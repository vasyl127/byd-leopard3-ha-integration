"""Trip detection and trip statistics, ported from BYDMate.

Sources in https://github.com/AndyShaman/BYDMate:
- start/stop detection: domain/tracker/TripTracker.kt
- energy plausibility:  data/local/TripEnergySanity.kt
- moving time:          ui/trips/TripDetailStats.kt

Pure Python, no Home Assistant imports. Timestamps are unix seconds.
"""

from __future__ import annotations

import math
from typing import Any, Callable

SPEED_THRESHOLD = 3          # km/h
START_DELAY = 5.0            # s above threshold before a trip starts
STOP_DELAY = 180.0           # s at zero before a trip ends
MAX_GAP = 120.0              # s; longer silences are GPS/data gaps, not driving
MAX_PLAUSIBLE_TRIP_KM = 1500.0
MAX_KWH_PER_100KM = 150.0
MIN_KM_FOR_PER100_RULE = 5.0
MAX_KWH_PER_TRIP = 500.0
MAX_POINTS_STORED = 800


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat, dlon = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def energy_is_plausible(kwh: float, km: float | None) -> bool:
    if not math.isfinite(kwh) or kwh < 0 or kwh > MAX_KWH_PER_TRIP:
        return False
    if (km or 0) >= MIN_KM_FOR_PER100_RULE and kwh / km * 100 > MAX_KWH_PER_100KM:
        return False
    return True


def energy_for(kwh: float, km: float | None, soc_start: float | None, soc_end: float | None,
               capacity: float) -> float | None:
    """Raw kWh when plausible, else the SOC-delta estimate, else None."""
    if energy_is_plausible(kwh, km):
        return kwh
    if capacity > 0 and soc_start is not None and soc_end is not None and soc_start > soc_end:
        return (soc_start - soc_end) / 100 * capacity
    return None


def moving_time(points: list[dict[str, Any]], start: float, end: float | None) -> float | None:
    """Seconds spent moving: intervals starting at a point with speed >= 1, skipping gaps."""
    if end is None or len(points) < 4:
        return None
    moving = 0.0
    for a, b in zip(points, points[1:]):
        dt = b["t"] - a["t"]
        if dt > MAX_GAP:
            continue
        if (a.get("speed") or 0) >= 1:
            moving += dt
    return moving if 0 < moving <= end - start else None


def thin(points: list[dict[str, Any]], limit: int = MAX_POINTS_STORED) -> list[dict[str, Any]]:
    """Keep the first and last point and an even spread in between."""
    if len(points) <= limit:
        return points
    step = (len(points) - 1) / (limit - 1)
    return [points[round(i * step)] for i in range(limit)]


