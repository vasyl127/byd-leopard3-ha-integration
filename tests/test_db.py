import math
import time

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.byd_leopard3.const import DOMAIN
from custom_components.byd_leopard3.db import HistoryDB

from .test_init import _setup


def _trip(i: int, n_points: int = 5000) -> dict:
    start = 1_800_000_000 + i * 3600
    pts = [{"t": start + k, "lat": 50.0, "lon": 30.0 + k / 1e4, "speed": 50} for k in range(n_points)]
    return {"id": str(start), "start": start, "end": start + n_points, "km": 10.0 + i, "kwh": 1.5, "per100": 15.0,
            "soc_start": 80, "soc_end": 78, "points": pts}


def test_db_trips_points_samples(tmp_path):
    db = HistoryDB(str(tmp_path / "h.db"))
    db.open()
    for i in range(3):
        db.add_trip("e1", _trip(i))
    db.add_trip("e2", _trip(9, 10))
    assert db.trip_count("e1") == 3
    trips = db.trips("e1")
    assert [t["km"] for t in trips] == [10.0, 11.0, 12.0] and all(t["has_route"] for t in trips)
    assert "points" not in trips[0] and trips[0]["per100"] == 15.0
    assert [t["km"] for t in db.trips("e1", limit=2)] == [11.0, 12.0]
    full = db.trip("e1", trips[0]["id"])
    assert len(full["points"]) == 5000                      # the full route is kept
    assert len(db.trip("e1", trips[0]["id"], max_points=800)["points"]) == 800
    assert db.trip("e1", "nope") is None

    now = time.time()
    db.add_samples("e1", [(now - 10 * 86400, {"soc": 50}), (now - 60, {"soc": 60, "is_charging": True}),
                          (now, {"speed": 12, "climate": "on"})])
    h = db.samples("e1", ["soc", "speed", "is_charging", "climate"], now - 20 * 86400, now + 1)
    assert [v for _, v in h["soc"]] == [50, 60] and h["speed"][0][1] == 12
    assert h["is_charging"][0][1] == 1 and h["climate"] == []
    assert db.purge_samples("e1", now - 86400) == 1
    assert db.stats("e1")["samples"] == 2

    db.remove_entry("e1")
    assert db.trip_count("e1") == 0 and db.trip_count("e2") == 1
    db.close()


async def _drive(client, url, t0=1_800_000_000):
    t, lon, odo = t0, 30.0, 8100.0

    async def send(**p):
        r = await client.post(url, json={"utc": t, "soc": 60, "odometer": odo, "power": 8, **p})
        assert r.status == 200
    for _ in range(3):
        await send(speed=0, is_parked=1, lat=50.0, lon=lon); t += 30
    for _ in range(1200):   # 20 minutes at 60 km/h: more points than the old 800-point cap
        odo += 60 / 3600; lon += 60 / 3600 / (111.32 * math.cos(math.radians(50)))
        await send(speed=60, is_parked=0, lat=50.0, lon=lon); t += 1
    for _ in range(8):
        await send(is_parked=1, lat=50.0, lon=lon); t += 30


async def test_trips_survive_reload_and_history(hass: HomeAssistant, hass_client_no_auth, hass_ws_client):
    entry = await _setup(hass)
    client = await hass_client_no_auth()
    url = f"/api/webhook/{entry.data['webhook_id']}"
    await _drive(client, url)
    await hass.async_block_till_done()

    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()

    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": f"{DOMAIN}/trips", "entry_id": entry.entry_id, "days": 36500})
    trips = (await ws.receive_json())["result"]["trips"]
    assert len(trips) == 1 and trips[0]["km"] == 20.0 and trips[0]["has_route"]
    await ws.send_json({"id": 2, "type": f"{DOMAIN}/trip", "entry_id": entry.entry_id, "trip_id": trips[0]["id"]})
    assert len((await ws.receive_json())["result"]["points"]) > 800

    await ws.send_json({"id": 3, "type": f"{DOMAIN}/history", "entry_id": entry.entry_id, "keys": ["speed", "odometer"],
                        "start": 1_799_999_000, "end": 1_800_002_000})
    hist = (await ws.receive_json())["result"]
    # Samples every 10 s while driving, only when a value changed.
    assert 100 <= len(hist["odometer"]) <= 130 and hist["speed"][1][1] == 60
    await ws.send_json({"id": 4, "type": f"{DOMAIN}/db_stats", "entry_id": entry.entry_id})
    stats = (await ws.receive_json())["result"]
    assert stats["trips"] == 1 and stats["points"] > 800 and stats["history_days"] == 365

    # The last-trip sensor is restored from the database after the reload.
    reg = er.async_get(hass)
    ids = {e.unique_id.split("_", 1)[1]: e.entity_id for e in er.async_entries_for_config_entry(reg, entry.entry_id)}
    assert float(hass.states.get(ids["last_trip"]).state) == 20.0


async def test_trips_from_storage_are_migrated(hass: HomeAssistant, hass_storage, hass_ws_client):
    entry = MockConfigEntry(domain=DOMAIN, title="Leopard 3", data={"webhook_id": "byd_leopard3_x", "model": "leopard3",
                                                                     "source": "auto", "field_map": ""})
    old = [_trip(i, 50) for i in range(2)]
    hass_storage[f"{DOMAIN}.{entry.entry_id}"] = {"version": 1, "key": f"{DOMAIN}.{entry.entry_id}",
                                                  "data": {"values": {"soc": 70}, "trips": old}}
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": f"{DOMAIN}/trips", "entry_id": entry.entry_id, "days": 36500})
    trips = (await ws.receive_json())["result"]["trips"]
    assert [t["id"] for t in trips] == [t["id"] for t in old]
