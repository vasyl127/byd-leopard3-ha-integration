"""Constants for the BYD Leopard 3 integration."""

from __future__ import annotations

DOMAIN = "byd_leopard3"
MANUFACTURER = "BYD"
VERSION = "1.0.0"

CONF_WEBHOOK_ID = "webhook_id"
CONF_SOURCE = "source"
CONF_MODEL = "model"
CONF_CAPACITY = "capacity"
CONF_OFFLINE_AFTER = "offline_after"
CONF_SECRET = "webhook_secret"
CONF_FIELD_MAP = "field_map"
CONF_RECORD_TRIPS = "record_trips"
CONF_HISTORY_DAYS = "history_days"

# Where the data comes from. "auto" detects the payload shape on every request.
SOURCE_AUTO = "auto"
SOURCE_ABRP = "abrp"            # BYDMate and any app that speaks the Iternio/ABRP telemetry format
SOURCE_BYD_EV_PRO = "byd_ev_pro"  # {"sensors": {...}, "location": {...}, "device_info": {...}}
SOURCE_GENERIC = "generic"      # flat JSON that already uses this integration's key names
SOURCE_CUSTOM = "custom"        # any JSON, mapped with a user-supplied field map
SOURCES = [SOURCE_AUTO, SOURCE_ABRP, SOURCE_BYD_EV_PRO, SOURCE_GENERIC, SOURCE_CUSTOM]

# Vehicle presets. Capacity is used for trip energy fallback and the card's kWh line.
MODELS: dict[str, dict] = {
    "leopard3": {"name": "Leopard 3 / Tai 3", "capacity": 72.9},
    "seal": {"name": "Seal", "capacity": 82.5},
    "seal_u": {"name": "Seal U / Song Plus", "capacity": 71.8},
    "atto3": {"name": "Atto 3 / Yuan Plus", "capacity": 60.5},
    "dolphin": {"name": "Dolphin", "capacity": 60.4},
    "han": {"name": "Han", "capacity": 85.4},
    "tang": {"name": "Tang", "capacity": 108.8},
    "other": {"name": "BYD", "capacity": 60.0},
}
DEFAULT_MODEL = "leopard3"
DEFAULT_OFFLINE_AFTER = 120  # seconds without a packet before the car counts as offline

SIGNAL_UPDATE = f"{DOMAIN}_update_{{}}"
SIGNAL_NEW_KEYS = f"{DOMAIN}_new_keys_{{}}"
SIGNAL_TRIPS = f"{DOMAIN}_trips_{{}}"

STORAGE_VERSION = 1

# Long-term history (SQLite in the config dir). Trips and routes are kept forever;
# telemetry samples for CONF_HISTORY_DAYS (0 = forever).
DB_FILE = "byd_leopard3.db"
DEFAULT_HISTORY_DAYS = 365
SAMPLE_EVERY_ACTIVE = 10   # s between samples while driving or charging
SAMPLE_EVERY_IDLE = 60     # s between samples while parked

URL_BASE = f"/{DOMAIN}_static"
CARD_FILENAME = "byd-leopard3-card.js"
