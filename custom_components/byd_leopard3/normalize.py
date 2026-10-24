"""Turn any supported webhook payload into one flat set of canonical keys.

Pure Python on purpose: no Home Assistant imports, so it is unit-testable on its own.

Canonical keys (units): soc %, soh %, range km, power kW (negative = charging), voltage V,
current A (negative = charging), batt_temp / batt_temp_min / batt_temp_max °C, capacity kWh,
kwh_charged kWh, speed km/h, odometer km, cabin_temp / ext_temp / hvac_setpoint °C,
aux_voltage V, cell_max_v / cell_min_v V, front_motor_temp / rear_motor_temp °C, motor_rpm,
tyre_pressure_{fl,fr,rl,rr} bar, tyre_temp_* °C, tyre_state_* (normal|low|high),
is_charging / is_dcfc / is_parked (bool), charging_gun (disconnected|ac|dc),
vehicle_state, climate (on|off), fan_speed, seat_heat (off|level_1|level_2),
steering_heat (off|on), lock_* (locked|unlocked), door_* / hood / trunk (open|closed),
window_* %, sunroof / sunshade (not_equipped|closed|open|opening|closing),
lat, lon, heading, utc (unix seconds).
"""

from __future__ import annotations

import time
from typing import Any

WHEELS = ("fl", "fr", "rl", "rr")
BOOL_KEYS = {"is_charging", "is_dcfc", "is_parked"}
NUMERIC_KEYS = {
    "soc", "soh", "range", "power", "voltage", "current", "batt_temp", "batt_temp_min",
    "batt_temp_max", "capacity", "kwh_charged", "speed", "odometer", "cabin_temp", "ext_temp",
    "hvac_setpoint", "aux_voltage", "cell_max_v", "cell_min_v", "front_motor_temp",
    "rear_motor_temp", "motor_rpm", "lat", "lon", "heading", "utc", "sunroof_pos",
    *(f"tyre_pressure_{w}" for w in WHEELS), *(f"tyre_temp_{w}" for w in WHEELS),
    *(f"window_{w}" for w in WHEELS),
}
TEXT_KEYS = {
    "charging_gun", "vehicle_state", "climate", "fan_speed", "seat_heat", "steering_heat",
    "hood", "trunk", "sunroof", "sunshade",
    *(f"tyre_state_{w}" for w in WHEELS), *(f"lock_{w}" for w in WHEELS), *(f"door_{w}" for w in WHEELS),
}
CANONICAL_KEYS = BOOL_KEYS | NUMERIC_KEYS | TEXT_KEYS

# Iternio / ABRP telemetry (BYDMate sends this). Same names except where listed.
ABRP_RENAME = {
    "est_battery_range": "range", "tire_pressure_fl": "tyre_pressure_fl", "tire_pressure_fr": "tyre_pressure_fr",
    "tire_pressure_rl": "tyre_pressure_rl", "tire_pressure_rr": "tyre_pressure_rr",
    "elevation": None, "car_model": None, "hvac_power": None,
}

# BYD EV Pro: wheel suffixes use lf/rf/lr/rr, many keys are named differently, states are ints.
EV_PRO_RENAME = {
    "battery_soc": "soc", "battery_health": "soh", "battery_voltage": "voltage",
    "battery_current": "current", "battery_power": "power", "aux_voltage": "aux_voltage",
    "cell_max_voltage": "cell_max_v", "cell_min_voltage": "cell_min_v", "cabin_temp": "cabin_temp",
    "outside_temp": "ext_temp", "battery_max_temp": "batt_temp_max", "battery_min_temp": "batt_temp_min",
    "front_motor_temp": "front_motor_temp", "rear_motor_temp": "rear_motor_temp", "range": "range",
    "odometer": "odometer", "speed": "speed", "driver_temp_set": "hvac_setpoint",
    "front_motor_rpm": "motor_rpm", "door_hood": "hood", "trunk_open": "trunk", "sunroof_pos": "sunroof_pos",
}
EV_PRO_WHEEL = {"lf": "fl", "rf": "fr", "lr": "rl", "rr": "rr"}
EV_PRO_VEHICLE_STATE = {0: "off", 1: "on", 2: "on", 3: "remote_on", 4: "smart_charge", 5: "press_startup",
                        6: "bt_on", 7: "disinfect", 8: "exhibition", 9: "exhibition"}
