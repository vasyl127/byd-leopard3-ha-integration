/*
 * BYD Leopard 3 card for Home Assistant.
 * Part of https://github.com/vasyl127/byd-leopard3-ha-integration (served by the integration itself).
 * Three layouts: car, trips, combo (car + trips in one card, side by side when the card is wide).
 */
const VERSION = '1.1.1';
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
};
const THEME_KEYS = ['background', 'tiles', 'divider', 'text', 'secondary', 'accent'];
const toHex = (c) => Array.isArray(c) ? '#' + c.slice(0, 3).map(x => Math.max(0, Math.min(255, Math.round(Number(x) || 0))).toString(16).padStart(2, '0')).join('') : (typeof c === 'string' ? c.trim() : null);
const toRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : null; };
const cssRgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (m) return m[1].split(',').slice(0, 3).map(Number); return toRgb(s); };
const luma = (h) => { const c = toRgb(h); return c ? (0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]) / 255 : 0; };
const mix = (a, b, w) => { const x = toRgb(a), y = toRgb(b); return x && y ? toHex(x.map((v, i) => v + (y[i] - v) * w)) : a; };
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
    up_to:'до 30', kmh_plus:'90+ км/год', h_time:'час', h_dur:'трив.', h_km:'км', now:'зараз', no_trips:'За цей період поїздок немає',
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
    up_to:'under 30', kmh_plus:'90+ km/h', h_time:'time', h_dur:'dur.', h_km:'km', now:'now', no_trips:'No trips in this period',
    consumption:'Consumption', duration:'Duration', moving:'moving {d}', avg_speed:'Avg speed', over_moving:'while moving',
    battery:'Battery', gps:'GPS points', per_sec:'1 packet/s', start:'Start', finish:'Finish', on_road:'on the road', map_fail:'Map failed to load (offline)',
    ed_title:'Card visual editor', ed_layout:'Card layout', l_car:'Car', l_trips:'Trips', l_combo:'Combined',
    ed_lang:'Language', ed_alerts:'Show alerts', ed_seat:'Show seat heating', ed_wheel:'Show steering wheel heating',
    ed_low_soc:'Low battery threshold, %', ed_tyre:'Minimum tyre pressure, bar', ed_target:'Charge target, %', ed_yaml:'YAML',
  },
}; Object.assign(s.uk, {"year": "Рік", "all": "Все", "ed_theme": "Тема картки", "ed_theme_colors": "Кольори теми", "ed_background": "Фон картки", "ed_tiles": "Плитки", "ed_divider": "Лінії", "ed_text": "Текст", "ed_secondary": "Другорядний текст", "ed_accent": "Акцент", "th_ha": "Як у Home Assistant", "th_dark": "Темна", "th_light": "Світла", "th_midnight": "Північ", "th_graphite": "Графіт", "th_oled": "OLED (чорна)", "th_mineral": "Mineral (зелена)", "d_fl": "двері водія", "d_fr": "двері пасажира", "d_rl": "задні ліві двері", "fl": "Водій", "fr": "Пасажир", "rl": "Зад. лів.", "home": "Дім", "d": "дн", "st_driving": "їхала", "month": "30 днів", "no_vehicle": "Немає жодного авто. Додай інтеграцію BYD Leopard 3 у Налаштування → Пристрої та служби.", "lvl_level_1": "Рівень 1", "lvl_level_2": "Рівень 2", "roof_closed": "Закрито", "roof_open": "Відкрито", "roof_opening": "Відкривається", "roof_closing": "Закривається", "vs_off": "Вимкнено", "vs_on": "Увімкнено", "vs_remote_on": "Дистанційно", "vs_smart_charge": "Розумна зарядка", "vs_press_startup": "Запуск", "vs_bt_on": "Bluetooth", "vs_disinfect": "Дезінфекція", "vs_exhibition": "Виставковий", "lang_auto": "Як у Home Assistant", "col_black": "Obsidian Black (чорний)", "col_white": "Element White (білий)", "col_silver": "Starry Moon Silver (сріблясто-блакитний)", "col_green": "Mineral Green (зелений)", "col_pink": "Micro Light Pink (рожевий)", "col_ice_blue": "Ice Crystal Blue (блакитний)", "col_purple": "Stardust Purple (фіолетовий)", "col_custom": "Свій колір", "ed_entry_id": "Авто", "ed_layout": "Варіант картки", "ed_language": "Мова", "ed_color": "Колір авто", "ed_custom_color": "Свій колір", "ed_show_alerts": "Показувати сповіщення", "ed_show_seat_heat": "Показувати підігрів сидіння", "ed_show_steering_heat": "Показувати підігрів керма", "ed_show_trips_map": "Показувати карту поїздок", "ed_low_soc": "Поріг низького заряду", "ed_tyre_min": "Мінімальний тиск шин", "ed_charge_target": "Ціль заряду", "ed_advanced": "Додатково", "ed_title": "Заголовок (замість назви авто)", "ed_image_side": "Своє зображення збоку (URL)", "ed_image_top": "Своє зображення згори (URL)", "ed_map_tiles": "Свої тайли карти (URL з {z}/{x}/{y})", "edh_image_side": "Для інших моделей BYD. Перефарбування і колеса працюють лише з вбудованим Leopard 3."}); Object.assign(s.en, {"year": "Year", "all": "All", "ed_theme": "Card theme", "ed_theme_colors": "Theme colours", "ed_background": "Card background", "ed_tiles": "Tiles", "ed_divider": "Lines", "ed_text": "Text", "ed_secondary": "Secondary text", "ed_accent": "Accent", "th_ha": "Same as Home Assistant", "th_dark": "Dark", "th_light": "Light", "th_midnight": "Midnight", "th_graphite": "Graphite", "th_oled": "OLED (black)", "th_mineral": "Mineral (green)", "d_fl": "driver door", "d_fr": "passenger door", "d_rl": "rear left door", "fl": "Driver", "fr": "Passenger", "rl": "Rear left", "home": "Home", "d": "d", "st_driving": "driving", "month": "30 days", "no_vehicle": "No car yet. Add the BYD Leopard 3 integration in Settings → Devices & services.", "lvl_level_1": "Level 1", "lvl_level_2": "Level 2", "roof_closed": "Closed", "roof_open": "Open", "roof_opening": "Opening", "roof_closing": "Closing", "vs_off": "Off", "vs_on": "On", "vs_remote_on": "Remote on", "vs_smart_charge": "Smart charge", "vs_press_startup": "Starting", "vs_bt_on": "Bluetooth", "vs_disinfect": "Disinfection", "vs_exhibition": "Exhibition", "lang_auto": "Same as Home Assistant", "col_black": "Obsidian Black", "col_white": "Element White", "col_silver": "Starry Moon Silver", "col_green": "Mineral Green", "col_pink": "Micro Light Pink", "col_ice_blue": "Ice Crystal Blue", "col_purple": "Stardust Purple", "col_custom": "Custom colour", "ed_entry_id": "Car", "ed_layout": "Card layout", "ed_language": "Language", "ed_color": "Car colour", "ed_custom_color": "Custom colour", "ed_show_alerts": "Show alerts", "ed_show_seat_heat": "Show seat heating", "ed_show_steering_heat": "Show steering wheel heating", "ed_show_trips_map": "Show trips map", "ed_low_soc": "Low battery threshold", "ed_tyre_min": "Minimum tyre pressure", "ed_charge_target": "Charge target", "ed_advanced": "Advanced", "ed_title": "Title (instead of the car name)", "ed_image_side": "Custom side image (URL)", "ed_image_top": "Custom top image (URL)", "ed_map_tiles": "Custom map tiles (URL with {z}/{x}/{y})", "edh_image_side": "For other BYD models. Recolouring and spinning wheels only work with the built-in Leopard 3 drawing."}); return s; })();
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
const speedColor = (v) => v < 30 ? '#4fc3f7' : v < 60 ? '#66bb6a' : v < 90 ? '#ffca28' : '#ef5350';
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
  getGridOptions(){ return {columns: 12, min_columns: 6, rows: 'auto'}; }

  set hass(hass){
    const first = !this._hass;
    this._hass = hass;
    if (first) this._init();
    else this._render();
  }

  /* -- language -- */
  get lang(){
    const l = this._cfg.language;
    if (l && l !== 'auto') return STR[l] ? l : 'en';
    return (this._hass?.locale?.language || this._hass?.language || 'en').startsWith('uk') ? 'uk' : 'en';
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
    const p = this._palette() || {}, light = this._isLight();
    const set = (v, val) => val ? card.style.setProperty(v, val) : card.style.removeProperty(v);
    set('--card', p.background); set('--ha-card-background', p.background); set('--card-background-color', p.background);
    set('--card-2', p.tiles); set('--line', p.divider); set('--text', p.text); set('--muted', p.secondary);
    set('--faint', p.secondary && p.background ? mix(p.secondary, p.background, 0.35) : null);
    set('--accent', p.accent);
    card.style.background = p.background || '';
    card.style.color = p.text || '';
    card.classList.toggle('light', light);
    this._themeSig = JSON.stringify(p) + light;
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
    await this._loadRoute(this._sel, true);
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
    new ResizeObserver(() => { this._map.invalidateSize({animate: false}); if (this._route) this._drawRoute(this._route, true); }).observe(this.$('map'));
  }
  _drawRoute(trip, fit){
    if (!this._map) return;
    const L = window.L, pts = trip.points || [];
    this._routeLayer.clearLayers();
    if (pts.length < 2) return;
    let seg = [[pts[0].lat, pts[0].lon]], col = speedColor(pts[0].speed);
    for (let i = 1; i < pts.length; i++){
      const cc = speedColor(pts[i].speed);
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
      <div class="tc-head"><h2>${t('trips')}</h2>
        <div class="seg sm" role="group">
          <button type="button" data-act="period" data-p="1" aria-pressed="${this._period === 1}">${t('today')}</button>
          <button type="button" data-act="period" data-p="7" aria-pressed="${this._period === 7}">${t('week')}</button>
          <button type="button" data-act="period" data-p="30" aria-pressed="${this._period === 30}">${t('month')}</button>
          <button type="button" data-act="period" data-p="365" aria-pressed="${this._period === 365}">${t('year')}</button>
          <button type="button" data-act="period" data-p="36500" aria-pressed="${this._period === 36500}">${t('all')}</button>
        </div></div>
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
      ${this._cfg.show_trips_map === false ? '' : `<div class="legend"><span><i style="background:#4fc3f7"></i>${t('up_to')}</span><span><i style="background:#66bb6a"></i>30–60</span><span><i style="background:#ffca28"></i>60–90</span><span><i style="background:#ef5350"></i>${t('kmh_plus')}</span></div>`}
      ${detail}<div class="days">${days}</div>`);
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
    else if (act === 'trip'){ this._sel = el.dataset.id; this._fitted = false; this._renderTrips(); await this._loadRoute(this._sel, true); }
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
    const l = this._cfg?.language;
    if (l && l !== 'auto') return l;
    return (this._hass?.locale?.language || 'en').startsWith('uk') ? 'uk' : 'en';
  }
  t(k){ return STR[this.lang]?.[k] ?? STR.en[k] ?? k; }
  _schema(){
    const opt = (vals, pre) => vals.map(v => ({value: v, label: this.t(pre + v)}));
    const s = [
      {name: 'entry_id', selector: {select: {mode: 'dropdown', options: (this._veh || []).map(v => ({value: v.entry_id, label: v.title}))}}},
      {name: 'layout', selector: {select: {mode: 'dropdown', options: opt(['car', 'trips', 'combo'], 'l_')}}},
      {name: 'language', selector: {select: {mode: 'dropdown', options: [{value: 'auto', label: this.t('lang_auto')}, {value: 'uk', label: 'Українська'}, {value: 'en', label: 'English'}]}}},
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
.totals div{background:var(--card-2);border-radius:10px;padding:8px 10px;min-width:0}
.totals .k{color:var(--muted);font-size:11px}
.totals .v{font-size:16px;font-weight:500;white-space:nowrap}
.totals .v small{font-size:11px;color:var(--muted);font-weight:400;margin-left:2px}
#map{height:250px;background:#191a1a;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
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
