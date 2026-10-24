"""Config flow: name the car, pick the data source, get the webhook URL."""

from __future__ import annotations

import json
import secrets
from typing import Any

import voluptuous as vol

from homeassistant.components import webhook
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_CAPACITY,
    CONF_FIELD_MAP,
    CONF_HISTORY_DAYS,
    CONF_MODEL,
    CONF_OFFLINE_AFTER,
    CONF_RECORD_TRIPS,
    CONF_SECRET,
    CONF_SOURCE,
    CONF_WEBHOOK_ID,
    DEFAULT_HISTORY_DAYS,
    DEFAULT_MODEL,
    DEFAULT_OFFLINE_AFTER,
    DOMAIN,
    MODELS,
    SOURCE_AUTO,
    SOURCES,
)


FIELD_MAP_EXAMPLE = '{"soc": "battery.level", "speed": {"path": "spd", "scale": 3.6}}'


def _select(options: list[str], key: str) -> selector.SelectSelector:
    return selector.SelectSelector(selector.SelectSelectorConfig(
        options=options, translation_key=key, mode=selector.SelectSelectorMode.DROPDOWN))


def _valid_map(raw: str) -> bool:
    if not raw or not raw.strip():
        return True
    try:
        return isinstance(json.loads(raw), dict)
    except ValueError:
        return False


class BydConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            if not _valid_map(user_input.get(CONF_FIELD_MAP, "")):
                errors[CONF_FIELD_MAP] = "invalid_json"
            else:
                self._data = {**user_input, CONF_WEBHOOK_ID: f"{DOMAIN}_{secrets.token_hex(16)}"}
                return await self.async_step_webhook()
        schema = vol.Schema({
            vol.Required(CONF_NAME, default="Leopard 3"): str,
            vol.Required(CONF_MODEL, default=DEFAULT_MODEL): _select(list(MODELS), "model"),
            vol.Required(CONF_SOURCE, default=SOURCE_AUTO): _select(SOURCES, "source"),
            vol.Optional(CONF_FIELD_MAP, default=""): selector.TextSelector(
                selector.TextSelectorConfig(multiline=True)),
        })
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors,
                                    description_placeholders={"example": FIELD_MAP_EXAMPLE})

    async def async_step_webhook(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            name = self._data.pop(CONF_NAME)
            return self.async_create_entry(title=name, data=self._data)
        url = webhook.async_generate_url(self.hass, self._data[CONF_WEBHOOK_ID])
        return self.async_show_form(step_id="webhook", data_schema=vol.Schema({}),
                                    description_placeholders={"webhook_url": url})

    @staticmethod
    @callback
    def async_get_options_flow(entry: ConfigEntry) -> OptionsFlow:
        return BydOptionsFlow()


class BydOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        entry = self.config_entry
        cur = {**entry.data, **entry.options}
        if user_input is not None:
            if not _valid_map(user_input.get(CONF_FIELD_MAP, "")):
                errors[CONF_FIELD_MAP] = "invalid_json"
            else:
                return self.async_create_entry(data=user_input)
        url = webhook.async_generate_url(self.hass, entry.data[CONF_WEBHOOK_ID])
        schema = vol.Schema({
            vol.Required(CONF_MODEL, default=cur.get(CONF_MODEL, DEFAULT_MODEL)): _select(list(MODELS), "model"),
            vol.Required(CONF_SOURCE, default=cur.get(CONF_SOURCE, SOURCE_AUTO)): _select(SOURCES, "source"),
            vol.Optional(CONF_CAPACITY, description={"suggested_value": cur.get(CONF_CAPACITY)}): selector.NumberSelector(
                selector.NumberSelectorConfig(min=10, max=200, step=0.1, unit_of_measurement="kWh",
                                              mode=selector.NumberSelectorMode.BOX)),
            vol.Required(CONF_OFFLINE_AFTER, default=cur.get(CONF_OFFLINE_AFTER, DEFAULT_OFFLINE_AFTER)): selector.NumberSelector(
                selector.NumberSelectorConfig(min=30, max=3600, step=10, unit_of_measurement="s",
                                              mode=selector.NumberSelectorMode.BOX)),
            vol.Required(CONF_RECORD_TRIPS, default=cur.get(CONF_RECORD_TRIPS, True)): bool,
            vol.Required(CONF_HISTORY_DAYS, default=cur.get(CONF_HISTORY_DAYS, DEFAULT_HISTORY_DAYS)): selector.NumberSelector(
                selector.NumberSelectorConfig(min=0, max=3650, step=1, unit_of_measurement="d",
                                              mode=selector.NumberSelectorMode.BOX)),
            vol.Optional(CONF_SECRET, description={"suggested_value": cur.get(CONF_SECRET, "")}): str,
            vol.Optional(CONF_FIELD_MAP, description={"suggested_value": cur.get(CONF_FIELD_MAP, "")}): selector.TextSelector(
                selector.TextSelectorConfig(multiline=True)),
        })
        return self.async_show_form(step_id="init", data_schema=schema, errors=errors,
                                    description_placeholders={"webhook_url": url})
