"""Binary sensors: charging, DC fast charging, parked, online, trip in progress."""

from __future__ import annotations

import time
from datetime import timedelta

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
    BinarySensorEntityDescription,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval

from .const import CONF_OFFLINE_AFTER, DEFAULT_OFFLINE_AFTER, DOMAIN, SIGNAL_NEW_KEYS, SIGNAL_TRIPS
from .entity import VehicleEntity

DESCRIPTIONS = {d.key: d for d in [
    BinarySensorEntityDescription(key="is_charging", device_class=BinarySensorDeviceClass.BATTERY_CHARGING),
    BinarySensorEntityDescription(key="is_dcfc"),
    BinarySensorEntityDescription(key="is_parked"),
]}


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, add: AddEntitiesCallback) -> None:
    vehicle = hass.data[DOMAIN][entry.entry_id]
    made: set[str] = set()

    @callback
    def add_keys(keys) -> None:
        new = [FlagSensor(vehicle, DESCRIPTIONS[k]) for k in keys if k in DESCRIPTIONS and k not in made]
        made.update(e.key for e in new)
        if new:
            add(new)

    add_keys(list(vehicle.values))
    add([OnlineSensor(vehicle), DrivingSensor(vehicle)])
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_NEW_KEYS.format(entry.entry_id), add_keys))


class FlagSensor(VehicleEntity, BinarySensorEntity):
    def __init__(self, vehicle, description: BinarySensorEntityDescription) -> None:
        super().__init__(vehicle, description.key)
        self.entity_description = description

    @property
    def is_on(self) -> bool | None:
        return self.vehicle.values.get(self.key)


class OnlineSensor(VehicleEntity, BinarySensorEntity):
    """On while packets keep arriving. Off after the configured silence."""

    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, vehicle) -> None:
        super().__init__(vehicle, "online")

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(async_track_time_interval(self.hass, self._tick, timedelta(seconds=15)))

    @callback
    def _tick(self, _now) -> None:
        self.async_write_ha_state()

    @property
    def is_on(self) -> bool:
        last = self.vehicle.last_update
        limit = self.vehicle.opt(CONF_OFFLINE_AFTER, DEFAULT_OFFLINE_AFTER)
        return last is not None and time.time() - last <= limit


class DrivingSensor(VehicleEntity, BinarySensorEntity):
    """On while the trip recorder has a trip open."""

    _attr_device_class = BinarySensorDeviceClass.MOVING

    def __init__(self, vehicle) -> None:
        super().__init__(vehicle, "trip_in_progress")

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_TRIPS.format(self.vehicle.entry.entry_id), self._updated)
        )

    @property
    def is_on(self) -> bool:
        return self.vehicle.recorder.cur is not None
