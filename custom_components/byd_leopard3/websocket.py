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


def _strip(t: dict[str, Any]) -> dict[str, Any]:
    return {k: val for k, val in t.items() if k != "points"} | {"has_route": bool(t.get("points"))}


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/trips",
    vol.Required("entry_id"): str,
    vol.Optional("days", default=7): vol.All(int, vol.Range(min=1, max=3650)),
})
@callback
def ws_trips(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Trips of the last N days (without routes) plus the trip in progress."""
    v = _vehicles(hass).get(msg["entry_id"])
    if v is None:
        connection.send_error(msg["id"], "not_found", "Unknown vehicle")
        return
    since = time.time() - msg["days"] * 86400
    trips = [_strip(t) for t in v.trips if t["start"] >= since]
    live = v.recorder.live()
    connection.send_result(msg["id"], {"trips": trips, "live": _strip(live) if live else None})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/trip",
    vol.Required("entry_id"): str,
    vol.Required("trip_id"): str,
})
@callback
def ws_trip(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """One trip with its GPS points. trip_id "live" is the trip in progress."""
    v = _vehicles(hass).get(msg["entry_id"])
    if v is None:
        connection.send_error(msg["id"], "not_found", "Unknown vehicle")
        return
    if msg["trip_id"] == "live":
        trip = v.recorder.live()
    else:
        trip = next((t for t in reversed(v.trips) if t["id"] == msg["trip_id"]), None)
    if trip is None:
        connection.send_error(msg["id"], "not_found", "Unknown trip")
        return
    connection.send_result(msg["id"], trip)