EV_PRO_GUN = {0: "disconnected", 1: "disconnected", 2: "ac", 3: "dc"}
EV_PRO_SEAT = {0: "off", 1: "off", 2: "level_1", 3: "level_2"}
EV_PRO_WHEEL_HEAT = {0: "off", 1: "off", 2: "on"}
EV_PRO_LOCK = {1: "unlocked", 2: "locked"}
EV_PRO_OPEN = {0: "closed", 1: "open"}
EV_PRO_TYRE = {0: "normal", 1: "low", 2: "high"}
EV_PRO_ROOF = {0: "not_equipped", 1: "open", 2: "closing", 3: "opening"}


def detect_source(payload: dict[str, Any]) -> str:
    """Guess the payload format."""
    if isinstance(payload.get("sensors"), dict) or isinstance(payload.get("location"), dict):
        return "byd_ev_pro"
    if isinstance(payload.get("tlm"), dict) or "soc" in payload and "utc" in payload:
        return "abrp"
    return "generic"


def _num(v: Any) -> float | None:
    if v is None or isinstance(v, bool):
        return float(v) if isinstance(v, bool) else None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f else None  # drop NaN


def _int(v: Any) -> int | None:
    f = _num(v)
    return None if f is None else int(f)


def _bool(v: Any) -> bool | None:
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        s = v.strip().lower()
        if s in ("1", "true", "on", "yes"):
            return True
        if s in ("0", "false", "off", "no"):
            return False
        return None
    f = _num(v)
    return None if f is None else f != 0


def _get_path(obj: Any, path: str) -> Any:
    for part in path.split("."):
        if isinstance(obj, dict) and part in obj:
            obj = obj[part]
        elif isinstance(obj, list) and part.isdigit() and int(part) < len(obj):
            obj = obj[int(part)]
        else:
            return None
    return obj


def _from_abrp(p: dict[str, Any]) -> dict[str, Any]:
    p = p.get("tlm", p) if isinstance(p.get("tlm"), dict) else p
    out: dict[str, Any] = {}
    for k, v in p.items():
        key = ABRP_RENAME.get(k, k)
        if key:
            out[key] = v
    # ABRP has no explicit "speed absent" value; a parked packet simply omits it.
    if "speed" not in out and _bool(out.get("is_parked")):
        out["speed"] = 0
    return out


def _from_ev_pro(p: dict[str, Any]) -> dict[str, Any]:
    s = p.get("sensors") or {}
    out: dict[str, Any] = {}
    for k, v in s.items():
        if k in EV_PRO_RENAME:
            out[EV_PRO_RENAME[k]] = v
            continue
        for src, dst in EV_PRO_WHEEL.items():
            if k.endswith("_" + src):
                stem = k[: -len(src) - 1]
                if stem in ("tyre_pressure", "tyre_temp"):
                    out[f"{stem}_{dst}"] = v
                elif stem == "tyre_state":
                    out[f"tyre_state_{dst}"] = EV_PRO_TYRE.get(_int(v), None)
                elif stem == "lock":
                    out[f"lock_{dst}"] = EV_PRO_LOCK.get(_int(v), None)
                elif stem == "door":
                    out[f"door_{dst}"] = EV_PRO_OPEN.get(_int(v), None)
                elif stem == "window" or k.startswith("window_"):
                    pass
                break
        if k.startswith("window_") and k.endswith("_pos"):
            out[f"window_{EV_PRO_WHEEL.get(k[7:9], k[7:9])}"] = v
    if "vehicle_state" in s:
        out["vehicle_state"] = EV_PRO_VEHICLE_STATE.get(_int(s["vehicle_state"]), str(s["vehicle_state"]))
    if "charging_gun" in s:
        out["charging_gun"] = EV_PRO_GUN.get(_int(s["charging_gun"]), "disconnected")
    if "charging_state" in s:
        out["is_charging"] = _int(s["charging_state"]) == 1
    if "ac_power" in s:
        out["climate"] = "on" if _int(s["ac_power"]) == 1 else "off"
    if "fan_speed" in s:
        out["fan_speed"] = str(s["fan_speed"])
    if "driver_seat_heat" in s:
        out["seat_heat"] = EV_PRO_SEAT.get(_int(s["driver_seat_heat"]), "off")
    if "steering_heat" in s:
        out["steering_heat"] = EV_PRO_WHEEL_HEAT.get(_int(s["steering_heat"]), "off")
    for key in ("hood", "trunk"):
        if key in out:
            out[key] = EV_PRO_OPEN.get(_int(out[key]), None)
    if "sunroof_state" in s:
        out["sunroof"] = EV_PRO_ROOF.get(_int(s["sunroof_state"]), None)
    if "sunshade_state" in s:
        out["sunshade"] = EV_PRO_ROOF.get(_int(s["sunshade_state"]), None)
    # Charging power is reported as a positive number; canonical power is negative while charging.
    if out.get("is_charging") and _num(s.get("charging_power_dd")) is not None:
        out["power"] = -abs(_num(s["charging_power_dd"]))
    if out.get("is_charging") and out.get("charging_gun") == "dc":
        out["is_dcfc"] = True
    elif "is_charging" in out:
        out["is_dcfc"] = False
    loc = p.get("location") or {}
    if "latitude" in loc:
        out["lat"] = loc["latitude"]
    if "longitude" in loc:
        out["lon"] = loc["longitude"]
    if "heading" in loc:
        out["heading"] = loc["heading"]
    return out


