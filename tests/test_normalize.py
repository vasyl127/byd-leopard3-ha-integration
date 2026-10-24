from custom_components.byd_leopard3.normalize import detect_source, normalize

BYDMATE = {  # real packet from a Leopard 3 on AC charge
    "hvac_setpoint": 30, "tire_pressure_fl": 267, "odometer": 8081.6, "tire_pressure_fr": 262, "is_dcfc": 0,
    "utc": 1792857485, "soc": 20, "tire_pressure_rr": 262, "kwh_charged": 1.1610000133514404, "is_parked": 1,
    "soh": 99, "speed": 0, "batt_temp": 15, "voltage": 500, "capacity": 72.9, "is_charging": 1,
    "current": -5.199981689453125, "cabin_temp": 30, "tire_pressure_rl": 260, "ext_temp": 8, "power": -2.6,
}


def test_bydmate_packet():
    assert detect_source(BYDMATE) == "abrp"
    c = normalize(BYDMATE)
    assert c["soc"] == 20 and c["is_charging"] is True and c["is_dcfc"] is False and c["is_parked"] is True
    assert c["tyre_pressure_fl"] == 2.67 and c["tyre_pressure_rl"] == 2.6   # kPa -> bar
    assert c["utc"] == 1792857485 and c["power"] == -2.6


def test_abrp_parked_without_speed_and_tlm_wrapper():
    c = normalize({"tlm": {"soc": 50, "utc": 1, "is_parked": 1, "est_battery_range": 200}})
    assert c["speed"] == 0 and c["range"] == 200


def test_byd_ev_pro_payload():
    p = {"sensors": {"battery_soc": 81, "battery_health": 98.5, "charging_state": 1, "charging_gun": 3,
                     "charging_power_dd": 55.2, "tyre_pressure_lf": 2.5, "tyre_state_rr": 1, "lock_lf": 1,
                     "door_rf": 1, "trunk_open": 0, "window_lr_pos": 20, "driver_seat_heat": 2,
                     "steering_heat": 2, "battery_max_temp": 30, "battery_min_temp": 26, "speed": 0,
                     "vehicle_state": 4, "sunroof_state": 0},
         "location": {"latitude": 50.4, "longitude": 30.5, "heading": 90}}
    assert detect_source(p) == "byd_ev_pro"
    c = normalize(p, now=100)
    assert c["soc"] == 81 and c["is_charging"] is True and c["is_dcfc"] is True and c["power"] == -55.2
    assert c["tyre_pressure_fl"] == 2.5 and c["tyre_state_rr"] == "low"
    assert c["lock_fl"] == "unlocked" and c["door_fr"] == "open" and c["trunk"] == "closed"
    assert c["window_rl"] == 20 and c["seat_heat"] == "level_1" and c["steering_heat"] == "on"
    assert c["batt_temp"] == 28 and c["is_parked"] is True and c["vehicle_state"] == "smart_charge"
    assert c["sunroof"] == "not_equipped" and c["lat"] == 50.4 and c["utc"] == 100


def test_custom_field_map():
    p = {"car": {"bat": {"lvl": "64"}, "spd_ms": 20, "plug": "yes"}}
    fm = {"soc": "car.bat.lvl", "speed": {"path": "car.spd_ms", "scale": 3.6}, "is_charging": "car.plug"}
    c = normalize(p, "custom", fm, now=5)
    assert c["soc"] == 64 and round(c["speed"]) == 72 and c["is_charging"] is True and c["is_parked"] is False


def test_generic_drops_unknown_keys_and_ms_timestamps():
    c = normalize({"soc": 10, "foo": 1, "utc": 1792857485000}, "generic")
    assert "foo" not in c and c["utc"] == 1792857485
