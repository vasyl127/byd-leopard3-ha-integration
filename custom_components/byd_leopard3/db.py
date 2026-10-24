"""Long-term history in a local SQLite database: trips, full GPS routes and telemetry samples.

One file (`byd_leopard3.db` in the Home Assistant config dir) holds every car. All methods are
blocking and must run in the executor; a lock keeps the single connection thread-safe.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS trips (
    entry_id TEXT NOT NULL,
    id TEXT NOT NULL,
    start REAL NOT NULL,
    end REAL,
    km REAL,
    kwh REAL,
    data TEXT NOT NULL,
    PRIMARY KEY (entry_id, id)
);
CREATE INDEX IF NOT EXISTS trips_start ON trips (entry_id, start);
CREATE TABLE IF NOT EXISTS points (
    entry_id TEXT NOT NULL,
    trip_id TEXT NOT NULL,
    t REAL NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    speed REAL
);
CREATE INDEX IF NOT EXISTS points_trip ON points (entry_id, trip_id, t);
CREATE TABLE IF NOT EXISTS samples (
    entry_id TEXT NOT NULL,
    t REAL NOT NULL,
    data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS samples_t ON samples (entry_id, t);
"""

# Columns kept out of the JSON blob of a trip.
_TRIP_COLS = ("id", "start", "end", "km", "kwh", "points")


def thin(points: list[Any], limit: int) -> list[Any]:
    if limit <= 1 or len(points) <= limit:
        return points
    step = (len(points) - 1) / (limit - 1)
    return [points[round(i * step)] for i in range(limit)]


