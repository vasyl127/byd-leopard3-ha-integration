import math

from custom_components.byd_leopard3.trips import TripRecorder, energy_for, moving_time


def drive(rec, t0=1000.0, seconds=600, speed=50, soc0=80, odo0=100.0, power=10.0, gps=True):
    """Feed 1 Hz packets: parked, drive east, then 4 minutes parked."""
    t, odo, soc, lon = t0, odo0, soc0, 30.0
    for _ in range(3):
        rec.on_packet({"utc": t, "speed": 0, "soc": soc, "odometer": odo, "power": 0.3, "lat": 50.0, "lon": lon, "ext_temp": 9})
        t += 30
    for _ in range(seconds):
        odo += speed / 3600
        lon += speed / 3600 / (111.32 * math.cos(math.radians(50)))
        rec.on_packet({"utc": t, "speed": speed, "soc": soc - (odo - odo0) * 0.25, "odometer": odo, "power": power,
                       "lat": 50.0 if gps else None, "lon": lon if gps else None, "batt_temp": 20, "ext_temp": 9})
        t += 1
    for _ in range(9):
        rec.on_packet({"utc": t, "speed": 0, "soc": soc - (odo - odo0) * 0.25, "odometer": odo, "power": 0.3, "lat": 50.0, "lon": lon})
        t += 30
    return t


def test_trip_detected_with_stats():
    done = []
    rec = TripRecorder(72.9, done.append)
    drive(rec)
    assert len(done) == 1 and rec.cur is None
    t = done[0]
    assert abs(t["km"] - 50 * 600 / 3600) < 0.05            # odometer distance
    assert abs(t["kwh"] - 10 * 600 / 3600) < 0.1            # integrated power
    assert 15 < t["per100"] < 25
    assert abs(t["moving_s"] - 600) < 5 and abs(t["avg_speed"] - 50) < 1
    assert t["end"] - t["start"] < 620                      # end = moment of stop, not +3 min
    assert t["soc_start"] == 80 and t["ext_start"] == 9 and t["batt_max"] == 20


def test_short_burst_does_not_start_a_trip():
    rec = TripRecorder(72.9)
    for i in range(4):
        rec.on_packet({"utc": i, "speed": 10})
    rec.on_packet({"utc": 4, "speed": 0})
    assert rec.state == "idle"


def test_gps_fallback_and_energy_fallback():
    done = []
    rec = TripRecorder(72.9, done.append)
    # no odometer: distance from GPS; absurd power: energy from SOC delta
    t, lon = 0.0, 30.0
    for i in range(400):
        lon += 60 / 3600 / (111.32 * math.cos(math.radians(50)))
        rec.on_packet({"utc": t, "speed": 60, "soc": 80 - i * 0.01, "power": 9999, "lat": 50.0, "lon": lon})
        t += 1
    for _ in range(9):
        rec.on_packet({"utc": t, "speed": 0, "soc": 76, "lat": 50.0, "lon": lon})
        t += 30
    trip = done[0]
    assert abs(trip["km"] - 60 * 400 / 3600) < 0.2
    assert abs(trip["kwh"] - 4 / 100 * 72.9) < 0.01


def test_long_silence_closes_trip():
    done = []
    rec = TripRecorder(72.9, done.append)
    for i in range(30):
        rec.on_packet({"utc": i, "speed": 40, "odometer": 10 + i * 0.01, "power": 5})
    rec.on_packet({"utc": 2000, "speed": 0, "odometer": 10.3})
    assert len(done) == 1


def test_energy_rules():
    assert energy_for(2.0, 10, 80, 77, 72.9) == 2.0
    assert energy_for(-1, 10, 80, 77, 72.9) == 3 / 100 * 72.9
    assert energy_for(600, 10, None, None, 72.9) is None


def test_moving_time_skips_gaps():
    pts = [{"t": 0, "speed": 30}, {"t": 10, "speed": 30}, {"t": 500, "speed": 30}, {"t": 510, "speed": 0}, {"t": 520, "speed": 0}]
    assert moving_time(pts, 0, 520) == 20
