<p align="center"><img src="brand/logo@2x.png" alt="BYD Leopard 3 for Home Assistant" height="96"></p>

# BYD Leopard 3 for Home Assistant

[![hacs](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories)
[![Validate](https://github.com/vasyl127/byd-leopard3-ha-integration/actions/workflows/validate.yml/badge.svg)](https://github.com/vasyl127/byd-leopard3-ha-integration/actions/workflows/validate.yml)

Telemetry from your BYD in Home Assistant, pushed by the car over a webhook, plus a dashboard card with charging forecast, alerts, an animated car and a trip log on a map.

Built for the Leopard 3 (Fangchengbao Tai 3), but it works with any BYD and with any app that can send JSON to a webhook: **BYDMate**, **BYD EV Pro**, ABRP-style telemetry senders, or your own script.

> Українською — [нижче](#українською).

| Charging | Driving | Phone |
|---|---|---|
| ![](docs/card-charging.jpg) | ![](docs/card-driving.jpg) | ![](docs/card-phone.jpg) |

## Features

- **Any source.** BYDMate (Iternio/ABRP format), BYD EV Pro, a generic JSON format, or any JSON with a field map. The format is detected automatically.
- **Entities appear on their own** for the values your car actually sends: battery, charging, climate, tyres, doors, locks, windows, location and more. 60+ possible entities, translated to English and Ukrainian.
- **Trips** are recorded inside Home Assistant with the logic from BYDMate: start after 5 s above 3 km/h, end after 3 min at standstill, distance from the odometer (GPS fallback), energy from integrated power with BYDMate's plausibility checks, moving time without GPS gaps.
- **Long-term history** in a local SQLite database (`config/byd_leopard3.db`): every trip with its full GPS route, kept forever, plus telemetry samples (every 10 s while driving or charging, every 60 s when parked, only values that changed) kept for 365 days by default. It survives restarts and goes into Home Assistant backups. Trips from version 1.0 are moved in automatically.
- **Online / offline**: a connectivity sensor turns off when packets stop.
- **The card** (installed automatically, no resource to add):
  - three layouts: *car*, *trips*, or *combined* (side by side on wide screens, stacked on phones; it reacts to the card's own width);
  - tap any value (charge, power, temperatures, tyres, locks, odometer, …) to open its Home Assistant history graph, like any sensor;
  - animated wheels and road while driving, a parking sign when parked;
  - alerts at the top: flat or low tyre, low and critical battery, weak 12 V battery, hot battery, cell imbalance, open doors, hood or trunk, unlocked doors, open windows;
  - charging forecast: time to the target and the clock time it finishes (DC slows down above 80%);
  - offline view hides stale values and shows when the last packet came;
  - car colour: the factory Leopard 3 / Tai 3 colours (Obsidian Black, Element White, Starry Moon Silver, Mineral Green, Micro Light Pink, Ice Crystal Blue, Stardust Purple) or any custom colour;
  - 15 [themes](#themes): *same as Home Assistant*, Dark, Light, Midnight, Graphite, OLED, Mineral and the styled Claude CLI, Tesla, Gradient Glass, Neon, Paper, Off-road, iOS, iOS Dark; every colour of a theme can be changed in the editor;
  - English and Ukrainian, configured in the visual editor.

## Themes

Pick a theme in the card editor (*Card theme*) or with `theme:` in YAML. Every colour of a theme (background, tiles, lines, text, secondary text, accent) can be changed in the editor under *Theme colours*; only the colours you change are saved.

The last eight are styled themes: they also change fonts, borders and effects. Their fonts load from Google Fonts the first time such a theme is shown; without internet the card falls back to system fonts.

| | | |
|---|---|---|
| **Same as Home Assistant** (`ha`)<br><sub>follows your HA theme</sub> | **Dark** (`dark`) | **Light** (`light`) |
| ![Same as Home Assistant](docs/themes/ha.jpg) | ![Dark](docs/themes/dark.jpg) | ![Light](docs/themes/light.jpg) |
| **Midnight** (`midnight`) | **Graphite** (`graphite`) | **OLED** (`oled`)<br><sub>pure black</sub> |
| ![Midnight](docs/themes/midnight.jpg) | ![Graphite](docs/themes/graphite.jpg) | ![OLED](docs/themes/oled.jpg) |
| **Mineral** (`mineral`)<br><sub>green</sub> | **Claude CLI** (`claude`)<br><sub>terminal look, JetBrains Mono</sub> | **Tesla** (`tesla`)<br><sub>black, thin type</sub> |
| ![Mineral](docs/themes/mineral.jpg) | ![Claude CLI](docs/themes/claude.jpg) | ![Tesla](docs/themes/tesla.jpg) |
| **Gradient Glass** (`gradient`)<br><sub>animated gradient, glass tiles</sub> | **Neon** (`neon`)<br><sub>synthwave glow</sub> | **Paper** (`paper`)<br><sub>editorial, serif</sub> |
| ![Gradient Glass](docs/themes/gradient.jpg) | ![Neon](docs/themes/neon.jpg) | ![Paper](docs/themes/paper.jpg) |
| **Off-road** (`offroad`)<br><sub>Fangchengbao stencil and hazard stripes</sub> | **iOS** (`ios`)<br><sub>widget style, light</sub> | **iOS Dark** (`ios_dark`)<br><sub>widget style, dark</sub> |
| ![Off-road](docs/themes/offroad.jpg) | ![iOS](docs/themes/ios.jpg) | ![iOS Dark](docs/themes/ios_dark.jpg) |

Screenshots: combined layout, AC charging, rendered with `dev/harness.html`.

## Install

### HACS (recommended)

1. HACS → ⋮ → **Custom repositories** → add `https://github.com/vasyl127/byd-leopard3-ha-integration`, type **Integration**.
2. Find **BYD Leopard 3** in HACS and download it.
3. Restart Home Assistant.

Requires Home Assistant 2024.11 or newer.

[![Open in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=vasyl127&repository=byd-leopard3-ha-integration&category=integration)

### Manual

Copy `custom_components/byd_leopard3` into your `config/custom_components/` and restart.

## Set up

1. **Settings → Devices & services → Add integration → BYD Leopard 3.**
2. Give the car a name, pick the model and the data source (leave *Detect automatically* if unsure).
3. Copy the webhook URL that the next step shows and paste it into your app:
   - **BYDMate**: Settings → Integrations → **Webhook: telemetry** → paste the URL → *Save webhook*, then turn on *Live data → your own server*. Turn on *Send coordinates to the webhook* to get the location and trip routes. BYDMate only sends to `https://` URLs, so Home Assistant has to be reachable over HTTPS.
   - **BYD EV Pro**: the Home Assistant webhook setting.
   - **Anything else**: `POST` JSON to the URL.
4. The entities show up with the first packet.

Then add the card: Dashboard → Edit → Add card → **BYD Leopard 3**. Everything is set in the visual editor.

> The webhook URL is a secret. If Home Assistant is reachable from the internet, anyone with the URL can post data. To lock it down, set a **webhook secret** in the integration options and the same value in your app. Requests are accepted with `Authorization: Bearer <secret>` (the *Secret* field in BYDMate) or with an HMAC signature (`X-Webhook-Signature: hex(HMAC-SHA256(secret, body))`). Anything else gets `403`.

## Data formats

### BYDMate / ABRP (Iternio)

```json
{"utc": 1792857485, "soc": 20, "soh": 99, "power": -2.6, "voltage": 500, "current": -5.2,
 "is_charging": 1, "is_dcfc": 0, "is_parked": 1, "speed": 0, "odometer": 8081.6,
 "batt_temp": 15, "ext_temp": 8, "cabin_temp": 30, "hvac_setpoint": 30, "capacity": 72.9,
 "kwh_charged": 1.16, "tire_pressure_fl": 267, "lat": 50.45, "lon": 30.52, "heading": 90}
```

Tyre pressure in kPa is converted to bar. A `{"tlm": {...}}` wrapper is accepted.

### BYD EV Pro

`{"sensors": {...}, "location": {"latitude": ..., "longitude": ...}, "device_info": {...}}` with the app's own keys (`battery_soc`, `tyre_pressure_lf`, `lock_lf`, …) and numeric states.

### Generic

Flat JSON with this integration's keys:

| Key | Unit / values |
|---|---|
| `soc`, `soh` | % |
| `range`, `odometer` | km |
| `power` | kW, negative while charging |
| `voltage`, `current` | V, A (negative while charging) |
| `batt_temp`, `batt_temp_min`, `batt_temp_max`, `cabin_temp`, `ext_temp`, `hvac_setpoint` | °C |
| `capacity`, `kwh_charged` | kWh |
| `speed` | km/h |
| `aux_voltage`, `cell_max_v`, `cell_min_v` | V |
| `front_motor_temp`, `rear_motor_temp`, `motor_rpm` | °C, rpm |
| `tyre_pressure_fl/fr/rl/rr` | bar (or kPa) |
| `tyre_temp_*`, `tyre_state_*` | °C, `normal` / `low` / `high` |
| `is_charging`, `is_dcfc`, `is_parked` | true / false or 1 / 0 |
| `charging_gun` | `disconnected` / `ac` / `dc` |
| `climate`, `steering_heat` | `on` / `off` |
| `seat_heat` | `off` / `level_1` / `level_2` |
| `lock_fl/fr/rl/rr` | `locked` / `unlocked` |
| `door_fl/fr/rl/rr`, `hood`, `trunk` | `open` / `closed` |
| `window_fl/fr/rl/rr` | % open |
| `sunroof`, `sunshade` | `not_equipped` / `closed` / `open` / `opening` / `closing` |
| `lat`, `lon`, `heading` | degrees |
| `utc` | unix seconds or milliseconds (defaults to receive time) |

### Custom (field map)

Choose *Custom JSON with a field map* and give a JSON object that maps our keys to paths in your payload. A path can be a string, or an object with `path`, `scale`, `offset` and `map`:

```json
{
  "soc": "battery.level",
  "speed": {"path": "gps.speed_ms", "scale": 3.6},
  "is_charging": {"path": "charger.state", "map": {"CHARGING": true, "IDLE": false}},
  "lat": "gps.lat", "lon": "gps.lon"
}
```

A field map also works on top of the other sources, to add or fix a value.

## Card options

All of them are in the visual editor. YAML equivalent:

```yaml
type: custom:byd-leopard3-card
entry_id: 01J...            # which car (optional when you have one)
layout: combo               # car | trips | combo
language: auto              # auto | uk | en
color: green                # black | white | silver | green | pink | ice_blue | purple | custom
custom_color: [233, 30, 99] # with color: custom
theme: midnight             # ha | dark | light | midnight | graphite | oled | mineral |
                            # claude | tesla | gradient | neon | paper | offroad | ios | ios_dark
theme_colors:               # optional: change any colour of the theme
  accent: [255, 159, 28]    # also background, tiles, divider, text, secondary
show_alerts: true
show_seat_heat: true
show_steering_heat: false
show_trips_map: true
low_soc: 20                 # %
tyre_min: 2.3               # bar
charge_target: 100          # %
title: My car               # optional
image_side: /local/car.png  # optional, for other models
image_top: /local/car_top.png
map_tiles: https://tile.openstreetmap.org/{z}/{x}/{y}.png  # optional
```

## History database

`config/byd_leopard3.db` (SQLite) has three tables: `trips` (summary per trip), `points` (the full GPS route of every trip) and `samples` (telemetry, one JSON row with the values that changed). Trips and routes are never deleted. Telemetry older than *Keep telemetry history* (integration options, default 365 days, `0` keeps everything) is purged every 6 hours. Removing the integration deletes its rows.

The sensors themselves are also recorded by Home Assistant's own recorder as usual, so their graphs and long-term statistics work everywhere in HA.

## Websocket API

The card uses these commands, and you can use them too:

- `byd_leopard3/vehicles`
- `byd_leopard3/trips` (`entry_id`, `days` up to 36500)
- `byd_leopard3/trip` (`entry_id`, `trip_id`, or `"live"` for the trip in progress), with the GPS route
- `byd_leopard3/history` (`entry_id`, `keys`, optional `start`, `end` as unix seconds, `max_points`): `{key: [[ts, value], ...]}` from the database
- `byd_leopard3/db_stats` (`entry_id`): how many trips, route points and samples are stored

## Development

```bash
uv venv --python 3.13 .venv && VIRTUAL_ENV=.venv uv pip install -r requirements_test.txt
.venv/bin/python -m pytest
```

`dev/harness.html` renders the card with mock data (serve the repo root, e.g. `python3 -m http.server`, and open `/dev/harness.html`). `dev/make_trips.py` rebuilds its sample trips with the real recorder.

## Credits

- Trip logic follows [BYDMate](https://github.com/AndyShaman/BYDMate) by AndyShaman.
- Map tiles © Esri. Map by [Leaflet](https://leafletjs.com) (bundled).
- Not affiliated with BYD or Fangchengbao. Car drawing and colours are illustrative.

---

## Українською

Інтеграція передає телеметрію BYD у Home Assistant через вебхук і додає картку для дашборду: прогноз заряджання, сповіщення, анімоване авто та журнал поїздок на карті. Зроблено для Leopard 3, але працює з будь-яким BYD і будь-яким застосунком, що надсилає JSON: **BYDMate**, **BYD EV Pro**, ABRP-сумісні застосунки або власний скрипт.

### Встановлення

1. HACS → ⋮ → **Custom repositories** → `https://github.com/vasyl127/byd-leopard3-ha-integration`, тип **Integration**.
2. Знайди **BYD Leopard 3** у HACS, завантаж і перезапусти Home Assistant.
3. **Налаштування → Пристрої та служби → Додати інтеграцію → BYD Leopard 3.** Вкажи назву, модель і джерело даних (якщо не впевнений, лиши «Визначати автоматично»).
4. Скопіюй адресу вебхука і встав її в застосунок. У BYDMate це Settings → Integrations → **Webhook: telemetry**: встав адресу, натисни *Save webhook* і увімкни *Live data → your own server*. Щоб мати локацію і маршрути поїздок, увімкни *Send coordinates to the webhook*. BYDMate надсилає дані лише на `https://`, тож Home Assistant має бути доступний через HTTPS.
5. Щоб ніхто сторонній не міг слати дані на вебхук, задай **секрет вебхука** в параметрах інтеграції і той самий рядок у полі *Secret* у BYDMate.
6. Датчики з'являться з першим пакетом. Додай картку: Дашборд → Редагувати → Додати картку → **BYD Leopard 3**. Усе налаштовується у візуальному редакторі: варіант картки, мова, колір авто, сповіщення, підігрів керма, пороги.

### Що вміє

- Автоматично визначає формат даних: BYDMate, BYD EV Pro, загальний JSON або будь-який JSON через мапу полів.
- Створює лише ті датчики, які авто справді надсилає. Назви датчиків перекладені англійською та українською.
- Записує поїздки за логікою BYDMate у локальну базу SQLite (`config/byd_leopard3.db`): усі поїздки з повними GPS-маршрутами зберігаються назавжди, телеметрія — 365 днів (змінюється в параметрах інтеграції, `0` — без обмеження). Дані переживають перезапуск і потрапляють у бекапи HA. У картці є періоди «Рік» і «Все».
- Картка має три варіанти: авто, поїздки, комплект. Комплект на широкому екрані показує поїздки справа, а на телефоні знизу.
- Натисни на будь-яке значення (заряд, потужність, температури, шини, замки, пробіг…), і відкриється його графік історії, як у звичайного сенсора HA.
- 15 тем картки: як у Home Assistant, темна, світла, «Північ», «Графіт», OLED, Mineral і стильні Claude CLI, Tesla, «Градієнтне скло», «Неон», «Папір», Off-road, iOS, iOS темна. Стильні теми змінюють ще й шрифти, рамки та ефекти. Кожен колір теми (фон, плитки, лінії, текст, акцент) можна змінити в редакторі. Скріншоти всіх тем — у розділі [Themes](#themes).
- Колір авто: заводські кольори Leopard 3 / Tai 3 (Obsidian Black, Element White, Starry Moon Silver, Mineral Green, Micro Light Pink, Ice Crystal Blue, Stardust Purple) або будь-який свій.
- Сповіщення: спущене чи низьке колесо, низький заряд, слабкий 12 В, гаряча батарея, розбаланс комірок, відчинені двері, багажник чи капот, незамкнені двері, відкриті вікна.
- Коли даних немає, картка ховає застарілі значення і показує, коли прийшов останній пакет.

Не є офіційним продуктом BYD чи Fangchengbao.