class HistoryDB:
    def __init__(self, path: str) -> None:
        self.path = path
        self._lock = threading.Lock()
        self._conn: sqlite3.Connection | None = None

    # -- connection --------------------------------------------------------------------------
    def open(self) -> None:
        with self._lock:
            if self._conn is not None:
                return
            conn = sqlite3.connect(self.path, check_same_thread=False, timeout=30)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.executescript(SCHEMA)
            conn.commit()
            self._conn = conn

    def close(self) -> None:
        with self._lock:
            if self._conn is not None:
                self._conn.close()
                self._conn = None

    def _c(self) -> sqlite3.Connection:
        if self._conn is None:
            raise RuntimeError("database is not open")
        return self._conn

    # -- trips -------------------------------------------------------------------------------
    def add_trip(self, entry_id: str, trip: dict[str, Any]) -> None:
        extra = {k: v for k, v in trip.items() if k not in _TRIP_COLS}
        pts = trip.get("points") or []
        with self._lock:
            c = self._c()
            c.execute(
                "INSERT OR REPLACE INTO trips (entry_id, id, start, end, km, kwh, data) VALUES (?,?,?,?,?,?,?)",
                (entry_id, trip["id"], trip["start"], trip.get("end"), trip.get("km"), trip.get("kwh"), json.dumps(extra)),
            )
            c.execute("DELETE FROM points WHERE entry_id=? AND trip_id=?", (entry_id, trip["id"]))
            c.executemany(
                "INSERT INTO points (entry_id, trip_id, t, lat, lon, speed) VALUES (?,?,?,?,?,?)",
                [(entry_id, trip["id"], p["t"], p["lat"], p["lon"], p.get("speed")) for p in pts],
            )
            c.commit()

    def trip_count(self, entry_id: str) -> int:
        with self._lock:
            return self._c().execute("SELECT COUNT(*) FROM trips WHERE entry_id=?", (entry_id,)).fetchone()[0]

    @staticmethod
    def _row(row: tuple, has_route: bool | None = None) -> dict[str, Any]:
        tid, start, end, km, kwh, data = row
        trip = {"id": tid, "start": start, "end": end, "km": km, "kwh": kwh, **json.loads(data)}
        if has_route is not None:
            trip["has_route"] = has_route
        return trip

    def trips(self, entry_id: str, since: float = 0, until: float | None = None,
              limit: int | None = None) -> list[dict[str, Any]]:
        """Trips without points, oldest first, with `has_route`."""
        q = ("SELECT t.id, t.start, t.end, t.km, t.kwh, t.data, "
             "EXISTS(SELECT 1 FROM points p WHERE p.entry_id=t.entry_id AND p.trip_id=t.id) "
             "FROM trips t WHERE t.entry_id=? AND t.start>=?")
        args: list[Any] = [entry_id, since]
        if until is not None:
            q += " AND t.start<?"
            args.append(until)
        q += " ORDER BY t.start DESC"
        if limit:
            q += " LIMIT ?"
            args.append(limit)
        with self._lock:
            rows = self._c().execute(q, args).fetchall()
        return [self._row(r[:6], bool(r[6])) for r in reversed(rows)]

    def trip(self, entry_id: str, trip_id: str, max_points: int = 0) -> dict[str, Any] | None:
        with self._lock:
            c = self._c()
            row = c.execute("SELECT id, start, end, km, kwh, data FROM trips WHERE entry_id=? AND id=?",
                            (entry_id, trip_id)).fetchone()
            if row is None:
                return None
            pts = c.execute("SELECT t, lat, lon, speed FROM points WHERE entry_id=? AND trip_id=? ORDER BY t",
                            (entry_id, trip_id)).fetchall()
        trip = self._row(row)
        trip["points"] = [{"t": t, "lat": lat, "lon": lon, "speed": sp} for t, lat, lon, sp in thin(pts, max_points)]
        return trip

    # -- telemetry samples -------------------------------------------------------------------
    def add_samples(self, entry_id: str, samples: list[tuple[float, dict[str, Any]]]) -> None:
        if not samples:
            return
        with self._lock:
            c = self._c()
            c.executemany("INSERT INTO samples (entry_id, t, data) VALUES (?,?,?)",
                          [(entry_id, t, json.dumps(d)) for t, d in samples])
            c.commit()

    def samples(self, entry_id: str, keys: list[str], start: float, end: float,
                max_points: int = 0) -> dict[str, list[list[float]]]:
        """Per key: [[t, value], ...] for numeric values in [start, end]."""
        with self._lock:
            rows = self._c().execute(
                "SELECT t, data FROM samples WHERE entry_id=? AND t>=? AND t<=? ORDER BY t",
                (entry_id, start, end)).fetchall()
        out: dict[str, list[list[float]]] = {k: [] for k in keys}
        for t, data in rows:
            d = json.loads(data)
            for k in keys:
                v = d.get(k)
                if isinstance(v, bool):
                    v = int(v)
                if isinstance(v, (int, float)):
                    out[k].append([t, v])
        return {k: thin(v, max_points) for k, v in out.items()}

    # -- housekeeping ------------------------------------------------------------------------
    def purge_samples(self, entry_id: str, before: float) -> int:
        with self._lock:
            c = self._c()
            n = c.execute("DELETE FROM samples WHERE entry_id=? AND t<?", (entry_id, before)).rowcount
            c.commit()
            return n

    def remove_entry(self, entry_id: str) -> None:
        with self._lock:
            c = self._c()
            for table in ("trips", "points", "samples"):
                c.execute(f"DELETE FROM {table} WHERE entry_id=?", (entry_id,))  # noqa: S608 - fixed names
            c.commit()

    def stats(self, entry_id: str) -> dict[str, Any]:
        with self._lock:
            c = self._c()
            trips = c.execute("SELECT COUNT(*), MIN(start) FROM trips WHERE entry_id=?", (entry_id,)).fetchone()
            pts = c.execute("SELECT COUNT(*) FROM points WHERE entry_id=?", (entry_id,)).fetchone()[0]
            smp = c.execute("SELECT COUNT(*), MIN(t) FROM samples WHERE entry_id=?", (entry_id,)).fetchone()
        return {"trips": trips[0], "first_trip": trips[1], "points": pts, "samples": smp[0], "first_sample": smp[1]}