def _from_custom(p: dict[str, Any], field_map: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, spec in (field_map or {}).items():
        if isinstance(spec, str):
            spec = {"path": spec}
        if not isinstance(spec, dict) or "path" not in spec:
            continue
        v = _get_path(p, str(spec["path"]))
        if v is None:
            continue
        if "scale" in spec or "offset" in spec:
            f = _num(v)
            if f is None:
                continue
            v = f * float(spec.get("scale", 1)) + float(spec.get("offset", 0))
        if "map" in spec and isinstance(spec["map"], dict):
            v = spec["map"].get(str(v), v)
        out[key] = v
    return out


def normalize(payload: dict[str, Any], source: str = "auto", field_map: dict[str, Any] | None = None,
              now: float | None = None) -> dict[str, Any]:
    """Return canonical values found in the payload. Unknown keys are dropped."""
    if not isinstance(payload, dict):
        return {}
    src = detect_source(payload) if source == "auto" else source
    if src == "abrp":
        raw = _from_abrp(payload)
    elif src == "byd_ev_pro":
        raw = _from_ev_pro(payload)
    elif src == "custom":
        raw = _from_custom(payload, field_map or {})
    else:
        raw = dict(payload)
    if field_map and src != "custom":
        raw.update(_from_custom(payload, field_map))  # a field map can patch any source

    out: dict[str, Any] = {}
    for k, v in raw.items():
        if k not in CANONICAL_KEYS or v is None:
            continue
        if k in BOOL_KEYS:
            b = _bool(v)
            if b is not None:
                out[k] = b
        elif k in NUMERIC_KEYS:
            f = _num(v)
            if f is not None:
                out[k] = f
        else:
            out[k] = str(v).strip().lower().replace(" ", "_")

    # Tyre pressure: ABRP says bar, BYDMate actually sends kPa (267). Anything above 20 is kPa.
    for w in WHEELS:
        k = f"tyre_pressure_{w}"
        if k in out and out[k] > 20:
            out[k] = round(out[k] / 100, 2)
    # Battery temperature: fall back to the min/max mean when only the pair is sent.
    if "batt_temp" not in out and "batt_temp_min" in out and "batt_temp_max" in out:
        out["batt_temp"] = round((out["batt_temp_min"] + out["batt_temp_max"]) / 2, 1)
    # Parked: when the app does not say, a stopped car with no gear info counts as parked.
    if "is_parked" not in out and "speed" in out:
        out["is_parked"] = out["speed"] == 0
    if out.get("is_charging") is False:
        out.setdefault("is_dcfc", False)
    # utc: accept milliseconds, default to receive time.
    if "utc" in out and out["utc"] > 1e11:
        out["utc"] = out["utc"] / 1000
    out.setdefault("utc", now if now is not None else time.time())
    return out
