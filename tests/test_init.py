import math

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.setup import async_setup_component

from custom_components.byd_leopard3.const import DOMAIN

from .test_normalize import BYDMATE


async def _setup(hass: HomeAssistant):
    assert await async_setup_component(hass, "http", {})
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["step_id"] == "user"
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"name": "Leopard 3", "model": "leopard3", "source": "auto", "field_map": ""})
    assert result["step_id"] == "webhook"
    assert "/api/webhook/byd_leopard3_" in result["description_placeholders"]["webhook_url"]
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] == "create_entry"
    await hass.async_block_till_done()
    return hass.config_entries.async_entries(DOMAIN)[0]


async def test_flow_webhook_entities_and_ws(hass: HomeAssistant, hass_client_no_auth, hass_ws_client):
    entry = await _setup(hass)
    client = await hass_client_no_auth()
    url = f"/api/webhook/{entry.data['webhook_id']}"

    resp = await client.post(url, json=BYDMATE)
    assert resp.status == 200
    await hass.async_block_till_done()

    reg = er.async_get(hass)
    ids = {e.unique_id.split("_", 1)[1]: e.entity_id for e in er.async_entries_for_config_entry(reg, entry.entry_id)}
    assert float(hass.states.get(ids["soc"]).state) == 20
    assert float(hass.states.get(ids["tyre_pressure_fl"]).state) == 2.67
    assert hass.states.get(ids["is_charging"]).state == "on"
    assert hass.states.get(ids["online"]).state == "on"

    # A short drive through the webhook creates a trip.
    t, lon, odo = 1_800_000_000, 30.0, 8100.0
    async def send(**p):
        r = await client.post(url, json={"utc": t, "soc": 60, "odometer": odo, "power": 8, **p})
        assert r.status == 200
    for _ in range(3):
        await send(speed=0, is_parked=1, lat=50.0, lon=lon); t += 30
    for _ in range(120):
        odo += 60 / 3600; lon += 60 / 3600 / (111.32 * math.cos(math.radians(50)))
        await send(speed=60, is_parked=0, lat=50.0, lon=lon); t += 1
    for _ in range(8):
        await send(is_parked=1, lat=50.0, lon=lon); t += 30
    await hass.async_block_till_done()
    assert float(hass.states.get(ids["last_trip"]).state) == 2.0

    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": f"{DOMAIN}/vehicles"})
    msg = await ws.receive_json()
    assert msg["success"] and msg["result"][0]["entities"]["soc"] == ids["soc"]
    await ws.send_json({"id": 2, "type": f"{DOMAIN}/trips", "entry_id": entry.entry_id, "days": 3650})
    msg = await ws.receive_json()
    trips = msg["result"]["trips"]
    assert len(trips) == 1 and trips[0]["has_route"] and "points" not in trips[0]
    await ws.send_json({"id": 3, "type": f"{DOMAIN}/trip", "entry_id": entry.entry_id, "trip_id": trips[0]["id"]})
    msg = await ws.receive_json()
    assert len(msg["result"]["points"]) >= 100


async def test_hmac_and_bad_json(hass: HomeAssistant, hass_client_no_auth):
    entry = await _setup(hass)
    hass.config_entries.async_update_entry(entry, options={**entry.options, "webhook_secret": "s3cret"})
    await hass.async_block_till_done()
    client = await hass_client_no_auth()
    url = f"/api/webhook/{entry.data['webhook_id']}"
    resp = await client.post(url, json=BYDMATE)
    assert resp.status == 403
    resp = await client.post(url, data="not json", headers={"content-type": "text/plain"})
    assert resp.status in (400, 403)


async def test_secret_bearer_and_hmac(hass: HomeAssistant, hass_client_no_auth):
    """BYDMate sends the secret as `Authorization: Bearer`; HMAC signing also works."""
    import hashlib
    import hmac
    import json

    entry = await _setup(hass)
    hass.config_entries.async_update_entry(entry, options={**entry.options, "webhook_secret": "s3cret"})
    await hass.async_block_till_done()
    client = await hass_client_no_auth()
    url = f"/api/webhook/{entry.data['webhook_id']}"
    resp = await client.post(url, json=BYDMATE, headers={"Authorization": "Bearer wrong"})
    assert resp.status == 403
    resp = await client.post(url, json=BYDMATE, headers={"Authorization": "Bearer s3cret"})
    assert resp.status == 200
    body = json.dumps(BYDMATE).encode()
    sig = hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()
    resp = await client.post(url, data=body, headers={"content-type": "application/json", "X-Webhook-Signature": sig})
    assert resp.status == 200


async def test_options_flow(hass: HomeAssistant):
    entry = await _setup(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["step_id"] == "init"
    result = await hass.config_entries.options.async_configure(result["flow_id"], {
        "model": "seal", "source": "abrp", "offline_after": 300, "record_trips": True, "field_map": "{bad"})
    assert result["errors"] == {"field_map": "invalid_json"}
