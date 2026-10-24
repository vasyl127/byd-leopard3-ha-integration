"""Websocket API used by the Lovelace card."""

from __future__ import annotations

import time
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er

from .const import CONF_OFFLINE_AFTER, DEFAULT_OFFLINE_AFTER, DOMAIN, MODELS


@callback
def async_register_websocket(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_vehicles)
    websocket_api.async_register_command(hass, ws_trips)
    websocket_api.async_register_command(hass, ws_trip)
    websocket_api.async_register_command(hass, ws_history)
    websocket_api.async_register_command(hass, ws_db_stats)


def _vehicles(hass: HomeAssistant) -> dict[str, Any]:
    from . import Vehicle

    return {k: v for k, v in hass.data.get(DOMAIN, {}).items() if isinstance(v, Vehicle)}


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/vehicles"})
@callback
def ws_vehicles(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """List configured cars with a map of canonical key -> entity_id."""
    reg = er.async_get(hass)
    out = []
    for entry_id, v in _vehicles(hass).items():
        entities = {}
        for ent in er.async_entries_for_config_entry(reg, entry_id):
            key = ent.unique_id.removeprefix(f"{entry_id}_")
            entities[key] = ent.entity_id
        out.append({
            "entry_id": entry_id, "title": v.entry.title, "model": v.model,
            "model_name": MODELS.get(v.model, MODELS["other"])["name"], "capacity": v.capacity,
            "offline_after": v.opt(CONF_OFFLINE_AFTER, DEFAULT_OFFLINE_AFTER), "entities": entities,
        })
    connection.send_result(msg["id"], out)


ROUTE_POINTS = 3000      # points sent to the card for one route
HISTORY_POINTS = 2000    # points per key for history charts


def _strip(t: dict[str, Any]) -> dict[str, Any]:
    return {k: val for k, val in t.items() if k != "points"} | {"has_route": bool(t.get("points"))}


def _get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]):
    v = _vehicles(hass).get(msg["entry_id"])
    if v is None:
        connection.send_error(msg["id"], "not_found", "Unknown vehicle")
    return v


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/trips",
    vol.Required("entry_id"): str,
    vol.Optional("days", default=7): vol.All(int, vol.Range(min=1, max=36500)),
})
@websocket_api.async_response
async def ws_trips(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Trips of the last N days from the database (without routes) plus the trip in progress."""
    v = _get(hass, connection, msg)
    if v is None:
        return
    since = time.time() - msg["days"] * 86400
    trips = await hass.async_add_executor_job(v.db.trips, v.entry.entry_id, since)
    live = v.recorder.live()
    connection.send_result(msg["id"], {"trips": trips, "live": _strip(live) if live else None})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/trip",
    vol.Required("entry_id"): str,
    vol.Required("trip_id"): str,
})
@websocket_api.async_response
async def ws_trip(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """One trip with its GPS points. trip_id "live" is the trip in progress."""
    v = _get(hass, connection, msg)
    if v is None:
        return
    if msg["trip_id"] == "live":
        trip = v.recorder.live()
    else:
        trip = await hass.async_add_executor_job(v.db.trip, v.entry.entry_id, msg["trip_id"], ROUTE_POINTS)
    if trip is None:
        connection.send_error(msg["id"], "not_found", "Unknown trip")
        return
    connection.send_result(msg["id"], trip)


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/history",
    vol.Required("entry_id"): str,
    vol.Required("keys"): [str],
    vol.Optional("start"): vol.Coerce(float),
    vol.Optional("end"): vol.Coerce(float),
    vol.Optional("max_points", default=HISTORY_POINTS): vol.All(int, vol.Range(min=10, max=20000)),
})
@websocket_api.async_response
async def ws_history(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Telemetry history from the database: {key: [[unix_ts, value], ...]} for numeric keys."""
    v = _get(hass, connection, msg)
    if v is None:
        return
    await v.async_flush()
    end = msg.get("end") or time.time()
    start = msg.get("start") or end - 86400
    data = await hass.async_add_executor_job(v.db.samples, v.entry.entry_id, msg["keys"], start, end, msg["max_points"])
    connection.send_result(msg["id"], data)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/db_stats", vol.Required("entry_id"): str})
@websocket_api.async_response
async def ws_db_stats(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """How much history the database holds for a car."""
    v = _get(hass, connection, msg)
    if v is None:
        return
    stats = await hass.async_add_executor_job(v.db.stats, v.entry.entry_id)
    connection.send_result(msg["id"], stats | {"history_days": v.history_days})
