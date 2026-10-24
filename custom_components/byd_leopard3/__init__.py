"""BYD Leopard 3: vehicle telemetry over a webhook (BYDMate, BYD EV Pro or any app)."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from datetime import timedelta
from pathlib import Path
from typing import Any

from aiohttp.web import Request, Response, json_response

from homeassistant.components import webhook
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.helpers.typing import ConfigType

from .const import (
    CARD_FILENAME,
    CONF_CAPACITY,
    CONF_FIELD_MAP,
    CONF_HISTORY_DAYS,
    CONF_MODEL,
    CONF_RECORD_TRIPS,
    CONF_SECRET,
    CONF_SOURCE,
    CONF_WEBHOOK_ID,
    DB_FILE,
    DEFAULT_HISTORY_DAYS,
    DEFAULT_MODEL,
    DOMAIN,
    MODELS,
    SIGNAL_NEW_KEYS,
    SIGNAL_TRIPS,
    SIGNAL_UPDATE,
    SAMPLE_EVERY_ACTIVE,
    SAMPLE_EVERY_IDLE,
    SOURCE_AUTO,
    STORAGE_VERSION,
    URL_BASE,
    VERSION,
)
from .db import HistoryDB
from .normalize import normalize
from .trips import TripRecorder, thin

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.SENSOR, Platform.BINARY_SENSOR, Platform.DEVICE_TRACKER]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

RECENT_TRIPS = 50         # newest trips kept in memory (the database has all of them)
SAVE_DELAY = 15           # s
FLUSH_EVERY = timedelta(seconds=30)
PURGE_EVERY = timedelta(hours=6)
DB_KEY = "_db"


class Vehicle:
    """Runtime state of one car: latest values, trip recorder, storage."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, db: HistoryDB) -> None:
        self.hass = hass
        self.entry = entry
        self.db = db
        self.store: Store = Store(hass, STORAGE_VERSION, f"{DOMAIN}.{entry.entry_id}")
        self.values: dict[str, Any] = {}
        self.last_update: float | None = None
        self.trips: list[dict[str, Any]] = []   # newest RECENT_TRIPS, without routes
        self.recorder = TripRecorder(self.capacity, on_finish=self._trip_finished)
        self._samples: list[tuple[float, dict[str, Any]]] = []
        self._sampled: dict[str, Any] = {}
        self._sampled_at = 0.0

    # -- options ----------------------------------------------------------------------------
    def opt(self, key: str, default: Any = None) -> Any:
        return self.entry.options.get(key, self.entry.data.get(key, default))

    @property
    def model(self) -> str:
        return self.opt(CONF_MODEL, DEFAULT_MODEL)

    @property
    def capacity(self) -> float:
        cap = self.opt(CONF_CAPACITY)
        return float(cap) if cap else MODELS.get(self.model, MODELS["other"])["capacity"]

    @property
    def history_days(self) -> int:
        return int(self.opt(CONF_HISTORY_DAYS, DEFAULT_HISTORY_DAYS) or 0)

    @property
    def field_map(self) -> dict[str, Any]:
        raw = self.opt(CONF_FIELD_MAP, "") or ""
        if isinstance(raw, dict):
            return raw
        try:
            return json.loads(raw) if raw.strip() else {}
        except ValueError:
            _LOGGER.warning("Field map for %s is not valid JSON, ignoring it", self.entry.title)
            return {}

    # -- storage ----------------------------------------------------------------------------
    async def async_load(self) -> None:
        data = await self.store.async_load() or {}
        self.values = data.get("values", {})
        self.last_update = data.get("last_update")
        self.recorder.load(data.get("recorder"))
        eid = self.entry.entry_id
        # Version 1.0 kept trips in .storage; move them into the database once.
        old = data.get("trips") or []
        if old and await self.hass.async_add_executor_job(self.db.trip_count, eid) == 0:
            for trip in old:
                await self.hass.async_add_executor_job(self.db.add_trip, eid, trip)
            _LOGGER.info("Moved %d trips of %s into %s", len(old), self.entry.title, DB_FILE)
        self.trips = await self.hass.async_add_executor_job(lambda: self.db.trips(eid, limit=RECENT_TRIPS))
        if old:
            self.schedule_save()

    def _data_to_save(self) -> dict[str, Any]:
        rec = self.recorder.dump()
        if rec.get("cur"):
            rec = {**rec, "cur": {**rec["cur"], "points": thin(rec["cur"]["points"], 3000)}}
        return {"values": self.values, "last_update": self.last_update, "recorder": rec}

    def schedule_save(self) -> None:
        self.store.async_delay_save(self._data_to_save, SAVE_DELAY)

    # -- packets ----------------------------------------------------------------------------
    @callback
    def handle(self, payload: dict[str, Any]) -> dict[str, Any]:
        canon = normalize(payload, self.opt(CONF_SOURCE, SOURCE_AUTO), self.field_map, now=time.time())
        if "capacity" not in canon and "capacity" not in self.values:
            canon["capacity"] = self.capacity
        new_keys = [k for k in canon if k not in self.values]
        # A parked ABRP packet has no speed; the car is standing still.
        if canon.get("is_parked") and "speed" not in canon:
            canon["speed"] = 0
        self.values.update(canon)
        self.last_update = time.time()
        self._sample(canon.get("utc", self.last_update))
        was_driving = self.recorder.cur is not None
        if self.opt(CONF_RECORD_TRIPS, True):
            self.recorder.capacity = self.capacity
            self.recorder.on_packet({**canon, "utc": canon.get("utc", self.last_update)})
        self.schedule_save()
        if new_keys:
            async_dispatcher_send(self.hass, SIGNAL_NEW_KEYS.format(self.entry.entry_id), new_keys)
        async_dispatcher_send(self.hass, SIGNAL_UPDATE.format(self.entry.entry_id))
        if was_driving != (self.recorder.cur is not None):
            async_dispatcher_send(self.hass, SIGNAL_TRIPS.format(self.entry.entry_id))
        return canon

    # -- long-term history --------------------------------------------------------------------
    @callback
    def _sample(self, ts: float) -> None:
        """Queue what changed since the last sample, at most every 10 s (moving/charging) or 60 s."""
        active = bool(self.values.get("is_charging")) or self.recorder.cur is not None
        if ts - self._sampled_at < (SAMPLE_EVERY_ACTIVE if active else SAMPLE_EVERY_IDLE):
            return
        diff = {k: v for k, v in self.values.items() if k != "utc" and self._sampled.get(k) != v}
        self._sampled_at = ts
        if diff:
            self._sampled.update(diff)
            self._samples.append((ts, diff))

    async def async_flush(self, *_: Any) -> None:
        batch, self._samples = self._samples, []
        if batch:
            await self.hass.async_add_executor_job(self.db.add_samples, self.entry.entry_id, batch)

    async def async_purge(self, *_: Any) -> None:
        if self.history_days > 0:
            await self.hass.async_add_executor_job(
                self.db.purge_samples, self.entry.entry_id, time.time() - self.history_days * 86400)

    @callback
    def _trip_finished(self, trip: dict[str, Any]) -> None:
        if trip["km"] < 0.05:
            return  # a few metres in the yard is not a trip
        self.hass.async_create_task(self._store_trip(trip))

    async def _store_trip(self, trip: dict[str, Any]) -> None:
        await self.hass.async_add_executor_job(self.db.add_trip, self.entry.entry_id, trip)
        self.trips.append({**{k: v for k, v in trip.items() if k != "points"}, "has_route": bool(trip.get("points"))})
        self.trips = self.trips[-RECENT_TRIPS:]
        async_dispatcher_send(self.hass, SIGNAL_TRIPS.format(self.entry.entry_id))

    def last_trip(self) -> dict[str, Any] | None:
        return self.trips[-1] if self.trips else None


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the Lovelace card and register the websocket API once."""
    from .websocket import async_register_websocket

    www = Path(__file__).parent / "www"
    await hass.http.async_register_static_paths([StaticPathConfig(URL_BASE, str(www), False)])
    if "frontend" in hass.config.components:
        from homeassistant.components.frontend import add_extra_js_url

        add_extra_js_url(hass, f"{URL_BASE}/{CARD_FILENAME}?v={VERSION}")
    async_register_websocket(hass)
    hass.data.setdefault(DOMAIN, {})
    return True


async def _async_db(hass: HomeAssistant) -> HistoryDB:
    """The shared history database, opened on first use and closed when HA stops."""
    data = hass.data.setdefault(DOMAIN, {})
    if DB_KEY not in data:
        db = HistoryDB(hass.config.path(DB_FILE))
        await hass.async_add_executor_job(db.open)
        data[DB_KEY] = db

        async def _close(_: Event) -> None:
            for v in list(hass.data.get(DOMAIN, {}).values()):
                if isinstance(v, Vehicle):
                    await v.async_flush()
            await hass.async_add_executor_job(db.close)

        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, _close)
    return data[DB_KEY]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    vehicle = Vehicle(hass, entry, await _async_db(hass))
    await vehicle.async_load()
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = vehicle
    entry.runtime_data = vehicle

    webhook.async_register(hass, DOMAIN, entry.title, entry.data[CONF_WEBHOOK_ID], _handle_webhook,
                           allowed_methods=["POST", "PUT"])
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    entry.async_on_unload(async_track_time_interval(hass, vehicle.async_flush, FLUSH_EVERY))
    entry.async_on_unload(async_track_time_interval(hass, vehicle.async_purge, PURGE_EVERY))
    hass.async_create_task(vehicle.async_purge())
    return True


async def _async_reload(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    webhook.async_unregister(hass, entry.data[CONF_WEBHOOK_ID])
    vehicle: Vehicle = hass.data[DOMAIN][entry.entry_id]
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if ok:
        await vehicle.async_flush()
        await vehicle.store.async_save(vehicle._data_to_save())
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return ok


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await Store(hass, STORAGE_VERSION, f"{DOMAIN}.{entry.entry_id}").async_remove()
    db = await _async_db(hass)
    await hass.async_add_executor_job(db.remove_entry, entry.entry_id)


def _authorized(secret: str, body: bytes, request: Request) -> bool:
    """Accept `Authorization: Bearer <secret>` (BYDMate) or an HMAC-SHA256 body signature."""
    auth = request.headers.get("Authorization", "")
    if auth[:7].lower() == "bearer " and hmac.compare_digest(auth[7:].strip().encode(), secret.encode()):
        return True
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, request.headers.get("X-Webhook-Signature", ""))


async def _handle_webhook(hass: HomeAssistant, webhook_id: str, request: Request) -> Response:
    vehicle = next((v for v in hass.data.get(DOMAIN, {}).values()
                    if isinstance(v, Vehicle) and v.entry.data.get(CONF_WEBHOOK_ID) == webhook_id), None)
    if vehicle is None:
        return json_response({"error": "unknown_webhook"}, status=404)
    body = await request.read()

    secret = vehicle.opt(CONF_SECRET, "")
    if secret and not _authorized(secret, body, request):
        return json_response({"error": "invalid_signature"}, status=403)

    try:
        payload = json.loads(body) if body else {}
    except ValueError:
        # Some ABRP-style senders put the JSON in a "tlm" query or form field.
        form = dict(request.query)
        if not form:
            try:
                form = dict(await request.post())
            except Exception:  # noqa: BLE001
                form = {}
        try:
            payload = json.loads(form["tlm"]) if "tlm" in form else form
        except ValueError:
            return json_response({"error": "invalid_json"}, status=400)
    if not isinstance(payload, dict):
        return json_response({"error": "expected_object"}, status=400)

    canon = vehicle.handle(payload)
    return json_response({"status": "ok", "keys": len(canon)})
