"""Build dev/trips.json: sample trips made by feeding simulated packets through the real TripRecorder."""
import json, math, random, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "custom_components" / "byd_leopard3"))
from trips import TripRecorder, haversine_km  # noqa: E402

routes = json.loads((Path(__file__).parent / "routes.json").read_text())
PLAN = [("home-okko", 2, 14, 5, 52, 11), ("okko-home", 2, 15, 20, 80, 10), ("home-irpin", 1, 10, 12, None, 9),
        ("irpin-home", 1, 17, 40, None, 7), ("home-office", 0, 8, 31, None, 6), ("office-ocean", 0, 13, 2, None, 9),
        ("ocean-home", 0, 14, 10, None, 9)]
trips = []
rec = TripRecorder(72.9, trips.append)
rnd = random.Random(7)
soc, odo = 52.0, 7962.4
for route, ago, h, m, soc0, ext in PLAN:
    if soc0: soc = soc0
    lt = time.localtime(); day = time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday - ago, h, m, 0, 0, 0, -1))
    pts = routes[route]["pts"]; cum = [0.0]
    for a, b in zip(pts, pts[1:]): cum.append(cum[-1] + haversine_km(a[0], a[1], b[0], b[1]))
    hw = "irpin" in route or "okko" in route
    t, d, v, target, stop, nxt, kwh = day, 0.0, 0.0, 35, 0, 1.0, 0.0
    for k in range(4): rec.on_packet({"utc": t - (4 - k) * 30, "speed": 0, "soc": soc, "odometer": odo, "power": 0.3, "lat": pts[0][0], "lon": pts[0][1], "ext_temp": ext})
    i = 1
    while d < cum[-1]:
        if stop > 0:
            v = max(0, v - 9); stop -= v == 0
        else:
            if d > nxt and cum[-1] - d > 0.6: stop, nxt = 12 + rnd.randint(0, 35), d + (3 if hw else 0.9) + rnd.random() * (6 if hw else 2.5)
            if rnd.random() < 0.03: target = 45 + rnd.random() * 65 if hw else 22 + rnd.random() * 38
            v = max(0, v + max(-7, min(3.5, target - v)))
        d = min(cum[-1], d + v / 3600)
        p = 0.9 + v * 0.07 + v * v * 0.0019 if v else 0.6; kwh += p / 3600
        while i < len(cum) - 1 and cum[i] < d: i += 1
        f = (d - cum[i - 1]) / ((cum[i] - cum[i - 1]) or 1)
        lat = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f; lon = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f
        rec.on_packet({"utc": t, "speed": round(v), "soc": round(soc - kwh / 72.9 * 100), "odometer": odo + d, "power": p,
                       "lat": lat, "lon": lon, "ext_temp": ext, "batt_temp": round(ext + 4 + d / 6)})
        t += 1
    for k in range(9): rec.on_packet({"utc": t + k * 30, "speed": 0, "soc": round(soc - kwh / 72.9 * 100), "odometer": odo + d, "power": 0.3, "lat": pts[-1][0], "lon": pts[-1][1]})
    soc, odo = round(soc - kwh / 72.9 * 100), odo + d
(Path(__file__).parent / "trips.json").write_text(json.dumps(trips))
print(len(trips), [round(x["km"], 1) for x in trips])
