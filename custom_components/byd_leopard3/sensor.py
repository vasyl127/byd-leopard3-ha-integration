"""Sensors created from whatever keys the car actually sends."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import (
    PERCENTAGE,
    REVOLUTIONS_PER_MINUTE,
    EntityCategory,
    UnitOfElectricCurrent,
    UnitOfElectricPotential,
    UnitOfEnergy,
    UnitOfLength,
    UnitOfPower,
    UnitOfPressure,
    UnitOfSpeed,
    UnitOfTemperature,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, SIGNAL_NEW_KEYS, SIGNAL_TRIPS
from .entity import VehicleEntity
from .normalize import WHEELS

M = SensorStateClass.MEASUREMENT
DC = SensorDeviceClass
TEMP = UnitOfTemperature.CELSIUS


@dataclass(frozen=True, kw_only=True)
class Desc(SensorEntityDescription):
    precision: int | None = None


def _num(key, dc=None, unit=None, sc=M, precision=None, cat=None, enabled=True):
    return Desc(key=key, device_class=dc, native_unit_of_measurement=unit, state_class=sc,
                suggested_display_precision=precision, entity_category=cat,
                entity_registry_enabled_default=enabled)


def _enum(key, options, cat=None):
    return Desc(key=key, device_class=DC.ENUM, options=options, entity_category=cat)


DIAG = EntityCategory.DIAGNOSTIC
OPEN = ["open", "closed"]
ROOF = ["not_equipped", "closed", "open", "opening", "closing"]

DESCRIPTIONS: dict[str, Desc] = {d.key: d for d in [
    _num("soc", DC.BATTERY, PERCENTAGE, precision=0),
    _num("soh", None, PERCENTAGE, precision=1),
    _num("range", DC.DISTANCE, UnitOfLength.KILOMETERS, precision=0),
    _num("power", DC.POWER, UnitOfPower.KILO_WATT, precision=1),
    _num("voltage", DC.VOLTAGE, UnitOfElectricPotential.VOLT, precision=0),
    _num("current", DC.CURRENT, UnitOfElectricCurrent.AMPERE, precision=1),
    _num("batt_temp", DC.TEMPERATURE, TEMP, precision=1),
    _num("batt_temp_min", DC.TEMPERATURE, TEMP, precision=1, cat=DIAG),
    _num("batt_temp_max", DC.TEMPERATURE, TEMP, precision=1, cat=DIAG),
    _num("capacity", DC.ENERGY_STORAGE, UnitOfEnergy.KILO_WATT_HOUR, precision=1, cat=DIAG),
    _num("kwh_charged", DC.ENERGY, UnitOfEnergy.KILO_WATT_HOUR, sc=SensorStateClass.TOTAL, precision=2),
    _num("speed", DC.SPEED, UnitOfSpeed.KILOMETERS_PER_HOUR, precision=0),
    _num("odometer", DC.DISTANCE, UnitOfLength.KILOMETERS, sc=SensorStateClass.TOTAL_INCREASING, precision=0),
    _num("cabin_temp", DC.TEMPERATURE, TEMP, precision=1),
    _num("ext_temp", DC.TEMPERATURE, TEMP, precision=1),
    _num("hvac_setpoint", DC.TEMPERATURE, TEMP, precision=1),
    _num("aux_voltage", DC.VOLTAGE, UnitOfElectricPotential.VOLT, precision=1),
    _num("cell_max_v", DC.VOLTAGE, UnitOfElectricPotential.VOLT, precision=3, cat=DIAG),
    _num("cell_min_v", DC.VOLTAGE, UnitOfElectricPotential.VOLT, precision=3, cat=DIAG),
    _num("front_motor_temp", DC.TEMPERATURE, TEMP, precision=0, cat=DIAG),
    _num("rear_motor_temp", DC.TEMPERATURE, TEMP, precision=0, cat=DIAG),
    _num("motor_rpm", None, REVOLUTIONS_PER_MINUTE, precision=0, cat=DIAG),
    _num("sunroof_pos", None, PERCENTAGE, precision=0),
    *[_num(f"tyre_pressure_{w}", DC.PRESSURE, UnitOfPressure.BAR, precision=2) for w in WHEELS],
    *[_num(f"tyre_temp_{w}", DC.TEMPERATURE, TEMP, precision=0, cat=DIAG) for w in WHEELS],
    *[_num(f"window_{w}", None, PERCENTAGE, precision=0) for w in WHEELS],
    *[_enum(f"tyre_state_{w}", ["normal", "low", "high"]) for w in WHEELS],
    *[_enum(f"lock_{w}", ["locked", "unlocked"]) for w in WHEELS],
    *[_enum(f"door_{w}", OPEN) for w in WHEELS],
    _enum("hood", OPEN), _enum("trunk", OPEN),
    _enum("sunroof", ROOF), _enum("sunshade", ROOF),
    _enum("charging_gun", ["disconnected", "ac", "dc"]),
    _enum("climate", ["on", "off"]),
    _enum("seat_heat", ["off", "level_1", "level_2"]),
    _enum("steering_heat", ["off", "on"]),
    Desc(key="vehicle_state"),
    Desc(key="fan_speed"),
]}

SKIP = {"lat", "lon", "heading", "utc", "is_charging", "is_dcfc", "is_parked"}


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, add: AddEntitiesCallback) -> None:
    vehicle = hass.data[DOMAIN][entry.entry_id]
    made: set[str] = set()

    @callback
    def add_keys(keys) -> None:
        new = [ValueSensor(vehicle, DESCRIPTIONS[k]) for k in keys if k in DESCRIPTIONS and k not in made]
        made.update(e.key for e in new)
        if new:
            add(new)

    add_keys(list(vehicle.values))
    add([LastUpdateSensor(vehicle), LastTripSensor(vehicle)])
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_NEW_KEYS.format(entry.entry_id), add_keys))


class ValueSensor(VehicleEntity, SensorEntity):
    def __init__(self, vehicle, description: Desc) -> None:
        super().__init__(vehicle, description.key)
        self.entity_description = description

    @property
    def native_value(self) -> Any:
        v = self.vehicle.values.get(self.key)
        d = self.entity_description
        if d.device_class == DC.ENUM and v not in (d.options or []):
            return None
        return v


class LastUpdateSensor(VehicleEntity, SensorEntity):
    _attr_device_class = DC.TIMESTAMP
    _attr_entity_category = DIAG

    def __init__(self, vehicle) -> None:
        super().__init__(vehicle, "last_update")

    @property
    def native_value(self) -> datetime | None:
        ts = self.vehicle.last_update
        return datetime.fromtimestamp(ts, timezone.utc) if ts else None


class LastTripSensor(VehicleEntity, SensorEntity):
    """State: distance of the latest finished trip; attributes: its summary."""

    _attr_device_class = DC.DISTANCE
    _attr_native_unit_of_measurement = UnitOfLength.KILOMETERS
    _attr_suggested_display_precision = 1

    def __init__(self, vehicle) -> None:
        super().__init__(vehicle, "last_trip")

    async def async_added_to_hass(self) -> None:
        # Only trip start/finish changes this sensor, not every packet.
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_TRIPS.format(self.vehicle.entry.entry_id), self._updated)
        )

    @property
    def native_value(self) -> float | None:
        t = self.vehicle.last_trip()
        return t["km"] if t else None

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        t = self.vehicle.last_trip()
        attrs: dict[str, Any] = {"trip_in_progress": self.vehicle.recorder.cur is not None}
        if t:
            attrs.update({k: v for k, v in t.items() if k not in ("points",)})
            attrs["start"] = datetime.fromtimestamp(t["start"], timezone.utc).isoformat()
            attrs["end"] = datetime.fromtimestamp(t["end"], timezone.utc).isoformat()
        return attrs