class TripRecorder:
    """Feed it canonical packets (see normalize.py); it calls on_finish with each trip."""

    def __init__(self, capacity: float, on_finish: Callable[[dict[str, Any]], None] | None = None) -> None:
        self.capacity = capacity
        self.on_finish = on_finish
        self.state = "idle"
        self.cur: dict[str, Any] | None = None
        self._above_since: float | None = None
        self._zero_since: float | None = None
        self._pre: list[dict[str, Any]] = []
        self._prev: dict[str, Any] | None = None
        self._before: dict[str, Any] | None = None

    # -- persistence -------------------------------------------------------------------------
    def dump(self) -> dict[str, Any]:
        return {"state": self.state, "cur": self.cur, "zero_since": self._zero_since, "prev": self._prev}

    def load(self, data: dict[str, Any] | None) -> None:
        if not data:
            return
        self.state = data.get("state", "idle")
        self.cur = data.get("cur")
        self._zero_since = data.get("zero_since")
        self._prev = data.get("prev")
        if self.state == "driving" and not self.cur:
            self.state = "idle"

    # -- packets -----------------------------------------------------------------------------
    def on_packet(self, p: dict[str, Any]) -> None:
        now = p["utc"]
        speed = p.get("speed") or 0
        # A long silence while driving (car switched off, no network) closes the trip.
        if self.state == "driving" and self.cur and now - self.cur["last"]["utc"] > STOP_DELAY:
            self.finish(self._zero_since or self.cur["last"]["utc"])
        if self.state == "idle":
            if speed > SPEED_THRESHOLD:
                if self._above_since is None:
                    self._above_since = now
                    self._pre = []
                    self._before = self._prev   # last packet before the car moved
                self._pre.append(p)
                if now - self._above_since >= START_DELAY:
                    self._start()
            else:
                self._above_since = None
                self._pre = []
        else:
            self._record(p)
            if speed == 0:
                if self._zero_since is None:
                    self._zero_since = now
                elif now - self._zero_since >= STOP_DELAY:
                    self.finish(self._zero_since)
            else:
                self._zero_since = None
        self._prev = p

    def _start(self) -> None:
        first = self._pre[0]
        before = self._before or first
        self.state = "driving"
        self.cur = {
            "start": first["utc"], "soc_start": before.get("soc"), "odo_start": before.get("odometer"),
            "ext_start": before.get("ext_temp"), "points": [], "kwh": 0.0, "batt": [], "last": before,
            "start_lat": before.get("lat"), "start_lon": before.get("lon"),
        }
        pre, self._pre = self._pre, []
        self._above_since = None
        self._zero_since = None
        for p in pre:
            self._record(p)

    def _record(self, p: dict[str, Any]) -> None:
        c = self.cur
        assert c is not None
        if p.get("lat") is not None and p.get("lon") is not None:
            c["points"].append({"t": p["utc"], "lat": p["lat"], "lon": p["lon"], "speed": p.get("speed") or 0})
        last = c["last"]
        dt = p["utc"] - last["utc"]
        if 0 < dt <= MAX_GAP and last.get("power") is not None:
            c["kwh"] += last["power"] * dt / 3600
        if p.get("batt_temp") is not None:
            c["batt"].append(p["batt_temp"])
        # Carry values the packet left out, so the end-of-trip summary has them.
        c["last"] = {**last, **{k: v for k, v in p.items() if v is not None}}

    def summary(self, c: dict[str, Any], end: float) -> dict[str, Any]:
        pts = [pt for pt in c["points"] if pt["t"] <= end]
        last = c["last"]
        gps_km = sum(haversine_km(a["lat"], a["lon"], b["lat"], b["lon"]) for a, b in zip(pts, pts[1:]))
        odo_km = None
        if last.get("odometer") is not None and c.get("odo_start") is not None:
            odo_km = last["odometer"] - c["odo_start"]
        km = odo_km if odo_km is not None and 0 <= odo_km <= MAX_PLAUSIBLE_TRIP_KM and (odo_km > 0 or not pts) else gps_km
        kwh = energy_for(c["kwh"], km, c.get("soc_start"), last.get("soc"), self.capacity)
        moving = moving_time(pts, c["start"], end)
        batt = c["batt"]
        return {
            "id": str(int(c["start"])),
            "start": c["start"], "end": end, "km": round(km, 2),
            "kwh": None if kwh is None else round(kwh, 3),
            "per100": None if kwh is None or not km else round(kwh / km * 100, 2),
            "soc_start": c.get("soc_start"), "soc_end": last.get("soc"),
            "ext_start": c.get("ext_start"), "ext_end": last.get("ext_temp"),
            "moving_s": moving, "avg_speed": round(km / (moving / 3600), 1) if moving else None,
            "batt_avg": round(sum(batt) / len(batt), 1) if batt else None,
            "batt_min": min(batt) if batt else None, "batt_max": max(batt) if batt else None,
            "start_lat": pts[0]["lat"] if pts else c.get("start_lat"),
            "start_lon": pts[0]["lon"] if pts else c.get("start_lon"),
            "end_lat": pts[-1]["lat"] if pts else None, "end_lon": pts[-1]["lon"] if pts else None,
            "points": thin(pts),
        }

    def finish(self, end: float) -> dict[str, Any] | None:
        if not self.cur:
            self.state = "idle"
            return None
        trip = self.summary(self.cur, end)
        self.cur = None
        self.state = "idle"
        self._zero_since = None
        if self.on_finish:
            self.on_finish(trip)
        return trip

    def live(self) -> dict[str, Any] | None:
        if not self.cur:
            return None
        return {**self.summary(self.cur, self.cur["last"]["utc"]), "live": True}
