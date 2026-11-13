/*
 * BYD Leopard 3 card for Home Assistant.
 * Part of https://github.com/vasyl127/byd-leopard3-ha-integration (served by the integration itself).
 * Three layouts: car, trips, combo (car + trips in one card, side by side when the card is wide).
 */
const VERSION = '1.3.3';
const DOMAIN = 'byd_leopard3';
const BASE = new URL('.', import.meta.url).href;
// Version every asset URL like the card itself (…card.js?v=x.y.z), so browsers and proxies such as
// Cloudflare never serve a drawing or the map library from a previous release.
const ASSET_V = new URL(import.meta.url).searchParams.get('v') || VERSION;
const asset = (path) => `${BASE}${path}?v=${encodeURIComponent(ASSET_V)}`;

/* ---------- Paint ---------- */
const COLORS = {
  // Factory colours of the Leopard 3 / Fangchengbao Tai 3 (official names), tuned on the black drawing.
  black: null,                 // Obsidian Black (曜石黑): the drawing is black already
  white: '#e6e4de',            // Element White (元素白), warm off-white
  silver: '#b3c3ca',           // Starry Moon Silver (星月银), light blue-grey
  green: '#6e8275',            // Mineral Green (矿石绿), grey sage
  pink: '#d4bcc3',             // Micro Light Pink (微光粉), pearl, 2025+
  ice_blue: '#6f9fbe',         // Ice Crystal Blue (冰晶蓝), 2025
  purple: '#67658c',           // Stardust Purple (星尘紫), flash-charge 2026
};
/* ---------- Card themes (every colour can be changed in the editor) ---------- */
const THEMES = {
  ha:       null,   // follow the Home Assistant theme
  dark:     {background:'#1c1c1c', tiles:'#262626', divider:'#2e2e2e', text:'#e1e1e1', secondary:'#9b9b9b', accent:'#03a9f4'},
  light:    {background:'#ffffff', tiles:'#f1f3f5', divider:'#e3e6ea', text:'#1d2125', secondary:'#5f6870', accent:'#1e63c8'},
  midnight: {background:'#0f1726', tiles:'#18233a', divider:'#24314d', text:'#e6ecf7', secondary:'#9aa8c4', accent:'#4f8cff'},
  graphite: {background:'#232527', tiles:'#2e3134', divider:'#3a3d41', text:'#ececec', secondary:'#a4a8ad', accent:'#ff9f1c'},
  oled:     {background:'#000000', tiles:'#111111', divider:'#1f1f1f', text:'#f2f2f2', secondary:'#9a9a9a', accent:'#00c853'},
  mineral:  {background:'#151c19', tiles:'#1f2925', divider:'#2b3732', text:'#e7efeb', secondary:'#9fb2a9', accent:'#6fbf8f'},
  // Styled themes: own fonts, borders and effects (CSS below, `.host[data-theme=…]`).
  claude:   {background:'#262624', tiles:'#262624', divider:'#45423e', text:'#ebe8e4', secondary:'#a8a29b', accent:'#d97757', faint:'#7a756e', ok:'#8fbf6a', warn:'#e5b45a', err:'#e5735f', park:'#d97757', radius:'0', fonts:'family=JetBrains+Mono:wght@400;500;600'},
  tesla:    {background:'#000000', tiles:'transparent', divider:'#1f1f1f', text:'#f2f2f2', secondary:'#8e8e8e', accent:'#3e6ae1', faint:'#5c5c5c', ok:'#3e6ae1', warn:'#e8a33d', err:'#e82127', park:'#3e6ae1', radius:'6px', fonts:'family=Inter:wght@200;300;400;500'},
  gradient: {background:'rgba(255,255,255,.12)', tiles:'rgba(255,255,255,.10)', divider:'rgba(255,255,255,.22)', text:'#ffffff', secondary:'rgba(255,255,255,.78)', accent:'#ffffff', faint:'rgba(255,255,255,.6)', ok:'#7cffb2', warn:'#ffd36e', err:'#ff7a90', park:'#4f7cff', radius:'26px', fonts:'family=Plus+Jakarta+Sans:wght@400;600;700;800'},
  neon:     {background:'#0d0420', tiles:'#120830', divider:'#3a1466', text:'#f6ecff', secondary:'#b9a2dd', accent:'#00f0ff', faint:'#7d68a3', ok:'#39ff88', warn:'#ffd400', err:'#ff3d7f', park:'#ff2bd6', radius:'4px', fonts:'family=Rajdhani:wght@500;600;700&family=Orbitron:wght@500;700'},
  paper:    {background:'#fbf8f1', tiles:'transparent', divider:'#d7cdb9', text:'#1c1915', secondary:'#6b6254', accent:'#b4532a', faint:'#958b7a', ok:'#2e7d32', warn:'#bf5b00', err:'#b71c1c', park:'#1c1915', radius:'2px', fonts:'family=Inter:wght@400;500;600;700&family=Fraunces:ital,wght@0,500;0,600;1,600'},
  offroad:  {background:'#262920', tiles:'#30342a', divider:'#454a3a', text:'#ece5cf', secondary:'#b6ad91', accent:'#e2a33b', faint:'#878067', ok:'#9ccc65', warn:'#e2a33b', err:'#ef5b3b', park:'#e2a33b', radius:'3px', fonts:'family=Saira:wght@400;500;600&family=Saira+Stencil+One'},
  ios:      {background:'#ffffff', tiles:'#f2f2f7', divider:'#e5e5ea', text:'#000000', secondary:'#8e8e93', accent:'#007aff', faint:'#aeaeb2', ok:'#34c759', warn:'#ff9500', err:'#ff3b30', park:'#007aff', radius:'22px', fonts:'family=Inter:wght@400;500;600;700'},
  ios_dark: {background:'#1c1c1e', tiles:'#2c2c2e', divider:'#38383a', text:'#ffffff', secondary:'#8e8e93', accent:'#0a84ff', faint:'#636366', ok:'#30d158', warn:'#ff9f0a', err:'#ff453a', park:'#0a84ff', radius:'22px', fonts:'family=Inter:wght@400;500;600;700'},
};
const THEME_KEYS = ['background', 'tiles', 'divider', 'text', 'secondary', 'accent'];
const toHex = (c) => Array.isArray(c) ? '#' + c.slice(0, 3).map(x => Math.max(0, Math.min(255, Math.round(Number(x) || 0))).toString(16).padStart(2, '0')).join('') : (typeof c === 'string' ? c.trim() : null);
const toRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : null; };
const cssRgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (m) return m[1].split(',').slice(0, 3).map(Number); return toRgb(s); };
const luma = (h) => { const c = toRgb(h); return c ? (0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]) / 255 : 0; };
const mix = (a, b, w) => { const x = toRgb(a), y = toRgb(b); return x && y ? toHex(x.map((v, i) => v + (y[i] - v) * w)) : a; };
// Styled themes use web fonts; load them once into the page (shadow DOM uses document fonts).
const _fonts = new Set();
function loadFonts(spec){
  if (_fonts.has(spec)) return; _fonts.add(spec);
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?${spec}&display=swap`;
  document.head.appendChild(l);
}
const _painted = new Map();
const _loadImg = (src) => new Promise((ok, bad) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = bad; i.src = src; });
// Recolour the body of the black drawing: masked pixels take the target colour, shaded by the
// original brightness; chrome and highlights blend toward white; saturated pixels (lights) stay.
async function paint(view, hex){
  const src = asset(`images/leopard3_${view}.png`);
  if (!hex) return src;
  const key = view + hex;
  if (_painted.has(key)) return _painted.get(key);
  const job = (async () => {
    const [img, mask] = await Promise.all([_loadImg(src), _loadImg(asset(`images/leopard3_${view}_mask.png`))]);
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', {willReadFrequently: true});
    g.drawImage(mask, 0, 0); const m = g.getImageData(0, 0, w, h).data;
    g.clearRect(0, 0, w, h); g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, w, h), p = id.data;
    const tr = parseInt(hex.slice(1,3),16)/255, tg = parseInt(hex.slice(3,5),16)/255, tb = parseInt(hex.slice(5,7),16)/255;
    const tl = 0.2126*tr + 0.7152*tg + 0.0722*tb, base = 0.30 + 0.45*tl;
    for (let i = 0; i < p.length; i += 4){
      const wgt = m[i] / 255; if (wgt <= 0) continue;
      const r = p[i], gg = p[i+1], b = p[i+2];
      const mx = Math.max(r,gg,b), mn = Math.min(r,gg,b);
      if ((mx-mn)/(mx+1e-6) > 0.35 && mx > 90) continue;
      const L = (0.2126*r + 0.7152*gg + 0.0722*b) / 255;
      const shade = Math.min(1.15, base + 2.1*L), hl = Math.max(0, (L-0.42)/0.4);
      const nr = Math.min(255, (tr*shade*(1-hl)+hl)*255), ng = Math.min(255, (tg*shade*(1-hl)+hl)*255), nb = Math.min(255, (tb*shade*(1-hl)+hl)*255);
      p[i] = r + (nr-r)*wgt; p[i+1] = gg + (ng-gg)*wgt; p[i+2] = b + (nb-b)*wgt;
    }
    g.putImageData(id, 0, 0);
    return c.toDataURL('image/png');
  })().catch(() => src);
  _painted.set(key, job);
  return job;
}

/* ---------- Leaflet (bundled, loaded once) ---------- */
let _leaflet;
function loadLeaflet(){
  if (window.L) return Promise.resolve(window.L);
  if (_leaflet) return _leaflet;
  _leaflet = new Promise((ok, bad) => {
    const s = document.createElement('script');
    s.src = asset('leaflet/leaflet.js'); s.onload = () => ok(window.L); s.onerror = bad;
    document.head.appendChild(s);
  });
  return _leaflet;
}
let _leafletCss;
const leafletCss = () => _leafletCss ||= fetch(asset('leaflet/leaflet.css')).then(r => r.text()).catch(() => '');

/* ---------- Strings ---------- */
const STR = (() => { const s = {
  uk: {
    locale:'uk-UA', days:['нд','пн','вт','ср','чт','пт','сб'],
    s:'с', min:'хв', h:'год', ago:'{v} тому', km:'км', kmh:'км/год', kwh:'кВт·год', kw:'кВт', v:'В', a:'А', mv:'мВ',
    charging:'Заряджається', dc_charging:'Швидка DC-зарядка', driving:'У русі', parked:'Стоїть',
    not_connected:'Не підключено', connected:'{g} підключено', climate:'Клімат {t}°', dc_fast:'DC швидка',
    parking:'паркування', range:'Запас ходу', of_cap:'≈ {u} з {c} кВт·год',
    sec_charging:'Заряджання', sec_battery:'Батарея', sec_motion:'Рух', sec_climate:'Клімат', sec_body:'Шини, двері, вікна',
    session:'За сесію', to_target:'До {t}% залишилось', finish_at:'Завершення о {t}', finish_tomorrow:'Завершення завтра о {t}', taper:'після 80% DC сповільнюється',
    state:'Стан', not_charging:'Не заряджається', gun:'Пістолет: {g}', gun_off:'відключено', last_session:'Остання сесія',
    power:'Потужність', charging_l:'заряджання', discharge:'розряд', idle:'простій', voltage:'Напруга', current:'Струм',
    batt_temp:'Темп. батареї', minmax:'мін {a}° · макс {b}°', capacity:'Ємність', nominal:'номінальна', soh:'Стан (SoH)',
    cells:'Комірки', cells_sub:'мін {a} · Δ {d} мВ', aux:'12 В', vstate:'Стан авто',
    speed:'Швидкість', motors:'Мотори', front_rear:'перед / зад', rpm:'Оберти', front_motor:'передній мотор',
    cabin:'Салон', outside:'Надворі', setpoint:'Задано', ac_fan:'A/C {a} · вентилятор {f}', on:'увімк.', off:'вимк.',
    seat:'Сидіння водія', heat:'підігрів', wheel:'Кермо', off_v:'Вимк.', on_v:'Увімк.', roof:'Люк / шторка', closed_v:'Закрито', shade:'шторка: {s}', open_f:'відкрита',
    hood:'Капот {s}', trunk:'Багажник {s}', open_n:'відкрито', closed_n:'закрито',
    lf:'Водій', rf:'Пасажир', lr:'Зад. лів.', rr:'Зад. прав.', win_open:'Вікна відкриті: {w}', win_closed:'Вікна закриті',
    tyre_ok:'Норма', tyre_low:'Низький', tyre_high:'Високий',
    updated:'Оновлено', last_packet:'Останній пакет',
    no_link:'Немає зв’язку', asleep:'Авто спить', no_data:'Дані з авто не надходять', mm_off:'Мультимедіа вимкнена, дані не надходять',
    no_data_p:'Останній пакет прийшов <b id="ago">{a}</b>, коли машина {s}. Перевір інтернет у машині або застосунок BYDMate.',
    asleep_p:'Останній пакет прийшов <b id="ago">{a}</b>.', st_parked:'стояла', st_charging:'заряджалась (AC)',
    last_place:'Остання відома локація: {p}', last_trip:'Остання поїздка: {a}–{b}, {k} км',
    // alerts
    a_tyre_low:'Низький тиск: {w} {p} bar', a_tyre_flat:'Спущене колесо: {w} {p} bar',
    w_fl:'передня ліва', w_fr:'передня права', w_rl:'задня ліва', w_rr:'задня права',
    a_soc_low:'Низький заряд: {s}%', a_soc_crit:'Критичний заряд: {s}%', a_soc_charging:'Низький заряд {s}%, заряджається',
    a_aux:'Низька напруга 12 В: {v} В', a_batt_hot:'Батарея гаряча: {t}°C', a_cells:'Розбаланс комірок: {d} мВ',
    a_door:'Відчинено: {w}', a_unlocked:'Не замкнено: {w}', a_windows:'Відкриті вікна: {w}',
    d_lf:'двері водія', d_rf:'двері пасажира', d_lr:'задні ліві двері', d_rr:'задні праві двері', d_hood:'капот', d_trunk:'багажник',
    more:'Ще {n}', less:'Згорнути',
    // trips
    trips:'Поїздки', today:'Сьогодні', week:'7 днів', distance:'Відстань', energy:'Енергія', average:'Середнє', count:'Поїздок',
    pw_low:'до 15', pw_high:'27+ кВт', pw_na:'немає даних', h_time:'час', h_dur:'трив.', h_km:'км', now:'зараз', no_trips:'За цей період поїздок немає',
    consumption:'Витрата', duration:'Тривалість', moving:'у русі {d}', avg_speed:'Сер. швидкість', over_moving:'за час у русі',
    battery:'Батарея', gps:'Точок GPS', per_sec:'1 пакет/с', start:'Старт', finish:'Фініш', on_road:'в дорозі', map_fail:'Карта не завантажилась (немає інтернету)',
    // editor
    ed_title:'Візуальний редактор картки', ed_layout:'Варіант картки', l_car:'Авто', l_trips:'Поїздки', l_combo:'Комплект',
    ed_lang:'Мова', ed_alerts:'Показувати сповіщення', ed_seat:'Показувати підігрів сидіння', ed_wheel:'Показувати підігрів керма',
    ed_low_soc:'Поріг низького заряду, %', ed_tyre:'Мінімальний тиск шин, bar', ed_target:'Ціль заряду, %', ed_yaml:'YAML',
  },
  en: {
    locale:'en-GB', days:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    s:'s', min:'min', h:'h', ago:'{v} ago', km:'km', kmh:'km/h', kwh:'kWh', kw:'kW', v:'V', a:'A', mv:'mV',
    charging:'Charging', dc_charging:'DC fast charging', driving:'Driving', parked:'Parked',
    not_connected:'Not plugged in', connected:'{g} plugged in', climate:'Climate {t}°', dc_fast:'DC fast',
    parking:'parking', range:'Range', of_cap:'≈ {u} of {c} kWh',
    sec_charging:'Charging', sec_battery:'Battery', sec_motion:'Motion', sec_climate:'Climate', sec_body:'Tyres, doors, windows',
    session:'This session', to_target:'{t}% in', finish_at:'Done at {t}', finish_tomorrow:'Done tomorrow at {t}', taper:'DC slows down above 80%',
    state:'State', not_charging:'Not charging', gun:'Plug: {g}', gun_off:'disconnected', last_session:'Last session',
    power:'Power', charging_l:'charging', discharge:'discharging', idle:'idle', voltage:'Voltage', current:'Current',
    batt_temp:'Battery temp', minmax:'min {a}° · max {b}°', capacity:'Capacity', nominal:'nominal', soh:'Health (SoH)',
    cells:'Cells', cells_sub:'min {a} · Δ {d} mV', aux:'12 V', vstate:'Vehicle state',
    speed:'Speed', motors:'Motors', front_rear:'front / rear', rpm:'RPM', front_motor:'front motor',
    cabin:'Cabin', outside:'Outside', setpoint:'Set to', ac_fan:'A/C {a} · fan {f}', on:'on', off:'off',
    seat:'Driver seat', heat:'heating', wheel:'Steering wheel', off_v:'Off', on_v:'On', roof:'Sunroof / shade', closed_v:'Closed', shade:'shade: {s}', open_f:'open',
    hood:'Hood {s}', trunk:'Trunk {s}', open_n:'open', closed_n:'closed',
    lf:'Driver', rf:'Passenger', lr:'Rear left', rr:'Rear right', win_open:'Windows open: {w}', win_closed:'Windows closed',
    tyre_ok:'Normal', tyre_low:'Low', tyre_high:'High',
    updated:'Updated', last_packet:'Last packet',
    no_link:'No connection', asleep:'Car is asleep', no_data:'No data from the car', mm_off:'Head unit is off, no data',
    no_data_p:'The last packet arrived <b id="ago">{a}</b>, while the car was {s}. Check the car’s internet or the BYDMate app.',
    asleep_p:'The last packet arrived <b id="ago">{a}</b>.', st_parked:'parked', st_charging:'charging (AC)',
    last_place:'Last known location: {p}', last_trip:'Last trip: {a}–{b}, {k} km',
    a_tyre_low:'Low tyre pressure: {w} {p} bar', a_tyre_flat:'Flat tyre: {w} {p} bar',
    w_fl:'front left', w_fr:'front right', w_rl:'rear left', w_rr:'rear right',
    a_soc_low:'Low battery: {s}%', a_soc_crit:'Critical battery: {s}%', a_soc_charging:'Low battery {s}%, charging',
    a_aux:'Low 12 V battery: {v} V', a_batt_hot:'Battery is hot: {t}°C', a_cells:'Cell imbalance: {d} mV',
    a_door:'Open: {w}', a_unlocked:'Unlocked: {w}', a_windows:'Windows open: {w}',
    d_lf:'driver door', d_rf:'passenger door', d_lr:'rear left door', d_rr:'rear right door', d_hood:'hood', d_trunk:'trunk',
    more:'{n} more', less:'Show less',
    trips:'Trips', today:'Today', week:'7 days', distance:'Distance', energy:'Energy', average:'Average', count:'Trips',
    pw_low:'under 15', pw_high:'27+ kW', pw_na:'no data', h_time:'time', h_dur:'dur.', h_km:'km', now:'now', no_trips:'No trips in this period',
    consumption:'Consumption', duration:'Duration', moving:'moving {d}', avg_speed:'Avg speed', over_moving:'while moving',
    battery:'Battery', gps:'GPS points', per_sec:'1 packet/s', start:'Start', finish:'Finish', on_road:'on the road', map_fail:'Map failed to load (offline)',
    ed_title:'Card visual editor', ed_layout:'Card layout', l_car:'Car', l_trips:'Trips', l_combo:'Combined',
    ed_lang:'Language', ed_alerts:'Show alerts', ed_seat:'Show seat heating', ed_wheel:'Show steering wheel heating',
    ed_low_soc:'Low battery threshold, %', ed_tyre:'Minimum tyre pressure, bar', ed_target:'Charge target, %', ed_yaml:'YAML',
  },
}; Object.assign(s.uk, {"year": "Рік", "all": "Все", "ed_theme": "Тема картки", "ed_theme_colors": "Кольори теми", "ed_background": "Фон картки", "ed_tiles": "Плитки", "ed_divider": "Лінії", "ed_text": "Текст", "ed_secondary": "Другорядний текст", "ed_accent": "Акцент", "th_ha": "Як у Home Assistant", "th_dark": "Темна", "th_light": "Світла", "th_midnight": "Північ", "th_graphite": "Графіт", "th_oled": "OLED (чорна)", "th_mineral": "Mineral (зелена)", "th_claude": "Claude CLI (термінал)", "th_tesla": "Tesla", "th_gradient": "Градієнтне скло", "th_neon": "Неон", "th_paper": "Папір", "th_offroad": "Off-road (позашляховик)", "th_ios": "iOS", "th_ios_dark": "iOS темна", "d_fl": "двері водія", "d_fr": "двері пасажира", "d_rl": "задні ліві двері", "fl": "Водій", "fr": "Пасажир", "rl": "Зад. лів.", "home": "Дім", "d": "дн", "st_driving": "їхала", "month": "30 днів", "no_vehicle": "Немає жодного авто. Додай інтеграцію BYD Leopard 3 у Налаштування → Пристрої та служби.", "lvl_level_1": "Рівень 1", "lvl_level_2": "Рівень 2", "roof_closed": "Закрито", "roof_open": "Відкрито", "roof_opening": "Відкривається", "roof_closing": "Закривається", "vs_off": "Вимкнено", "vs_on": "Увімкнено", "vs_remote_on": "Дистанційно", "vs_smart_charge": "Розумна зарядка", "vs_press_startup": "Запуск", "vs_bt_on": "Bluetooth", "vs_disinfect": "Дезінфекція", "vs_exhibition": "Виставковий", "lang_auto": "Як у Home Assistant", "col_black": "Obsidian Black (чорний)", "col_white": "Element White (білий)", "col_silver": "Starry Moon Silver (сріблясто-блакитний)", "col_green": "Mineral Green (зелений)", "col_pink": "Micro Light Pink (рожевий)", "col_ice_blue": "Ice Crystal Blue (блакитний)", "col_purple": "Stardust Purple (фіолетовий)", "col_custom": "Свій колір", "ed_entry_id": "Авто", "ed_layout": "Варіант картки", "ed_language": "Мова", "ed_color": "Колір авто", "ed_custom_color": "Свій колір", "ed_show_alerts": "Показувати сповіщення", "ed_show_seat_heat": "Показувати підігрів сидіння", "ed_show_steering_heat": "Показувати підігрів керма", "ed_show_trips_map": "Показувати карту поїздок", "ed_low_soc": "Поріг низького заряду", "ed_tyre_min": "Мінімальний тиск шин", "ed_charge_target": "Ціль заряду", "ed_advanced": "Додатково", "ed_title": "Заголовок (замість назви авто)", "ed_image_side": "Своє зображення збоку (URL)", "ed_image_top": "Своє зображення згори (URL)", "ed_map_tiles": "Свої тайли карти (URL з {z}/{x}/{y})", "edh_image_side": "Для інших моделей BYD. Перефарбування і колеса працюють лише з вбудованим Leopard 3."}); Object.assign(s.en, {"year": "Year", "all": "All", "ed_theme": "Card theme", "ed_theme_colors": "Theme colours", "ed_background": "Card background", "ed_tiles": "Tiles", "ed_divider": "Lines", "ed_text": "Text", "ed_secondary": "Secondary text", "ed_accent": "Accent", "th_ha": "Same as Home Assistant", "th_dark": "Dark", "th_light": "Light", "th_midnight": "Midnight", "th_graphite": "Graphite", "th_oled": "OLED (black)", "th_mineral": "Mineral (green)", "th_claude": "Claude CLI (terminal)", "th_tesla": "Tesla", "th_gradient": "Gradient Glass", "th_neon": "Neon", "th_paper": "Paper", "th_offroad": "Off-road", "th_ios": "iOS", "th_ios_dark": "iOS Dark", "d_fl": "driver door", "d_fr": "passenger door", "d_rl": "rear left door", "fl": "Driver", "fr": "Passenger", "rl": "Rear left", "home": "Home", "d": "d", "st_driving": "driving", "month": "30 days", "no_vehicle": "No car yet. Add the BYD Leopard 3 integration in Settings → Devices & services.", "lvl_level_1": "Level 1", "lvl_level_2": "Level 2", "roof_closed": "Closed", "roof_open": "Open", "roof_opening": "Opening", "roof_closing": "Closing", "vs_off": "Off", "vs_on": "On", "vs_remote_on": "Remote on", "vs_smart_charge": "Smart charge", "vs_press_startup": "Starting", "vs_bt_on": "Bluetooth", "vs_disinfect": "Disinfection", "vs_exhibition": "Exhibition", "lang_auto": "Same as Home Assistant", "col_black": "Obsidian Black", "col_white": "Element White", "col_silver": "Starry Moon Silver", "col_green": "Mineral Green", "col_pink": "Micro Light Pink", "col_ice_blue": "Ice Crystal Blue", "col_purple": "Stardust Purple", "col_custom": "Custom colour", "ed_entry_id": "Car", "ed_layout": "Card layout", "ed_language": "Language", "ed_color": "Car colour", "ed_custom_color": "Custom colour", "ed_show_alerts": "Show alerts", "ed_show_seat_heat": "Show seat heating", "ed_show_steering_heat": "Show steering wheel heating", "ed_show_trips_map": "Show trips map", "ed_low_soc": "Low battery threshold", "ed_tyre_min": "Minimum tyre pressure", "ed_charge_target": "Charge target", "ed_advanced": "Advanced", "ed_title": "Title (instead of the car name)", "ed_image_side": "Custom side image (URL)", "ed_image_top": "Custom top image (URL)", "ed_map_tiles": "Custom map tiles (URL with {z}/{x}/{y})", "edh_image_side": "For other BYD models. Recolouring and spinning wheels only work with the built-in Leopard 3 drawing."}); /* i18n:extra */ Object.assign(s, {"de":{"locale":"de-DE","days":["So","Mo","Di","Mi","Do","Fr","Sa"],"s":"s","min":"min","h":"h","ago":"vor {v}","km":"km","kmh":"km/h","kwh":"kWh","kw":"kW","v":"V","a":"A","mv":"mV","charging":"Lädt","dc_charging":"DC-Schnellladen","driving":"Fährt","parked":"Geparkt","not_connected":"Nicht eingesteckt","connected":"{g} eingesteckt","climate":"Klima {t}°","dc_fast":"DC-schnell","parking":"Parken","range":"Reichweite","of_cap":"≈ {u} von {c} kWh","sec_charging":"Laden","sec_battery":"Batterie","sec_motion":"Fahrt","sec_climate":"Klima","sec_body":"Reifen, Türen, Fenster","session":"Diese Sitzung","to_target":"{t}% in","finish_at":"Fertig um {t}","finish_tomorrow":"Fertig morgen um {t}","taper":"DC wird über 80% langsamer","state":"Status","not_charging":"Lädt nicht","gun":"Stecker: {g}","gun_off":"getrennt","last_session":"Letzte Sitzung","power":"Leistung","charging_l":"Laden","discharge":"Entladen","idle":"Leerlauf","voltage":"Spannung","current":"Strom","batt_temp":"Batterietemp.","minmax":"min {a}° · max {b}°","capacity":"Kapazität","nominal":"nominal","soh":"Zustand (SoH)","cells":"Zellen","cells_sub":"min {a} · Δ {d} mV","aux":"12 V","vstate":"Fahrzeugzustand","speed":"Tempo","motors":"Motoren","front_rear":"vorne / hinten","rpm":"U/min","front_motor":"Frontmotor","cabin":"Innen","outside":"Außen","setpoint":"Soll","ac_fan":"Klima {a} · Lüfter {f}","on":"an","off":"aus","seat":"Fahrersitz","heat":"Heizung","wheel":"Lenkrad","off_v":"Aus","on_v":"An","roof":"Dach / Rollo","closed_v":"Geschlossen","shade":"Rollo: {s}","open_f":"offen","hood":"Motorhaube {s}","trunk":"Kofferraum {s}","open_n":"offen","closed_n":"zu","lf":"Fahrer","rf":"Beifahrer","lr":"Hinten li.","rr":"Hinten re.","win_open":"Fenster offen: {w}","win_closed":"Fenster zu","tyre_ok":"Normal","tyre_low":"Niedrig","tyre_high":"Hoch","updated":"Aktualisiert","last_packet":"Letztes Paket","no_link":"Keine Verbindung","asleep":"Fahrzeug schläft","no_data":"Keine Daten vom Fahrzeug","mm_off":"Infotainment aus, keine Daten","no_data_p":"Das letzte Paket kam <b id=\"ago\">{a}</b>, als das Fahrzeug {s} war. Prüfen Sie die Internetverbindung des Fahrzeugs oder die BYDMate-App.","asleep_p":"Das letzte Paket kam <b id=\"ago\">{a}</b>.","st_parked":"geparkt","st_charging":"am Laden (AC)","last_place":"Letzter bekannter Standort: {p}","last_trip":"Letzte Fahrt: {a}–{b}, {k} km","a_tyre_low":"Niedriger Reifendruck: {w} {p} bar","a_tyre_flat":"Reifenpanne: {w} {p} bar","w_fl":"vorne links","w_fr":"vorne rechts","w_rl":"hinten links","w_rr":"hinten rechts","a_soc_low":"Akku niedrig: {s}%","a_soc_crit":"Akku kritisch: {s}%","a_soc_charging":"Akku niedrig {s}%, lädt","a_aux":"12-V-Batterie schwach: {v} V","a_batt_hot":"Batterie heiß: {t}°C","a_cells":"Zellungleichgewicht: {d} mV","a_door":"Offen: {w}","a_unlocked":"Entriegelt: {w}","a_windows":"Fenster offen: {w}","d_lf":"Fahrertür","d_rf":"Beifahrertür","d_lr":"Tür hinten links","d_rr":"Tür hinten rechts","d_hood":"Motorhaube","d_trunk":"Kofferraum","more":"{n} weitere","less":"Weniger anzeigen","trips":"Fahrten","today":"Heute","week":"7 Tage","distance":"Strecke","energy":"Energie","average":"Durchschnitt","count":"Fahrten","pw_low":"unter 15","pw_high":"27+ kW","pw_na":"keine Daten","h_time":"Zeit","h_dur":"Dauer","h_km":"km","now":"jetzt","no_trips":"Keine Fahrten in diesem Zeitraum","consumption":"Verbrauch","duration":"Dauer","moving":"in Bewegung {d}","avg_speed":"Ø Tempo","over_moving":"in Bewegung","battery":"Batterie","gps":"GPS-Punkte","per_sec":"1 Paket/s","start":"Start","finish":"Ziel","on_road":"unterwegs","map_fail":"Karte konnte nicht geladen werden (offline)","ed_title":"Titel (statt Fahrzeugname)","ed_layout":"Kartenlayout","l_car":"Fahrzeug","l_trips":"Fahrten","l_combo":"Kombiniert","ed_lang":"Sprache","ed_alerts":"Warnungen anzeigen","ed_seat":"Sitzheizung anzeigen","ed_wheel":"Lenkradheizung anzeigen","ed_low_soc":"Schwelle niedriger Akkustand","ed_tyre":"Minimaler Reifendruck, bar","ed_target":"Ladeziel, %","ed_yaml":"YAML","year":"Jahr","all":"Alle","ed_theme":"Kartendesign","ed_theme_colors":"Designfarben","ed_background":"Kartenhintergrund","ed_tiles":"Kacheln","ed_divider":"Linien","ed_text":"Text","ed_secondary":"Sekundärtext","ed_accent":"Akzent","th_ha":"Wie Home Assistant","th_dark":"Dunkel","th_light":"Hell","th_midnight":"Mitternacht","th_graphite":"Graphit","th_oled":"OLED (schwarz)","th_mineral":"Mineral (grün)","th_claude":"Claude CLI (Terminal)","th_tesla":"Tesla","th_gradient":"Gradient Glass","th_neon":"Neon","th_paper":"Papier","th_offroad":"Offroad","th_ios":"iOS","th_ios_dark":"iOS Dunkel","d_fl":"Fahrertür","d_fr":"Beifahrertür","d_rl":"Tür hinten links","fl":"Fahrer","fr":"Beifahrer","rl":"Hinten li.","home":"Zuhause","d":"T","st_driving":"Fahrt","month":"30 Tage","no_vehicle":"Noch kein Fahrzeug. Fügen Sie die Integration BYD Leopard 3 unter Einstellungen → Geräte & Dienste hinzu.","lvl_level_1":"Stufe 1","lvl_level_2":"Stufe 2","roof_closed":"Geschlossen","roof_open":"Offen","roof_opening":"Öffnet","roof_closing":"Schließt","vs_off":"Aus","vs_on":"An","vs_remote_on":"Fern-Ein","vs_smart_charge":"Smart Charge","vs_press_startup":"Startet","vs_bt_on":"Bluetooth","vs_disinfect":"Desinfektion","vs_exhibition":"Ausstellungsmodus","lang_auto":"Wie Home Assistant","col_black":"Obsidian Black","col_white":"Element White","col_silver":"Starry Moon Silver","col_green":"Mineral Green","col_pink":"Micro Light Pink","col_ice_blue":"Ice Crystal Blue","col_purple":"Stardust Purple","col_custom":"Eigene Farbe","ed_entry_id":"Fahrzeug","ed_language":"Sprache","ed_color":"Fahrzeugfarbe","ed_custom_color":"Eigene Farbe","ed_show_alerts":"Warnungen anzeigen","ed_show_seat_heat":"Sitzheizung anzeigen","ed_show_steering_heat":"Lenkradheizung anzeigen","ed_show_trips_map":"Fahrtenkarte anzeigen","ed_tyre_min":"Minimaler Reifendruck","ed_charge_target":"Ladeziel","ed_advanced":"Erweitert","ed_image_side":"Eigenes Seitenbild (URL)","ed_image_top":"Eigenes Bild von oben (URL)","ed_map_tiles":"Eigene Kartenkacheln (URL mit {z}/{x}/{y})","edh_image_side":"Für andere BYD-Modelle. Umfärben und drehende Räder funktionieren nur mit der integrierten Leopard 3-Zeichnung."},"es":{"locale":"es-ES","days":["dom","lun","mar","mié","jue","vie","sáb"],"s":"s","min":"min","h":"h","ago":"hace {v}","km":"km","kmh":"km/h","kwh":"kWh","kw":"kW","v":"V","a":"A","mv":"mV","charging":"Cargando","dc_charging":"Carga rápida DC","driving":"En marcha","parked":"Aparcado","not_connected":"No enchufado","connected":"{g} enchufado","climate":"Clima {t}°","dc_fast":"DC rápida","parking":"aparcado","range":"Autonomía","of_cap":"≈ {u} de {c} kWh","sec_charging":"Carga","sec_battery":"Batería","sec_motion":"Conducción","sec_climate":"Climatización","sec_body":"Neumáticos, puertas, ventanillas","session":"Esta sesión","to_target":"{t}% en","finish_at":"Termina a las {t}","finish_tomorrow":"Termina mañana a las {t}","taper":"La carga DC se ralentiza por encima del 80%","state":"Estado","not_charging":"Sin cargar","gun":"Conector: {g}","gun_off":"desconectado","last_session":"Última sesión","power":"Potencia","charging_l":"cargando","discharge":"descargando","idle":"en reposo","voltage":"Tensión","current":"Corriente","batt_temp":"Temp. batería","minmax":"mín {a}° · máx {b}°","capacity":"Capacidad","nominal":"nominal","soh":"Salud (SoH)","cells":"Celdas","cells_sub":"mín {a} · Δ {d} mV","aux":"12 V","vstate":"Estado del coche","speed":"Velocidad","motors":"Motores","front_rear":"delantero / trasero","rpm":"RPM","front_motor":"motor delantero","cabin":"Habitáculo","outside":"Exterior","setpoint":"Consigna","ac_fan":"A/A {a} · vent. {f}","on":"encendido","off":"apagado","seat":"Asiento cond.","heat":"calefacción","wheel":"Volante","off_v":"Apagado","on_v":"Encendido","roof":"Techo / cortina","closed_v":"Cerrado","shade":"cortinilla: {s}","open_f":"abierta","hood":"Capó {s}","trunk":"Maletero {s}","open_n":"abierto","closed_n":"cerrado","lf":"Conductor","rf":"Acompañante","lr":"Tras. izq.","rr":"Tras. der.","win_open":"Ventanillas abiertas: {w}","win_closed":"Ventanillas cerradas","tyre_ok":"Normal","tyre_low":"Baja","tyre_high":"Alta","updated":"Actualizado","last_packet":"Último paquete","no_link":"Sin conexión","asleep":"El coche está en reposo","no_data":"Sin datos del coche","mm_off":"Pantalla central apagada, sin datos","no_data_p":"El último paquete llegó <b id=\"ago\">{a}</b>, cuando el coche estaba {s}. Comprueba la conexión a Internet del coche o la aplicación BYDMate.","asleep_p":"El último paquete llegó <b id=\"ago\">{a}</b>.","st_parked":"aparcado","st_charging":"cargando (AC)","last_place":"Última ubicación conocida: {p}","last_trip":"Último viaje: {a}–{b}, {k} km","a_tyre_low":"Presión baja: {w} {p} bar","a_tyre_flat":"Pinchazo: {w} {p} bar","w_fl":"delantero izquierdo","w_fr":"delantero derecho","w_rl":"trasero izquierdo","w_rr":"trasero derecho","a_soc_low":"Batería baja: {s}%","a_soc_crit":"Batería crítica: {s}%","a_soc_charging":"Batería baja {s}%, cargando","a_aux":"Batería de 12 V baja: {v} V","a_batt_hot":"Batería caliente: {t}°C","a_cells":"Desequilibrio de celdas: {d} mV","a_door":"Abierto: {w}","a_unlocked":"Desbloqueado: {w}","a_windows":"Ventanillas abiertas: {w}","d_lf":"puerta del conductor","d_rf":"puerta del acompañante","d_lr":"puerta trasera izquierda","d_rr":"puerta trasera derecha","d_hood":"capó","d_trunk":"maletero","more":"{n} más","less":"Mostrar menos","trips":"Viajes","today":"Hoy","week":"7 días","distance":"Distancia","energy":"Energía","average":"Media","count":"Viajes","pw_low":"menos de 15","pw_high":"27+ kW","pw_na":"sin datos","h_time":"hora","h_dur":"dur.","h_km":"km","now":"ahora","no_trips":"No hay viajes en este periodo","consumption":"Consumo","duration":"Duración","moving":"en movimiento {d}","avg_speed":"Vel. media","over_moving":"en movimiento","battery":"Batería","gps":"Puntos GPS","per_sec":"1 paquete/s","start":"Inicio","finish":"Fin","on_road":"en carretera","map_fail":"No se pudo cargar el mapa (sin conexión)","ed_title":"Título (en lugar del nombre del coche)","ed_layout":"Diseño de la tarjeta","l_car":"Coche","l_trips":"Viajes","l_combo":"Combinado","ed_lang":"Idioma","ed_alerts":"Mostrar alertas","ed_seat":"Mostrar calefacción del asiento","ed_wheel":"Mostrar calefacción del volante","ed_low_soc":"Umbral de batería baja","ed_tyre":"Presión mínima de neumáticos, bar","ed_target":"Objetivo de carga, %","ed_yaml":"YAML","year":"Año","all":"Todo","ed_theme":"Tema de la tarjeta","ed_theme_colors":"Colores del tema","ed_background":"Fondo de la tarjeta","ed_tiles":"Mosaicos","ed_divider":"Líneas","ed_text":"Texto","ed_secondary":"Texto secundario","ed_accent":"Acento","th_ha":"Igual que Home Assistant","th_dark":"Oscuro","th_light":"Claro","th_midnight":"Medianoche","th_graphite":"Grafito","th_oled":"OLED (negro)","th_mineral":"Mineral (verde)","th_claude":"Claude CLI (terminal)","th_tesla":"Tesla","th_gradient":"Gradient Glass","th_neon":"Neón","th_paper":"Papel","th_offroad":"Todoterreno","th_ios":"iOS","th_ios_dark":"iOS oscuro","d_fl":"puerta del conductor","d_fr":"puerta del acompañante","d_rl":"puerta trasera izquierda","fl":"Conductor","fr":"Acompañante","rl":"Tras. izq.","home":"Casa","d":"d","st_driving":"en marcha","month":"30 días","no_vehicle":"Aún no hay ningún coche. Añade la integración BYD Leopard 3 en Ajustes → Dispositivos y servicios.","lvl_level_1":"Nivel 1","lvl_level_2":"Nivel 2","roof_closed":"Cerrado","roof_open":"Abierto","roof_opening":"Abriendo","roof_closing":"Cerrando","vs_off":"Apagado","vs_on":"Encendido","vs_remote_on":"Encendido remoto","vs_smart_charge":"Carga inteligente","vs_press_startup":"Arrancando","vs_bt_on":"Bluetooth","vs_disinfect":"Desinfección","vs_exhibition":"Modo exposición","lang_auto":"Igual que Home Assistant","col_black":"Obsidian Black (negro)","col_white":"Element White (blanco)","col_silver":"Starry Moon Silver (plata)","col_green":"Mineral Green (verde)","col_pink":"Micro Light Pink (rosa)","col_ice_blue":"Ice Crystal Blue (azul hielo)","col_purple":"Stardust Purple (morado)","col_custom":"Color personalizado","ed_entry_id":"Coche","ed_language":"Idioma","ed_color":"Color del coche","ed_custom_color":"Color personalizado","ed_show_alerts":"Mostrar alertas","ed_show_seat_heat":"Mostrar calefacción del asiento","ed_show_steering_heat":"Mostrar calefacción del volante","ed_show_trips_map":"Mostrar mapa de viajes","ed_tyre_min":"Presión mínima de neumáticos","ed_charge_target":"Objetivo de carga","ed_advanced":"Avanzado","ed_image_side":"Imagen lateral personalizada (URL)","ed_image_top":"Imagen superior personalizada (URL)","ed_map_tiles":"Mosaicos de mapa personalizados (URL con {z}/{x}/{y})","edh_image_side":"Para otros modelos BYD. El cambio de color y las ruedas giratorias solo funcionan con el dibujo integrado del Leopard 3."},"fr":{"locale":"fr-FR","days":["dim.","lun.","mar.","mer.","jeu.","ven.","sam."],"s":"s","min":"min","h":"h","ago":"il y a {v}","km":"km","kmh":"km/h","kwh":"kWh","kw":"kW","v":"V","a":"A","mv":"mV","charging":"En charge","dc_charging":"Charge rapide DC","driving":"En route","parked":"Stationnée","not_connected":"Non branchée","connected":"{g} branché","climate":"Clim {t}°","dc_fast":"DC rapide","parking":"stationnement","range":"Autonomie","of_cap":"≈ {u} sur {c} kWh","sec_charging":"Charge","sec_battery":"Batterie","sec_motion":"Conduite","sec_climate":"Climatisation","sec_body":"Pneus, portes, vitres","session":"Cette session","to_target":"{t}% dans","finish_at":"Fin à {t}","finish_tomorrow":"Fin demain à {t}","taper":"La charge DC ralentit au-delà de 80%","state":"État","not_charging":"Pas en charge","gun":"Prise : {g}","gun_off":"déconnectée","last_session":"Dernière session","power":"Puissance","charging_l":"charge","discharge":"décharge","idle":"au repos","voltage":"Tension","current":"Courant","batt_temp":"Temp. batterie","minmax":"min {a}° · max {b}°","capacity":"Capacité","nominal":"nominale","soh":"Santé (SoH)","cells":"Cellules","cells_sub":"min {a} · Δ {d} mV","aux":"12 V","vstate":"État du véhicule","speed":"Vitesse","motors":"Moteurs","front_rear":"avant / arrière","rpm":"tr/min","front_motor":"moteur avant","cabin":"Habitacle","outside":"Extérieur","setpoint":"Consigne","ac_fan":"Clim {a} · ventil. {f}","on":"activée","off":"désactivée","seat":"Siège conducteur","heat":"chauffage","wheel":"Volant","off_v":"Désactivé","on_v":"Activé","roof":"Toit / pare-soleil","closed_v":"Fermé","shade":"pare-soleil : {s}","open_f":"ouvert","hood":"Capot {s}","trunk":"Coffre {s}","open_n":"ouvert","closed_n":"fermé","lf":"Conducteur","rf":"Passager","lr":"Arr. gauche","rr":"Arr. droit","win_open":"Vitres ouvertes : {w}","win_closed":"Vitres fermées","tyre_ok":"Normale","tyre_low":"Basse","tyre_high":"Élevée","updated":"Mis à jour","last_packet":"Dernier paquet","no_link":"Pas de connexion","asleep":"Voiture en veille","no_data":"Aucune donnée de la voiture","mm_off":"Écran central éteint, pas de données","no_data_p":"Le dernier paquet est arrivé <b id=\"ago\">{a}</b>, alors que la voiture était {s}. Vérifiez la connexion Internet de la voiture ou l'application BYDMate.","asleep_p":"Le dernier paquet est arrivé <b id=\"ago\">{a}</b>.","st_parked":"stationnée","st_charging":"en charge (AC)","last_place":"Dernière position connue : {p}","last_trip":"Dernier trajet : {a}–{b}, {k} km","a_tyre_low":"Pression basse : {w} {p} bar","a_tyre_flat":"Pneu crevé : {w} {p} bar","w_fl":"avant gauche","w_fr":"avant droit","w_rl":"arrière gauche","w_rr":"arrière droit","a_soc_low":"Batterie faible : {s}%","a_soc_crit":"Batterie critique : {s}%","a_soc_charging":"Batterie faible {s}%, en charge","a_aux":"Batterie 12 V faible : {v} V","a_batt_hot":"Batterie chaude : {t}°C","a_cells":"Déséquilibre des cellules : {d} mV","a_door":"Ouvert : {w}","a_unlocked":"Déverrouillé : {w}","a_windows":"Vitres ouvertes : {w}","d_lf":"porte conducteur","d_rf":"porte passager","d_lr":"porte arrière gauche","d_rr":"porte arrière droite","d_hood":"capot","d_trunk":"coffre","more":"{n} de plus","less":"Afficher moins","trips":"Trajets","today":"Aujourd'hui","week":"7 jours","distance":"Distance","energy":"Énergie","average":"Moyenne","count":"Trajets","pw_low":"moins de 15","pw_high":"27+ kW","pw_na":"pas de données","h_time":"heure","h_dur":"durée","h_km":"km","now":"maintenant","no_trips":"Aucun trajet sur cette période","consumption":"Consommation","duration":"Durée","moving":"en mouvement {d}","avg_speed":"Vitesse moy.","over_moving":"en mouvement","battery":"Batterie","gps":"Points GPS","per_sec":"1 paquet/s","start":"Départ","finish":"Arrivée","on_road":"sur la route","map_fail":"Échec du chargement de la carte (hors ligne)","ed_title":"Titre (à la place du nom de la voiture)","ed_layout":"Disposition de la carte","l_car":"Voiture","l_trips":"Trajets","l_combo":"Combinée","ed_lang":"Langue","ed_alerts":"Afficher les alertes","ed_seat":"Afficher le chauffage du siège","ed_wheel":"Afficher le volant chauffant","ed_low_soc":"Seuil de batterie faible","ed_tyre":"Pression minimale des pneus, bar","ed_target":"Objectif de charge, %","ed_yaml":"YAML","year":"Année","all":"Tout","ed_theme":"Thème de la carte","ed_theme_colors":"Couleurs du thème","ed_background":"Arrière-plan de la carte","ed_tiles":"Tuiles","ed_divider":"Lignes","ed_text":"Texte","ed_secondary":"Texte secondaire","ed_accent":"Accent","th_ha":"Comme Home Assistant","th_dark":"Sombre","th_light":"Clair","th_midnight":"Minuit","th_graphite":"Graphite","th_oled":"OLED (noir)","th_mineral":"Mineral (vert)","th_claude":"Claude CLI (terminal)","th_tesla":"Tesla","th_gradient":"Gradient Glass","th_neon":"Néon","th_paper":"Papier","th_offroad":"Tout-terrain","th_ios":"iOS","th_ios_dark":"iOS sombre","d_fl":"porte conducteur","d_fr":"porte passager","d_rl":"porte arrière gauche","fl":"Conducteur","fr":"Passager","rl":"Arr. gauche","home":"Domicile","d":"j","st_driving":"en route","month":"30 jours","no_vehicle":"Aucune voiture pour l'instant. Ajoutez l'intégration BYD Leopard 3 dans Paramètres → Appareils et services.","lvl_level_1":"Niveau 1","lvl_level_2":"Niveau 2","roof_closed":"Fermé","roof_open":"Ouvert","roof_opening":"Ouverture","roof_closing":"Fermeture","vs_off":"Éteint","vs_on":"Allumé","vs_remote_on":"Démarrage à distance","vs_smart_charge":"Charge intelligente","vs_press_startup":"Démarrage","vs_bt_on":"Bluetooth","vs_disinfect":"Désinfection","vs_exhibition":"Mode exposition","lang_auto":"Comme Home Assistant","col_black":"Obsidian Black (noir)","col_white":"Element White (blanc)","col_silver":"Starry Moon Silver (argent)","col_green":"Mineral Green (vert)","col_pink":"Micro Light Pink (rose)","col_ice_blue":"Ice Crystal Blue (bleu glacier)","col_purple":"Stardust Purple (violet)","col_custom":"Couleur personnalisée","ed_entry_id":"Voiture","ed_language":"Langue","ed_color":"Couleur de la voiture","ed_custom_color":"Couleur personnalisée","ed_show_alerts":"Afficher les alertes","ed_show_seat_heat":"Afficher le chauffage du siège","ed_show_steering_heat":"Afficher le volant chauffant","ed_show_trips_map":"Afficher la carte des trajets","ed_tyre_min":"Pression minimale des pneus","ed_charge_target":"Objectif de charge","ed_advanced":"Avancé","ed_image_side":"Image de profil personnalisée (URL)","ed_image_top":"Image vue de dessus personnalisée (URL)","ed_map_tiles":"Tuiles de carte personnalisées (URL avec {z}/{x}/{y})","edh_image_side":"Pour les autres modèles BYD. Le changement de couleur et les roues animées ne fonctionnent qu'avec le dessin intégré de la Leopard 3."},"it":{"locale":"it-IT","days":["dom","lun","mar","mer","gio","ven","sab"],"s":"s","min":"min","h":"h","ago":"{v} fa","km":"km","kmh":"km/h","kwh":"kWh","kw":"kW","v":"V","a":"A","mv":"mV","charging":"In carica","dc_charging":"Ricarica rapida DC","driving":"In marcia","parked":"Parcheggiata","not_connected":"Non collegata","connected":"{g} collegato","climate":"Clima {t}°","dc_fast":"DC rapida","parking":"parcheggio","range":"Autonomia","of_cap":"≈ {u} di {c} kWh","sec_charging":"Ricarica","sec_battery":"Batteria","sec_motion":"Guida","sec_climate":"Clima","sec_body":"Pneumatici, porte, finestrini","session":"Questa sessione","to_target":"{t}% tra","finish_at":"Fine alle {t}","finish_tomorrow":"Fine domani alle {t}","taper":"La ricarica DC rallenta oltre l'80%","state":"Stato","not_charging":"Non in carica","gun":"Connettore: {g}","gun_off":"scollegato","last_session":"Ultima sessione","power":"Potenza","charging_l":"in carica","discharge":"in scarica","idle":"inattiva","voltage":"Tensione","current":"Corrente","batt_temp":"Temp. batteria","minmax":"min {a}° · max {b}°","capacity":"Capacità","nominal":"nominale","soh":"Salute (SoH)","cells":"Celle","cells_sub":"min {a} · Δ {d} mV","aux":"12 V","vstate":"Stato veicolo","speed":"Velocità","motors":"Motori","front_rear":"anteriore / posteriore","rpm":"giri/min","front_motor":"motore anteriore","cabin":"Abitacolo","outside":"Esterno","setpoint":"Impostata","ac_fan":"A/C {a} · ventola {f}","on":"acceso","off":"spento","seat":"Sedile guida","heat":"riscaldamento","wheel":"Volante","off_v":"Spento","on_v":"Acceso","roof":"Tetto / tendina","closed_v":"Chiuso","shade":"tendina: {s}","open_f":"aperta","hood":"Cofano {s}","trunk":"Bagagliaio {s}","open_n":"aperto","closed_n":"chiuso","lf":"Conducente","rf":"Passeggero","lr":"Post. sx","rr":"Post. dx","win_open":"Finestrini aperti: {w}","win_closed":"Finestrini chiusi","tyre_ok":"Normale","tyre_low":"Bassa","tyre_high":"Alta","updated":"Aggiornato","last_packet":"Ultimo pacchetto","no_link":"Nessuna connessione","asleep":"L'auto è in standby","no_data":"Nessun dato dall'auto","mm_off":"Display centrale spento, nessun dato","no_data_p":"L'ultimo pacchetto è arrivato <b id=\"ago\">{a}</b>, mentre l'auto era {s}. Controlla la connessione Internet dell'auto o l'app BYDMate.","asleep_p":"L'ultimo pacchetto è arrivato <b id=\"ago\">{a}</b>.","st_parked":"parcheggiata","st_charging":"in carica (AC)","last_place":"Ultima posizione nota: {p}","last_trip":"Ultimo viaggio: {a}–{b}, {k} km","a_tyre_low":"Pressione bassa: {w} {p} bar","a_tyre_flat":"Pneumatico a terra: {w} {p} bar","w_fl":"anteriore sinistro","w_fr":"anteriore destro","w_rl":"posteriore sinistro","w_rr":"posteriore destro","a_soc_low":"Batteria scarica: {s}%","a_soc_crit":"Batteria critica: {s}%","a_soc_charging":"Batteria scarica {s}%, in carica","a_aux":"Batteria 12 V scarica: {v} V","a_batt_hot":"Batteria calda: {t}°C","a_cells":"Squilibrio celle: {d} mV","a_door":"Aperto: {w}","a_unlocked":"Sbloccato: {w}","a_windows":"Finestrini aperti: {w}","d_lf":"porta conducente","d_rf":"porta passeggero","d_lr":"porta posteriore sinistra","d_rr":"porta posteriore destra","d_hood":"cofano","d_trunk":"bagagliaio","more":"altri {n}","less":"Mostra meno","trips":"Viaggi","today":"Oggi","week":"7 giorni","distance":"Distanza","energy":"Energia","average":"Media","count":"Viaggi","pw_low":"sotto 15","pw_high":"27+ kW","pw_na":"nessun dato","h_time":"ora","h_dur":"durata","h_km":"km","now":"ora","no_trips":"Nessun viaggio in questo periodo","consumption":"Consumo","duration":"Durata","moving":"in movimento {d}","avg_speed":"Vel. media","over_moving":"in movimento","battery":"Batteria","gps":"Punti GPS","per_sec":"1 pacchetto/s","start":"Partenza","finish":"Arrivo","on_road":"in viaggio","map_fail":"Impossibile caricare la mappa (offline)","ed_title":"Titolo (al posto del nome dell'auto)","ed_layout":"Layout della scheda","l_car":"Auto","l_trips":"Viaggi","l_combo":"Combinato","ed_lang":"Lingua","ed_alerts":"Mostra avvisi","ed_seat":"Mostra riscaldamento sedile","ed_wheel":"Mostra riscaldamento volante","ed_low_soc":"Soglia batteria scarica","ed_tyre":"Pressione minima pneumatici, bar","ed_target":"Obiettivo di ricarica, %","ed_yaml":"YAML","year":"Anno","all":"Tutto","ed_theme":"Tema della scheda","ed_theme_colors":"Colori del tema","ed_background":"Sfondo della scheda","ed_tiles":"Riquadri","ed_divider":"Linee","ed_text":"Testo","ed_secondary":"Testo secondario","ed_accent":"Accento","th_ha":"Come Home Assistant","th_dark":"Scuro","th_light":"Chiaro","th_midnight":"Mezzanotte","th_graphite":"Grafite","th_oled":"OLED (nero)","th_mineral":"Mineral (verde)","th_claude":"Claude CLI (terminale)","th_tesla":"Tesla","th_gradient":"Gradient Glass","th_neon":"Neon","th_paper":"Carta","th_offroad":"Fuoristrada","th_ios":"iOS","th_ios_dark":"iOS scuro","d_fl":"porta conducente","d_fr":"porta passeggero","d_rl":"porta posteriore sinistra","fl":"Conducente","fr":"Passeggero","rl":"Post. sx","home":"Casa","d":"g","st_driving":"in marcia","month":"30 giorni","no_vehicle":"Nessuna auto. Aggiungi l'integrazione BYD Leopard 3 in Impostazioni → Dispositivi e servizi.","lvl_level_1":"Livello 1","lvl_level_2":"Livello 2","roof_closed":"Chiuso","roof_open":"Aperto","roof_opening":"In apertura","roof_closing":"In chiusura","vs_off":"Spento","vs_on":"Acceso","vs_remote_on":"Acceso da remoto","vs_smart_charge":"Ricarica smart","vs_press_startup":"Avvio","vs_bt_on":"Bluetooth","vs_disinfect":"Disinfezione","vs_exhibition":"Modalità esposizione","lang_auto":"Come Home Assistant","col_black":"Obsidian Black (nero)","col_white":"Element White (bianco)","col_silver":"Starry Moon Silver (argento)","col_green":"Mineral Green (verde)","col_pink":"Micro Light Pink (rosa)","col_ice_blue":"Ice Crystal Blue (azzurro ghiaccio)","col_purple":"Stardust Purple (viola)","col_custom":"Colore personalizzato","ed_entry_id":"Auto","ed_language":"Lingua","ed_color":"Colore dell'auto","ed_custom_color":"Colore personalizzato","ed_show_alerts":"Mostra avvisi","ed_show_seat_heat":"Mostra riscaldamento sedile","ed_show_steering_heat":"Mostra riscaldamento volante","ed_show_trips_map":"Mostra mappa dei viaggi","ed_tyre_min":"Pressione minima pneumatici","ed_charge_target":"Obiettivo di ricarica","ed_advanced":"Avanzate","ed_image_side":"Immagine laterale personalizzata (URL)","ed_image_top":"Immagine dall'alto personalizzata (URL)","ed_map_tiles":"Riquadri mappa personalizzati (URL con {z}/{x}/{y})","edh_image_side":"Per altri modelli BYD. Il cambio colore e le ruote che girano funzionano solo con il disegno integrato della Leopard 3."},"nl":{"locale":"nl-NL","days":["zo","ma","di","wo","do","vr","za"],"s":"s","min":"min","h":"u","ago":"{v} geleden","km":"km","kmh":"km/h","kwh":"kWh","kw":"kW","v":"V","a":"A","mv":"mV","charging":"Laden","dc_charging":"DC-snelladen","driving":"Rijdt","parked":"Geparkeerd","not_connected":"Niet aangesloten","connected":"{g} aangesloten","climate":"Klimaat {t}°","dc_fast":"DC-snel","parking":"parkeren","range":"Bereik","of_cap":"≈ {u} van {c} kWh","sec_charging":"Laden","sec_battery":"Accu","sec_motion":"Rijden","sec_climate":"Klimaat","sec_body":"Banden, portieren, ramen","session":"Deze sessie","to_target":"{t}% over","finish_at":"Klaar om {t}","finish_tomorrow":"Morgen klaar om {t}","taper":"DC vertraagt boven 80%","state":"Status","not_charging":"Laadt niet","gun":"Stekker: {g}","gun_off":"losgekoppeld","last_session":"Laatste sessie","power":"Vermogen","charging_l":"laden","discharge":"ontladen","idle":"inactief","voltage":"Spanning","current":"Stroom","batt_temp":"Accutemp.","minmax":"min {a}° · max {b}°","capacity":"Capaciteit","nominal":"nominaal","soh":"Conditie (SoH)","cells":"Cellen","cells_sub":"min {a} · Δ {d} mV","aux":"12 V","vstate":"Voertuigstatus","speed":"Snelheid","motors":"Motoren","front_rear":"voor / achter","rpm":"tpm","front_motor":"voormotor","cabin":"Interieur","outside":"Buiten","setpoint":"Ingesteld","ac_fan":"Airco {a} · ventilator {f}","on":"aan","off":"uit","seat":"Bestuurdersstoel","heat":"verwarming","wheel":"Stuur","off_v":"Uit","on_v":"Aan","roof":"Dak / scherm","closed_v":"Gesloten","shade":"scherm: {s}","open_f":"open","hood":"Motorkap {s}","trunk":"Kofferbak {s}","open_n":"open","closed_n":"dicht","lf":"Bestuurder","rf":"Passagier","lr":"Linksachter","rr":"Rechtsachter","win_open":"Ramen open: {w}","win_closed":"Ramen dicht","tyre_ok":"Normaal","tyre_low":"Laag","tyre_high":"Hoog","updated":"Bijgewerkt","last_packet":"Laatste pakket","no_link":"Geen verbinding","asleep":"Auto slaapt","no_data":"Geen gegevens van de auto","mm_off":"Infotainment uit, geen gegevens","no_data_p":"Het laatste pakket kwam <b id=\"ago\">{a}</b> binnen, terwijl de auto {s} was. Controleer het internet van de auto of de BYDMate-app.","asleep_p":"Het laatste pakket kwam <b id=\"ago\">{a}</b> binnen.","st_parked":"geparkeerd","st_charging":"aan het laden (AC)","last_place":"Laatst bekende locatie: {p}","last_trip":"Laatste rit: {a}–{b}, {k} km","a_tyre_low":"Lage bandenspanning: {w} {p} bar","a_tyre_flat":"Lekke band: {w} {p} bar","w_fl":"linksvoor","w_fr":"rechtsvoor","w_rl":"linksachter","w_rr":"rechtsachter","a_soc_low":"Accu laag: {s}%","a_soc_crit":"Accu kritiek: {s}%","a_soc_charging":"Accu laag {s}%, laadt","a_aux":"12V-accu zwak: {v} V","a_batt_hot":"Accu is heet: {t}°C","a_cells":"Celonbalans: {d} mV","a_door":"Open: {w}","a_unlocked":"Ontgrendeld: {w}","a_windows":"Ramen open: {w}","d_lf":"bestuurdersportier","d_rf":"passagiersportier","d_lr":"portier linksachter","d_rr":"portier rechtsachter","d_hood":"motorkap","d_trunk":"kofferbak","more":"nog {n}","less":"Minder tonen","trips":"Ritten","today":"Vandaag","week":"7 dagen","distance":"Afstand","energy":"Energie","average":"Gemiddeld","count":"Ritten","pw_low":"onder 15","pw_high":"27+ kW","pw_na":"geen gegevens","h_time":"tijd","h_dur":"duur","h_km":"km","now":"nu","no_trips":"Geen ritten in deze periode","consumption":"Verbruik","duration":"Duur","moving":"rijdend {d}","avg_speed":"Gem. snelheid","over_moving":"tijdens rijden","battery":"Accu","gps":"GPS-punten","per_sec":"1 pakket/s","start":"Start","finish":"Einde","on_road":"onderweg","map_fail":"Kaart laden mislukt (offline)","ed_title":"Titel (in plaats van autonaam)","ed_layout":"Kaartindeling","l_car":"Auto","l_trips":"Ritten","l_combo":"Gecombineerd","ed_lang":"Taal","ed_alerts":"Waarschuwingen tonen","ed_seat":"Stoelverwarming tonen","ed_wheel":"Stuurverwarming tonen","ed_low_soc":"Drempel lage accu","ed_tyre":"Minimale bandenspanning, bar","ed_target":"Laaddoel, %","ed_yaml":"YAML","year":"Jaar","all":"Alle","ed_theme":"Kaartthema","ed_theme_colors":"Themakleuren","ed_background":"Kaartachtergrond","ed_tiles":"Tegels","ed_divider":"Lijnen","ed_text":"Tekst","ed_secondary":"Secundaire tekst","ed_accent":"Accent","th_ha":"Zelfde als Home Assistant","th_dark":"Donker","th_light":"Licht","th_midnight":"Middernacht","th_graphite":"Grafiet","th_oled":"OLED (zwart)","th_mineral":"Mineral (groen)","th_claude":"Claude CLI (terminal)","th_tesla":"Tesla","th_gradient":"Gradient Glass","th_neon":"Neon","th_paper":"Papier","th_offroad":"Offroad","th_ios":"iOS","th_ios_dark":"iOS donker","d_fl":"bestuurdersportier","d_fr":"passagiersportier","d_rl":"portier linksachter","fl":"Bestuurder","fr":"Passagier","rl":"Linksachter","home":"Thuis","d":"d","st_driving":"rijdend","month":"30 dagen","no_vehicle":"Nog geen auto. Voeg de integratie BYD Leopard 3 toe via Instellingen → Apparaten & diensten.","lvl_level_1":"Stand 1","lvl_level_2":"Stand 2","roof_closed":"Gesloten","roof_open":"Open","roof_opening":"Gaat open","roof_closing":"Gaat dicht","vs_off":"Uit","vs_on":"Aan","vs_remote_on":"Op afstand aan","vs_smart_charge":"Slim laden","vs_press_startup":"Opstarten","vs_bt_on":"Bluetooth","vs_disinfect":"Desinfectie","vs_exhibition":"Showroommodus","lang_auto":"Zelfde als Home Assistant","col_black":"Obsidian Black","col_white":"Element White","col_silver":"Starry Moon Silver","col_green":"Mineral Green","col_pink":"Micro Light Pink","col_ice_blue":"Ice Crystal Blue","col_purple":"Stardust Purple","col_custom":"Eigen kleur","ed_entry_id":"Auto","ed_language":"Taal","ed_color":"Autokleur","ed_custom_color":"Eigen kleur","ed_show_alerts":"Waarschuwingen tonen","ed_show_seat_heat":"Stoelverwarming tonen","ed_show_steering_heat":"Stuurverwarming tonen","ed_show_trips_map":"Rittenkaart tonen","ed_tyre_min":"Minimale bandenspanning","ed_charge_target":"Laaddoel","ed_advanced":"Geavanceerd","ed_image_side":"Eigen zijaanzicht (URL)","ed_image_top":"Eigen bovenaanzicht (URL)","ed_map_tiles":"Eigen kaarttegels (URL met {z}/{x}/{y})","edh_image_side":"Voor andere BYD-modellen. Herkleuren en draaiende wielen werken alleen met de ingebouwde Leopard 3-tekening."},"pl":{"locale":"pl-PL","days":["Nd","Pn","Wt","Śr","Cz","Pt","So"],"s":"s","min":"min","h":"h","ago":"{v} temu","km":"km","kmh":"km/h","kwh":"kWh","kw":"kW","v":"V","a":"A","mv":"mV","charging":"Ładowanie","dc_charging":"Szybkie ładowanie DC","driving":"W trasie","parked":"Zaparkowany","not_connected":"Nie podłączony","connected":"Podłączono {g}","climate":"Klimatyzacja {t}°","dc_fast":"Szybkie DC","parking":"postój","range":"Zasięg","of_cap":"≈ {u} z {c} kWh","sec_charging":"Ładowanie","sec_battery":"Bateria","sec_motion":"Jazda","sec_climate":"Klimatyzacja","sec_body":"Opony, drzwi, okna","session":"Ta sesja","to_target":"{t}% za","finish_at":"Koniec o {t}","finish_tomorrow":"Koniec jutro o {t}","taper":"DC zwalnia powyżej 80%","state":"Stan","not_charging":"Nie ładuje","gun":"Wtyczka: {g}","gun_off":"odłączona","last_session":"Ostatnia sesja","power":"Moc","charging_l":"ładowanie","discharge":"rozładowanie","idle":"bezczynność","voltage":"Napięcie","current":"Prąd","batt_temp":"Temp. baterii","minmax":"min {a}° · maks {b}°","capacity":"Pojemność","nominal":"nominalna","soh":"Kondycja (SoH)","cells":"Ogniwa","cells_sub":"min {a} · Δ {d} mV","aux":"12 V","vstate":"Stan pojazdu","speed":"Prędkość","motors":"Silniki","front_rear":"przód / tył","rpm":"obr/min","front_motor":"przedni silnik","cabin":"Kabina","outside":"Na zewnątrz","setpoint":"Ustawiono","ac_fan":"Klima {a} · nawiew {f}","on":"wł.","off":"wył.","seat":"Fotel kierowcy","heat":"podgrzewanie","wheel":"Kierownica","off_v":"Wył.","on_v":"Wł.","roof":"Dach / roleta","closed_v":"Zamknięty","shade":"roleta: {s}","open_f":"otwarta","hood":"Maska {s}","trunk":"Bagażnik {s}","open_n":"otwarty","closed_n":"zamknięty","lf":"Kierowca","rf":"Pasażer","lr":"Tył lewy","rr":"Tył prawy","win_open":"Otwarte okna: {w}","win_closed":"Okna zamknięte","tyre_ok":"Normalne","tyre_low":"Niskie","tyre_high":"Wysokie","updated":"Aktualizacja","last_packet":"Ostatni pakiet","no_link":"Brak połączenia","asleep":"Samochód śpi","no_data":"Brak danych z samochodu","mm_off":"Multimedia wyłączone, brak danych","no_data_p":"Ostatni pakiet dotarł <b id=\"ago\">{a}</b>, gdy samochód był {s}. Sprawdź internet w samochodzie lub aplikację BYDMate.","asleep_p":"Ostatni pakiet dotarł <b id=\"ago\">{a}</b>.","st_parked":"zaparkowany","st_charging":"w trakcie ładowania (AC)","last_place":"Ostatnia znana lokalizacja: {p}","last_trip":"Ostatnia trasa: {a}–{b}, {k} km","a_tyre_low":"Niskie ciśnienie w oponie: {w} {p} bar","a_tyre_flat":"Przebita opona: {w} {p} bar","w_fl":"przód lewa","w_fr":"przód prawa","w_rl":"tył lewa","w_rr":"tył prawa","a_soc_low":"Niski poziom baterii: {s}%","a_soc_crit":"Krytyczny poziom baterii: {s}%","a_soc_charging":"Niski poziom baterii {s}%, ładowanie","a_aux":"Słaby akumulator 12 V: {v} V","a_batt_hot":"Bateria gorąca: {t}°C","a_cells":"Nierównowaga ogniw: {d} mV","a_door":"Otwarte: {w}","a_unlocked":"Odblokowane: {w}","a_windows":"Otwarte okna: {w}","d_lf":"drzwi kierowcy","d_rf":"drzwi pasażera","d_lr":"drzwi tylne lewe","d_rr":"drzwi tylne prawe","d_hood":"maska","d_trunk":"bagażnik","more":"jeszcze {n}","less":"Pokaż mniej","trips":"Trasy","today":"Dziś","week":"7 dni","distance":"Dystans","energy":"Energia","average":"Średnio","count":"Trasy","pw_low":"poniżej 15","pw_high":"27+ kW","pw_na":"brak danych","h_time":"czas","h_dur":"czas trw.","h_km":"km","now":"teraz","no_trips":"Brak tras w tym okresie","consumption":"Zużycie","duration":"Czas trwania","moving":"w ruchu {d}","avg_speed":"Śr. prędkość","over_moving":"w ruchu","battery":"Bateria","gps":"Punkty GPS","per_sec":"1 pakiet/s","start":"Start","finish":"Koniec","on_road":"w drodze","map_fail":"Nie udało się załadować mapy (offline)","ed_title":"Tytuł (zamiast nazwy auta)","ed_layout":"Układ karty","l_car":"Auto","l_trips":"Trasy","l_combo":"Łączony","ed_lang":"Język","ed_alerts":"Pokaż alerty","ed_seat":"Pokaż podgrzewanie fotela","ed_wheel":"Pokaż podgrzewanie kierownicy","ed_low_soc":"Próg niskiej baterii","ed_tyre":"Minimalne ciśnienie opon, bar","ed_target":"Cel ładowania, %","ed_yaml":"YAML","year":"Rok","all":"Wszystkie","ed_theme":"Motyw karty","ed_theme_colors":"Kolory motywu","ed_background":"Tło karty","ed_tiles":"Kafelki","ed_divider":"Linie","ed_text":"Tekst","ed_secondary":"Tekst dodatkowy","ed_accent":"Akcent","th_ha":"Jak w Home Assistant","th_dark":"Ciemny","th_light":"Jasny","th_midnight":"Północ","th_graphite":"Grafit","th_oled":"OLED (czarny)","th_mineral":"Mineral (zielony)","th_claude":"Claude CLI (terminal)","th_tesla":"Tesla","th_gradient":"Gradient Glass","th_neon":"Neon","th_paper":"Papier","th_offroad":"Off-road","th_ios":"iOS","th_ios_dark":"iOS ciemny","d_fl":"drzwi kierowcy","d_fr":"drzwi pasażera","d_rl":"drzwi tylne lewe","fl":"Kierowca","fr":"Pasażer","rl":"Tył lewy","home":"Dom","d":"d","st_driving":"w trasie","month":"30 dni","no_vehicle":"Brak samochodu. Dodaj integrację BYD Leopard 3 w Ustawienia → Urządzenia oraz usługi.","lvl_level_1":"Poziom 1","lvl_level_2":"Poziom 2","roof_closed":"Zamknięty","roof_open":"Otwarty","roof_opening":"Otwieranie","roof_closing":"Zamykanie","vs_off":"Wył.","vs_on":"Wł.","vs_remote_on":"Zdalnie wł.","vs_smart_charge":"Smart charge","vs_press_startup":"Uruchamianie","vs_bt_on":"Bluetooth","vs_disinfect":"Dezynfekcja","vs_exhibition":"Tryb wystawowy","lang_auto":"Jak w Home Assistant","col_black":"Obsidian Black","col_white":"Element White","col_silver":"Starry Moon Silver","col_green":"Mineral Green","col_pink":"Micro Light Pink","col_ice_blue":"Ice Crystal Blue","col_purple":"Stardust Purple","col_custom":"Własny kolor","ed_entry_id":"Auto","ed_language":"Język","ed_color":"Kolor auta","ed_custom_color":"Własny kolor","ed_show_alerts":"Pokaż alerty","ed_show_seat_heat":"Pokaż podgrzewanie fotela","ed_show_steering_heat":"Pokaż podgrzewanie kierownicy","ed_show_trips_map":"Pokaż mapę tras","ed_tyre_min":"Minimalne ciśnienie opon","ed_charge_target":"Cel ładowania","ed_advanced":"Zaawansowane","ed_image_side":"Własny obraz z boku (URL)","ed_image_top":"Własny obraz z góry (URL)","ed_map_tiles":"Własne kafelki mapy (URL z {z}/{x}/{y})","edh_image_side":"Dla innych modeli BYD. Zmiana koloru i obracające się koła działają tylko z wbudowanym rysunkiem Leopard 3."},"pt":{"locale":"pt-BR","days":["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"],"s":"s","min":"min","h":"h","ago":"há {v}","km":"km","kmh":"km/h","kwh":"kWh","kw":"kW","v":"V","a":"A","mv":"mV","charging":"Carregando","dc_charging":"Carregamento rápido DC","driving":"Dirigindo","parked":"Estacionado","not_connected":"Não conectado","connected":"{g} conectado","climate":"Clima {t}°","dc_fast":"DC rápido","parking":"estacionamento","range":"Autonomia","of_cap":"≈ {u} de {c} kWh","sec_charging":"Carregando","sec_battery":"Bateria","sec_motion":"Movimento","sec_climate":"Climatização","sec_body":"Pneus, portas, vidros","session":"Esta sessão","to_target":"{t}% em","finish_at":"Pronto às {t}","finish_tomorrow":"Pronto amanhã às {t}","taper":"DC desacelera acima de 80%","state":"Estado","not_charging":"Não carregando","gun":"Plugue: {g}","gun_off":"desconectado","last_session":"Última sessão","power":"Potência","charging_l":"carregando","discharge":"descarregando","idle":"ocioso","voltage":"Tensão","current":"Corrente","batt_temp":"Temp. bateria","minmax":"mín {a}° · máx {b}°","capacity":"Capacidade","nominal":"nominal","soh":"Saúde (SoH)","cells":"Células","cells_sub":"mín {a} · Δ {d} mV","aux":"12 V","vstate":"Estado do carro","speed":"Velocidade","motors":"Motores","front_rear":"diant. / tras.","rpm":"RPM","front_motor":"motor dianteiro","cabin":"Cabine","outside":"Externa","setpoint":"Definido","ac_fan":"A/C {a} · vent. {f}","on":"ligado","off":"desligado","seat":"Banco motor.","heat":"aquecimento","wheel":"Volante","off_v":"Desligado","on_v":"Ligado","roof":"Teto / cortina","closed_v":"Fechado","shade":"cortina: {s}","open_f":"aberto","hood":"Capô {s}","trunk":"Porta-malas {s}","open_n":"aberto","closed_n":"fechado","lf":"Motorista","rf":"Passageiro","lr":"Tras. esq.","rr":"Tras. dir.","win_open":"Vidros abertos: {w}","win_closed":"Vidros fechados","tyre_ok":"Normal","tyre_low":"Baixa","tyre_high":"Alta","updated":"Atualizado","last_packet":"Último pacote","no_link":"Sem conexão","asleep":"Carro em repouso","no_data":"Sem dados do carro","mm_off":"Central multimídia desligada, sem dados","no_data_p":"O último pacote chegou <b id=\"ago\">{a}</b>, quando o carro estava {s}. Verifique a internet do carro ou o app BYDMate.","asleep_p":"O último pacote chegou <b id=\"ago\">{a}</b>.","st_parked":"estacionado","st_charging":"carregando (AC)","last_place":"Última localização: {p}","last_trip":"Última viagem: {a}–{b}, {k} km","a_tyre_low":"Pressão baixa: {w} {p} bar","a_tyre_flat":"Pneu furado: {w} {p} bar","w_fl":"dianteiro esquerdo","w_fr":"dianteiro direito","w_rl":"traseiro esquerdo","w_rr":"traseiro direito","a_soc_low":"Bateria baixa: {s}%","a_soc_crit":"Bateria crítica: {s}%","a_soc_charging":"Bateria baixa {s}%, carregando","a_aux":"Bateria 12 V baixa: {v} V","a_batt_hot":"Bateria quente: {t}°C","a_cells":"Desequilíbrio das células: {d} mV","a_door":"Aberto: {w}","a_unlocked":"Destravado: {w}","a_windows":"Vidros abertos: {w}","d_lf":"porta do motorista","d_rf":"porta do passageiro","d_lr":"porta tras. esquerda","d_rr":"porta tras. direita","d_hood":"capô","d_trunk":"porta-malas","more":"mais {n}","less":"Mostrar menos","trips":"Viagens","today":"Hoje","week":"7 dias","distance":"Distância","energy":"Energia","average":"Média","count":"Viagens","pw_low":"abaixo de 15","pw_high":"27+ kW","pw_na":"sem dados","h_time":"hora","h_dur":"dur.","h_km":"km","now":"agora","no_trips":"Nenhuma viagem neste período","consumption":"Consumo","duration":"Duração","moving":"em movimento {d}","avg_speed":"Vel. média","over_moving":"em movimento","battery":"Bateria","gps":"Pontos GPS","per_sec":"1 pacote/s","start":"Início","finish":"Fim","on_road":"na estrada","map_fail":"Falha ao carregar o mapa (offline)","ed_title":"Título (em vez do nome do carro)","ed_layout":"Layout do cartão","l_car":"Carro","l_trips":"Viagens","l_combo":"Combinado","ed_lang":"Idioma","ed_alerts":"Mostrar alertas","ed_seat":"Mostrar aquecimento do banco","ed_wheel":"Mostrar aquecimento do volante","ed_low_soc":"Limite de bateria baixa","ed_tyre":"Pressão mínima dos pneus, bar","ed_target":"Meta de carga, %","ed_yaml":"YAML","year":"Ano","all":"Tudo","ed_theme":"Tema do cartão","ed_theme_colors":"Cores do tema","ed_background":"Fundo do cartão","ed_tiles":"Blocos","ed_divider":"Linhas","ed_text":"Texto","ed_secondary":"Texto secundário","ed_accent":"Destaque","th_ha":"Igual ao Home Assistant","th_dark":"Escuro","th_light":"Claro","th_midnight":"Meia-noite","th_graphite":"Grafite","th_oled":"OLED (preto)","th_mineral":"Mineral (verde)","th_claude":"Claude CLI (terminal)","th_tesla":"Tesla","th_gradient":"Vidro gradiente","th_neon":"Neon","th_paper":"Papel","th_offroad":"Off-road","th_ios":"iOS","th_ios_dark":"iOS escuro","d_fl":"porta do motorista","d_fr":"porta do passageiro","d_rl":"porta tras. esquerda","fl":"Motorista","fr":"Passageiro","rl":"Tras. esq.","home":"Casa","d":"d","st_driving":"em movimento","month":"30 dias","no_vehicle":"Nenhum carro ainda. Adicione a integração BYD Leopard 3 em Configurações → Dispositivos e serviços.","lvl_level_1":"Nível 1","lvl_level_2":"Nível 2","roof_closed":"Fechado","roof_open":"Aberto","roof_opening":"Abrindo","roof_closing":"Fechando","vs_off":"Desligado","vs_on":"Ligado","vs_remote_on":"Ligado remotamente","vs_smart_charge":"Carga inteligente","vs_press_startup":"Iniciando","vs_bt_on":"Bluetooth","vs_disinfect":"Desinfecção","vs_exhibition":"Exposição","lang_auto":"Igual ao Home Assistant","col_black":"Obsidian Black (preto)","col_white":"Element White (branco)","col_silver":"Starry Moon Silver (prata)","col_green":"Mineral Green (verde)","col_pink":"Micro Light Pink (rosa)","col_ice_blue":"Ice Crystal Blue (azul)","col_purple":"Stardust Purple (roxo)","col_custom":"Cor personalizada","ed_entry_id":"Carro","ed_language":"Idioma","ed_color":"Cor do carro","ed_custom_color":"Cor personalizada","ed_show_alerts":"Mostrar alertas","ed_show_seat_heat":"Mostrar aquecimento do banco","ed_show_steering_heat":"Mostrar aquecimento do volante","ed_show_trips_map":"Mostrar mapa de viagens","ed_tyre_min":"Pressão mínima dos pneus","ed_charge_target":"Meta de carga","ed_advanced":"Avançado","ed_image_side":"Imagem lateral personalizada (URL)","ed_image_top":"Imagem superior personalizada (URL)","ed_map_tiles":"Blocos de mapa personalizados (URL com {z}/{x}/{y})","edh_image_side":"Para outros modelos BYD. A troca de cor e as rodas girando só funcionam com o desenho embutido do Leopard 3."},"zh":{"locale":"zh-CN","days":["日","一","二","三","四","五","六"],"s":"秒","min":"分","h":"时","ago":"{v}前","km":"km","kmh":"km/h","kwh":"kWh","kw":"kW","v":"V","a":"A","mv":"mV","charging":"充电中","dc_charging":"直流快充","driving":"行驶中","parked":"已驻车","not_connected":"未插枪","connected":"已插 {g} 枪","climate":"空调 {t}°","dc_fast":"直流快充","parking":"驻车","range":"续航","of_cap":"≈ {u} / {c} kWh","sec_charging":"充电","sec_battery":"电池","sec_motion":"行驶","sec_climate":"空调","sec_body":"轮胎、车门、车窗","session":"本次充电","to_target":"{t}% 还需","finish_at":"{t} 充满","finish_tomorrow":"明天 {t} 充满","taper":"直流超过 80% 后变慢","state":"状态","not_charging":"未充电","gun":"充电枪：{g}","gun_off":"未连接","last_session":"上次充电","power":"功率","charging_l":"充电","discharge":"放电","idle":"空闲","voltage":"电压","current":"电流","batt_temp":"电池温度","minmax":"最低 {a}° · 最高 {b}°","capacity":"容量","nominal":"标称","soh":"健康度 (SoH)","cells":"电芯","cells_sub":"最低 {a} · Δ {d} mV","aux":"12 V","vstate":"车辆状态","speed":"车速","motors":"电机","front_rear":"前 / 后","rpm":"转速","front_motor":"前电机","cabin":"车内","outside":"车外","setpoint":"设定","ac_fan":"A/C {a} · 风量 {f}","on":"开","off":"关","seat":"主驾座椅","heat":"加热","wheel":"方向盘","off_v":"关闭","on_v":"开启","roof":"天窗 / 遮阳帘","closed_v":"关闭","shade":"遮阳帘：{s}","open_f":"打开","hood":"前舱盖{s}","trunk":"后备箱{s}","open_n":"开启","closed_n":"关闭","lf":"主驾","rf":"副驾","lr":"左后","rr":"右后","win_open":"车窗打开：{w}","win_closed":"车窗已关闭","tyre_ok":"正常","tyre_low":"偏低","tyre_high":"偏高","updated":"已更新","last_packet":"最后数据包","no_link":"无连接","asleep":"车辆休眠中","no_data":"没有车辆数据","mm_off":"车机已关闭，无数据","no_data_p":"最后一个数据包于 <b id=\"ago\">{a}</b> 收到，当时车辆处于{s}状态。请检查车辆网络或 BYDMate 应用。","asleep_p":"最后一个数据包于 <b id=\"ago\">{a}</b> 收到。","st_parked":"驻车","st_charging":"交流充电","last_place":"最后位置：{p}","last_trip":"上次行程：{a}–{b}，{k} km","a_tyre_low":"胎压低：{w} {p} bar","a_tyre_flat":"爆胎/亏气：{w} {p} bar","w_fl":"左前","w_fr":"右前","w_rl":"左后","w_rr":"右后","a_soc_low":"电量低：{s}%","a_soc_crit":"电量严重不足：{s}%","a_soc_charging":"电量低 {s}%，充电中","a_aux":"12 V 蓄电池电压低：{v} V","a_batt_hot":"电池温度过高：{t}°C","a_cells":"电芯不均衡：{d} mV","a_door":"未关闭：{w}","a_unlocked":"未上锁：{w}","a_windows":"车窗打开：{w}","d_lf":"主驾车门","d_rf":"副驾车门","d_lr":"左后车门","d_rr":"右后车门","d_hood":"前舱盖","d_trunk":"后备箱","more":"还有 {n} 项","less":"收起","trips":"行程","today":"今天","week":"7 天","distance":"里程","energy":"能耗","average":"平均","count":"次数","pw_low":"15 以下","pw_high":"27+ kW","pw_na":"无数据","h_time":"时间","h_dur":"时长","h_km":"km","now":"现在","no_trips":"此期间没有行程","consumption":"能耗","duration":"时长","moving":"行驶 {d}","avg_speed":"平均车速","over_moving":"行驶时","battery":"电池","gps":"GPS 点","per_sec":"1 包/秒","start":"起点","finish":"终点","on_road":"在路上","map_fail":"地图加载失败（离线）","ed_title":"标题（替代车辆名称）","ed_layout":"卡片布局","l_car":"车辆","l_trips":"行程","l_combo":"组合","ed_lang":"语言","ed_alerts":"显示警报","ed_seat":"显示座椅加热","ed_wheel":"显示方向盘加热","ed_low_soc":"低电量阈值","ed_tyre":"最低胎压，bar","ed_target":"充电目标，%","ed_yaml":"YAML","year":"年","all":"全部","ed_theme":"卡片主题","ed_theme_colors":"主题颜色","ed_background":"卡片背景","ed_tiles":"磁贴","ed_divider":"分隔线","ed_text":"文本","ed_secondary":"次要文本","ed_accent":"强调色","th_ha":"跟随 Home Assistant","th_dark":"深色","th_light":"浅色","th_midnight":"午夜","th_graphite":"石墨","th_oled":"OLED（纯黑）","th_mineral":"Mineral（绿色）","th_claude":"Claude CLI（终端）","th_tesla":"Tesla","th_gradient":"渐变玻璃","th_neon":"霓虹","th_paper":"纸张","th_offroad":"越野","th_ios":"iOS","th_ios_dark":"iOS 深色","d_fl":"主驾车门","d_fr":"副驾车门","d_rl":"左后车门","fl":"主驾","fr":"副驾","rl":"左后","home":"家","d":"天","st_driving":"行驶","month":"30 天","no_vehicle":"还没有车辆。请在“设置 → 设备与服务”中添加 BYD Leopard 3 集成。","lvl_level_1":"1 档","lvl_level_2":"2 档","roof_closed":"关闭","roof_open":"打开","roof_opening":"正在打开","roof_closing":"正在关闭","vs_off":"关闭","vs_on":"开启","vs_remote_on":"远程启动","vs_smart_charge":"智能充电","vs_press_startup":"正在启动","vs_bt_on":"Bluetooth","vs_disinfect":"消毒","vs_exhibition":"展车模式","lang_auto":"跟随 Home Assistant","col_black":"Obsidian Black（曜石黑）","col_white":"Element White（元素白）","col_silver":"Starry Moon Silver（星月银）","col_green":"Mineral Green（矿石绿）","col_pink":"Micro Light Pink（微光粉）","col_ice_blue":"Ice Crystal Blue（冰晶蓝）","col_purple":"Stardust Purple（星尘紫）","col_custom":"自定义颜色","ed_entry_id":"车辆","ed_language":"语言","ed_color":"车身颜色","ed_custom_color":"自定义颜色","ed_show_alerts":"显示警报","ed_show_seat_heat":"显示座椅加热","ed_show_steering_heat":"显示方向盘加热","ed_show_trips_map":"显示行程地图","ed_tyre_min":"最低胎压","ed_charge_target":"充电目标","ed_advanced":"高级","ed_image_side":"自定义侧视图（URL）","ed_image_top":"自定义俯视图（URL）","ed_map_tiles":"自定义地图瓦片（含 {z}/{x}/{y} 的 URL）","edh_image_side":"用于其他 BYD 车型。换色和车轮转动仅适用于内置的 Leopard 3 图形。"},"ja":{"locale":"ja-JP","days":["日","月","火","水","木","金","土"],"s":"秒","min":"分","h":"時間","ago":"{v}前","km":"km","kmh":"km/h","kwh":"kWh","kw":"kW","v":"V","a":"A","mv":"mV","charging":"充電中","dc_charging":"DC 急速充電","driving":"走行中","parked":"駐車中","not_connected":"未接続","connected":"{g} 接続中","climate":"空調 {t}°","dc_fast":"DC 急速","parking":"駐車","range":"航続距離","of_cap":"≈ {u} / {c} kWh","sec_charging":"充電中","sec_battery":"バッテリー","sec_motion":"走行","sec_climate":"空調","sec_body":"タイヤ・ドア・窓","session":"今回","to_target":"{t}% まで","finish_at":"{t} 完了","finish_tomorrow":"明日 {t} 完了","taper":"DC は 80% 以上で減速","state":"状態","not_charging":"充電していません","gun":"プラグ: {g}","gun_off":"未接続","last_session":"前回の充電","power":"電力","charging_l":"充電","discharge":"放電","idle":"待機","voltage":"電圧","current":"電流","batt_temp":"電池温度","minmax":"最低 {a}° · 最高 {b}°","capacity":"容量","nominal":"公称","soh":"劣化度 (SoH)","cells":"セル","cells_sub":"最低 {a} · Δ {d} mV","aux":"12 V","vstate":"車両状態","speed":"速度","motors":"モーター","front_rear":"前 / 後","rpm":"回転数","front_motor":"フロントモーター","cabin":"車内","outside":"外気","setpoint":"設定","ac_fan":"A/C {a} · ファン {f}","on":"オン","off":"オフ","seat":"運転席","heat":"ヒーター","wheel":"ステアリング","off_v":"オフ","on_v":"オン","roof":"ルーフ / シェード","closed_v":"閉","shade":"シェード: {s}","open_f":"開","hood":"ボンネット {s}","trunk":"トランク {s}","open_n":"開","closed_n":"閉","lf":"運転席","rf":"助手席","lr":"左後","rr":"右後","win_open":"開いている窓: {w}","win_closed":"窓は閉","tyre_ok":"正常","tyre_low":"低","tyre_high":"高","updated":"更新","last_packet":"最終パケット","no_link":"接続なし","asleep":"車両はスリープ中","no_data":"車両からのデータなし","mm_off":"ヘッドユニットがオフ、データなし","no_data_p":"最後のパケットは <b id=\"ago\">{a}</b> に届きました（車両は{s}）。車両のインターネット接続または BYDMate アプリを確認してください。","asleep_p":"最後のパケットは <b id=\"ago\">{a}</b> に届きました。","st_parked":"駐車中","st_charging":"充電中（AC）","last_place":"最終位置: {p}","last_trip":"前回の走行: {a}–{b}、{k} km","a_tyre_low":"タイヤ空気圧低下: {w} {p} bar","a_tyre_flat":"パンク: {w} {p} bar","w_fl":"左前","w_fr":"右前","w_rl":"左後","w_rr":"右後","a_soc_low":"バッテリー残量低下: {s}%","a_soc_crit":"バッテリー残量危険: {s}%","a_soc_charging":"残量低下 {s}%、充電中","a_aux":"12 V バッテリー低下: {v} V","a_batt_hot":"バッテリー高温: {t}°C","a_cells":"セル電圧の不均衡: {d} mV","a_door":"開いています: {w}","a_unlocked":"解錠: {w}","a_windows":"開いている窓: {w}","d_lf":"運転席ドア","d_rf":"助手席ドア","d_lr":"左後ドア","d_rr":"右後ドア","d_hood":"ボンネット","d_trunk":"トランク","more":"他 {n} 件","less":"表示を減らす","trips":"走行","today":"今日","week":"7 日間","distance":"距離","energy":"電力量","average":"平均","count":"回数","pw_low":"15 未満","pw_high":"27+ kW","pw_na":"データなし","h_time":"時刻","h_dur":"時間","h_km":"km","now":"現在","no_trips":"この期間の走行はありません","consumption":"電費","duration":"所要時間","moving":"走行 {d}","avg_speed":"平均速度","over_moving":"走行時","battery":"バッテリー","gps":"GPS ポイント","per_sec":"1 パケット/秒","start":"出発","finish":"到着","on_road":"走行中","map_fail":"地図を読み込めません（オフライン）","ed_title":"タイトル（車両名の代わり）","ed_layout":"カードのレイアウト","l_car":"車両","l_trips":"走行","l_combo":"複合","ed_lang":"言語","ed_alerts":"アラートを表示","ed_seat":"シートヒーターを表示","ed_wheel":"ステアリングヒーターを表示","ed_low_soc":"バッテリー低下のしきい値","ed_tyre":"最低タイヤ空気圧、bar","ed_target":"充電目標、%","ed_yaml":"YAML","year":"年","all":"すべて","ed_theme":"カードのテーマ","ed_theme_colors":"テーマの色","ed_background":"カードの背景","ed_tiles":"タイル","ed_divider":"罫線","ed_text":"テキスト","ed_secondary":"サブテキスト","ed_accent":"アクセント","th_ha":"Home Assistant と同じ","th_dark":"ダーク","th_light":"ライト","th_midnight":"ミッドナイト","th_graphite":"グラファイト","th_oled":"OLED（黒）","th_mineral":"Mineral（グリーン）","th_claude":"Claude CLI（ターミナル）","th_tesla":"Tesla","th_gradient":"グラデーションガラス","th_neon":"ネオン","th_paper":"ペーパー","th_offroad":"オフロード","th_ios":"iOS","th_ios_dark":"iOS ダーク","d_fl":"運転席ドア","d_fr":"助手席ドア","d_rl":"左後ドア","fl":"運転席","fr":"助手席","rl":"左後","home":"自宅","d":"日","st_driving":"走行中","month":"30 日間","no_vehicle":"車両がまだありません。設定 → デバイスとサービス で BYD Leopard 3 統合を追加してください。","lvl_level_1":"レベル 1","lvl_level_2":"レベル 2","roof_closed":"閉","roof_open":"開","roof_opening":"開いています","roof_closing":"閉じています","vs_off":"オフ","vs_on":"オン","vs_remote_on":"リモート起動","vs_smart_charge":"スマート充電","vs_press_startup":"起動中","vs_bt_on":"Bluetooth","vs_disinfect":"除菌","vs_exhibition":"展示モード","lang_auto":"Home Assistant と同じ","col_black":"Obsidian Black（黒）","col_white":"Element White（白）","col_silver":"Starry Moon Silver（シルバー）","col_green":"Mineral Green（グリーン）","col_pink":"Micro Light Pink（ピンク）","col_ice_blue":"Ice Crystal Blue（ブルー）","col_purple":"Stardust Purple（パープル）","col_custom":"カスタムカラー","ed_entry_id":"車両","ed_language":"言語","ed_color":"車体色","ed_custom_color":"カスタムカラー","ed_show_alerts":"アラートを表示","ed_show_seat_heat":"シートヒーターを表示","ed_show_steering_heat":"ステアリングヒーターを表示","ed_show_trips_map":"走行マップを表示","ed_tyre_min":"最低タイヤ空気圧","ed_charge_target":"充電目標","ed_advanced":"詳細設定","ed_image_side":"カスタム側面画像（URL）","ed_image_top":"カスタム上面画像（URL）","ed_map_tiles":"カスタム地図タイル（{z}/{x}/{y} を含む URL）","edh_image_side":"他の BYD モデル用。色変更とホイール回転は内蔵の Leopard 3 イラストでのみ動作します。"}}); return s; })();
/* Card language: "auto" follows Home Assistant (pt-BR -> pt, zh-Hans -> zh), unknown -> English. */
const LANGS = [['uk', 'Українська'], ['en', 'English'], ['de', 'Deutsch'], ['es', 'Español'], ['fr', 'Français'],
  ['it', 'Italiano'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['pt', 'Português'], ['zh', '中文'], ['ja', '日本語']];
const pickLang = (cfg, hass) => {
  const l = String(cfg && cfg !== 'auto' ? cfg : hass?.locale?.language || hass?.language || 'en').toLowerCase();
  return STR[l] ? l : STR[l.split('-')[0]] ? l.split('-')[0] : 'en';
};
const ICONS = {
  bolt:'<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  plug:'<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  therm:'<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  gauge:'<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  heart:'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  batt:'<rect x="2" y="7" width="16" height="10" rx="2"/><path d="M22 11v2"/>',
  lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  park:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  move:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  fan:'<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 2 0 3 2 2 4l-4 3"/><path d="M14 12c4 0 7 1 7 4 0 2-2 3-4 2l-3-4"/><path d="M12 14c0 4-1 7-4 7-2 0-3-2-2-4l4-3"/><path d="M10 12c-4 0-7-1-7-4 0-2 2-3 4-2l3 4"/>',
  snow:'<path d="M12 2v20"/><path d="M2 12h20"/><path d="m4.9 4.9 14.2 14.2"/><path d="m19.1 4.9-14.2 14.2"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  wave:'<path d="M2 12h4l3-8 4 16 3-8h6"/>',
  cpu:'<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>',
  wifioff:'<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.8"/><path d="M19 12.9a10 10 0 0 0-2.3-1.7"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6"/><path d="M22 8.8A15 15 0 0 0 11 4.6"/><path d="M12 20h.01"/>',
  moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  tyre:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>',
  door:'<path d="M4 21V5l9-2v18"/><path d="M13 4h7v17"/><path d="M2 21h20"/><path d="M10 12h.01"/>',
  window:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/>',
  route:'<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
};

/* ---------- Tiny DOM morph: keeps running CSS animations and the map alive ---------- */
function morph(target, html){
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  syncChildren(target, tpl.content);
}
function syncChildren(a, b){
  const an = [...a.childNodes], bn = [...b.childNodes];
  for (let i = 0; i < bn.length; i++){
    const x = an[i], y = bn[i];
    if (!x){ a.appendChild(y.cloneNode(true)); continue; }
    if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName || (x.nodeType === 1 && x.getAttribute('data-k') !== y.getAttribute('data-k'))){
      a.replaceChild(y.cloneNode(true), x); continue;
    }
    if (x.nodeType === 3 || x.nodeType === 8){ if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
    for (const at of [...x.attributes]) if (!y.hasAttribute(at.name)) x.removeAttribute(at.name);
    for (const at of [...y.attributes]) if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value);
    syncChildren(x, y);
  }
  for (let i = an.length - 1; i >= bn.length; i--) a.removeChild(an[i]);
}

/* ---------- Helpers ---------- */
const pad = (n) => String(n).padStart(2,'0');
const hm = (ts) => { const d = new Date(ts*1000); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dur = (s) => { const m = Math.round(s/60); return `${Math.floor(m/60)}:${pad(m%60)}`; };
const dayKey = (ts) => { const d = new Date(ts*1000); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const per100Cls = (v) => v == null ? '' : v < 20 ? 'c-good' : v <= 25 ? 'c-mid' : 'c-bad';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
// Route colour by power drawn from the battery, kW (regen/negative counts as low). Unknown (no data) — grey.
const POWER_BANDS = [[15, '#4fc3f7'], [22, '#66bb6a'], [27, '#ffca28'], [Infinity, '#ef5350']];
const POWER_NA = '#8e8e93';
// Trackpad pinch (ctrl+wheel) delta that makes one zoom step.
const PINCH_STEP = 40;
const powerColor = (kw) => kw == null || !isFinite(kw) ? POWER_NA : POWER_BANDS.find(([max]) => kw < max)[1];
// Attributes that open the entity's more-info dialog (history graph) on click.
const more = (eid) => eid ? ` data-act="more" data-e="${eid}" role="button" tabindex="0"` : '';
const IMG_W = 949, IMG_H = 372, WHEEL_R = 66, WHEELS = [[165, 282], [738, 282]];

const DEFAULTS = {
  layout: 'combo', language: 'auto', color: 'black', custom_color: [233, 30, 99],
  show_alerts: true, show_seat_heat: true, show_steering_heat: false, show_trips_map: true,
  low_soc: 20, tyre_min: 2.3, charge_target: 100, trips_days: 7, theme: 'ha',
};

class BydLeopard3Card extends HTMLElement {
  static getConfigElement(){ return document.createElement('byd-leopard3-card-editor'); }
  static getStubConfig(){ return {layout: 'combo'}; }

  setConfig(config){
    const prevTheme = this._themeSig;
    this._cfg = {...DEFAULTS, ...(config || {})};
    this._period ||= 1;
    this._applyTheme();
    if (this._map && prevTheme !== undefined && prevTheme !== this._themeSig){
      this._map.remove(); this._map = null; this._carPin = null; this._routeLayer = null;
    }
    // The visual editor calls setConfig on every change: repaint, relayout, refetch trips.
    if (this.shadowRoot && this._hass){
      this._applyLayout();
      this._loadImages().then(() => this._render(true));
      this._refreshTrips();
    }
  }
  getCardSize(){ return this._cfg?.layout === 'trips' ? 9 : 12; }
  // Full width of the section by default: in a wide section (sections view, column span 2+) the combined
  // layout then puts the trips next to the car instead of under it.
  getGridOptions(){ return {columns: 'full', min_columns: 6, rows: 'auto'}; }

  set hass(hass){
    const first = !this._hass;
    this._hass = hass;
    if (first) this._init();
    else this._render();
  }

  /* -- language -- */
  get lang(){
    return pickLang(this._cfg.language, this._hass);
  }
  t(key, vars = {}){ const s = STR[this.lang][key] ?? STR.en[key] ?? key; return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''); }
  nf(v, d = 1){ return Number(v).toLocaleString(STR[this.lang].locale, {minimumFractionDigits: d, maximumFractionDigits: d}); }
  dayLabel(ts){ const d = new Date(ts*1000); return `${pad(d.getDate())}.${pad(d.getMonth()+1)} (${STR[this.lang].days[d.getDay()]})`; }

  /* -- setup -- */
  async _init(){
    const root = this.attachShadow({mode: 'open'});
    root.innerHTML = `<style>${CSS}</style><style id="lcss"></style>
      <ha-card class="host"><div class="split">
        <div class="card" id="car"></div>
        <div class="card" id="trips">
          <div id="thead"></div>
          <div id="map" role="img"></div>
          <div id="tbody"></div>
        </div>
      </div></ha-card>`;
    this.$ = (id) => root.getElementById(id);
    this._applyLayout();
    this._applyTheme();
    root.addEventListener('click', (e) => this._onClick(e));
    root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.act){ e.preventDefault(); e.target.click(); } });
    this._tick = setInterval(() => this._render(), 15000);   // "N s ago" and offline detection
    try {
      const list = await this._hass.callWS({type: `${DOMAIN}/vehicles`});
      this._veh = list.find(v => v.entry_id === this._cfg.entry_id) || list[0];
    } catch (e) { this._veh = null; }
    await this._loadImages();
    this._render(true);
    this._refreshTrips();
  }
  disconnectedCallback(){ clearInterval(this._tick); clearTimeout(this._tripTimer); }
  connectedCallback(){ if (this._hass && this.shadowRoot && !this._tick) this._tick = setInterval(() => this._render(), 15000); }

  _applyLayout(){
    const card = this.shadowRoot?.querySelector('.host'); if (!card) return;
    card.classList.remove('mode-car','mode-trips','mode-combo');
    card.classList.add('mode-' + (this._cfg.layout || 'combo'));
    if (this._map) setTimeout(() => this._map.invalidateSize(), 50);
  }
  /* -- theme -- */
  _palette(){
    const base = THEMES[this._cfg.theme] || null, over = this._cfg.theme_colors || {};
    const p = base ? {...base} : {};
    for (const k of THEME_KEYS) if (over[k] != null){ const h = toHex(over[k]); if (h) p[k] = h; }
    return Object.keys(p).length ? p : null;
  }
  _isLight(){
    const p = this._palette();
    if (p?.background) return luma(p.background) > 0.55;
    return this._hass?.themes?.darkMode === false;
  }
  _applyTheme(){
    const card = this.shadowRoot?.querySelector('.host'); if (!card) return;
    const key = THEMES[this._cfg.theme] ? this._cfg.theme : 'ha', preset = THEMES[key] || {};
    const p = this._palette() || {}, over = this._cfg.theme_colors || {}, light = this._isLight();
    const styled = !!preset.fonts;   // themes from the theme gallery: own fonts, borders, effects
    const set = (v, val) => val ? card.style.setProperty(v, val) : card.style.removeProperty(v);
    set('--card', p.background); set('--ha-card-background', p.background); set('--card-background-color', p.background);
    set('--card-2', p.tiles); set('--line', p.divider); set('--text', p.text); set('--muted', p.secondary);
    set('--faint', over.secondary == null && preset.faint ? preset.faint
      : (p.secondary && p.background ? mix(p.secondary, p.background, 0.35) : null));
    set('--accent', p.accent);
    for (const v of ['ok', 'warn', 'err', 'park']) set('--' + v, preset[v]);
    set('--radius', preset.radius); set('--ha-card-border-radius', preset.radius);
    // Styled themes paint their own frame (gradient, grid, stripes) unless the background colour was changed.
    card.style.background = styled && over.background == null ? '' : (p.background || '');
    card.style.color = p.text || '';
    if (key === 'ha') card.removeAttribute('data-theme'); else card.setAttribute('data-theme', key);
    card.classList.toggle('light', light);
    if (preset.fonts) loadFonts(preset.fonts);
    this._themeSig = key + JSON.stringify(p) + light;
  }
  _hex(){
    const c = this._cfg.color;
    if (c === 'custom'){ const [r,g,b] = this._cfg.custom_color || [0,0,0]; return '#' + [r,g,b].map(x => pad(Number(x).toString(16))).join(''); }
    return COLORS[c] ?? null;
  }
  async _loadImages(){
    const hex = this._hex();
    if (this._imgKey === (hex || '') + (this._cfg.image_side || '') + (this._cfg.image_top || '')) return;
    this._imgKey = (hex || '') + (this._cfg.image_side || '') + (this._cfg.image_top || '');
    this._side = this._cfg.image_side || await paint('side', hex);
    this._top = this._cfg.image_top || await paint('top', hex);
  }

  /* -- state access -- */
  _eid(key){ return this._veh?.entities?.[key]; }
  _more(key){ const id = this._eid(key); return id && this._hass?.states?.[id] ? more(id) : ''; }
  _st(key){ const id = this._eid(key); return id ? this._hass.states[id] : undefined; }
  v(key){
    const s = this._st(key);
    if (!s || s.state === 'unavailable' || s.state === 'unknown' || s.state === '') return null;
    const n = Number(s.state);
    return Number.isNaN(n) ? s.state : n;
  }
  on(key){ const s = this._st(key); return s ? s.state === 'on' : null; }

  _data(){
    const v = (k) => this.v(k);
    const tyre = (w) => [v(`tyre_pressure_${w}`), v(`tyre_temp_${w}`), v(`tyre_state_${w}`)];
    const tracker = this._st('location');
    const lastUpd = this._st('last_update');
    return {
      soc: v('soc'), soh: v('soh'), range: v('range'), odo: v('odometer'), speed: v('speed') ?? 0,
      power: v('power'), voltage: v('voltage'), current: v('current'),
      batt_temp: v('batt_temp'), batt_min: v('batt_temp_min'), batt_max: v('batt_temp_max'),
      capacity: v('capacity') ?? this._veh?.capacity, session: v('kwh_charged'),
      charging: this.on('is_charging'), dcfc: this.on('is_dcfc'), parked: this.on('is_parked') ?? (v('speed') ?? 0) === 0,
      gun: v('charging_gun'), aux_voltage: v('aux_voltage'), cell_max: v('cell_max_v'), cell_min: v('cell_min_v'),
      vehicle_state: v('vehicle_state'), fm_temp: v('front_motor_temp'), rm_temp: v('rear_motor_temp'), rpm: v('motor_rpm'),
      cabin: v('cabin_temp'), outside: v('ext_temp'), setpoint: v('hvac_setpoint'), ac: v('climate'), fan: v('fan_speed'),
      seat: v('seat_heat'), wheel: v('steering_heat'), sunroof: v('sunroof'), sunshade: v('sunshade'),
      tyres: {fl: tyre('fl'), fr: tyre('fr'), rl: tyre('rl'), rr: tyre('rr')},
      locks: {fl: v('lock_fl'), fr: v('lock_fr'), rl: v('lock_rl'), rr: v('lock_rr')},
      doors: {fl: v('door_fl'), fr: v('door_fr'), rl: v('door_rl'), rr: v('door_rr')}, hood: v('hood'), trunk: v('trunk'),
      windows: {fl: v('window_fl'), fr: v('window_fr'), rl: v('window_rl'), rr: v('window_rr')},
      place: tracker && !['unknown','unavailable','not_home'].includes(tracker.state)
        ? (tracker.state === 'home' ? this.t('home') : (this._hass.states[`zone.${tracker.state}`]?.attributes?.friendly_name || tracker.state)) : null,
      lat: tracker?.attributes?.latitude, lon: tracker?.attributes?.longitude,
      online: this.on('online'), updated: lastUpd && !['unknown','unavailable'].includes(lastUpd.state) ? Date.parse(lastUpd.state) : null,
      driving: this.on('trip_in_progress'),
    };
  }

  /* -- rendering -- */
  _render(force){
    if (!this.shadowRoot || !this._hass) return;
    if (!this._veh){
      morph(this.$('car'), `<div class="empty">${this.t('no_vehicle')}</div>`);
      this.$('trips').style.display = 'none';
      return;
    }
    this.$('trips').style.display = '';
    // Skip work when none of our entities changed.
    const sig = Object.values(this._veh.entities).map(id => this._hass.states[id]?.last_updated).join('|') + this.lang + Math.floor(Date.now()/15000);
    if (!force && sig === this._sig) return;
    this._sig = sig;
    if (this._cfg.theme === 'ha' || !this._cfg.theme) this._applyTheme();
    const d = this._data();
    if (this._cfg.layout !== 'trips') morph(this.$('car'), d.online === false ? this._offlineHtml(d) : this._carHtml(d));
    this._tempo(d);
    if (this._cfg.layout !== 'car'){
      this._renderTrips();
      if (d.driving !== this._wasDriving){ this._wasDriving = d.driving; this._refreshTrips(); }
      if (this._map && d.lat != null) this._moveCar(d.lat, d.lon, this._sel === 'live');
    }
  }

  _tile(key, value, unit, sub = '', icon = '', cls = '', ent = ''){
    if (value == null || value === '') return '';
    const m = ent ? this._more(ent) : '';
    return `<div class="tile ${cls} ${m ? 'clk' : ''}"${m}><div class="k">${icon ? ic(icon) : ''}${key}</div>
      <div class="v"><span>${value}</span>${unit ? `<small>${unit}</small>` : ''}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  }
  _alerts(d){
    const out = [], c = this._cfg, t = (k, x) => this.t(k, x);
    for (const w of ['fl','fr','rl','rr']){
      const [p, , st] = d.tyres[w];
      if (p == null && st == null) continue;
      if (p != null && p < 1.8) out.push({lvl:'err', icon:'tyre', text:t('a_tyre_flat', {w:t('w_'+w), p:this.nf(p,2)})});
      else if ((p != null && p < c.tyre_min) || st === 'low') out.push({lvl:'warn', icon:'tyre', text:t('a_tyre_low', {w:t('w_'+w), p:p == null ? '—' : this.nf(p,2)})});
    }
    if (d.soc != null && d.soc <= c.low_soc){
      if (d.charging) out.push({lvl:'info', icon:'batt', text:t('a_soc_charging', {s:Math.round(d.soc)})});
      else out.push({lvl: d.soc <= 10 ? 'err' : 'warn', icon:'batt', text:t(d.soc <= 10 ? 'a_soc_crit' : 'a_soc_low', {s:Math.round(d.soc)})});
    }
    if (d.aux_voltage != null && d.aux_voltage < 12.2) out.push({lvl:'warn', icon:'batt', text:t('a_aux', {v:this.nf(d.aux_voltage,1)})});
    const hot = d.batt_max ?? d.batt_temp;
    if (hot != null && hot >= 45) out.push({lvl:'warn', icon:'therm', text:t('a_batt_hot', {t:Math.round(hot)})});
    if (d.cell_max != null && d.cell_min != null){
      const delta = Math.round((d.cell_max - d.cell_min)*1000);
      if (delta > 50) out.push({lvl:'warn', icon:'cpu', text:t('a_cells', {d:delta})});
    }
    if (d.parked){
      const open = ['fl','fr','rl','rr'].filter(k => d.doors[k] === 'open').map(k => t('d_'+k));
      if (d.hood === 'open') open.push(t('d_hood'));
      if (d.trunk === 'open') open.push(t('d_trunk'));
      if (open.length) out.push({lvl:'warn', icon:'door', text:t('a_door', {w:open.join(', ')})});
      const unl = ['fl','fr','rl','rr'].filter(k => d.locks[k] === 'unlocked').map(k => t('d_'+k));
      if (unl.length) out.push({lvl:'warn', icon:'unlock', text:t('a_unlocked', {w:unl.join(', ')})});
      const win = ['fl','fr','rl','rr'].filter(k => (d.windows[k] ?? 0) > 0).map(k => `${t(k).toLowerCase()} ${Math.round(d.windows[k])}%`);
      if (win.length) out.push({lvl:'warn', icon:'window', text:t('a_windows', {w:win.join(', ')})});
    }
    const rank = {err:0, warn:1, info:2};
    out.sort((a,b) => rank[a.lvl] - rank[b.lvl]);
    if (!c.show_alerts || !out.length) return '';
    const shown = this._alertsOpen ? out : out.slice(0, 2), rest = out.length - 2;
    return `<div class="alerts" role="status">${shown.map(a => `<div class="alert ${a.lvl}">${ic(a.icon)}<span>${esc(a.text)}</span></div>`).join('')}
      ${rest > 0 ? `<button type="button" class="alert-more" data-act="alerts">${this._alertsOpen ? t('less') : t('more', {n:rest})}</button>` : ''}</div>`;
  }
  _eta(d){
    const target = this._cfg.charge_target, kw = Math.abs(d.power ?? 0) * 0.92;
    if (kw < 0.1 || d.soc == null || d.soc >= target || !d.capacity) return null;
    const per = d.capacity / 100;
    let h;
    if (d.dcfc){
      const a = Math.max(0, Math.min(80, target) - d.soc), b = Math.max(0, target - Math.max(80, d.soc));
      h = a*per/kw + b*per/(kw*0.35);
    } else h = (target - d.soc)*per/kw;
    const mins = h*60, end = new Date(Date.now() + mins*60000);
    const tomorrow = end.toDateString() !== new Date().toDateString();
    const left = mins >= 60 ? `${Math.floor(mins/60)} ${this.t('h')} ${Math.round(mins%60)} ${this.t('min')}` : `${Math.round(mins)} ${this.t('min')}`;
    return {target, left, end: this.t(tomorrow ? 'finish_tomorrow' : 'finish_at', {t:`${pad(end.getHours())}:${pad(end.getMinutes())}`}), taper: d.dcfc && target > 80};
  }
  _ago(ms){
    const sec = (Date.now() - ms)/1000; let v;
    if (sec < 60) v = `${Math.max(0, Math.round(sec))} ${this.t('s')}`;
    else if (sec < 3600) v = `${Math.floor(sec/60)} ${this.t('min')}`;
    else if (sec < 86400) v = `${Math.floor(sec/3600)} ${this.t('h')} ${Math.floor((sec%3600)/60)} ${this.t('min')}`;
    else v = `${Math.floor(sec/86400)} ${this.t('d')}`;
    return this.t('ago', {v});
  }
  _stamp(ms){ return new Date(ms).toLocaleString(STR[this.lang].locale, {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'}); }
  _tyre(ty, w){
    const [p, temp, st] = ty;
    if (p == null && temp == null && st == null) return '<div class="tyre"></div>';
    const low = (p != null && p < this._cfg.tyre_min) || (st && st !== 'normal');
    const m = this._more('tyre_pressure_' + w) || this._more('tyre_state_' + w);
    return `<div class="tyre ${low ? 'low' : ''} ${m ? 'clk' : ''}"${m}>
      ${p != null ? `<div class="p">${this.nf(p,2)}<small> bar</small></div>` : ''}
      ${temp != null ? `<div class="t">${Math.round(temp)}°C</div>` : ''}
      <div class="st">${low ? (st === 'high' ? this.t('tyre_high') : this.t('tyre_low')) : this.t('tyre_ok')}</div></div>`;
  }
  _wheel([cx, cy]){
    const D = WHEEL_R*2;
    return `<span class="wheel" style="left:${(cx-WHEEL_R)/IMG_W*100}%;top:${(cy-WHEEL_R)/IMG_H*100}%;width:${D/IMG_W*100}%;height:${D/IMG_H*100}%;background-image:url(${this._side});background-size:${IMG_W/D*100}% ${IMG_H/D*100}%;background-position:${(cx-WHEEL_R)/(IMG_W-D)*100}% ${(cy-WHEEL_R)/(IMG_H-D)*100}%"></span>`;
  }

  _carHtml(d){
    const t = (k, x) => this.t(k, x), nf = (v, n) => v == null ? null : this.nf(v, n), c = this._cfg;
    const driving = !d.parked, eta = d.charging ? this._eta(d) : null;
    let status, dot = '';
    if (d.charging) status = d.dcfc ? t('dc_charging') : t('charging');
    else if (driving){ status = t('driving'); dot = 'drive'; }
    else status = t('parked');
    const usable = d.soc != null && d.capacity ? d.soc/100 * d.capacity * (d.soh ?? 100)/100 : null;
    const socCls = d.soc == null ? '' : d.soc <= 10 ? 'crit' : d.soc <= c.low_soc ? 'low' : '';
    const p = d.power, pcls = p == null ? '' : p < 0 ? 'neg' : p > 1 ? 'pos' : '';
    const gun = d.gun && d.gun !== 'disconnected' ? d.gun.toUpperCase() : null;
    const chips = [
      d.charging ? (d.dcfc ? `<span class="chip dc"${this._more('is_dcfc')}>${ic('bolt')} ${t('dc_fast')}</span>` : `<span class="chip ok"${this._more('charging_gun') || this._more('is_charging')}>${ic('plug')} ${t('connected', {g: gun || 'AC'})}</span>`)
        : (driving ? '' : `<span class="chip"${this._more('charging_gun') || this._more('is_charging')}>${ic('plug')} ${t('not_connected')}</span>`),
      d.ac === 'on' && d.setpoint != null ? `<span class="chip info"${this._more('climate')}>${ic('snow')} ${t('climate', {t:nf(d.setpoint,0)})}</span>` : '',
      d.place ? `<span class="chip"${this._more('location')}>${ic('pin')} ${esc(d.place)}</span>` : '',
    ].join('');
    const chg = d.charging ? `
      <div class="chg ${d.dcfc ? 'dc' : ''}">
        <svg class="ring"${this._more('soc')} viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(127,127,127,.3)" stroke-width="3"/>
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="${d.dcfc ? '#ba68c8' : '#66bb6a'}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${((d.soc ?? 0)/100*97.4).toFixed(1)} 97.4" transform="rotate(-90 18 18)"/>
          <text x="18" y="21.5" text-anchor="middle" font-size="9" font-weight="500" fill="currentColor">${Math.round(d.soc ?? 0)}%</text></svg>
        <div>
          <div class="pw"${this._more('power')}>${p != null ? nf(Math.abs(p),1) : '—'} <small>${t('kw')} · ${d.dcfc ? t('dc_fast') : (gun || 'AC')}</small></div>
          <div class="meta">
            ${d.session != null ? `<span${this._more('kwh_charged')}>${t('session')} <b>${nf(d.session,2)} ${t('kwh')}</b></span>` : ''}
            ${d.voltage != null ? `<span${this._more('voltage')}><b>${nf(d.voltage,0)} ${t('v')}</b>${d.current != null ? ` · <b>${nf(Math.abs(d.current),1)} ${t('a')}</b>` : ''}</span>` : ''}
          </div>
        </div>
        ${eta ? `<div class="eta"><div><span>${t('to_target', {t:eta.target})}</span><b>${eta.left}</b></div>
          <div class="end">${ic('clock')} ${eta.end}</div>${eta.taper ? `<div class="taper">${t('taper')}</div>` : ''}</div>` : ''}
      </div>` : `
      <div class="grid">
        ${this._tile(t('state'), t('not_charging'), '', d.gun ? t('gun', {g: gun || t('gun_off')}) : '', 'plug', 'wide', 'is_charging')}
        ${this._tile(t('last_session'), nf(d.session,2), t('kwh'), '', 'bolt', '', 'kwh_charged')}
      </div>`;
    const battery = [
      this._tile(t('power'), p == null ? null : `<span class="${pcls}">${nf(p,1)}</span>`, t('kw'), p == null ? '' : p < 0 ? t('charging_l') : p > 1 ? t('discharge') : t('idle'), 'bolt', '', 'power'),
      this._tile(t('voltage'), nf(d.voltage,0), t('v'), '', 'wave', '', 'voltage'),
      this._tile(t('current'), d.current == null ? null : `<span class="${pcls}">${nf(d.current,1)}</span>`, t('a'), '', 'wave', '', 'current'),
      this._tile(t('batt_temp'), nf(d.batt_temp,1), '°C', d.batt_min != null && d.batt_max != null ? t('minmax', {a:Math.round(d.batt_min), b:Math.round(d.batt_max)}) : '', 'therm', '', 'batt_temp'),
      this._tile(t('capacity'), nf(d.capacity,1), t('kwh'), t('nominal'), 'batt', '', 'capacity'),
      this._tile(t('soh'), nf(d.soh,1), '%', '', 'heart', '', 'soh'),
      this._tile(t('cells'), nf(d.cell_max,3), t('v'), d.cell_min != null ? t('cells_sub', {a:nf(d.cell_min,3), d:Math.round((d.cell_max-d.cell_min)*1000)}) : '', 'cpu', '', 'cell_max_v'),
      this._tile(t('aux'), nf(d.aux_voltage,1), t('v'), '', 'batt', '', 'aux_voltage'),
      this._tile(t('vstate'), d.vehicle_state != null ? t('vs_' + d.vehicle_state) : null, '', '', 'cpu', '', 'vehicle_state'),
    ].join('');
    const motion = [
      this._tile(t('speed'), Math.round(d.speed), t('kmh'), '', 'gauge', '', 'speed'),
      this._tile(t('motors'), d.fm_temp != null || d.rm_temp != null ? `${d.fm_temp != null ? Math.round(d.fm_temp) + '°' : '—'} / ${d.rm_temp != null ? Math.round(d.rm_temp) + '°' : '—'}` : null, '', t('front_rear'), 'therm', '', d.fm_temp != null ? 'front_motor_temp' : 'rear_motor_temp'),
      this._tile(t('rpm'), d.rpm != null ? Math.round(d.rpm).toLocaleString(STR[this.lang].locale) : null, 'RPM', t('front_motor'), 'fan', '', 'motor_rpm'),
    ].join('');
    const climate = [
      this._tile(t('cabin'), nf(d.cabin,1), '°C', '', 'therm', '', 'cabin_temp'),
      this._tile(t('outside'), nf(d.outside,1), '°C', '', 'therm', '', 'ext_temp'),
      this._tile(t('setpoint'), nf(d.setpoint,1), '°C', d.ac != null ? t('ac_fan', {a: d.ac === 'on' ? t('on') : t('off'), f: d.fan == null || d.fan === 'off' || d.fan === '0' ? t('off') : d.fan}) : '', 'snow', '', 'hvac_setpoint'),
      c.show_seat_heat ? this._tile(t('seat'), d.seat == null ? null : d.seat === 'off' ? t('off_v') : t('lvl_' + d.seat), '', t('heat'), 'therm', '', 'seat_heat') : '',
      c.show_steering_heat ? this._tile(t('wheel'), d.wheel == null ? null : d.wheel === 'off' ? t('off_v') : t('on_v'), '', t('heat'), 'therm', '', 'steering_heat') : '',
      d.sunroof && d.sunroof !== 'not_equipped' ? this._tile(t('roof'), t('roof_' + d.sunroof), '', d.sunshade && d.sunshade !== 'not_equipped' ? t('shade', {s: t('roof_' + d.sunshade).toLowerCase()}) : '', 'fan', '', 'sunroof') : '',
    ].join('');
    const ty = d.tyres, hasTyres = ['fl','fr','rl','rr'].some(w => ty[w].some(x => x != null));
    const hasLocks = ['fl','fr','rl','rr'].some(k => d.locks[k] != null);
    const winKnown = ['fl','fr','rl','rr'].some(k => d.windows[k] != null);
    const winOpen = ['fl','fr','rl','rr'].filter(k => (d.windows[k] ?? 0) > 0);
    const lockChip = (k) => d.locks[k] == null ? '' : `<span class="chip ${d.locks[k] === 'locked' ? '' : 'warn'}"${this._more('lock_' + k)}>${ic(d.locks[k] === 'locked' ? 'lock' : 'unlock')} ${t(k)}</span>`;
    const body = hasTyres || hasLocks || winKnown || d.hood != null || d.trunk != null;
    const ups = d.updated ? this._ago(d.updated) : '—';

    return `
      ${this._alerts(d)}
      <div class="head">
        <div><h2>${esc(this._cfg.title || this._veh.title)}</h2><div class="status"${this._more(d.charging ? 'is_charging' : 'is_parked')}><span class="dot ${dot}"></span>${status}</div></div>
        ${d.odo != null ? `<div class="odo"${this._more('odometer')}>${ic('gauge')} ${Math.round(d.odo).toLocaleString(STR[this.lang].locale)} ${t('km')}</div>` : ''}
      </div>
      <div class="hero ${driving ? 'driving' : ''}" data-k="hero">
        ${d.parked ? `<div class="psign" role="img" aria-label="${t('parked')}">P<small>${t('parking')}</small></div>` : ''}
        ${driving ? `<div class="spd"${this._more('speed')}><b>${Math.round(d.speed)}</b><span>${t('kmh')}</span></div>` : ''}
        <div class="scene"><div class="road"></div><div class="streaks"><i></i><i></i><i></i></div></div>
        <div class="carwrap"><img src="${this._side}" alt="">${this._cfg.image_side ? '' : WHEELS.map(w => this._wheel(w)).join('')}</div>
      </div>
      <div class="chips">${chips}</div>
      ${d.soc != null ? `<div class="soc">
        <div class="soc-row"><div class="soc-big"${this._more('soc')}>${Math.round(d.soc)}<small>%</small></div>
          ${d.range != null ? `<div class="range"${this._more('range')}>${t('range')} <b>${Math.round(d.range)} ${t('km')}</b></div>` : ''}</div>
        <div class="bar"${this._more('soc') || ' role="img"'} aria-label="${Math.round(d.soc)}%"><i class="${socCls} ${d.charging ? 'charging' : ''}" style="width:${d.soc}%"></i></div>
        <div class="energy">${usable != null ? `<span>${t('of_cap', {u:nf(usable,1), c:nf(d.capacity,1)})}</span>` : '<span></span>'}${d.soh != null ? `<span${this._more('soh')}>SoH ${nf(d.soh,1)}%</span>` : ''}</div>
      </div>` : ''}
      ${driving ? '' : `<section class="blk"><h3>${t('sec_charging')}</h3>${chg}</section>`}
      ${battery ? `<section class="blk"><h3>${t('sec_battery')}</h3><div class="grid">${battery}</div></section>` : ''}
      ${driving && motion ? `<section class="blk"><h3>${t('sec_motion')}</h3><div class="grid">${motion}</div></section>` : ''}
      ${climate ? `<section class="blk"><h3>${t('sec_climate')}</h3><div class="grid">${climate}</div></section>` : ''}
      ${body ? `<section class="blk"><h3>${t('sec_body')}</h3>
        <div class="top">
          <div class="col">${this._tyre(ty.fl, 'fl')}${this._tyre(ty.rl, 'rl')}</div>
          <div class="topcar"><img src="${this._top}" alt="">
            ${d.hood != null ? `<span class="lbl ${d.hood === 'open' ? 'open' : ''}" style="top:8px"${this._more('hood')}>${t('hood', {s: d.hood === 'open' ? t('open_n') : t('closed_n')})}</span>` : ''}
            ${d.cabin != null ? `<span class="lbl" style="top:47%"${this._more('cabin_temp')}>${nf(d.cabin,1)} °C</span>` : ''}
            ${d.trunk != null ? `<span class="lbl ${d.trunk === 'open' ? 'open' : ''}" style="bottom:8px"${this._more('trunk')}>${t('trunk', {s: d.trunk === 'open' ? t('open_n') : t('closed_n')})}</span>` : ''}
          </div>
          <div class="col r">${this._tyre(ty.fr, 'fr')}${this._tyre(ty.rr, 'rr')}</div>
        </div>
        <div class="locks">${lockChip('fl')}${lockChip('fr')}${lockChip('rl')}${lockChip('rr')}
          ${winKnown ? (winOpen.length ? `<span class="chip warn">${t('win_open', {w: winOpen.map(k => t(k).toLowerCase() + ' ' + Math.round(d.windows[k]) + '%').join(', ')})}</span>` : `<span class="chip ok">${t('win_closed')}</span>`) : ''}
        </div></section>` : ''}
      <div class="foot"${this._more('last_update')}><span>${ic('clock')} ${t('updated')} <b>${ups}</b></span><span>${d.updated ? this._stamp(d.updated) : ''}</span></div>`;
  }

  _offlineHtml(d){
    const t = (k, x) => this.t(k, x);
    const alert = d.charging || !d.parked;
    const svg = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;
    const lt = this._trips?.trips?.at(-1);
    const st = d.charging ? t('st_charging') : !d.parked ? t('st_driving') : t('st_parked');
    return `
      <div class="head"><div><h2>${esc(this._cfg.title || this._veh.title)}</h2>
        <div class="status"${this._more('online')}><span class="dot ${alert ? 'off' : 'stale'}"></span>${alert ? t('no_link') : t('asleep')}</div></div></div>
      <div class="hero offline" data-k="hero-off"><div class="carwrap"><img src="${this._side}" alt=""></div></div>
      <div class="offline-box ${alert ? 'alert' : ''}"><div class="ico">${svg(alert ? 'wifioff' : 'moon')}</div>
        <div><h4>${alert ? t('no_data') : t('mm_off')}</h4>
        <p>${d.updated ? (alert ? t('no_data_p', {a:this._ago(d.updated), s:st}) : t('asleep_p', {a:this._ago(d.updated)})) : ''}</p></div></div>
      <div class="lastknown">
        ${d.place ? `<span class="chip"${this._more('location')}>${ic('pin')} ${t('last_place', {p:esc(d.place)})}</span>` : ''}
        ${lt ? `<span class="chip">${ic('route')} ${t('last_trip', {a:hm(lt.start), b:hm(lt.end), k:this.nf(lt.km,1)})}</span>` : ''}
      </div>
      <div class="foot ${alert ? 'offline' : ''}"${this._more('last_update')}><span>${ic('clock')} ${t('last_packet')}</span><span>${d.updated ? this._stamp(d.updated) : ''}</span></div>`;
  }

  _tempo(d){
    const hero = this.shadowRoot.querySelector('.hero.driving'); if (!hero) return;
    const s = Math.max(d.speed || 0, 1);
    const rps = s / (3.6 * Math.PI * 0.75) / 4;
    hero.style.setProperty('--wheel-dur', (1/Math.max(rps, .15)).toFixed(2)+'s');
    hero.style.setProperty('--road-dur', Math.max(.18, 22/s).toFixed(2)+'s');
    hero.style.setProperty('--streak-dur', Math.max(.45, 60/s).toFixed(2)+'s');
    hero.classList.toggle('stopped', !(d.speed > 0));
  }

  /* -- trips -- */
  async _refreshTrips(){
    clearTimeout(this._tripTimer);
    if (!this._veh || this._cfg.layout === 'car') return;
    try {
      this._trips = await this._hass.callWS({type: `${DOMAIN}/trips`, entry_id: this._veh.entry_id, days: Math.max(this._period, this._cfg.trips_days)});
    } catch (e) { this._trips = {trips: [], live: null}; }
    if (!this._sel || (this._sel === 'live' && !this._trips.live)) this._sel = this._trips.live ? 'live' : this._trips.trips.at(-1)?.id || null;
    if (this._sel) await this._loadRoute(this._sel, true);
    else {
      // No trips yet: still show the map, centred on the car when its position is known.
      await this._ensureMap();
      const d = this._data();
      if (this._map && d.lat != null){ this._map.setView([d.lat, d.lon], 14); this._moveCar(d.lat, d.lon, false); }
    }
    this._renderTrips();
    // While a trip is open, poll for its growing route.
    this._tripTimer = setTimeout(() => this._refreshTrips(), this._trips.live ? 5000 : 300000);
  }
  async _loadRoute(id, fit){
    if (!id || !this._veh) return;
    try {
      const trip = await this._hass.callWS({type: `${DOMAIN}/trip`, entry_id: this._veh.entry_id, trip_id: id});
      this._route = trip;
      await this._ensureMap();
      this._drawRoute(trip, fit && (id !== 'live' || !this._fitted));
      if (id === 'live') this._fitted = true;
    } catch (e) { this._route = null; }
  }
  async _ensureMap(){
    if (this._map || this._cfg.show_trips_map === false) return;
    const L = await loadLeaflet().catch(() => null);
    if (!L){ this.$('map').innerHTML = `<div class="empty">${this.t('map_fail')}</div>`; return; }
    this.shadowRoot.getElementById('lcss').textContent = await leafletCss();
    const dark = !this._isLight();
    this._map = L.map(this.$('map'), {zoomControl: true, scrollWheelZoom: false, attributionControl: true}).setView([50.45, 30.52], 11);
    const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
    const kind = dark ? 'Dark' : 'Light';
    L.tileLayer(this._cfg.map_tiles || `${esri}World_${kind}_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {maxNativeZoom: 16, maxZoom: 18, attribution: this._cfg.map_tiles ? '' : 'Tiles &copy; Esri'}).addTo(this._map);
    if (!this._cfg.map_tiles) L.tileLayer(`${esri}World_${kind}_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, {maxNativeZoom: 16, maxZoom: 18}).addTo(this._map);
    this._routeLayer = L.layerGroup().addTo(this._map);
    this._pinchZoom();
    new ResizeObserver(() => { this._map.invalidateSize({animate: false}); if (this._route) this._drawRoute(this._route, true); }).observe(this.$('map'));
  }
  /* Pinch-to-zoom on the map instead of the page. Leaflet handles pinch through pointer/touch events,
     but WebKit (iOS Safari, the HA iOS app, macOS trackpads) also fires gesture* events and zooms the whole page.
     Cancelling them keeps the page still; if Leaflet's own pinch is not running, the gesture drives the map zoom. */
  _pinchZoom(){
    const el = this.$('map'), map = this._map;
    let g = null;
    const opts = {passive: false};
    el.addEventListener('gesturestart', (e) => { e.preventDefault(); g = {z: map.getZoom(), p: map.mouseEventToContainerPoint(e)}; }, opts);
    el.addEventListener('gesturechange', (e) => {
      e.preventDefault();
      if (!g || map.touchZoom?._zooming || !(e.scale > 0)) return;
      const z = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), Math.round(g.z + Math.log2(e.scale))));
      if (z !== map.getZoom()) map.setZoomAround(g.p, z, {animate: false});
    }, opts);
    el.addEventListener('gestureend', (e) => { e.preventDefault(); g = null; }, opts);
    // Chrome / Edge / Firefox on a trackpad report a pinch as a wheel event with ctrlKey (Ctrl + wheel on a mouse too).
    // Ordinary scrolling (no ctrlKey) still scrolls the page, so the dashboard does not get stuck on the map.
    let acc = 0, last = 0;
    el.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const now = performance.now();
      if (now - last > 400) acc = 0;
      last = now;
      acc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const step = acc <= -PINCH_STEP ? 1 : acc >= PINCH_STEP ? -1 : 0;
      if (!step) return;
      acc = 0;
      const z = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + step));
      if (z !== map.getZoom()) map.setZoomAround(map.mouseEventToContainerPoint(e), z);
    }, opts);
  }
  _drawRoute(trip, fit){
    if (!this._map) return;
    const L = window.L, pts = trip.points || [];
    this._routeLayer.clearLayers();
    if (pts.length < 2) return;
    let seg = [[pts[0].lat, pts[0].lon]], col = powerColor(pts[0].power);
    for (let i = 1; i < pts.length; i++){
      const cc = powerColor(pts[i].power);
      seg.push([pts[i].lat, pts[i].lon]);
      if (cc !== col || i === pts.length - 1){ L.polyline(seg, {color: col, weight: 4, opacity: .95}).addTo(this._routeLayer); seg = [[pts[i].lat, pts[i].lon]]; col = cc; }
    }
    L.circleMarker([pts[0].lat, pts[0].lon], {radius: 6, color: '#fff', weight: 2, fillColor: '#4caf50', fillOpacity: 1}).addTo(this._routeLayer).bindTooltip(this.t('start') + ' ' + hm(trip.start));
    if (!trip.live) L.circleMarker([pts.at(-1).lat, pts.at(-1).lon], {radius: 6, color: '#fff', weight: 2, fillColor: '#f44336', fillOpacity: 1}).addTo(this._routeLayer).bindTooltip(this.t('finish') + ' ' + hm(trip.end));
    if (fit) this._map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lon])), {padding: [24, 24], animate: false});
  }
  _moveCar(lat, lon, follow){
    const L = window.L; if (!L || !this._map) return;
    if (!this._carPin) this._carPin = L.marker([lat, lon], {icon: L.divIcon({className: '', html: '<div class="carpin"></div>', iconSize: [22, 22], iconAnchor: [11, 11]}), zIndexOffset: 1000}).addTo(this._map);
    this._carPin.setLatLng([lat, lon]);
    if (follow && !this._map.getBounds().pad(-0.15).contains([lat, lon])) this._map.panTo([lat, lon], {animate: false});
  }

  _renderTrips(){
    const t = (k, x) => this.t(k, x), nf = (v, n) => this.nf(v, n);
    const data = this._trips || {trips: [], live: null};
    const from = new Date(); from.setHours(0,0,0,0); from.setDate(from.getDate() - (Math.min(this._period, 36500) - 1));
    const list = data.trips.filter(x => x.start*1000 >= from.getTime());
    const lv = data.live;
    const all = lv ? [...list, lv] : list;
    const sum = (xs) => { const km = xs.reduce((a,x) => a + x.km, 0), kwh = xs.reduce((a,x) => a + (x.kwh ?? 0), 0); return {km, kwh, per100: km ? kwh/km*100 : null, n: xs.length}; };
    const s = sum(all);
    morph(this.$('thead'), `
      <div class="tc-head"><h2>${t('trips')}</h2></div>
      <div class="totals">
        <div><div class="k">${t('distance')}</div><div class="v">${nf(s.km,1)}<small>${t('km')}</small></div></div>
        <div><div class="k">${t('energy')}</div><div class="v">${nf(s.kwh,1)}<small>${t('kwh')}</small></div></div>
        <div><div class="k">${t('average')}</div><div class="v ${per100Cls(s.per100)}">${s.per100 == null ? '—' : nf(s.per100,1)}<small>/100</small></div></div>
        <div><div class="k">${t('count')}</div><div class="v">${s.n}</div></div>
      </div>`);
    this.$('map').style.display = this._cfg.show_trips_map === false ? 'none' : '';

    const groups = {};
    list.forEach(x => (groups[dayKey(x.start)] ||= []).push(x));
    if (lv) (groups[dayKey(lv.start)] ||= []).push(lv);
    const keys = Object.keys(groups).sort().reverse();
    this._open ||= {};
    const head = `<div class="trow hd"><span>${t('h_time')}</span><span>${t('h_dur')}</span><span>${t('h_km')}</span><span>SOC</span><span>/100</span></div>`;
    const row = (x) => {
      const id = x.live ? 'live' : x.id, sel = this._sel === id;
      return `<div class="trow ${sel ? 'sel' : ''}" data-act="trip" data-id="${id}" role="button" tabindex="0">
        <span class="mono">${x.live ? `<span class="live">${hm(x.start)} · ${t('now')}</span>` : `${hm(x.start)}–${hm(x.end)}`}</span>
        <span class="mono">${dur(x.end - x.start)}</span><span class="mono">${nf(x.km,1)}</span>
        <span class="mono">${x.soc_start != null ? Math.round(x.soc_start) : '—'}→${x.soc_end != null ? Math.round(x.soc_end) : '—'}</span>
        <span class="mono ${per100Cls(x.per100)}">${x.per100 == null ? '—' : nf(x.per100,1)}</span></div>`;
    };
    const days = keys.length ? keys.map((k, gi) => {
      const items = groups[k].sort((a,b) => b.start - a.start), ds = sum(items);
      const open = this._open[k] ?? gi === 0;
      return `<div class="day ${open ? 'open' : ''}" data-k="${k}">
        <div class="day-h" data-act="day" data-day="${k}"><b><span class="tri">▸</span> ${this.dayLabel(items[0].start)}</b>
          <span>${nf(ds.km,1)} ${t('km')}</span><span>${nf(ds.kwh,1)} ${t('kwh')}</span><span class="${per100Cls(ds.per100)}">${ds.per100 == null ? '—' : nf(ds.per100,1)}/100</span></div>
        <div class="rows">${head}${items.map(row).join('')}</div></div>`;
    }).join('') : `<div class="empty">${t('no_trips')}</div>`;

    const sel = this._sel === 'live' ? lv : data.trips.find(x => x.id === this._sel);
    let detail = '';
    if (sel){
      const socD = sel.soc_start != null && sel.soc_end != null ? Math.round(sel.soc_end - sel.soc_start) : null;
      detail = `<div class="detail">
        <div class="ttl"><b>${this.dayLabel(sel.start)}</b><span>${hm(sel.start)}${sel.live ? ' · ' + t('on_road') : '–' + hm(sel.end)}</span></div>
        <div class="grid">
          ${this._tile(t('distance'), nf(sel.km,1), t('km'), '', 'route')}
          ${this._tile(t('energy'), sel.kwh == null ? '—' : nf(sel.kwh,2), t('kwh'), '', 'bolt')}
          ${this._tile(t('consumption'), `<span class="${per100Cls(sel.per100)}">${sel.per100 == null ? '—' : nf(sel.per100,1)}</span>`, t('kwh') + '/100', '', 'gauge')}
          ${this._tile('SOC', sel.soc_start != null ? `${Math.round(sel.soc_start)}→${Math.round(sel.soc_end)}` : null, '%', socD == null ? '' : socD < 0 ? `−${-socD}%` : socD > 0 ? `+${socD}%` : '0%', 'batt')}
          ${this._tile(t('duration'), dur(sel.end - sel.start), '', sel.moving_s ? t('moving', {d: dur(sel.moving_s)}) : '', 'clock')}
          ${this._tile(t('avg_speed'), sel.avg_speed == null ? '—' : nf(sel.avg_speed,0), t('kmh'), t('over_moving'), 'gauge')}
          ${this._tile(t('outside'), sel.ext_start == null ? null : sel.ext_start === sel.ext_end || sel.ext_end == null ? `${Math.round(sel.ext_start)}°` : `${Math.round(sel.ext_start)}° → ${Math.round(sel.ext_end)}°`, '', '', 'therm')}
          ${this._tile(t('battery'), sel.batt_avg == null ? null : nf(sel.batt_avg,0) + '°', '', sel.batt_min != null ? t('minmax', {a: Math.round(sel.batt_min), b: Math.round(sel.batt_max)}) : '', 'therm')}
        </div></div>`;
    }
    morph(this.$('tbody'), `
      ${this._cfg.show_trips_map === false ? '' : `<div class="legend"><span><i style="background:#4fc3f7"></i>${t('pw_low')}</span><span><i style="background:#66bb6a"></i>15–22</span><span><i style="background:#ffca28"></i>22–27</span><span><i style="background:#ef5350"></i>${t('pw_high')}</span>${this._route?.points?.some(p => p.power == null) ? `<span><i style="background:${POWER_NA}"></i>${t('pw_na')}</span>` : ''}</div>`}
      ${detail}
      <div class="periods">
          <div class="seg sm" role="group">
          <button type="button" data-act="period" data-p="1" aria-pressed="${this._period === 1}">${t('today')}</button>
          <button type="button" data-act="period" data-p="7" aria-pressed="${this._period === 7}">${t('week')}</button>
          <button type="button" data-act="period" data-p="30" aria-pressed="${this._period === 30}">${t('month')}</button>
          <button type="button" data-act="period" data-p="365" aria-pressed="${this._period === 365}">${t('year')}</button>
          <button type="button" data-act="period" data-p="36500" aria-pressed="${this._period === 36500}">${t('all')}</button>
        </div></div>
      <div class="days">${days}</div>`);
  }

  async _onClick(e){
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act;
    if (act === 'more'){
      this.dispatchEvent(new CustomEvent('hass-more-info', {detail: {entityId: el.dataset.e}, bubbles: true, composed: true}));
    }
    else if (act === 'alerts'){ this._alertsOpen = !this._alertsOpen; this._render(true); }
    else if (act === 'period'){ this._period = +el.dataset.p; await this._refreshTrips(); }
    else if (act === 'day'){ const k = el.dataset.day; const box = el.parentElement; this._open[k] = !box.classList.contains('open'); this._renderTrips(); }
    else if (act === 'trip'){ this._sel = el.dataset.id; this._fitted = false; this._renderTrips(); await this._loadRoute(this._sel, true); this._renderTrips(); }
  }
}

