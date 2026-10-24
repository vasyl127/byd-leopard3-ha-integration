"""Shared entity base."""

from __future__ import annotations

from homeassistant.core import callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity

from .const import DOMAIN, MANUFACTURER, MODELS, SIGNAL_UPDATE, VERSION


class VehicleEntity(Entity):
    """Entity fed by the vehicle's webhook packets."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, vehicle, key: str) -> None:
        self.vehicle = vehicle
        self.key = key
        entry = vehicle.entry
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_translation_key = key
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title,
            manufacturer=MANUFACTURER,
            model=MODELS.get(vehicle.model, MODELS["other"])["name"],
            sw_version=VERSION,
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_UPDATE.format(self.vehicle.entry.entry_id), self._updated)
        )

    @callback
    def _updated(self) -> None:
        self.async_write_ha_state()
