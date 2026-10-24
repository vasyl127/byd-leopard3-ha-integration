"""GPS position from the webhook (lat/lon/heading)."""

from __future__ import annotations

from typing import Any

from homeassistant.components.device_tracker import SourceType, TrackerEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .entity import VehicleEntity


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, add: AddEntitiesCallback) -> None:
    add([Location(hass.data[DOMAIN][entry.entry_id])])


class Location(VehicleEntity, TrackerEntity):
    def __init__(self, vehicle) -> None:
        super().__init__(vehicle, "location")

    @property
    def source_type(self) -> SourceType:
        return SourceType.GPS

    @property
    def latitude(self) -> float | None:
        return self.vehicle.values.get("lat")

    @property
    def longitude(self) -> float | None:
        return self.vehicle.values.get("lon")

    @property
    def location_accuracy(self) -> int:
        return 10

    @property
    def battery_level(self) -> int | None:
        soc = self.vehicle.values.get("soc")
        return None if soc is None else int(soc)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        h = self.vehicle.values.get("heading")
        return {"heading": h} if h is not None else {}