/* ---------- Visual editor (HA's own ha-form) ---------- */
class BydLeopard3CardEditor extends HTMLElement {
  setConfig(config){ this._cfg = {...config}; this._draw(); }
  set hass(hass){
    const first = !this._hass; this._hass = hass;
    if (first) hass.callWS({type: `${DOMAIN}/vehicles`}).then(v => { this._veh = v; this._draw(); }).catch(() => { this._veh = []; this._draw(); });
    if (this._form) this._form.hass = hass;
  }
  get lang(){
    return pickLang(this._cfg?.language, this._hass);
  }
  t(k){ return STR[this.lang]?.[k] ?? STR.en[k] ?? k; }
  _schema(){
    const opt = (vals, pre) => vals.map(v => ({value: v, label: this.t(pre + v)}));
    const s = [
      {name: 'entry_id', selector: {select: {mode: 'dropdown', options: (this._veh || []).map(v => ({value: v.entry_id, label: v.title}))}}},
      {name: 'layout', selector: {select: {mode: 'dropdown', options: opt(['car', 'trips', 'combo'], 'l_')}}},
      {name: 'language', selector: {select: {mode: 'dropdown', options: [{value: 'auto', label: this.t('lang_auto')}, ...LANGS.map(([value, label]) => ({value, label}))]}}},
      {name: 'color', selector: {select: {mode: 'dropdown', options: opt([...Object.keys(COLORS), 'custom'], 'col_')}}},
    ];
    if (this._cfg.color === 'custom') s.push({name: 'custom_color', selector: {color_rgb: {}}});
    s.push(
      {name: 'theme', selector: {select: {mode: 'dropdown', options: opt(Object.keys(THEMES), 'th_')}}},
      {type: 'expandable', name: 'theme_colors', title: this.t('ed_theme_colors'),
       schema: THEME_KEYS.map(k => ({name: k, selector: {color_rgb: {}}}))},
    );
    s.push(
      {name: 'show_alerts', selector: {boolean: {}}},
      {name: 'show_seat_heat', selector: {boolean: {}}},
      {name: 'show_steering_heat', selector: {boolean: {}}},
      {name: 'show_trips_map', selector: {boolean: {}}},
      {name: 'low_soc', selector: {number: {min: 5, max: 50, step: 1, mode: 'box', unit_of_measurement: '%'}}},
      {name: 'tyre_min', selector: {number: {min: 1.5, max: 3.5, step: 0.05, mode: 'box', unit_of_measurement: 'bar'}}},
      {name: 'charge_target', selector: {number: {min: 50, max: 100, step: 5, mode: 'box', unit_of_measurement: '%'}}},
      {type: 'expandable', name: 'advanced', flatten: true, title: this.t('ed_advanced'), schema: [
        {name: 'title', selector: {text: {}}},
        {name: 'image_side', selector: {text: {}}},
        {name: 'image_top', selector: {text: {}}},
        {name: 'map_tiles', selector: {text: {}}},
      ]},
    );
    return s;
  }
  _draw(){
    if (!this._cfg || !this._hass) return;
    if (!this._form){
      this._form = document.createElement('ha-form');
      this._form.computeLabel = (s) => this.t('ed_' + s.name);
      this._form.computeHelper = (s) => STR[this.lang]['edh_' + s.name] ?? STR.en['edh_' + s.name] ?? undefined;
      this._form.addEventListener('value-changed', (e) => {
        const next = {...e.detail.value};
        if ((next.theme || 'ha') !== (this._cfg.theme || 'ha')) delete next.theme_colors;   // a new theme starts clean
        else {
          // Keep only the colours that differ from the theme, so switching themes later still works.
          const diff = {};
          for (const k of THEME_KEYS){
            const v = toHex(next.theme_colors?.[k]);
            if (v && v !== this._base?.[k]) diff[k] = toRgb(v);
          }
          if (Object.keys(diff).length) next.theme_colors = diff; else delete next.theme_colors;
        }
        this._cfg = next;
        this.dispatchEvent(new CustomEvent('config-changed', {detail: {config: this._cfg}, bubbles: true, composed: true}));
        this._draw();
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._base = this._baseColors();
    const colors = {};
    for (const k of THEME_KEYS){ const v = toHex(this._cfg.theme_colors?.[k]) || this._base[k]; if (v) colors[k] = toRgb(v); }
    this._form.data = {...DEFAULTS, ...this._cfg, theme_colors: colors};
  }
  _baseColors(){
    const preset = THEMES[this._cfg.theme || 'ha'];
    if (preset) return {...preset};
    // "Same as Home Assistant": show the colours of the active HA theme.
    const cs = getComputedStyle(this), v = (...names) => { for (const n of names){ const x = cs.getPropertyValue(n).trim(); if (x) return toHex(cssRgb(x)) || null; } return null; };
    return {background: v('--ha-card-background', '--card-background-color'), tiles: v('--secondary-background-color'),
            divider: v('--divider-color'), text: v('--primary-text-color'), secondary: v('--secondary-text-color'), accent: v('--primary-color')};
  }
}

const CSS = `:host{
  --bg:var(--primary-background-color,#111); --card:var(--ha-card-background,var(--card-background-color,#1c1c1c));
  --card-2:var(--secondary-background-color,#232323); --line:var(--divider-color,#2e2e2e);
  --text:var(--primary-text-color,#e1e1e1); --muted:var(--secondary-text-color,#9b9b9b); --faint:var(--disabled-text-color,#6f6f6f);
  --accent:var(--primary-color,#03a9f4); --ok:var(--success-color,#4caf50); --warn:var(--warning-color,#ff9800); --err:var(--error-color,#f44336);
  --dc:#ab47bc; --park:#1e63c8; --radius:var(--ha-card-border-radius,12px);
  display:block;
}
*{box-sizing:border-box}
ha-card{display:block;overflow:hidden;color:var(--text);font-size:14px;line-height:1.4;container-type:inline-size}
.card{background:transparent;border:0;border-radius:0;overflow:hidden;min-width:0}
.split{display:grid;grid-template-columns:minmax(0,1fr)}
.mode-car #trips,.mode-trips #car{display:none}
.mode-combo #trips{border-top:1px solid var(--line)}
@container (min-width:860px){
  .mode-combo .split{grid-template-columns:minmax(0,460px) minmax(0,1fr)}
  .mode-combo #trips{border-top:0;border-left:1px solid var(--line)}
  .mode-combo #map{height:340px}
}
.seg{display:flex;flex-wrap:wrap;gap:4px;background:var(--card-2);border-radius:999px;padding:3px}
.seg button{all:unset;cursor:pointer;padding:4px 10px;border-radius:999px;color:var(--muted);font-size:12px}
.seg button[aria-pressed=true]{background:var(--accent);color:var(--text-primary-color,#fff)}
.seg button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.hero.stopped .wheel,.hero.stopped .road,.hero.stopped .streaks i{animation-play-state:paused}


/* Card variants: car only, trips only, or both in one card */

/* Controls */

/* Card */
.card{background:var(--card);border-radius:var(--radius);border:1px solid var(--line);overflow:hidden}
.head{display:flex;justify-content:space-between;align-items:flex-start;padding:16px 16px 0;gap:8px}
.head h2{margin:0;font-size:20px;font-weight:500}
.status{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;margin-top:2px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px rgba(76,175,80,.18)}
.dot.drive{background:var(--accent);box-shadow:0 0 0 3px rgba(3,169,244,.2);animation:pulse 1.4s ease-in-out infinite}
.dot.stale{background:var(--faint);box-shadow:none}
.dot.off{background:var(--err);box-shadow:0 0 0 3px rgba(244,67,54,.2)}
@keyframes pulse{50%{box-shadow:0 0 0 6px rgba(3,169,244,0)}}
.odo{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;white-space:nowrap}

/* Hero */
.hero{position:relative;padding:8px 12px 0;text-align:center;overflow:hidden}
.hero::before{content:"";position:absolute;inset:18% 6% 4%;background:radial-gradient(closest-side,rgba(160,190,220,.16),transparent);pointer-events:none}
.carwrap{position:relative;width:100%;max-width:420px;margin:0 auto;z-index:1}
.carwrap img{width:100%;display:block;filter:drop-shadow(0 14px 12px rgba(0,0,0,.6)) brightness(1.08)}
.wheel{position:absolute;border-radius:50%;background-repeat:no-repeat;display:none;filter:brightness(1.08)}
.scene{position:absolute;left:0;right:0;bottom:4px;height:34%;pointer-events:none;display:none}
.road{position:absolute;left:-10%;right:-10%;bottom:10px;height:3px;
  background:repeating-linear-gradient(90deg,rgba(255,255,255,.35) 0 34px,transparent 34px 78px);background-size:78px 3px;
  -webkit-mask:linear-gradient(90deg,transparent,#000 15%,#000 85%,transparent);mask:linear-gradient(90deg,transparent,#000 15%,#000 85%,transparent)}
.streaks i{position:absolute;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(180,210,240,.5));right:-30%;width:28%;opacity:0}
.streaks i:nth-child(1){top:-120%;animation-delay:0s}
.streaks i:nth-child(2){top:-70%;animation-delay:.35s;width:20%}
.streaks i:nth-child(3){top:-20%;animation-delay:.7s;width:24%}
.hero.driving .scene{display:block}
.hero.driving .wheel{display:block;animation:spin var(--wheel-dur,.5s) linear infinite reverse}
.hero.driving .road{animation:road var(--road-dur,.6s) linear infinite}
.hero.driving .streaks i{animation:streak var(--streak-dur,1s) linear infinite}
.hero.driving .carwrap{animation:bob .9s ease-in-out infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes road{to{background-position:78px 0}}
@keyframes streak{0%{transform:translateX(-260%);opacity:0}20%{opacity:1}100%{transform:translateX(40%);opacity:0}}
@keyframes bob{50%{transform:translateY(-1.2px)}}
.spd{position:absolute;right:16px;top:6px;z-index:2;text-align:right;line-height:1}
.spd b{font-size:28px;font-weight:500;font-variant-numeric:tabular-nums}
.spd span{display:block;color:var(--muted);font-size:11px;margin-top:2px}
.psign{position:absolute;left:16px;top:8px;z-index:2;width:34px;height:34px;border-radius:7px;background:var(--park);
  border:2px solid #fff;color:#fff;font:700 22px/30px Roboto,sans-serif;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.45);animation:pop .35s ease-out}
.psign small{position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:4px;font:500 10px/1 Roboto,sans-serif;color:var(--muted);white-space:nowrap}
@keyframes pop{from{transform:scale(.6);opacity:0}}
@media (prefers-reduced-motion:reduce){
  .hero.driving .wheel,.hero.driving .road,.hero.driving .streaks i,.hero.driving .carwrap,.psign,.dot.drive{animation:none}
}
.hero.offline img{filter:grayscale(1) brightness(.8);opacity:.35}

.chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:10px 16px 0}
.chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:var(--card-2);color:var(--muted);font-size:12.5px;position:relative}
.chip.ok{background:rgba(76,175,80,.16);color:#8fd694}
.chip.dc{background:rgba(171,71,188,.2);color:#d9a5e2}
.chip.info{background:rgba(3,169,244,.15);color:#7fd0f7}
.chip.warn{background:rgba(255,152,0,.16);color:#ffc069}
.chip.park{background:rgba(30,99,200,.22);color:#9cc2ff}

.soc{padding:14px 16px 4px}
.soc-row{display:flex;justify-content:space-between;align-items:baseline}
.soc-big{font-size:34px;font-weight:500;letter-spacing:-.5px}
.soc-big small{font-size:16px;color:var(--muted);font-weight:400;margin-left:2px}
.range{color:var(--muted);text-align:right}
.range b{color:var(--text);font-size:18px;font-weight:500}
.bar{position:relative;height:12px;border-radius:6px;background:var(--track,#333);overflow:hidden;margin:8px 0 6px}
.bar i{position:absolute;inset:0 auto 0 0;border-radius:6px;background:var(--ok);transition:width .5s}
.bar i.low{background:var(--warn)}
.bar i.crit{background:var(--err)}
.bar i.charging{background-image:repeating-linear-gradient(-45deg,rgba(255,255,255,.18) 0 8px,transparent 8px 16px);background-size:22.6px 100%;animation:stripes 1s linear infinite}
@keyframes stripes{to{background-position:22.6px 0}}
@media (prefers-reduced-motion:reduce){.bar i.charging{animation:none}}
.energy{display:flex;justify-content:space-between;color:var(--muted);font-size:12.5px;gap:8px;flex-wrap:wrap}

section.blk{padding:14px 16px 4px;border-top:1px solid var(--line);margin-top:12px}
section.blk h3{margin:0 0 10px;font-size:12px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);display:flex;justify-content:space-between;align-items:center;gap:8px}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
@media (max-width:400px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.tile{background:var(--card-2);border-radius:10px;padding:9px 10px;position:relative;min-width:0}
.tile .k{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile .v{font-size:16px;font-weight:500;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile .v small{font-size:12px;color:var(--muted);font-weight:400;margin-left:2px}
.tile .s{font-size:11px;color:var(--faint);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile.wide{grid-column:span 2}
.neg{color:#8fd694}
.pos{color:#ffb74d}
svg.i{width:14px;height:14px;flex:none;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}


/* Charging panel */
.chg{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;background:linear-gradient(135deg,rgba(76,175,80,.14),rgba(76,175,80,.04));border-radius:10px;padding:12px;margin-bottom:8px}
.chg.dc{background:linear-gradient(135deg,rgba(171,71,188,.2),rgba(171,71,188,.05))}
.chg .pw{font-size:26px;font-weight:500}
.chg .pw small{font-size:14px;color:var(--muted);font-weight:400}
.chg .meta{display:flex;flex-wrap:wrap;gap:4px 14px;color:var(--muted);font-size:12.5px}
.chg .meta b{color:var(--text);font-weight:500}
.ring{width:54px;height:54px}

/* Top view */
.top{display:grid;grid-template-columns:1fr auto 1fr;align-items:stretch;gap:6px}
.top .col{display:flex;flex-direction:column;justify-content:space-between;padding:22px 0}
.top .col.r{text-align:right}
.tyre .p{font-size:18px;font-weight:500}
.tyre .p small{font-size:12px;color:var(--muted);font-weight:400}
.tyre .t{font-size:12px;color:var(--muted)}
.tyre.low .p{color:var(--warn)}
.tyre .st{font-size:11px;color:var(--ok)}
.tyre.low .st{color:var(--warn)}
.topcar{position:relative;width:132px}
.topcar img{width:100%;display:block;filter:brightness(1.25) drop-shadow(0 0 14px rgba(160,190,220,.12))}
.topcar .lbl{position:absolute;left:50%;transform:translateX(-50%);font-size:11px;background:rgba(0,0,0,.6);padding:2px 7px;border-radius:999px;white-space:nowrap;color:var(--muted)}
.topcar .lbl.open{color:#ffc069;background:rgba(80,40,0,.75)}
.locks{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 4px}

/* Offline */
.offline-box{margin:14px 16px 0;padding:14px;border-radius:10px;background:var(--card-2);display:grid;grid-template-columns:36px minmax(0,1fr);gap:12px;align-items:start}
.offline-box.alert{background:rgba(244,67,54,.1)}
.offline-box .ico{width:36px;height:36px;min-width:36px;flex:none;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.06);color:var(--muted)}
.offline-box.alert .ico{background:rgba(244,67,54,.18);color:#ff8a80}
.offline-box .ico svg{width:18px;height:18px}
.offline-box h4{margin:0 0 4px;font-size:15px;font-weight:500}
.offline-box p{margin:0;color:var(--muted);font-size:12.5px}
.lastknown{margin:10px 16px 0;display:flex;flex-wrap:wrap;gap:6px}

.foot{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--line);margin-top:12px;color:var(--muted);font-size:12.5px;position:relative}
.foot b{color:var(--text);font-weight:500}
.foot.offline{background:rgba(244,67,54,.1);color:#ff8a80}

/* Trips card */
.tc-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:14px 16px 10px;flex-wrap:wrap}
.tc-head h2{margin:0;font-size:18px;font-weight:500;display:flex;align-items:center;gap:8px}
.totals{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:0 16px 12px}
.totals > div{background:var(--card-2);border-radius:10px;padding:8px 10px;min-width:0}
.totals .k{color:var(--muted);font-size:11px}
.totals .v{font-size:16px;font-weight:500;white-space:nowrap}
.totals .v small{font-size:11px;color:var(--muted);font-weight:400;margin-left:2px}
#map{touch-action:none;height:250px;background:#191a1a;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.leaflet-container{font:12px Roboto,sans-serif;background:#191a1a}
.leaflet-control-attribution{background:rgba(0,0,0,.55)!important;color:#888!important}
.leaflet-control-attribution a{color:#aaa!important}
.leaflet-bar a{background:#2a2a2a!important;color:#ddd!important;border-color:#3a3a3a!important}
.carpin{width:22px;height:22px;border-radius:50%;background:var(--accent);border:3px solid #fff;box-shadow:0 0 0 6px rgba(3,169,244,.25),0 2px 8px rgba(0,0,0,.5)}
.legend{display:flex;gap:10px;flex-wrap:wrap;padding:8px 16px 0;color:var(--faint);font-size:11px;align-items:center}
.legend i{display:inline-block;width:14px;height:4px;border-radius:2px;margin-right:4px;vertical-align:middle}
.detail{padding:10px 16px 4px}
.detail .ttl{display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:8px}
.detail .ttl b{font-size:15px;font-weight:500}
.detail .ttl span{color:var(--muted);font-size:12px}
.mono{font-family:"Roboto Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums}
.days{padding:6px 0 8px}
.periods{display:flex;justify-content:flex-end;padding:12px 16px 2px}
.day{border-top:1px solid var(--line)}
.day-h{display:grid;grid-template-columns:1fr auto auto auto;gap:12px;align-items:center;padding:10px 16px;cursor:pointer;user-select:none}
.day-h b{font-weight:500}
.day-h span{color:var(--muted);font-size:12.5px;white-space:nowrap}
.day-h .tri{display:inline-block;width:10px;color:var(--accent);transition:transform .15s}
.day.open .tri{transform:rotate(90deg)}
.rows{display:none;padding:0 8px 8px}
.day.open .rows{display:block}
.trow{display:grid;grid-template-columns:minmax(0,1.5fr) .6fr .7fr .9fr .7fr;gap:6px;align-items:center;padding:8px;border-radius:8px;cursor:pointer;font-size:13px}
.trow:hover{background:rgba(255,255,255,.03)}
.trow.sel{background:rgba(3,169,244,.12)}
.trow.hd{cursor:default;color:var(--faint);font-size:11px;padding-top:2px;padding-bottom:2px}
.trow.hd:hover{background:none}
.trow > :not(:first-child){text-align:right}
.trow .live{display:inline-flex;align-items:center;gap:5px;color:#7fd0f7}
.trow .live::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--accent);animation:pulse 1.4s infinite}
.c-good{color:#8fd694}.c-mid{color:#ffd54f}.c-bad{color:#ffb74d}
.empty{padding:20px 16px;color:var(--muted);text-align:center}

/* Side notes */
/* Alerts */
.alerts{display:flex;flex-direction:column;gap:6px;padding:12px 12px 0}
.alert{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;font-size:13px;line-height:1.3}
.alert svg.i{width:16px;height:16px}
.alert.err{background:rgba(244,67,54,.16);color:#ff8a80}
.alert.warn{background:rgba(255,152,0,.14);color:#ffc069}
.alert.info{background:rgba(3,169,244,.12);color:#7fd0f7}
.alert-more{all:unset;cursor:pointer;align-self:flex-start;color:var(--muted);font-size:12px;padding:2px 4px}
.alert-more:focus-visible{outline:2px solid var(--accent);border-radius:4px}
/* Charging forecast */
.chg .eta{grid-column:1/-1;display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;align-items:baseline;border-top:1px solid rgba(255,255,255,.08);padding-top:10px}
.chg .eta b{white-space:nowrap}
.chg .eta span{color:var(--muted);font-size:12.5px;margin-right:6px}
.chg .eta b{font-size:18px;font-weight:500}
.chg .eta .end{display:flex;align-items:center;gap:6px;color:var(--text);font-size:13px;white-space:nowrap}
.chg .eta .taper{flex-basis:100%;color:var(--faint);font-size:11px}
/* Clickable attributes: open the entity's history (more-info) */
[data-act=more]{cursor:pointer}
.tile.clk{transition:background .15s}
.tile.clk:hover,.tyre.clk:hover{background:color-mix(in srgb,var(--card-2) 82%,var(--text))}
.tyre.clk{border-radius:8px;padding:2px 4px;margin:-2px -4px}
.chip[data-act=more]:hover,.lbl[data-act=more]:hover{filter:brightness(1.2)}
.odo[data-act=more]:hover,.status[data-act=more]:hover,.soc-big[data-act=more]:hover,.range[data-act=more]:hover,.foot[data-act=more]:hover span:first-child,.energy [data-act=more]:hover,.chg [data-act=more]:hover{color:var(--accent)}
[data-act=more]:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}

/* Light themes */
.host.light{--track:#e3e6ea}
.host.light .chip.ok{color:#2e7d32}.host.light .chip.dc{color:#7b1fa2}.host.light .chip.info{color:#0277bd}
.host.light .chip.warn{color:#a15c00}.host.light .chip.park{color:#1e4fa0}
.host.light .alert.err{color:#c62828}.host.light .alert.warn{color:#9a5700}.host.light .alert.info{color:#0277bd}
.host.light .neg,.host.light .c-good{color:#2e7d32}.host.light .pos,.host.light .c-bad{color:#c26100}.host.light .c-mid{color:#8a6d00}
.host.light .trow:hover{background:rgba(0,0,0,.04)}
.host.light .trow .live{color:#0277bd}
.host.light .carwrap img{filter:drop-shadow(0 12px 10px rgba(0,0,0,.28))}
.host.light .topcar img{filter:none}
.host.light .topcar .lbl{background:rgba(255,255,255,.88);color:var(--muted);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.host.light .topcar .lbl.open{background:#fff3e0;color:#9a5700}
.host.light .offline-box .ico{background:rgba(0,0,0,.05)}
.host.light .offline-box.alert .ico{color:#c62828}
.host.light .foot.offline{color:#c62828}
.host.light .road{background:repeating-linear-gradient(90deg,rgba(0,0,0,.25) 0 34px,transparent 34px 78px);background-size:78px 3px}
.host.light .chg .eta{border-top-color:rgba(0,0,0,.08)}
.host.light #map,.host.light .leaflet-container{background:#e9ecef}
.host.light .leaflet-bar a{background:#fff!important;color:#333!important;border-color:#d6d9dd!important}
.host.light .leaflet-control-attribution{background:rgba(255,255,255,.75)!important;color:#555!important}
.host.light .leaflet-control-attribution a{color:#333!important}

/* The ha-card is the frame; the car and trips parts inside it are flat. */
.host > .split > .card{border:0;border-radius:0;background:transparent}
.host[data-theme]{background:var(--card);border-radius:var(--radius);overflow:hidden}
.ring text{fill:var(--text)}
.ring circle:first-child{stroke:var(--line)}
@keyframes blink{50%{opacity:0}}
@keyframes grad{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
/* ---- Styled themes (from the theme gallery prototype) ---- */
.host[data-theme=paper] .chip.ok,.host[data-theme=ios] .chip.ok{color:#2e7d32;background:rgba(76,175,80,.14)}
.host[data-theme=paper] .chip.info,.host[data-theme=ios] .chip.info{color:#01579b;background:rgba(3,169,244,.12)}
.host[data-theme=paper] .chip.warn,.host[data-theme=ios] .chip.warn{color:#8a4b00;background:rgba(255,152,0,.16)}
.host[data-theme=paper] .chip.dc,.host[data-theme=ios] .chip.dc{color:#6a1b9a;background:rgba(171,71,188,.14)}
.host[data-theme=paper] .alert.err,.host[data-theme=ios] .alert.err{color:#b71c1c}
.host[data-theme=paper] .alert.warn,.host[data-theme=ios] .alert.warn{color:#8a4b00}
.host[data-theme=paper] .alert.info,.host[data-theme=ios] .alert.info{color:#01579b}
.host[data-theme=paper] .neg,.host[data-theme=ios] .neg,.host[data-theme=paper] .c-good,.host[data-theme=ios] .c-good{color:#2e7d32}
.host[data-theme=paper] .pos,.host[data-theme=ios] .pos,.host[data-theme=paper] .c-bad,.host[data-theme=ios] .c-bad{color:#bf5b00}
.host[data-theme=paper] .c-mid,.host[data-theme=ios] .c-mid{color:#8d6e00}
.host[data-theme=paper] .tyre .st,.host[data-theme=ios] .tyre .st{color:#2e7d32}
.host[data-theme=paper] .tyre.low .p,.host[data-theme=paper] .tyre.low .st,.host[data-theme=ios] .tyre.low .p,.host[data-theme=ios] .tyre.low .st{color:#bf5b00}
.host[data-theme=paper] .offline-box.alert,.host[data-theme=ios] .offline-box.alert{background:rgba(244,67,54,.08)}
.host[data-theme=paper] .foot.offline,.host[data-theme=ios] .foot.offline{color:#b71c1c}
.host[data-theme=claude],.host[data-theme=claude] .seg button,.host[data-theme=claude] .leaflet-container{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:13px}
.host[data-theme=claude]{border:1px solid var(--line)}
.host[data-theme=claude] .head h2::before{content:"> ";color:var(--accent)}
.host[data-theme=claude] .head h2{font-size:17px;font-weight:600}
.host[data-theme=claude] .status::after{content:"▋";color:var(--accent);animation:blink 1s steps(1) infinite;margin-left:2px}
.host[data-theme=claude] section.blk h3{text-transform:none;letter-spacing:0;color:var(--accent);font-size:12.5px;justify-content:flex-start;gap:7px}
.host[data-theme=claude] section.blk h3::before{content:"## ";color:var(--faint)}
.host[data-theme=claude] .tile{background:transparent;border:1px dashed var(--line);border-radius:0}
.host[data-theme=claude] .tile .v{font-weight:500}
.host[data-theme=claude] .chip{background:transparent;border:1px solid var(--line);border-radius:0}
.host[data-theme=claude] .chip.ok{border-color:#5d7a47}
.host[data-theme=claude] .chip.info{border-color:#3f6f86}
.host[data-theme=claude] .chip.warn{border-color:#8a6a2e}
.host[data-theme=claude] .soc-big{font-weight:400;font-size:40px}
.host[data-theme=claude] .bar{border-radius:0;background:repeating-linear-gradient(90deg,#3a3835 0 7px,transparent 7px 9px);height:14px}
.host[data-theme=claude] .bar i{border-radius:0;background:repeating-linear-gradient(90deg,var(--accent) 0 7px,transparent 7px 9px)!important;animation:none}
.host[data-theme=claude] .bar i.low,.host[data-theme=claude] .bar i.crit{background:repeating-linear-gradient(90deg,var(--err) 0 7px,transparent 7px 9px)!important}
.host[data-theme=claude] .psign{border-radius:0;background:transparent;border:1px solid var(--accent);color:var(--accent);box-shadow:none;font-family:"JetBrains Mono",monospace}
.host[data-theme=claude] .alert{border-radius:0;background:transparent;border-left:3px solid currentColor}
.host[data-theme=claude] .chg,.host[data-theme=claude] .chg.dc{background:transparent;border:1px solid var(--line);border-radius:0}
.host[data-theme=claude] .seg{border-radius:0}
.host[data-theme=claude] .seg button{border-radius:0}
.host[data-theme=claude] .seg button[aria-pressed=true]{background:var(--accent);color:#1f1e1d}
.host[data-theme=claude] .totals > div,.host[data-theme=claude] .offline-box{border-radius:0;background:transparent;border:1px dashed var(--line)}
.host[data-theme=claude] .trow.sel{background:rgba(217,119,87,.14)}
.host[data-theme=claude] .day-h .tri,.host[data-theme=claude] .trow .live{color:var(--accent)}
.host[data-theme=claude] .foot::before{content:"~/leopard3 $";color:var(--ok);margin-right:auto;display:none}
.host[data-theme=claude] .hero::before{background:radial-gradient(closest-side,rgba(217,119,87,.12),transparent)}
.host[data-theme=claude] .mono{font-family:"JetBrains Mono",monospace}
.host[data-theme=tesla],.host[data-theme=tesla] .seg button{font-family:Inter,system-ui,sans-serif;font-weight:300}
.host[data-theme=tesla]{border:0}
.host[data-theme=tesla] .head h2{font-weight:500;font-size:22px;letter-spacing:.01em}
.host[data-theme=tesla] .carwrap{max-width:470px}
.host[data-theme=tesla] .hero::before{background:radial-gradient(closest-side,rgba(255,255,255,.07),transparent)}
.host[data-theme=tesla] .soc-big{font-size:56px;font-weight:200;letter-spacing:-2px}
.host[data-theme=tesla] .range b{font-weight:400}
.host[data-theme=tesla] .bar{height:4px;background:#222}
.host[data-theme=tesla] .bar i{background:#f2f2f2}
.host[data-theme=tesla] .bar i.low{background:var(--warn)}
.host[data-theme=tesla] .bar i.crit{background:var(--err)}
.host[data-theme=tesla] .bar i.charging{background-color:#36c46a}
.host[data-theme=tesla] section.blk{border-top:1px solid #151515}
.host[data-theme=tesla] section.blk h3{font-weight:500;color:var(--muted);letter-spacing:.12em;font-size:11px}
.host[data-theme=tesla] .tile{padding:10px 4px;border-radius:0;border-bottom:1px solid #151515}
.host[data-theme=tesla] .tile .v{font-size:20px;font-weight:300}
.host[data-theme=tesla] .chip{background:#111;color:#bdbdbd;border-radius:6px}
.host[data-theme=tesla] .chip.ok,.host[data-theme=tesla] .chip.info,.host[data-theme=tesla] .chip.dc{background:#111;color:#f2f2f2}
.host[data-theme=tesla] .chg,.host[data-theme=tesla] .chg.dc{background:#0c0c0c;border-radius:10px}
.host[data-theme=tesla] .chg .pw{font-weight:200;font-size:30px}
.host[data-theme=tesla] .psign{background:transparent;border:1.5px solid #f2f2f2;border-radius:6px;box-shadow:none;font-weight:500}
.host[data-theme=tesla] .alert{background:#111!important;border-radius:8px}
.host[data-theme=tesla] .alert.err{color:#ff4d4f}
.host[data-theme=tesla] .alert.warn{color:#f0b35a}
.host[data-theme=tesla] .alert.info{color:#8fb1ff}
.host[data-theme=tesla] .seg{background:#111;border-color:#222}
.host[data-theme=tesla] .seg button[aria-pressed=true]{background:#f2f2f2;color:#000}
.host[data-theme=tesla] .totals > div{background:#0c0c0c}
.host[data-theme=tesla] .totals .v{font-weight:300;font-size:20px}
.host[data-theme=tesla] .trow.sel{background:#111}
.host[data-theme=gradient]{background:linear-gradient(130deg,#ff5fa2,#7b5cff 35%,#2fb9ff 70%,#5effc8);background-size:300% 300%;animation:grad 18s ease infinite;font-family:"Plus Jakarta Sans",Inter,sans-serif}
.host[data-theme=gradient]{backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);border:1px solid rgba(255,255,255,.3);box-shadow:0 20px 60px rgba(40,10,90,.25)}
.host[data-theme=gradient]{backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);border-color:rgba(255,255,255,.3)}
.host[data-theme=gradient] > .split > .card{backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:none;border:0}
.host[data-theme=gradient] .tile,.host[data-theme=gradient] .totals > div{border-radius:18px;border:1px solid rgba(255,255,255,.18)}
.host[data-theme=gradient] .head h2{font-weight:700;font-size:22px}
.host[data-theme=gradient] .soc-big{font-weight:800;font-size:44px}
.host[data-theme=gradient] .bar{background:rgba(255,255,255,.2);height:14px;border-radius:999px}
.host[data-theme=gradient] .bar i{background:linear-gradient(90deg,#fff,#ffe1f3);border-radius:999px;box-shadow:0 0 18px rgba(255,255,255,.6)}
.host[data-theme=gradient] .chip{background:rgba(255,255,255,.16);color:#fff}
.host[data-theme=gradient] .chip.ok,.host[data-theme=gradient] .chip.info,.host[data-theme=gradient] .chip.dc,.host[data-theme=gradient] .chip.warn{color:#fff;background:rgba(255,255,255,.24)}
.host[data-theme=gradient] .chg,.host[data-theme=gradient] .chg.dc{background:rgba(255,255,255,.14);border-radius:20px}
.host[data-theme=gradient] .alert{background:rgba(255,255,255,.18)!important;color:#fff!important;border-radius:14px}
.host[data-theme=gradient] .neg,.host[data-theme=gradient] .pos,.host[data-theme=gradient] .c-good,.host[data-theme=gradient] .c-mid,.host[data-theme=gradient] .c-bad{color:#fff;font-weight:700}
.host[data-theme=gradient] .seg{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25)}
.host[data-theme=gradient] .seg button{color:#fff}
.host[data-theme=gradient] .seg button[aria-pressed=true]{background:#fff;color:#5b2bd6}
.host[data-theme=gradient] .trow.sel{background:rgba(255,255,255,.18)}
.host[data-theme=gradient] .psign{border-radius:12px}
.host[data-theme=gradient] #map{border-radius:0}
.host[data-theme=neon]{background:radial-gradient(1200px 600px at 50% -10%,#3b0a6b 0,transparent 60%),linear-gradient(transparent 95%,rgba(255,43,214,.12) 95%) 0 0/100% 32px,linear-gradient(90deg,transparent 95%,rgba(0,240,255,.08) 95%) 0 0/32px 100%,#07000f;font-family:Rajdhani,sans-serif;font-size:15px}
.host[data-theme=neon]{border:1px solid #ff2bd6;box-shadow:0 0 0 1px rgba(255,43,214,.3),0 0 30px rgba(255,43,214,.25),inset 0 0 40px rgba(0,240,255,.05)}
.host[data-theme=neon]{border-color:#ff2bd6;box-shadow:0 0 30px rgba(255,43,214,.3)}
.host[data-theme=neon] > .split > .card{box-shadow:none}
.host[data-theme=neon] .head h2,.host[data-theme=neon] section.blk h3,.host[data-theme=neon] .soc-big,.host[data-theme=neon] .tc-head h2,.host[data-theme=neon] .spd b{font-family:Orbitron,sans-serif;text-transform:uppercase}
.host[data-theme=neon] .head h2{color:#fff;text-shadow:0 0 12px #ff2bd6,0 0 2px #fff;letter-spacing:.06em}
.host[data-theme=neon] section.blk h3{color:var(--accent);text-shadow:0 0 8px rgba(0,240,255,.7)}
.host[data-theme=neon] .soc-big{color:#fff;text-shadow:0 0 16px var(--accent)}
.host[data-theme=neon] .tile,.host[data-theme=neon] .totals > div{border:1px solid rgba(0,240,255,.28);box-shadow:inset 0 0 18px rgba(0,240,255,.06)}
.host[data-theme=neon] .tile .v{color:#fff}
.host[data-theme=neon] .bar{background:#1b0c33;height:10px}
.host[data-theme=neon] .bar i{background:linear-gradient(90deg,#ff2bd6,#00f0ff)!important;box-shadow:0 0 14px #00f0ff}
.host[data-theme=neon] .chip{background:transparent;border:1px solid rgba(255,43,214,.5);color:#f6ecff}
.host[data-theme=neon] .chip.ok{border-color:#39ff88;color:#39ff88}
.host[data-theme=neon] .chip.info{border-color:#00f0ff;color:#00f0ff}
.host[data-theme=neon] .psign{background:transparent;border-color:#ff2bd6;color:#ff2bd6;box-shadow:0 0 14px #ff2bd6,inset 0 0 10px rgba(255,43,214,.4);text-shadow:0 0 8px #ff2bd6}
.host[data-theme=neon] .chg,.host[data-theme=neon] .chg.dc{background:#0d0420;border:1px solid #39ff88;box-shadow:0 0 18px rgba(57,255,136,.25)}
.host[data-theme=neon] .alert{background:transparent!important;border:1px solid currentColor;text-shadow:0 0 6px currentColor}
.host[data-theme=neon] .seg{background:#0d0420;border-color:#3a1466}
.host[data-theme=neon] .seg button[aria-pressed=true]{background:#ff2bd6;color:#fff;box-shadow:0 0 14px #ff2bd6}
.host[data-theme=neon] .carwrap img{filter:drop-shadow(0 0 18px rgba(0,240,255,.35)) brightness(1.15)}
.host[data-theme=neon] .road{background:repeating-linear-gradient(90deg,#00f0ff 0 34px,transparent 34px 78px);box-shadow:0 0 10px #00f0ff}
.host[data-theme=neon] .trow.sel{background:rgba(255,43,214,.16)}
.host[data-theme=paper],.host[data-theme=paper] .seg button{font-family:Inter,sans-serif}
.host[data-theme=paper]{border:1px solid #cfc4ad;box-shadow:0 1px 0 #fff inset,0 10px 30px rgba(60,40,10,.08)}
.host[data-theme=paper] .head h2,.host[data-theme=paper] .soc-big,.host[data-theme=paper] .tc-head h2,.host[data-theme=paper] .chg .pw,.host[data-theme=paper] .tile .v,.host[data-theme=paper] .totals .v{font-family:Fraunces,Georgia,serif}
.host[data-theme=paper] .head h2{font-size:26px;font-weight:600;font-style:italic}
.host[data-theme=paper] .soc-big{font-size:46px;font-weight:500}
.host[data-theme=paper] section.blk{border-top:2px solid var(--text)}
.host[data-theme=paper] section.blk h3{color:var(--text);font-weight:700;letter-spacing:.14em}
.host[data-theme=paper] .tile{border-top:1px solid var(--line);border-radius:0;padding:8px 2px}
.host[data-theme=paper] .tile .v{font-size:19px;font-weight:600}
.host[data-theme=paper] .bar{background:#e4dccb;height:8px;border-radius:0}
.host[data-theme=paper] .bar i{background:var(--text);border-radius:0}
.host[data-theme=paper] .bar i.low,.host[data-theme=paper] .bar i.crit{background:var(--accent)}
.host[data-theme=paper] .chip{background:transparent;border:1px solid var(--line);border-radius:2px;color:var(--muted)}
.host[data-theme=paper] .chg,.host[data-theme=paper] .chg.dc{background:#f3eee2;border:1px solid var(--line);border-radius:2px}
.host[data-theme=paper] .psign{background:#1c1915;border-color:#fbf8f1;border-radius:3px}
.host[data-theme=paper] .carwrap img{filter:drop-shadow(0 12px 10px rgba(60,40,10,.25))}
.host[data-theme=paper] .hero::before{background:none}
.host[data-theme=paper] .topcar img{filter:none}
.host[data-theme=paper] .alert{border-radius:2px;border-left:3px solid currentColor;background:#f3eee2!important}
.host[data-theme=paper] .seg{background:#fbf8f1;border-color:var(--line);border-radius:2px}
.host[data-theme=paper] .seg button{border-radius:2px}
.host[data-theme=paper] .seg button[aria-pressed=true]{background:#1c1915;color:#fbf8f1}
.host[data-theme=paper] .totals > div{background:transparent;border:1px solid var(--line);border-radius:2px}
.host[data-theme=paper] .trow.sel{background:#f1e8d6}
.host[data-theme=offroad]{font-family:Saira,sans-serif;background:repeating-linear-gradient(45deg,#1b1d16 0 22px,#1e2019 22px 44px)}
.host[data-theme=offroad]{border:2px solid #3a3e30;box-shadow:0 0 0 1px #11130e}
.host[data-theme=offroad] .head h2,.host[data-theme=offroad] section.blk h3,.host[data-theme=offroad] .tc-head h2,.host[data-theme=offroad] .soc-big{font-family:"Saira Stencil One",Saira,sans-serif;text-transform:uppercase;letter-spacing:.04em}
.host[data-theme=offroad] .head h2{font-size:24px;color:var(--accent)}
.host[data-theme=offroad] section.blk h3{color:var(--text);font-size:14px;position:relative;padding-bottom:6px}
.host[data-theme=offroad] section.blk h3::after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:repeating-linear-gradient(-45deg,var(--accent) 0 8px,#1b1d16 8px 16px);opacity:.7}
.host[data-theme=offroad] .tile{border-left:3px solid var(--accent);border-radius:2px}
.host[data-theme=offroad] .soc-big{font-size:42px;color:var(--accent)}
.host[data-theme=offroad] .bar{height:14px;border-radius:2px;background:#1b1d16;border:1px solid #454a3a}
.host[data-theme=offroad] .bar i{border-radius:0;background:repeating-linear-gradient(-45deg,#9ccc65 0 10px,#7cab45 10px 20px)}
.host[data-theme=offroad] .chip{border-radius:2px;background:#30342a;border:1px solid #454a3a}
.host[data-theme=offroad] .psign{background:var(--accent);color:#1b1d16;border-color:#1b1d16;border-radius:3px}
.host[data-theme=offroad] .chg,.host[data-theme=offroad] .chg.dc{background:#30342a;border:1px dashed var(--accent);border-radius:3px}
.host[data-theme=offroad] .alert{border-radius:2px;border:1px solid currentColor}
.host[data-theme=offroad] .seg{border-radius:3px;background:#262920}
.host[data-theme=offroad] .seg button{border-radius:2px}
.host[data-theme=offroad] .seg button[aria-pressed=true]{background:var(--accent);color:#1b1d16}
.host[data-theme=offroad] .road{background:repeating-linear-gradient(90deg,var(--accent) 0 34px,transparent 34px 78px)}
.host[data-theme=offroad] .totals > div{border-radius:2px;border-top:3px solid var(--accent)}
.host[data-theme=offroad] .trow.sel{background:rgba(226,163,59,.14)}
.host[data-theme=ios],.host[data-theme=ios] .seg button{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,sans-serif;letter-spacing:-.01em}
.host[data-theme=ios]{border:0;box-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.06)}
.host[data-theme=ios]{border:0;box-shadow:0 8px 24px rgba(0,0,0,.08)}
.host[data-theme=ios] > .split > .card{box-shadow:none}
.host[data-theme=ios] .head h2{font-weight:700;font-size:24px}
.host[data-theme=ios] .soc-big{font-weight:700;font-size:44px;letter-spacing:-1px}
.host[data-theme=ios] section.blk{border-top:0}
.host[data-theme=ios] section.blk h3{text-transform:none;letter-spacing:0;font-size:15px;color:#000;font-weight:600}
.host[data-theme=ios] .tile,.host[data-theme=ios] .totals > div{border-radius:14px}
.host[data-theme=ios] .tile .v{font-weight:600}
.host[data-theme=ios] .bar{background:#e5e5ea;height:10px;border-radius:999px}
.host[data-theme=ios] .bar i{background:var(--ok);border-radius:999px}
.host[data-theme=ios] .chip{background:#f2f2f7;color:#3c3c43}
.host[data-theme=ios] .chg{background:#e9f9ee;border-radius:18px}
.host[data-theme=ios] .chg.dc{background:#f5e9fb}
.host[data-theme=ios] .psign{border-radius:10px;border-color:#fff}
.host[data-theme=ios] .hero::before{background:radial-gradient(closest-side,rgba(0,0,0,.05),transparent)}
.host[data-theme=ios] .carwrap img{filter:drop-shadow(0 14px 12px rgba(0,0,0,.25))}
.host[data-theme=ios] .topcar img{filter:none}
.host[data-theme=ios] .alert{border-radius:14px}
.host[data-theme=ios] .alert.err{background:#ffe9e8}
.host[data-theme=ios] .alert.warn{background:#fff3e0}
.host[data-theme=ios] .alert.info{background:#e5f1ff}
.host[data-theme=ios] .seg{background:#e5e5ea;border:0}
.host[data-theme=ios] .seg button{color:#000}
.host[data-theme=ios] .seg button[aria-pressed=true]{background:#fff;color:#000;box-shadow:0 1px 4px rgba(0,0,0,.15)}
.host[data-theme=ios] .trow.sel{background:#e5f1ff}
.host[data-theme=ios] .foot{border-top:0}
.host[data-theme=ios_dark],.host[data-theme=ios_dark] .seg button{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,sans-serif;letter-spacing:-.01em}
.host[data-theme=ios_dark]{border:0;box-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.06)}
.host[data-theme=ios_dark]{border:0;box-shadow:0 8px 24px rgba(0,0,0,.08)}
.host[data-theme=ios_dark] > .split > .card{box-shadow:none}
.host[data-theme=ios_dark] .head h2{font-weight:700;font-size:24px}
.host[data-theme=ios_dark] .soc-big{font-weight:700;font-size:44px;letter-spacing:-1px}
.host[data-theme=ios_dark] section.blk{border-top:0}
.host[data-theme=ios_dark] section.blk h3{text-transform:none;letter-spacing:0;font-size:15px;color:#000;font-weight:600}
.host[data-theme=ios_dark] .tile,.host[data-theme=ios_dark] .totals > div{border-radius:14px}
.host[data-theme=ios_dark] .tile .v{font-weight:600}
.host[data-theme=ios_dark] .bar{background:#e5e5ea;height:10px;border-radius:999px}
.host[data-theme=ios_dark] .bar i{background:var(--ok);border-radius:999px}
.host[data-theme=ios_dark] .chip{background:#f2f2f7;color:#3c3c43}
.host[data-theme=ios_dark] .chg{background:#e9f9ee;border-radius:18px}
.host[data-theme=ios_dark] .chg.dc{background:#f5e9fb}
.host[data-theme=ios_dark] .psign{border-radius:10px;border-color:#fff}
.host[data-theme=ios_dark] .hero::before{background:radial-gradient(closest-side,rgba(0,0,0,.05),transparent)}
.host[data-theme=ios_dark] .carwrap img{filter:drop-shadow(0 14px 12px rgba(0,0,0,.25))}
.host[data-theme=ios_dark] .topcar img{filter:none}
.host[data-theme=ios_dark] .alert{border-radius:14px}
.host[data-theme=ios_dark] .alert.err{background:#ffe9e8}
.host[data-theme=ios_dark] .alert.warn{background:#fff3e0}
.host[data-theme=ios_dark] .alert.info{background:#e5f1ff}
.host[data-theme=ios_dark] .seg{background:#e5e5ea;border:0}
.host[data-theme=ios_dark] .seg button{color:#000}
.host[data-theme=ios_dark] .seg button[aria-pressed=true]{background:#fff;color:#000;box-shadow:0 1px 4px rgba(0,0,0,.15)}
.host[data-theme=ios_dark] .trow.sel{background:#e5f1ff}
.host[data-theme=ios_dark] .foot{border-top:0}
.host[data-theme=ios_dark]{box-shadow:none}
.host[data-theme=ios_dark]{box-shadow:none}
.host[data-theme=ios_dark] section.blk h3{color:#fff}
.host[data-theme=ios_dark] .chip{background:#2c2c2e;color:#ebebf5}
.host[data-theme=ios_dark] .chip.ok{background:rgba(48,209,88,.18);color:#30d158}
.host[data-theme=ios_dark] .chip.info{background:rgba(10,132,255,.2);color:#64a8ff}
.host[data-theme=ios_dark] .chip.warn{background:rgba(255,159,10,.18);color:#ff9f0a}
.host[data-theme=ios_dark] .chip.dc{background:rgba(191,90,242,.2);color:#d08cff}
.host[data-theme=ios_dark] .chg{background:rgba(48,209,88,.14)}
.host[data-theme=ios_dark] .chg.dc{background:rgba(191,90,242,.16)}
.host[data-theme=ios_dark] .bar{background:#38383a}
.host[data-theme=ios_dark] .psign{border-color:#1c1c1e}
.host[data-theme=ios_dark] .hero::before{background:radial-gradient(closest-side,rgba(255,255,255,.08),transparent)}
.host[data-theme=ios_dark] .carwrap img{filter:drop-shadow(0 14px 12px rgba(0,0,0,.7)) brightness(1.1)}
.host[data-theme=ios_dark] .topcar img{filter:brightness(1.25)}
.host[data-theme=ios_dark] .alert.err{background:rgba(255,69,58,.18);color:#ff6961}
.host[data-theme=ios_dark] .alert.warn{background:rgba(255,159,10,.16);color:#ffb340}
.host[data-theme=ios_dark] .alert.info{background:rgba(10,132,255,.18);color:#64a8ff}
.host[data-theme=ios_dark] .seg{background:#2c2c2e}
.host[data-theme=ios_dark] .seg button{color:#fff}
.host[data-theme=ios_dark] .seg button[aria-pressed=true]{background:#636366;color:#fff;box-shadow:none}
.host[data-theme=ios_dark] .trow.sel{background:rgba(10,132,255,.2)}
.host[data-theme=paper] .topcar .lbl,.host[data-theme=ios] .topcar .lbl{background:rgba(255,255,255,.94);color:#1c1c1e;box-shadow:0 1px 4px rgba(0,0,0,.25);font-weight:500}
.host[data-theme=paper] .topcar .lbl.open,.host[data-theme=ios] .topcar .lbl.open{background:#fff3e0;color:#8a4b00}
/* Card editor */
`;

if (!customElements.get('byd-leopard3-card')) customElements.define('byd-leopard3-card', BydLeopard3Card);
if (!customElements.get('byd-leopard3-card-editor')) customElements.define('byd-leopard3-card-editor', BydLeopard3CardEditor);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'byd-leopard3-card')) window.customCards.push({
  type: 'byd-leopard3-card', name: 'BYD Leopard 3', preview: true,
  description: 'Car status, charging, alerts and trips with a map. Works with BYDMate, BYD EV Pro and any webhook source.',
  documentationURL: 'https://github.com/vasyl127/byd-leopard3-ha-integration',
});
console.info(`%c BYD-LEOPARD3-CARD %c ${VERSION} `, 'color:#fff;background:#1e63c8;font-weight:700', 'color:#1e63c8;background:#fff');
