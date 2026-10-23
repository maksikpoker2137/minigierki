(function () {
// Arena Lawy – wygląd i sterowanie po stronie przeglądarki. Całą grę liczy serwer (games/arena.js);
// tu tylko rysujemy (z wygładzaniem pozycji) i wysyłamy własne wejście: kierunek, celowanie, strzał, unik.
const M = window.ArenaMap, W = M.W, H = M.H, T = M.T, PR = 18;
let mp = M.get('lava'); // aktualna mapa (ustawiana w render z s.map)
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COL = ['#ffd166', '#4cc9f0', '#ff5d8f', '#7ee0a1'];   // kolory graczy (jak w reszcie strony)
const DARK = '#14132c';
const WN = { pistol: 'Pistolet', smg: 'Pistolet maszynowy', rifle: 'Karabin', revolver: 'Rewolwer', shotgun: 'Strzelba', minigun: 'Minigun', flame: 'Miotacz ognia', sniper: 'Snajperka', rocket: 'Wyrzutnia rakiet' };
const HN = { pistol: 'Pistolet', smg: 'SMG', rifle: 'Karabin', revolver: 'Rewolwer', shotgun: 'Strzelba', minigun: 'Minigun', flame: 'Miotacz', sniper: 'Snajperka', rocket: 'Rakiety' }; // krótkie nazwy do górnego HUD
const GUN = { pistol: [16, 6, '#c9c4e8'], smg: [24, 7, '#9fb4d9'], shotgun: [30, 9, '#c08a4a'], sniper: [44, 5, '#6b7c8c'], rocket: [34, 13, '#6f9a4f'],
  rifle: [34, 6, '#7d8f6a'], revolver: [20, 7, '#d4c27a'], minigun: [36, 12, '#555a66'], flame: [28, 10, '#d9622b'] }; // długość, grubość, kolor
const ITEM_COL = { health: '#ff4d6d', shield: '#4cc9f0', boost: '#ffd166', rage: '#ff7a3d' };
const TEAM_COL = ['#ff5d5d', '#4d8dff'], TEAM_NAME = ['Czerwoni', 'Niebiescy'];
const DASH_CD = 2200;

let cur = null, me = -1, send = null, got = 0, raf = 0, off = null, last = 0;
let bg = null, shimmer = [], disp = [], parts = [], rings = [], shots = [], lastFx = 0, shake = 0, P = null;
const keys = {}; const mouse = { x: W / 2, y: H / 2 };
const cam = { x: 0, y: 0 }; let camInit = false, overAt = 0, voteKey = '';
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
let firing = false, dashQ = false, aimA = 0, lastKey = '', sentAt = 0;
const touches = new Map(); // aktywne palce: { kind: 'move' | 'aim', ox, oy, cx, cy }

// ---------- własny celownik (ustawienia zapamiętane w przeglądarce) ----------
const XH_KEY = 'arena.celownik';
const XH_DEF = { on: true, style: 'cross', color: '#ffffff', size: 16, thick: 2, gap: 5, outline: true };
const XH_STYLES = [['cross', 'Krzyż'], ['plus', 'Krzyż + kropka'], ['dot', 'Kropka'], ['ring', 'Okrąg'], ['ringdot', 'Okrąg + kropka'], ['corners', 'Narożniki']];
const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
function loadXh() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(XH_KEY)) || {}; } catch (e) { /* brak dostępu do pamięci – zostają domyślne */ }
  return {
    on: o.on !== false, style: XH_STYLES.some(x => x[0] === o.style) ? o.style : XH_DEF.style,
    color: /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : XH_DEF.color,
    size: num(o.size, 6, 56, XH_DEF.size), thick: num(o.thick, 1, 8, XH_DEF.thick), gap: num(o.gap, 0, 24, XH_DEF.gap), outline: o.outline !== false
  };
}
const xh = loadXh();
const saveXh = () => { try { localStorage.setItem(XH_KEY, JSON.stringify(xh)); } catch (e) { /* trudno */ } };

// k = ile pikseli planszy przypada na 1 piksel ekranu, dzięki temu celownik ma ten sam rozmiar przy każdym powiększeniu
function drawXhair(g, x, y, c, k) {
  const sz = c.size * k, t = c.thick * k, gp = c.gap * k, dr = Math.max(t * 0.9, 1.5 * k);
  const pass = (col, ex, cap) => {
    g.strokeStyle = g.fillStyle = col; g.lineWidth = t + ex; g.lineCap = cap; g.lineJoin = 'miter';
    const arms = () => { g.beginPath(); g.moveTo(x - sz, y); g.lineTo(x - gp, y); g.moveTo(x + gp, y); g.lineTo(x + sz, y); g.moveTo(x, y - sz); g.lineTo(x, y - gp); g.moveTo(x, y + gp); g.lineTo(x, y + sz); g.stroke(); };
    const dot = () => { g.beginPath(); g.arc(x, y, dr + ex / 2, 0, 7); g.fill(); };
    const ring = () => { g.beginPath(); g.arc(x, y, sz, 0, 7); g.stroke(); };
    if (c.style === 'cross') arms();
    else if (c.style === 'plus') { arms(); dot(); }
    else if (c.style === 'dot') dot();
    else if (c.style === 'ring') ring();
    else if (c.style === 'ringdot') { ring(); dot(); }
    else if (c.style === 'corners') {
      const a = sz, b = Math.max(gp, sz * 0.45); g.beginPath();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { g.moveTo(x + sx * a, y + sy * b); g.lineTo(x + sx * a, y + sy * a); g.lineTo(x + sx * b, y + sy * a); });
      g.stroke();
    }
  };
  g.save();
  if (c.outline) pass('rgba(10,8,30,.85)', 3 * k, 'square');
  pass(c.color, 0, 'butt');
  g.restore();
}

// Celownik jako prawdziwy kursor systemowy (obrazek): zero opóźnienia i zwykły kursor znika.
function xhCursor() {
  const half = Math.ceil(xh.size + xh.thick / 2 + 4), n = half * 2, c = document.createElement('canvas');
  c.width = c.height = n; drawXhair(c.getContext('2d'), half, half, xh, 1);
  return `url(${c.toDataURL('image/png')}) ${half} ${half}, crosshair`;
}

// ---------- pełny ekran (dla całego bloku gry, więc trzyma się też między rundami) ----------
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const fsOk = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function toggleFs(el) {
  if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  const r = el.requestFullscreen || el.webkitRequestFullscreen; if (r) { const p = r.call(el); if (p && p.catch) p.catch(() => {}); }
}
function syncSnd() { const b = document.getElementById('snd'); if (b && window.Sfx) b.textContent = Sfx.isMuted() ? '🔇 Dźwięk: wył.' : '🔊 Dźwięk: wł.'; }
function syncFs() { const b = document.getElementById('fs'); if (b) b.textContent = fsEl() ? '✕ Wyjdź z pełnego ekranu' : '⛶ Pełny ekran'; }
document.addEventListener('fullscreenchange', syncFs);
document.addEventListener('webkitfullscreenchange', syncFs);

window.addEventListener('themechange', () => { if (bg && cur) bg = makeBg(); });
function stop() { cancelAnimationFrame(raf); raf = 0; if (off) { off(); off = null; } }

// ---------- tło: ziemia, lawa, kamienie, głazy (rysowane raz do bufora) ----------
function makeBg() { return mp.theme === 'lava' ? makeBgLava() : makeBgForest(); }
// paleta map lawowych: kolory z mapy, chyba że gracz wybrał własne w panelu 🎨
function makePalette() {
  const mx = window.Theme ? Theme.mix : (a => a), u = window.Theme ? Theme.arena() : {}, col = mp.colors || { ground: '#7b3d28', lava: '#f7870c' };
  const ground = u.ground || col.ground, lava = u.lava || col.lava, K = '#000000', Wh = '#ffffff';
  if (!u.ground && !u.lava && mp.id === 'lava') return { // domyślna Arena Lawy – dokładnie oryginalne kolory
    ground: '#7b3d28', dirt: ['#6f3524', '#86452e', '#74392a'], pebble: '#9b5b3f', cliff1: '#4a2015', cliff2: '#5a2a1a',
    lava: ['#f7870c', '#f58a10', '#fa9112'], rim: '#ffcf3a', sglow: '#ffb02e', ember: '#d9531a', stone1: '#5e2f1b', stone2: '#8a4a2a', stone3: '#a45c38'
  };
  return {
    ground, dirt: [mx(ground, K, 0.1), mx(ground, Wh, 0.07), mx(ground, K, 0.03)], pebble: mx(ground, Wh, 0.14),
    cliff1: mx(ground, K, 0.58), cliff2: mx(ground, K, 0.42),
    lava: [lava, mx(lava, Wh, 0.03), mx(lava, '#ffff80', 0.08)], rim: mx(lava, '#ffff80', 0.45), sglow: mx(lava, '#ffff80', 0.45), ember: mx(lava, K, 0.2),
    stone1: mx(ground, K, 0.35), stone2: mx(ground, K, 0.0), stone3: mx(ground, Wh, 0.14)
  };
}
function makeBgLava() {
  const AR = mp.W * mp.H / (W * H);
  const c = document.createElement('canvas'); c.width = mp.W; c.height = mp.H;
  const g = c.getContext('2d');
  let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  P = makePalette();
  g.fillStyle = P.ground; g.fillRect(0, 0, mp.W, mp.H);
  const dirt = P.dirt;
  for (let i = 0; i < 900 * AR; i++) { g.fillStyle = dirt[i % 3]; const s = 6 + rnd() * 14; g.fillRect(Math.floor(rnd() * mp.W), Math.floor(rnd() * mp.H), s, s * 0.7); }
  for (let i = 0; i < 120 * AR; i++) { // kamyczki na ziemi
    const x = rnd() * mp.W, y = rnd() * mp.H; if (mp.isLava(x, y)) continue; const r = 4 + rnd() * 9;
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(x + 2, y + r * 0.5, r, r * 0.6, 0, 0, 7); g.fill();
    g.fillStyle = P.pebble; g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, 7); g.fill();
  }
  const cols = Math.ceil(mp.W / T), rows = Math.ceil(mp.H / T);
  const L = (cx, cy) => cx >= 0 && cy >= 0 && cx < cols && cy < rows && mp.isLava(cx * T + T / 2, cy * T + T / 2);
  const shades = P.lava;
  shimmer = [];
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    if (!L(cx, cy)) continue;
    g.fillStyle = shades[(cx * 7 + cy * 13) % 3]; g.fillRect(cx * T, cy * T, T, T);
    if (rnd() < 0.06) shimmer.push({ x: cx * T + 4, y: cy * T + 4, p: rnd() * 6.28 });
  }
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) { // brzegi: ciemny uskok na zewnątrz + żarzący pasek wewnątrz
    if (!L(cx, cy)) continue;
    const x = cx * T, y = cy * T;
    if (!L(cx, cy - 1)) { g.fillStyle = P.cliff1; g.fillRect(x, y - 9, T, 9); g.fillStyle = P.rim; g.fillRect(x, y, T, 4); }
    if (!L(cx, cy + 1)) { g.fillStyle = P.cliff2; g.fillRect(x, y + T, T, 5); g.fillStyle = P.rim; g.fillRect(x, y + T - 4, T, 4); }
    if (!L(cx - 1, cy)) { g.fillStyle = P.cliff2; g.fillRect(x - 5, y, 5, T); g.fillStyle = P.rim; g.fillRect(x, y, 4, T); }
    if (!L(cx + 1, cy)) { g.fillStyle = P.cliff2; g.fillRect(x + T, y, 5, T); g.fillStyle = P.rim; g.fillRect(x + T - 4, y, 4, T); }
    if (((cx + cy) & 1) && (!L(cx, cy - 1) || !L(cx, cy + 1) || !L(cx - 1, cy) || !L(cx + 1, cy))) { g.fillStyle = P.ember; g.fillRect(x + 5, y + 5, 4, 4); }
  }
  mp.stones.forEach(s => drawStone(g, s));
  mp.boulders.forEach(b => drawBoulder(g, b));
  return c;
}

// ---------- tło map leśnych: łąka (zielona) i zima (śnieg) – piniowe drzewa, ścieżki, staw, płotki ----------
const FOREST = {
  meadow: { g: ['#98d84a', '#8ccb40', '#a9e45c'], tuft: '#6fb52f', path: '#e9cf5d', pathEdge: '#c4a93f', pine: ['#12351f', '#1f6b3a', '#2f9150'], snow: false, water: ['#2679c0', '#3aa0e8', '#8fd8ff'], shore: '#d8c27a', fence: ['#6b4423', '#a8743a'], rock: ['#3b3b4a', '#7b7b8c', '#a9a9bb'] },
  winter: { g: ['#e9f3fb', '#dbeaf6', '#f8fcff'], tuft: '#c5d9ea', path: '#cfdfec', pathEdge: '#b6cbdc', pine: ['#0f2f2a', '#1f5a4a', '#2f7d68'], snow: true, water: ['#6bb9db', '#9fdcf2', '#e6f8ff'], shore: '#f4fbff', fence: ['#7d8da0', '#c7d4e2'], rock: ['#46505e', '#8794a6', '#c6d0dc'] }
};
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawPine(g, cx, by, sz, P) {
  g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(cx + 4, by - 2, sz * 0.46, sz * 0.15, 0, 0, 7); g.fill();
  g.fillStyle = '#5a3a1e'; g.fillRect(cx - sz * 0.07, by - sz * 0.22, sz * 0.14, sz * 0.22);
  for (let k = 0; k < 3; k++) {
    const hw = sz * (0.47 - k * 0.1), yb = by - sz * 0.14 - k * sz * 0.3, yt = yb - sz * 0.56;
    g.fillStyle = P.pine[0]; g.beginPath(); g.moveTo(cx - hw - 2, yb + 2); g.lineTo(cx + hw + 2, yb + 2); g.lineTo(cx, yt - 3); g.closePath(); g.fill();
    g.fillStyle = P.pine[1]; g.beginPath(); g.moveTo(cx - hw, yb); g.lineTo(cx + hw, yb); g.lineTo(cx, yt); g.closePath(); g.fill();
    g.fillStyle = P.pine[2]; g.beginPath(); g.moveTo(cx - hw, yb); g.lineTo(cx, yb); g.lineTo(cx, yt); g.closePath(); g.fill();
    if (P.snow) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx - hw * 0.55, yb - sz * 0.2); g.lineTo(cx + hw * 0.55, yb - sz * 0.2); g.lineTo(cx, yt); g.closePath(); g.fill(); }
  }
}
function makeBgForest() {
  const AR = mp.W * mp.H / (W * H);
  const P = FOREST[mp.theme] || FOREST.meadow, winter = mp.theme === 'winter';
  const c = document.createElement('canvas'); c.width = mp.W; c.height = mp.H; const g = c.getContext('2d');
  let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  g.fillStyle = P.g[0]; g.fillRect(0, 0, mp.W, mp.H);
  for (let i = 0; i < 700 * AR; i++) { g.fillStyle = P.g[1 + (i & 1)]; const sz = 10 + rnd() * 30; g.fillRect(Math.floor(rnd() * mp.W), Math.floor(rnd() * mp.H), sz, sz * 0.6); }
  for (let i = 0; i < 420 * AR; i++) { const x = rnd() * mp.W, y = rnd() * mp.H; g.fillStyle = P.tuft; g.fillRect(x, y, 3, 7); g.fillRect(x + 5, y + 2, 3, 5); g.fillRect(x - 5, y + 3, 3, 4); }
  const paths = mp.paths || [];
  g.fillStyle = P.pathEdge; paths.forEach(r => g.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8));
  if (mp.plaza) { g.beginPath(); g.arc(mp.plaza[0], mp.plaza[1], mp.plaza[2] + 4, 0, 7); g.fill(); }
  g.fillStyle = P.path; paths.forEach(r => g.fillRect(r.x, r.y, r.w, r.h));
  if (mp.plaza) { g.beginPath(); g.arc(mp.plaza[0], mp.plaza[1], mp.plaza[2], 0, 7); g.fill(); }
  g.fillStyle = P.pathEdge; for (let i = 0; i < 160; i++) { const r = paths[i % Math.max(1, paths.length)]; if (!r) break; g.fillRect(r.x + rnd() * r.w, r.y + rnd() * r.h, 4, 3); }
  mp.rects.filter(r => r.k === 'water').forEach(r => { // staw / lód
    g.fillStyle = P.shore; rr(g, r.x - 10, r.y - 10, r.w + 20, r.h + 20, 26); g.fill();
    g.fillStyle = P.water[0]; rr(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 22); g.fill();
    g.fillStyle = P.water[1]; rr(g, r.x + 4, r.y + 4, r.w - 8, r.h - 10, 18); g.fill();
    g.strokeStyle = P.water[2]; g.lineWidth = 3;
    for (let i = 0, n = Math.max(3, r.w * r.h / 4000); i < n; i++) { const x = r.x + 14 + rnd() * (r.w - 44), y = r.y + 14 + rnd() * (r.h - 34); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20, winter ? y + 8 : y); g.stroke(); }
  });
  mp.rects.filter(r => r.k === 'fence').forEach(r => {
    const horiz = r.w >= r.h;
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(r.x + 3, r.y + 5, r.w, r.h);
    g.fillStyle = P.fence[0]; g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = P.fence[1];
    if (horiz) { g.fillRect(r.x, r.y + 3, r.w, 4); g.fillRect(r.x, r.y + r.h - 7, r.w, 4); for (let t = 0; t <= r.w - 8; t += 26) g.fillRect(r.x + t, r.y - 3, 8, r.h + 6); }
    else { g.fillRect(r.x + 3, r.y, 4, r.h); g.fillRect(r.x + r.w - 7, r.y, 4, r.h); for (let t = 0; t <= r.h - 8; t += 26) g.fillRect(r.x - 3, r.y + t, r.w + 6, 8); }
  });
  mp.rects.filter(r => r.k === 'rock').forEach(r => {
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(r.x + r.w / 2 + 5, r.y + r.h - 2, r.w * 0.6, r.h * 0.25, 0, 0, 7); g.fill();
    g.fillStyle = P.rock[0]; rr(g, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 16); g.fill();
    g.fillStyle = P.rock[1]; rr(g, r.x, r.y, r.w, r.h, 14); g.fill();
    g.fillStyle = P.rock[2]; rr(g, r.x + 6, r.y + 5, r.w * 0.5, r.h * 0.35, 8); g.fill();
  });
  const trees = []; // rzędy drzew: sortujemy po "stopach", żeby się ładnie zasłaniały
  mp.rects.filter(r => r.k === 'trees').forEach(r => {
    const sz = Math.min(r.w, r.h) + 6, horiz = r.w >= r.h, len = horiz ? r.w : r.h, n = Math.max(1, Math.round(len / (sz * 0.74)));
    for (let i = 0; i < n; i++) trees.push(horiz ? { x: r.x + (i + 0.5) / n * len, by: r.y + r.h, sz } : { x: r.x + r.w / 2, by: r.y + (i + 1) / n * len, sz });
  });
  trees.sort((a, b) => a.by - b.by).forEach(t => drawPine(g, t.x, t.by, t.sz, P));
  return c;
}
function drawStone(g, s) {
  const { x, y, r } = s;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y + r * 0.55, r * 1.05, r * 0.45, 0, 0, 7); g.fill();
  g.fillStyle = P.sglow; g.beginPath(); g.ellipse(x, y + r * 0.35, r, r * 0.6, 0, 0, 7); g.fill();
  g.fillStyle = P.stone1; g.beginPath(); g.ellipse(x, y + 2, r * 0.9, r * 0.75, 0, 0, 7); g.fill();
  g.fillStyle = P.stone2; g.beginPath(); g.ellipse(x, y - 3, r * 0.8, r * 0.6, 0, 0, 7); g.fill();
  g.fillStyle = P.stone3; g.beginPath(); g.ellipse(x - r * 0.2, y - r * 0.25, r * 0.4, r * 0.25, 0, 0, 7); g.fill();
}
function drawBoulder(g, b) {
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(b.x + 5, b.y + b.r * 0.7, b.r * 1.1, b.r * 0.6, 0, 0, 7); g.fill();
  g.fillStyle = '#2b2228'; g.beginPath(); g.arc(b.x, b.y, b.r + 3, 0, 7); g.fill();
  g.fillStyle = '#5b4b54'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill();
  g.fillStyle = '#6e5d67'; g.beginPath(); g.arc(b.x - 4, b.y - 5, b.r * 0.78, 0, 7); g.fill();
  g.fillStyle = '#8c7a85'; g.beginPath(); g.arc(b.x - 9, b.y - 11, b.r * 0.28, 0, 7); g.fill();
}

// ---------- efekty (cząsteczki, fale, drżenie ekranu) ----------
function burst(x, y, n, cols, sp, life, sz) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, v = sp * (0.3 + Math.random());
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + Math.random() * 0.7), max: life, col: cols[i % cols.length], sz: (sz || 4) * (0.7 + Math.random() * 0.8), drag: 2.5 });
  }
}
function sfx(n, o) { if (window.Sfx) Sfx.play(n, o); }
function applyFx(f) {
  if (f.type === 'hit') {
    burst(f.x, f.y, 9, ['#ff4d4d', '#c1272d', '#ff9d1c'], 220, 0.5); if (f.v === me) shake = Math.max(shake, 7);
    if (f.o === me) sfx('hitmark'); else if (f.v === me) sfx('hurt'); else sfx('hit', { vol: 0.6 }); // trafiłeś / oberwałeś / ktoś trafił kogoś
  }
  else if (f.type === 'spark') burst(f.x, f.y, 5, ['#ffe9a0', '#ffffff', '#c9c4e8'], 260, 0.25, 3);
  else if (f.type === 'boom') { burst(f.x, f.y, f.r ? 70 : 44, ['#ffd24a', '#ff7a1a', '#4a2a20', '#ff4d2d'], 440, 0.8, 6); rings.push({ x: f.x, y: f.y, t: 0, life: 0.35, max: (f.r || (cur ? cur.rocketR : 95)) + 20, col: '#ffd24a' }); shake = Math.max(shake, f.r ? 9 : 12); sfx('boom'); }
  else if (f.type === 'legend') { burst(f.x, f.y, 70, ['#ffd166', '#fff3b0', '#ffffff'], 380, 1, 6); rings.push({ x: f.x, y: f.y, t: 0, life: 0.8, max: 140, col: '#ffd166' }); rings.push({ x: f.x, y: f.y, t: 0, life: 1.1, max: 220, col: '#fff3b0' }); shake = Math.max(shake, f.v === me ? 12 : 5); }
  else if (f.type === 'bossSpawn') { for (let k = 0; k < 3; k++) rings.push({ x: f.x, y: f.y, t: -k * 0.18, life: 0.7, max: 260, col: '#ff5d3a' }); burst(f.x, f.y, 50, ['#ff5d3a', '#6d2d9c', '#ffd166'], 380, 0.9, 6); shake = Math.max(shake, 14); }
  else if (f.type === 'death') { burst(f.x, f.y, 55, [COL[f.v] || '#fff', '#ff4d4d', '#ffffff'], 400, 0.9, 6); rings.push({ x: f.x, y: f.y, t: 0, life: 0.5, max: 70, col: COL[f.v] || '#fff' }); shake = Math.max(shake, f.v === me ? 14 : 5);
    if (f.v === me) sfx('die'); else { sfx('death', { vol: 0.8 }); if (f.k === me) sfx('frag'); } }
  else if (f.type === 'spawn') rings.push({ x: f.x, y: f.y, t: 0, life: 0.6, max: 60, col: COL[f.v] || '#fff' });
  else if (f.type === 'dash') burst(f.x, f.y, 8, ['#ffffff', '#c9c4e8'], 180, 0.3, 4);
  else if (f.type === 'pick') { burst(f.x, f.y, 12, [ITEM_COL[f.item] || '#ffd166', '#ffffff'], 190, 0.45, 4); if (f.v === me) sfx('pick'); }
}

// ---------- rysowanie postaci, broni, przedmiotów ----------
function drawGun(g, w, x0) {
  const [l, t, c] = GUN[w] || GUN.pistol;
  g.fillStyle = DARK; g.fillRect(x0 - 2, -t / 2 - 2, l + 4, t + 4);
  g.fillStyle = c; g.fillRect(x0, -t / 2, l, t);
  if (w === 'sniper') { g.fillStyle = '#222'; g.fillRect(x0 + 10, -t / 2 - 4, 12, 4); }
  if (w === 'rocket') { g.fillStyle = '#e0953a'; g.fillRect(x0 + l - 7, -t / 2, 7, t); }
  if (w === 'shotgun') { g.fillStyle = '#7a4f24'; g.fillRect(x0, -t / 2, 10, t); }
}
function drawPlayer(g, p, i, d, now) {
  const x = Math.round(d.x), y = Math.round(d.y), c = COL[i];
  const inLava = mp.isLava(x, y) && !mp.onStone(x, y) && !p.dashing;
  g.save();
  if (p.inv && Math.floor(now / 90) % 2) g.globalAlpha = 0.45;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 3, y + PR - 2, PR, PR * 0.55, 0, 0, 7); g.fill();
  if (cur.team) { g.strokeStyle = TEAM_COL[cur.team[i]]; g.lineWidth = 4; g.beginPath(); g.ellipse(x, y + PR - 2, PR + 7, (PR + 7) * 0.55, 0, 0, 7); g.stroke(); } // pierścień drużyny
  if (p.lv > 0) { const hold = g.globalAlpha; g.globalAlpha = hold * (0.28 + 0.12 * Math.sin(now / 150)); g.fillStyle = '#ffd166'; g.beginPath(); g.arc(x, y, PR + 12 + p.lv * 3, 0, 7); g.fill(); g.globalAlpha = hold; } // aura legendy
  if (p.rage > 0) { g.strokeStyle = '#ff7a3d'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, PR + 11 + Math.sin(now / 70) * 2, 0, 7); g.stroke(); }
  if (p.boost) { g.strokeStyle = '#ffd166'; g.globalAlpha *= 0.6; g.lineWidth = 3; g.beginPath(); g.arc(x, y, PR + 7 + Math.sin(now / 80) * 2, 0, 7); g.stroke(); g.globalAlpha = p.inv && Math.floor(now / 90) % 2 ? 0.45 : 1; }
  g.translate(x, y);
  g.save(); g.rotate(d.a); drawGun(g, p.w, 12);
  if (p.fired) { g.fillStyle = '#fff3b0'; const l = (GUN[p.w] || GUN.pistol)[0] + 12; g.fillRect(l, -5, 12, 10); g.fillStyle = '#ffb02e'; g.fillRect(l + 12, -3, 8, 6); }
  g.restore();
  g.fillStyle = DARK; g.fillRect(-PR - 3, -PR - 3, 2 * PR + 6, 2 * PR + 6);
  g.fillStyle = c; g.fillRect(-PR, -PR, 2 * PR, 2 * PR);
  g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(-PR, PR - 9, 2 * PR, 9);
  g.fillStyle = DARK; // uszy/rogi/oczy – każdy gracz wygląda trochę inaczej
  if (i === 0) { g.fillRect(-PR, -PR - 8, 9, 9); g.fillRect(PR - 9, -PR - 8, 9, 9); g.fillStyle = c; g.fillRect(-PR + 2, -PR - 6, 5, 7); g.fillRect(PR - 7, -PR - 6, 5, 7); }
  else if (i === 1) { g.fillRect(-PR - 4, -PR - 4, 11, 11); g.fillRect(PR - 7, -PR - 4, 11, 11); g.fillStyle = c; g.fillRect(-PR - 2, -PR - 2, 7, 7); g.fillRect(PR - 5, -PR - 2, 7, 7); }
  else if (i === 2) { g.fillRect(-PR + 2, -PR - 9, 4, 10); g.fillRect(PR - 6, -PR - 9, 4, 10); g.fillRect(-PR + 2, -PR - 10, 10, 4); g.fillRect(PR - 12, -PR - 10, 10, 4); }
  else { g.fillRect(-PR + 3, -PR - 9, 12, 10); g.fillRect(PR - 15, -PR - 9, 12, 10); g.fillStyle = '#fff'; g.fillRect(-PR + 5, -PR - 7, 8, 6); g.fillRect(PR - 13, -PR - 7, 8, 6); }
  const ex = Math.cos(d.a) * 3, ey = Math.sin(d.a) * 3;
  g.fillStyle = '#fff'; g.fillRect(-11 + ex, -6 + ey, 9, 11); g.fillRect(3 + ex, -6 + ey, 9, 11);
  g.fillStyle = DARK; g.fillRect(-8 + ex * 2, -3 + ey * 2, 5, 6); g.fillRect(6 + ex * 2, -3 + ey * 2, 5, 6);
  if (inLava) { g.fillStyle = 'rgba(255,80,0,.4)'; g.fillRect(-PR, -PR, 2 * PR, 2 * PR); }
  g.restore();
  // pasek życia i nick nad głową
  const bw = 44, bx = x - bw / 2, by = y - PR - 20;
  g.fillStyle = DARK; g.fillRect(bx - 2, by - 2, bw + 4, 10);
  const hf = p.hp / (p.maxhp || 100); g.fillStyle = hf > 0.5 ? '#52d66b' : hf > 0.25 ? '#ffd166' : '#ff4d4d'; g.fillRect(bx, by, bw * Math.min(1, hf), 6);
  if (p.sh > 0) { g.fillStyle = '#4cc9f0'; g.fillRect(bx, by - 4, bw * p.sh / 50, 3); }
  g.font = '600 15px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillStyle = c;
  g.fillText(cur.names[i], x, by - (p.sh > 0 ? 9 : 6));
  if (p.lv > 0) { g.font = '16px sans-serif'; g.fillText('👑'.repeat(p.lv), x, by - (p.sh > 0 ? 28 : 25)); }
}
function drawItem(g, it, now) {
  const bob = Math.sin(now / 300 + it.id) * 3, x = it.x, y = it.y + bob;
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, it.y + 17, 14, 6, 0, 0, 7); g.fill();
  const col = ITEM_COL[it.type] || '#fff3b0';
  g.globalAlpha = 0.35 + 0.2 * Math.sin(now / 250 + it.id); g.fillStyle = col; g.beginPath(); g.arc(x, y, 25, 0, 7); g.fill(); g.globalAlpha = 1;
  g.fillStyle = DARK; g.beginPath(); g.arc(x, y, 19, 0, 7); g.fill();
  g.fillStyle = '#2d2a58'; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill();
  g.save(); g.translate(x, y);
  if (it.type === 'health') { g.fillStyle = col; g.fillRect(-4, -11, 8, 22); g.fillRect(-11, -4, 22, 8); }
  else if (it.type === 'shield') { g.fillStyle = col; g.beginPath(); g.moveTo(-10, -10); g.lineTo(10, -10); g.lineTo(10, 2); g.lineTo(0, 12); g.lineTo(-10, 2); g.closePath(); g.fill(); g.fillStyle = '#d8f4ff'; g.fillRect(-6, -6, 5, 8); }
  else if (it.type === 'rage') { g.fillStyle = col; g.beginPath(); g.moveTo(0, -13); g.quadraticCurveTo(11, -2, 7, 8); g.quadraticCurveTo(3, 13, 0, 11); g.quadraticCurveTo(-8, 12, -8, 3); g.quadraticCurveTo(-8, -3, -3, -6); g.quadraticCurveTo(-3, -10, 0, -13); g.fill(); g.fillStyle = '#ffd166'; g.beginPath(); g.moveTo(0, -2); g.quadraticCurveTo(5, 4, 2, 9); g.quadraticCurveTo(-4, 9, -4, 4); g.quadraticCurveTo(-3, 1, 0, -2); g.fill(); }
  else if (it.type === 'boost') { g.fillStyle = col; g.beginPath(); g.moveTo(3, -12); g.lineTo(-8, 3); g.lineTo(-1, 3); g.lineTo(-4, 12); g.lineTo(8, -3); g.lineTo(1, -3); g.closePath(); g.fill(); }
  else { const w = GUN[it.type] || GUN.pistol, k = Math.min(1, 22 / w[0]); g.scale(k, k); g.translate(-w[0] / 2, 0); drawGun(g, it.type, 0); }
  g.restore();
}
function drawBullet(g, b, now) {
  const dt = Math.min((now - got) / 1000, 0.1), x = b.x + b.vx * dt, y = b.y + b.vy * dt, a = Math.atan2(b.vy, b.vx);
  g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(a);
  if (b.w === 'rocket') {
    g.fillStyle = DARK; g.fillRect(-13, -6, 28, 12); g.fillStyle = '#d6d2f0'; g.fillRect(-11, -4, 22, 8); g.fillStyle = '#ff5d3a'; g.fillRect(8, -4, 7, 8);
    g.fillStyle = '#ffb02e'; g.fillRect(-22 - Math.random() * 6, -3, 11, 6);
    if (Math.random() < 0.7) parts.push({ x: x - Math.cos(a) * 14, y: y - Math.sin(a) * 14, vx: rnd(-30, 30), vy: rnd(-30, 30), life: 0.5, max: 0.5, col: Math.random() < 0.4 ? '#ffb02e' : '#6a5a5a', sz: 6, drag: 2 });
  } else if (b.w === 'boss') {
    g.fillStyle = 'rgba(255,93,58,.3)'; g.fillRect(-18, -3, 18, 6); g.fillStyle = DARK; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill();
    g.fillStyle = '#ff5d3a'; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill(); g.fillStyle = '#ffd166'; g.beginPath(); g.arc(-1, -1, 3.5, 0, 7); g.fill();
  } else if (b.w === 'flame') {
    const k = Math.min(1, Math.max(0, 1 - b.l / 240)), r = 6 + k * 10; g.globalAlpha = 0.85 - k * 0.5;
    g.fillStyle = k < 0.35 ? '#fff3b0' : k < 0.7 ? '#ff9d1c' : '#d9531a'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.globalAlpha = 1;
  } else if (b.w === 'sniper') {
    const gr = g.createLinearGradient(-90, 0, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, '#ffffff');
    g.fillStyle = gr; g.fillRect(-90, -2, 90, 4); g.fillStyle = '#fff'; g.fillRect(-4, -3, 14, 6);
  } else {
    g.fillStyle = 'rgba(255,240,170,.35)'; g.fillRect(-24, -2, 24, 4); g.fillStyle = '#fff3b0'; g.fillRect(-4, -3, 12, 6); g.fillStyle = '#ffb02e'; g.fillRect(4, -2, 4, 4);
  }
  g.restore();
}
const rnd = (a, b) => a + Math.random() * (b - a);

// laser snajperki widoczny dla wszystkich – można zdążyć uciec
function laser(g, x, y, a, mine) {
  const cx = Math.cos(a), cy = Math.sin(a), L = 2400;
  let t = 1;
  for (const b of mp.boulders) { const k = M.segCircle(x, y, x + cx * L, y + cy * L, b.x, b.y, b.r); if (k >= 0 && k < t) t = k; }
  for (const r of mp.rects) { if (!M.BULLET_BLOCK[r.k]) continue; const k = M.segRect(x, y, x + cx * L, y + cy * L, r); if (k >= 0 && k < t) t = k; }
  const tx = cx > 0 ? (W - x) / cx / L : cx < 0 ? -x / cx / L : 9, ty = cy > 0 ? (H - y) / cy / L : cy < 0 ? -y / cy / L : 9;
  t = Math.min(t, tx, ty);
  const sx = x + cx * 30, sy = y + cy * 30, ex = x + cx * L * t, ey = y + cy * L * t;
  g.strokeStyle = mine ? 'rgba(255,40,40,.9)' : 'rgba(255,40,40,.65)'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
  g.fillStyle = '#ff2828'; g.fillRect(Math.round(ex) - 3, Math.round(ey) - 3, 6, 6);
}

function drawHud(g, s, now) {
  const n = s.players.length, sw = 330;
  const order = s.players.map((_, i) => i); let xs;
  if (s.team) { order.sort((a, b) => s.team[a] - s.team[b] || a - b); const gap = 170, x0 = (W - (4 * sw + gap)) / 2; xs = order.map((_, k) => x0 + k * sw + (k >= 2 ? gap : 0)); }
  else { const x0 = (W - n * sw) / 2 + 10; xs = order.map((_, k) => x0 + k * sw); }
  order.forEach((i, k) => {
    const p = s.players[i], x = xs[k], y = 16, c = COL[i];
    g.globalAlpha = p.dead ? 0.5 : 1;
    g.fillStyle = 'rgba(20,19,44,.5)'; g.fillRect(x - 8, y - 8, sw - 22, 108);
    if (s.team) { g.fillStyle = TEAM_COL[s.team[i]]; g.fillRect(x - 8, y - 8, 5, 108); }
    g.fillStyle = DARK; g.fillRect(x, y, 56, 56); g.fillStyle = c; g.fillRect(x + 4, y + 4, 48, 48);
    g.fillStyle = '#fff'; g.fillRect(x + 12, y + 18, 11, 13); g.fillRect(x + 32, y + 18, 11, 13); g.fillStyle = DARK; g.fillRect(x + 16, y + 22, 6, 7); g.fillRect(x + 36, y + 22, 6, 7);
    const bx = x + 70, by = y + 24, bw = 200, bh = 26;
    g.font = '600 18px Fredoka, sans-serif'; g.textAlign = 'left'; g.fillStyle = c; g.fillText(s.names[i] + (i === me ? ' (ty)' : '') + (p.lv ? ' ' + '👑'.repeat(p.lv) : ''), bx, y + 14);
    g.fillStyle = DARK; g.fillRect(bx - 3, by - 3, bw + 6, bh + 6); g.fillStyle = '#2a1410'; g.fillRect(bx, by, bw, bh);
    if (p.hidden) { g.font = '500 17px Fredoka, sans-serif'; g.fillStyle = '#8f89b8'; g.fillText('poza zasięgiem wzroku', bx + 8, by + 19); }
    else {
      const hf = Math.min(1, p.hp / (p.maxhp || 100));
      g.fillStyle = hf > 0.5 ? '#35d44f' : hf > 0.25 ? '#ffd166' : '#ff4d4d'; g.fillRect(bx, by, bw * hf, bh);
      if (p.sh > 0) { g.fillStyle = '#4cc9f0'; g.fillRect(bx, by + bh - 8, bw * p.sh / 100, 8); }
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(bx, by, bw * hf, 5);
    }
    g.font = '700 34px Fredoka, sans-serif'; g.fillStyle = '#f4f2ff'; g.fillText(s.team ? String(p.kills) : `${p.kills} / ${s.kills}`, bx, y + 88);
    if (!p.hidden) { g.font = '500 17px Fredoka, sans-serif'; g.textAlign = 'right'; g.fillStyle = '#cbbfe6'; g.fillText(HN[p.w] + (p.ammo >= 0 ? ' · ' + p.ammo : ''), bx + bw, y + 86); }
    g.globalAlpha = 1;
  });
  if (s.team) { // wynik drużyn pośrodku
    const cx = (xs[1] + 300 + xs[2] - 8) / 2;
    g.textAlign = 'center'; g.font = '700 56px Fredoka, sans-serif';
    g.fillStyle = TEAM_COL[0]; g.fillText(String(s.teamKills[0]), cx - 38, y0hud() + 50);
    g.fillStyle = '#a9a5d6'; g.fillText(':', cx, y0hud() + 46);
    g.fillStyle = TEAM_COL[1]; g.fillText(String(s.teamKills[1]), cx + 38, y0hud() + 50);
    g.font = '500 16px Fredoka, sans-serif'; g.fillStyle = '#a9a5d6'; g.fillText('do ' + s.kills, cx, y0hud() + 76);
  }
  if (me >= 0) { // pasek uniku
    const p = s.players[me], cd = Math.max(0, p.dashCd - (now - got)), r = 1 - cd / DASH_CD;
    g.fillStyle = 'rgba(20,19,44,.7)'; g.fillRect(W / 2 - 100, H - 46, 200, 28);
    g.fillStyle = r >= 1 ? '#7ee0a1' : '#a9a5d6'; g.fillRect(W / 2 - 96, H - 42, 192 * r, 20);
    g.font = '600 16px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillStyle = DARK; g.fillText(r >= 1 ? 'UNIK GOTOWY (spacja)' : 'unik…', W / 2, H - 27);
  }
}
const y0hud = () => 16;

// aktualna broń i amunicja – prawy dolny róg
function drawWeaponPanel(g, s, now) {
  if (me < 0 || !s.players[me]) return;
  const p = s.players[me], w = 340, h = 114, x = W - w - 20, y = H - h - 20;
  g.save(); g.globalAlpha = p.dead ? 0.5 : 1;
  g.fillStyle = 'rgba(20,19,44,.82)'; g.fillRect(x, y, w, h);
  g.strokeStyle = s.team ? TEAM_COL[s.team[me]] : COL[me]; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
  g.save(); g.translate(x + 64, y + h / 2 + 2); const gw = GUN[p.w] || GUN.pistol, k = Math.min(2.4, 92 / gw[0]); g.scale(k, k); g.translate(-gw[0] / 2, 0); drawGun(g, p.w, 0); g.restore();
  g.textAlign = 'left'; let fs = 21; g.font = `600 ${fs}px Fredoka, sans-serif`; while (g.measureText(WN[p.w]).width > w - 142 && fs > 12) { fs--; g.font = `600 ${fs}px Fredoka, sans-serif`; }
  g.fillStyle = '#f4f2ff'; g.fillText(WN[p.w], x + 130, y + 32);
  const inf = p.ammo < 0, low = !inf && p.ammo <= Math.max(1, Math.ceil(p.ammoMax * 0.25));
  g.font = '700 54px Fredoka, sans-serif'; g.fillStyle = inf ? '#cbbfe6' : low ? (Math.floor(now / 220) % 2 ? '#ff5d5d' : '#ffb0b0') : '#ffd166';
  const txt = inf ? '∞' : String(p.ammo); g.fillText(txt, x + 130, y + 84);
  if (!inf) {
    const nw = g.measureText(txt).width; g.font = '500 22px Fredoka, sans-serif'; g.fillStyle = '#a9a5d6'; g.fillText('/ ' + p.ammoMax, x + 138 + nw, y + 84);
    const bw = w - 146; g.fillStyle = DARK; g.fillRect(x + 128, y + 95, bw + 4, 12); g.fillStyle = low ? '#ff5d5d' : '#ffd166'; g.fillRect(x + 130, y + 97, bw * p.ammo / p.ammoMax, 8);
  } else { g.font = '500 17px Fredoka, sans-serif'; g.fillStyle = '#a9a5d6'; g.fillText('bez limitu', x + 210, y + 80); }
  g.restore();
  // aktywne buffy nad panelem
  const chips = [];
  if (p.lv) chips.push(['👑 Legenda ' + '★'.repeat(p.lv), '#ffd166']);
  if (p.rage > 0) chips.push(['💢 Rage ' + Math.ceil((p.rage - (now - got)) / 1000) + ' s', '#ff7a3d']);
  if (p.boost) chips.push(['⚡ Szybkość', '#ffd166']);
  chips.forEach(([t, c], j) => { g.font = '600 18px Fredoka, sans-serif'; const tw = g.measureText(t).width + 20, cy = y - 12 - j * 34; g.fillStyle = 'rgba(20,19,44,.82)'; g.fillRect(x + w - tw, cy - 24, tw, 30); g.fillStyle = c; g.textAlign = 'right'; g.fillText(t, x + w - 10, cy - 3); });
}

// licznik do następnego wydarzenia + globalne buffy – lewy dolny róg
function drawCorner(g, s, now) {
  const lines = [];
  if (s.events && s.phase === 'play') { const ms = Math.max(0, s.nextEvMs - (now - got)); if (!s.goMs || now - got > s.goMs) lines.push(['⏱ Następne wydarzenie: ' + Math.ceil(ms / 1000) + ' s', '#cbbfe6']); }
  (s.buffs || []).forEach(b => { const ms = b.ms - (now - got); if (ms > 0) lines.push([(b.k === 'frenzy' ? '🔥 Szał obrażeń ×2 · ' : '⚡ Przyspieszenie · ') + Math.ceil(ms / 1000) + ' s', b.k === 'frenzy' ? '#ff7a3d' : '#ffd166']); });
  g.font = '600 19px Fredoka, sans-serif'; g.textAlign = 'left';
  lines.forEach(([t, c], j) => { const tw = g.measureText(t).width + 22, y = H - 22 - j * 34; g.fillStyle = 'rgba(20,19,44,.78)'; g.fillRect(20, y - 24, tw, 30); g.fillStyle = c; g.fillText(t, 31, y - 3); });
}

function drawBanner(g, s, now) {
  if (!s.banner) return; const ms = s.banner.ms - (now - got); if (ms <= 0) return;
  const a = Math.min(1, ms / 500, (4500 - ms) / 200 + 0.2), w = 900, h = s.banner.sub ? 104 : 70, x = (W - w) / 2, y = 128;
  g.save(); g.globalAlpha = Math.max(0, a);
  g.fillStyle = 'rgba(20,19,44,.88)'; g.fillRect(x, y, w, h); g.strokeStyle = '#ffd166'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
  g.textAlign = 'center'; g.font = '700 38px Fredoka, sans-serif'; g.fillStyle = '#fff3b0'; g.fillText(s.banner.text, W / 2, y + 47);
  if (s.banner.sub) { g.font = '500 21px Fredoka, sans-serif'; g.fillStyle = '#cbbfe6'; g.fillText(s.banner.sub, W / 2, y + 81); }
  g.restore();
}

function drawBossBar(g, s, now) {
  const b = s.boss; if (!b) return;
  const w = 640, h = 24, x = (W - w) / 2, y = H - 134, f = Math.max(0, b.hp / b.max);
  g.fillStyle = 'rgba(20,19,44,.82)'; g.fillRect(x - 10, y - 34, w + 20, 96);
  g.textAlign = 'left'; g.font = '700 20px Fredoka, sans-serif'; g.fillStyle = '#ff9d7a'; g.fillText('👹 BOSS', x, y - 10);
  g.textAlign = 'right'; g.font = '500 17px Fredoka, sans-serif'; g.fillStyle = '#cbbfe6'; g.fillText(b.hp + ' / ' + b.max + ' · ucieka za ' + Math.max(0, Math.ceil((b.ms - (now - got)) / 1000)) + ' s', x + w, y - 10);
  g.fillStyle = DARK; g.fillRect(x - 3, y - 3, w + 6, h + 6); g.fillStyle = '#2a1410'; g.fillRect(x, y, w, h);
  g.fillStyle = '#c23bff'; g.fillRect(x, y, w * f, h); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x, y, w * f, 5);
  // ranking obrażeń – kto prowadzi, ten dostanie buffy
  const rank = b.dmg.map((d, i) => [d, i]).filter(o => o[0] > 0).sort((a, c) => c[0] - a[0]);
  g.textAlign = 'left'; g.font = '600 18px Fredoka, sans-serif';
  if (!rank.length) { g.fillStyle = '#a9a5d6'; g.fillText('Nikt jeszcze nie zadał obrażeń…', x, y + 48); }
  else { let cx = x; rank.forEach(([d, i], j) => { const t = (j === 0 ? '👑 ' : '') + s.names[i] + ' ' + d; g.fillStyle = COL[i]; g.fillText(t, cx, y + 48); cx += g.measureText(t).width + 22; }); }
}

function drawBoss(g, b, now) {
  const x = Math.round(b.x), y = Math.round(b.y), r = b.r, pulse = Math.sin(now / 180);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x + 4, y + r * 0.8, r * 1.1, r * 0.5, 0, 0, 7); g.fill();
  g.save(); g.globalAlpha = 0.22 + 0.08 * pulse; g.fillStyle = '#ff4d2d'; g.beginPath(); g.arc(x, y, r + 18 + pulse * 3, 0, 7); g.fill(); g.restore();
  for (let k = 0; k < 6; k++) { const a = now / 600 + k * 1.047; g.fillStyle = k % 2 ? '#ffd166' : '#ff5d3a'; g.fillRect(Math.round(x + Math.cos(a) * (r + 24) - 4), Math.round(y + Math.sin(a) * (r + 24) - 4), 8, 8); }
  [[-1], [1]].forEach(([sx]) => { // rogi
    g.fillStyle = DARK; g.beginPath(); g.moveTo(x + sx * r * 0.85, y - r * 0.2); g.lineTo(x + sx * r * 0.6, y - r * 1.4); g.lineTo(x + sx * r * 0.1, y - r * 0.75); g.closePath(); g.fill();
    g.fillStyle = '#e8e0f5'; g.beginPath(); g.moveTo(x + sx * r * 0.78, y - r * 0.28); g.lineTo(x + sx * r * 0.6, y - r * 1.2); g.lineTo(x + sx * r * 0.22, y - r * 0.75); g.closePath(); g.fill();
  });
  g.fillStyle = DARK; g.beginPath(); g.arc(x, y, r + 4, 0, 7); g.fill();
  g.fillStyle = '#4a1d6b'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = '#6d2d9c'; g.beginPath(); g.arc(x - 5, y - 6, r * 0.75, 0, 7); g.fill();
  g.fillStyle = '#ff2d2d'; g.fillRect(x - 22, y - 12, 15, 11 + pulse * 2); g.fillRect(x + 7, y - 12, 15, 11 + pulse * 2);
  g.fillStyle = '#fff'; g.fillRect(x - 18, y - 10, 5, 5); g.fillRect(x + 11, y - 10, 5, 5);
  g.fillStyle = DARK; g.fillRect(x - 20, y + 10, 40, 8); g.fillStyle = '#fff'; for (let k = 0; k < 5; k++) g.fillRect(x - 18 + k * 8, y + 10, 4, 5);
  const bw = 80, f = Math.max(0, b.hp / b.max); // mały pasek nad bossem
  g.fillStyle = DARK; g.fillRect(x - bw / 2 - 2, y - r - 40, bw + 4, 10); g.fillStyle = '#c23bff'; g.fillRect(x - bw / 2, y - r - 38, bw * f, 6);
}

function drawHazards(g, s, now) {
  (s.hazards || []).forEach(h => {
    const ms = h.ms - (now - got), k = Math.max(0, Math.min(1, 1 - ms / 1300));
    g.fillStyle = 'rgba(255,60,40,' + (0.1 + 0.12 * k) + ')'; g.beginPath(); g.arc(h.x, h.y, h.r, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,90,40,' + (0.2 + 0.25 * k) + ')'; g.beginPath(); g.arc(h.x, h.y, h.r * k, 0, 7); g.fill();
    g.strokeStyle = Math.floor(now / 120) % 2 ? '#ff5d3a' : '#ffd166'; g.lineWidth = 4; g.beginPath(); g.arc(h.x, h.y, h.r, 0, 7); g.stroke();
    if (ms < 400) { const fy = h.y - ms * 1.6; g.fillStyle = '#ffd166'; g.beginPath(); g.arc(h.x, fy, 16, 0, 7); g.fill(); g.fillStyle = '#ff5d3a'; g.beginPath(); g.arc(h.x, fy, 10, 0, 7); g.fill(); }
  });
}

// tryb stożka: reszta mapy zaciemniona (serwer i tak nie wysyła wrogów spoza zasięgu wzroku)
let fogC = null;
function drawFog(g, s) {
  if (!s.fog || me < 0 || !s.players[me] || s.players[me].dead) return;
  if (!fogC) { fogC = document.createElement('canvas'); fogC.width = W; fogC.height = H; }
  const f = fogC.getContext('2d'), { r, near, half } = s.fog;
  f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, W, H); f.fillStyle = 'rgba(6,5,16,.97)'; f.fillRect(0, 0, W, H);
  f.globalCompositeOperation = 'destination-out';
  const cone = (x, y, a) => {
    const gr = f.createRadialGradient(x, y, near * 0.6, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.78, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = gr; f.beginPath(); f.moveTo(x, y); f.arc(x, y, r, a - half, a + half); f.closePath(); f.fill();
    const g2 = f.createRadialGradient(x, y, 0, x, y, near); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.7, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = g2; f.beginPath(); f.arc(x, y, near, 0, 7); f.fill();
  };
  cone(disp[me].x - cam.x, disp[me].y - cam.y, aimA);
  s.players.forEach((p, j) => { if (j !== me && s.team && s.team[j] === s.team[me] && !p.hidden && !p.dead && disp[j]) cone(disp[j].x - cam.x, disp[j].y - cam.y, disp[j].a); }); // sojusznicy dzielą wzrok
  f.globalCompositeOperation = 'source-over';
  g.drawImage(fogC, 0, 0);
}
function drawFeed(g, s) {
  g.font = '600 20px Fredoka, sans-serif'; g.textAlign = 'right';
  s.feed.slice(-5).forEach((f, i) => {
    const y = 150 + i * 30, v = s.names[f.v] || '?', k = f.k != null ? s.names[f.k] : null;
    const wn = f.w === 'lava' ? 'lawa' : (WN[f.w] || f.w);
    const parts2 = f.w === 'boss' ? [[v, COL[f.v]], [' zginął od bossa 👹', '#a9a5d6']]
      : f.w === 'meteor' ? [[v, COL[f.v]], [' trafiony meteorem ☄️', '#a9a5d6']]
      : k != null && f.w !== 'lava' ? [[v, COL[f.v]], [' ✖ ', '#a9a5d6'], [k, COL[f.k]], [` (${wn})`, '#a9a5d6']] : k != null ? [[v, COL[f.v]], [' spalony – lawa + ', '#a9a5d6'], [k, COL[f.k]]] : [[v, COL[f.v]], [' wpadł w lawę', '#a9a5d6']];
    const tw = parts2.reduce((a, [t]) => a + g.measureText(t).width, 0);
    g.fillStyle = 'rgba(20,19,44,.55)'; g.fillRect(W - 24 - tw - 12, y - 22, tw + 24, 30);
    let x = W - 24; g.textAlign = 'right';
    for (let j = parts2.length - 1; j >= 0; j--) { g.fillStyle = parts2[j][1]; g.fillText(parts2[j][0], x, y); x -= g.measureText(parts2[j][0]).width; }
  });
}

// kamera podąża za graczem (na dużych mapach); na małych (cała mapa mieści się w ekranie) stoi w miejscu
function updateCam(s, dt) {
  let tgt = me >= 0 && !s.players[me].hidden ? disp[me] : null;
  if (!tgt) { let best = -1; s.players.forEach((p, i) => { if (!p.hidden && !p.dead && disp[i] && p.kills > best) { best = p.kills; tgt = disp[i]; } }); }
  let tx = tgt ? tgt.x : mp.W / 2, ty = tgt ? tgt.y : mp.H / 2;
  if (me >= 0 && tgt && mp.W > W) { tx += (mouse.x - W / 2) * 0.3; ty += (mouse.y - H / 2) * 0.3; } // kamera lekko wyprzedza celownik
  const cx = cl(tx - W / 2, 0, Math.max(0, mp.W - W)), cy = cl(ty - H / 2, 0, Math.max(0, mp.H - H));
  if (!camInit) { cam.x = cx; cam.y = cy; camInit = true; } else { const k = 1 - Math.exp(-dt * 10); cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k; }
}
function drawMinimap(g, s) {
  if (mp.W <= W) return;
  const w = 250, h = w * mp.H / mp.W, x = 16, y = 16, k = w / mp.W;
  g.fillStyle = 'rgba(20,19,44,.72)'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
  g.fillStyle = 'rgba(160,200,140,.25)'; g.fillRect(x, y, w, h);
  const RC = { trees: '#2f9150', rock: '#9a9aaa', fence: '#a8743a', water: '#3aa0e8' };
  mp.rects.forEach(r => { g.fillStyle = RC[r.k] || '#888'; g.fillRect(x + r.x * k, y + r.y * k, Math.max(1.5, r.w * k), Math.max(1.5, r.h * k)); });
  s.items.forEach(it => { g.fillStyle = '#ffe27a'; g.fillRect(x + it.x * k - 1, y + it.y * k - 1, 3, 3); });
  if (s.boss) { g.fillStyle = '#c04bff'; g.beginPath(); g.arc(x + s.boss.x * k, y + s.boss.y * k, 5, 0, 7); g.fill(); }
  s.players.forEach((p, i) => { if (p.hidden || p.dead || !disp[i]) return; g.fillStyle = s.team ? TEAM_COL[s.team[i]] : COL[i]; g.beginPath(); g.arc(x + disp[i].x * k, y + disp[i].y * k, i === me ? 5 : 3.5, 0, 7); g.fill(); if (i === me) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); } });
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.5; g.strokeRect(x + cam.x * k, y + cam.y * k, W * k, H * k);
}
function drawWin(g, s, now) {
  const wt = s.team ? TEAM_NAME[s.winTeam] : s.names[s.winner], col = s.team ? TEAM_COL[s.winTeam] : COL[s.winner];
  const k = Math.min(1, (now - overAt) / 420), sc = 0.3 + 0.7 * (1 - Math.pow(1 - k, 3)) + (k < 1 ? 0 : 0.03 * Math.sin((now - overAt) / 220));
  g.fillStyle = 'rgba(20,19,44,' + (0.5 * k) + ')'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H / 2 - 40); g.scale(sc, sc); g.globalAlpha = k; g.textAlign = 'center';
  g.lineJoin = 'round'; g.font = '700 230px Fredoka, sans-serif';
  g.lineWidth = 22; g.strokeStyle = DARK; g.strokeText('WIN', 0, 70);
  const gr = g.createLinearGradient(0, -120, 0, 80); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(1, '#ffb02e');
  g.fillStyle = gr; g.fillText('WIN', 0, 70);
  g.font = '700 64px Fredoka, sans-serif'; g.lineWidth = 12; g.strokeStyle = DARK; g.strokeText(wt, 0, 150); g.fillStyle = col; g.fillText(wt, 0, 150);
  g.restore(); g.globalAlpha = 1;
}
function draw(g, s, now, dt) {
  updateCam(s, dt);
  g.imageSmoothingEnabled = false;
  g.save();
  shake *= Math.exp(-9 * dt);
  if (shake > 0.3) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  g.translate(-cam.x, -cam.y);
  g.drawImage(bg, cam.x, cam.y, W, H, cam.x, cam.y, W, H);
  const pulse = now / 400;
  g.fillStyle = '#ffe27a';
  shimmer.forEach(sh => { g.globalAlpha = 0.12 + 0.14 * Math.sin(pulse + sh.p); g.fillRect(sh.x, sh.y, 8, 8); }); g.globalAlpha = 1;

  drawHazards(g, s, now);
  s.items.forEach(it => drawItem(g, it, now));
  if (s.boss && s.boss.seen) drawBoss(g, s.boss, now);
  s.players.forEach((p, i) => { if (!p.dead && !p.hidden && p.w === 'sniper') laser(g, disp[i].x, disp[i].y, disp[i].a, i === me); });
  s.players.forEach((p, i) => {
    if (p.dead || p.hidden) return;
    const d = disp[i];
    if (p.dashing) burst(d.x, d.y, 1, ['#ffffff'], 40, 0.25, 8);
    if (mp.isLava(d.x, d.y) && !mp.onStone(d.x, d.y) && !p.dashing && Math.random() < 0.5) burst(d.x, d.y + 8, 1, ['#ffb02e', '#ff5d3a'], 120, 0.5, 4);
    drawPlayer(g, p, i, d, now);
  });
  s.bullets.forEach(b => drawBullet(g, b, now));

  for (let i = rings.length - 1; i >= 0; i--) { // fale uderzeniowe
    const r = rings[i]; r.t += dt; if (r.t >= r.life) { rings.splice(i, 1); continue; }
    const k = r.t / r.life; g.globalAlpha = 1 - k; g.strokeStyle = r.col; g.lineWidth = 6 * (1 - k) + 1; g.beginPath(); g.arc(r.x, r.y, 8 + r.max * k, 0, 7); g.stroke(); g.globalAlpha = 1;
  }
  for (let i = parts.length - 1; i >= 0; i--) { // cząsteczki
    const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k;
    g.globalAlpha = Math.min(1, p.life / p.max * 1.5); g.fillStyle = p.col; const z = Math.max(2, Math.round(p.sz * (0.5 + p.life / p.max * 0.5))); g.fillRect(Math.round(p.x - z / 2), Math.round(p.y - z / 2), z, z);
  }
  g.globalAlpha = 1;
  g.translate(cam.x, cam.y);
  drawFog(g, s);
  g.restore();
  drawMinimap(g, s);

  drawHud(g, s, now); drawFeed(g, s); drawWeaponPanel(g, s, now); drawCorner(g, s, now); drawBossBar(g, s, now); drawBanner(g, s, now);
  if (s.phase === 'over') {
    if (Math.random() < 0.35) burst(cam.x + Math.random() * W, cam.y - 10, 2, ['#ffd166', '#4cc9f0', '#ff5d8f', '#7ee0a1', '#ffffff'], 160, 2.2, 7);
    drawWin(g, s, now);
  }
  g.textAlign = 'center';
  const go = s.goMs - (now - got);
  if (s.phase === 'play' && go > 0) {
    g.fillStyle = 'rgba(20,19,44,.55)'; g.fillRect(0, H / 2 - 110, W, 200);
    g.fillStyle = '#f4f2ff'; g.font = '700 110px Fredoka, sans-serif'; g.fillText(String(Math.ceil(go / 1000)), W / 2, H / 2 + 20);
    g.font = '600 30px Fredoka, sans-serif'; g.fillStyle = '#a9a5d6'; g.fillText(me >= 0 ? 'Przygotuj się… unikaj lawy, zbieraj bronie!' : 'Walka zaraz się zacznie', W / 2, H / 2 + 65);
  }
  if (me >= 0 && s.players[me].dead && s.phase === 'play') {
    const ms = Math.max(0, s.players[me].respawnMs - (now - got));
    g.fillStyle = 'rgba(20,19,44,.45)'; g.fillRect(0, H / 2 - 70, W, 120);
    g.fillStyle = '#ff5d8f'; g.font = '700 54px Fredoka, sans-serif'; g.fillText('Odrodzenie za ' + Math.ceil(ms / 1000), W / 2, H / 2 + 10);
  }
  // drążki dotykowe
  const cv = g.canvas, rc = cv.getBoundingClientRect(), sx = W / rc.width;
  touches.forEach(t => {
    const ox = (t.ox - rc.left) * sx, oy = (t.oy - rc.top) * sx, cx = (t.cx - rc.left) * sx, cy = (t.cy - rc.top) * sx;
    g.strokeStyle = t.kind === 'aim' ? 'rgba(255,93,143,.6)' : 'rgba(255,255,255,.45)'; g.lineWidth = 4; g.beginPath(); g.arc(ox, oy, 60 * sx / 1, 0, 7); g.stroke();
    g.fillStyle = t.kind === 'aim' ? 'rgba(255,93,143,.6)' : 'rgba(255,255,255,.45)'; g.beginPath(); g.arc(cx, cy, 28, 0, 7); g.fill();
  });
}

// ---------- wejście gracza ----------
function readInput(cv, now) {
  const s = cur, d = disp[me]; if (!d) return;
  let dx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), dy = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
  let fire = firing || keys.j || keys.f;
  let aim = Math.atan2(mouse.y + cam.y - d.y, mouse.x + cam.x - d.x);
  let aimTouch = false;
  touches.forEach(t => {
    const vx = t.cx - t.ox, vy = t.cy - t.oy, len = Math.hypot(vx, vy);
    if (t.kind === 'move') { if (len > 8) { dx = vx / Math.max(len, 1) * Math.min(1, len / 55); dy = vy / Math.max(len, 1) * Math.min(1, len / 55); } }
    else if (len > 12) { aim = Math.atan2(vy, vx); aimTouch = true; fire = true; }
  });
  if (aimTouch) d.a = aim;
  aimA = aim;
  const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
  const key = [dx.toFixed(2), dy.toFixed(2), aim.toFixed(2), fire ? 1 : 0].join();
  if (key !== lastKey && now - sentAt > 33) { lastKey = key; sentAt = now; send('move', { type: 'in', dx, dy, aim, fire: !!fire }); }
  if (dashQ) { dashQ = false; send('move', { type: 'dash' }); }
}

function frame() {
  const cv = document.getElementById('arena'); if (!cv) return stop();
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now;
  const s = cur, g = cv.getContext('2d');
  if (me >= 0 && s.phase === 'play') readInput(cv, now); else if (me >= 0) { firing = false; }
  const k = 1 - Math.exp(-dt * 24), ka = 1 - Math.exp(-dt * 30);
  s.players.forEach((p, i) => { // wygładzanie pozycji między pakietami z serwera
    if (p.hidden) return; // poza zasięgiem wzroku (tryb stożka) – serwer nie podaje pozycji
    const d = disp[i] || (disp[i] = { x: p.x, y: p.y, a: p.a });
    if (!(d.x >= 0) || !(d.a === d.a) || Math.hypot(p.x - d.x, p.y - d.y) > 150 || p.dead) { d.x = p.x; d.y = p.y; if (!(d.a === d.a)) d.a = p.a; } else { d.x += (p.x - d.x) * k; d.y += (p.y - d.y) * k; }
    if (i === me && s.phase === 'play' && !p.dead) d.a = aimA; // własne celowanie bez opóźnienia
    else { let da = p.a - d.a; da = Math.atan2(Math.sin(da), Math.cos(da)); d.a += da * ka; }
  });
  try { draw(g, s, now, dt); } catch (e) { g.restore && 0; console.error('Błąd rysowania areny', e); try { g.setTransform(1, 0, 0, 1, 0, 0); } catch (e2) { /* nic */ } }
  const vt = document.getElementById('vt'); if (vt && s.vote) vt.textContent = Math.max(0, Math.ceil((s.vote.ms - (now - got)) / 1000)) + ' s';
  raf = requestAnimationFrame(frame); // pętla musi działać nawet po błędzie rysowania, inaczej gra "zamarza"
}

function xhPanel() {
  return `<details class="xh"><summary>🎯 Celownik</summary><div class="xh-body">
    <label class="xh-row"><input type="checkbox" id="xh-on" ${xh.on ? 'checked' : ''}> Własny celownik</label>
    <div class="xh-styles">${XH_STYLES.map(([id, n]) => `<button type="button" class="ghost tl" data-st="${id}">${n}</button>`).join('')}</div>
    <label class="xh-row">Kolor <input type="color" id="xh-c" value="${xh.color}"></label>
    <label class="xh-row">Rozmiar <input type="range" id="xh-s" min="6" max="56" value="${xh.size}"><output id="xh-sv">${xh.size}</output></label>
    <label class="xh-row">Grubość <input type="range" id="xh-t" min="1" max="8" value="${xh.thick}"><output id="xh-tv">${xh.thick}</output></label>
    <label class="xh-row">Przerwa <input type="range" id="xh-g" min="0" max="24" value="${xh.gap}"><output id="xh-gv">${xh.gap}</output></label>
    <label class="xh-row"><input type="checkbox" id="xh-o" ${xh.outline ? 'checked' : ''}> Ciemny obrys</label>
    <canvas id="xh-pv" width="150" height="150" aria-label="Podgląd celownika"></canvas></div></details>`;
}
function bindXh(el, cv, over) {
  const pv = el.querySelector('#xh-pv'), pg = pv.getContext('2d');
  const refresh = () => {
    pg.fillStyle = '#7b3d28'; pg.fillRect(0, 0, 150, 150); pg.fillStyle = '#f7870c'; pg.fillRect(75, 0, 75, 150);
    drawXhair(pg, 75, 75, xh, 1);
    el.querySelectorAll('[data-st]').forEach(b => b.classList.toggle('on', b.dataset.st === xh.style));
    cv.style.cursor = xh.on && !over ? xhCursor() : '';
    el.querySelector('#xh-sv').textContent = xh.size; el.querySelector('#xh-tv').textContent = xh.thick; el.querySelector('#xh-gv').textContent = xh.gap;
  };
  const set = (k, v) => { xh[k] = v; saveXh(); refresh(); };
  el.querySelector('#xh-on').onchange = e => set('on', e.target.checked);
  el.querySelector('#xh-o').onchange = e => set('outline', e.target.checked);
  el.querySelector('#xh-c').oninput = e => set('color', e.target.value);
  el.querySelector('#xh-s').oninput = e => set('size', +e.target.value);
  el.querySelector('#xh-t').oninput = e => set('thick', +e.target.value);
  el.querySelector('#xh-g').oninput = e => set('gap', +e.target.value);
  el.querySelectorAll('[data-st]').forEach(b => b.onclick = () => set('style', b.dataset.st));
  refresh();
}

function build(el, s) {
  stop();
  const over = s.phase === 'over';
  el.innerHTML = `<div class="bar"><div class="score" id="sc"></div></div>
    <div class="status" id="st" aria-live="polite"></div>
    <canvas id="arena" class="arena" width="${W}" height="${H}" aria-label="Plansza Areny Lawy"></canvas>
    ${over ? '<div class="ar-vote" id="vote"></div>' : ''}
    <p class="lead pong-help" id="hp" style="text-align:center;margin:10px auto 0;font-size:.9rem;max-width:none"></p>
    <div class="actions">${over ? '<button id="again">Start teraz</button>' : '<button class="ghost" id="dash" type="button">💨 Unik</button>'}${fsOk() ? '<button class="ghost" id="fs" type="button">⛶ Pełny ekran</button>' : ''}<button class="ghost" id="snd" type="button"></button><button class="ghost" id="leave">Wyjdź</button></div>
    ${me >= 0 ? xhPanel() : ''}`;
  const cv = el.querySelector('#arena');
  syncFs(); syncSnd();
  el.querySelector('#snd').onclick = () => { Sfx.toggle(); syncSnd(); };
  const fb = el.querySelector('#fs'); if (fb) fb.onclick = () => toggleFs(el);
  if (me >= 0) bindXh(el, cv, over);
  bg = makeBg(); parts = []; rings = []; shake = 0; touches.clear(); camInit = false; voteKey = ''; overAt = performance.now();
  if (over) sfx((s.team ? me >= 0 && s.team[me] === s.winTeam : s.winner === me) ? 'win' : 'pick');
  Object.keys(keys).forEach(k => delete keys[k]); firing = dashQ = false; lastKey = ''; sentAt = 0;
  shots = s.players.map(p => p.sn); disp = s.players.map(p => ({ x: p.x, y: p.y, a: p.a })); aimA = me >= 0 ? s.players[me].a : 0; fogC = null;
  lastFx = s.fx.reduce((m, f) => Math.max(m, f.id), 0);
  if (me >= 0 && !over) {
    const toWorld = e => { const r = cv.getBoundingClientRect(); mouse.x = (e.clientX - r.left) / r.width * W; mouse.y = (e.clientY - r.top) / r.height * H; };
    cv.onpointerdown = e => {
      cv.setPointerCapture(e.pointerId);
      if (e.pointerType === 'touch') {
        const r = cv.getBoundingClientRect(), kind = e.clientX - r.left < r.width / 2 ? 'move' : 'aim';
        touches.set(e.pointerId, { kind, ox: e.clientX, oy: e.clientY, cx: e.clientX, cy: e.clientY });
      } else { toWorld(e); if (e.button === 2) dashQ = true; else firing = true; }
    };
    cv.onpointermove = e => { const t = touches.get(e.pointerId); if (t) { t.cx = e.clientX; t.cy = e.clientY; } else toWorld(e); };
    const up = e => { if (touches.delete(e.pointerId)) return; if (e.button === 0 || e.type === 'pointercancel') firing = false; };
    cv.onpointerup = up; cv.onpointercancel = up;
    cv.oncontextmenu = e => e.preventDefault();
    const kd = e => {
      if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'm' && !e.repeat) { Sfx.toggle(); syncSnd(); return; }
      if (k === ' ' || k === 'shift') { e.preventDefault(); if (!e.repeat) dashQ = true; return; }
      if ('wasdjf'.includes(k) && k.length === 1 || k.startsWith('arrow')) { e.preventDefault(); keys[k] = true; }
    };
    const ku = e => { keys[e.key.toLowerCase()] = false; };
    const blur = () => { Object.keys(keys).forEach(k => keys[k] = false); firing = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    off = () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
    const db = el.querySelector('#dash'); if (db) db.onpointerdown = e => { e.preventDefault(); dashQ = true; };
  } else { const db = el.querySelector('#dash'); if (db) db.style.display = 'none'; }
  el.querySelector('#leave').onclick = () => send('leave');
  const again = el.querySelector('#again'); if (again) again.onclick = () => send('rematch');
  last = performance.now(); raf = requestAnimationFrame(frame);
}

function renderVote(el, s) {
  const box = el.querySelector('#vote'); if (!box || !s.vote) return;
  const key = JSON.stringify(s.vote.votes) + me; if (key === voteKey) return; voteKey = key;
  const v = s.vote.votes, mine = me >= 0 ? v[me] : null, voted = v.filter(x => x).length;
  box.innerHTML = `<h3>Głosowanie na następną mapę <span class="ar-vt" id="vt"></span></h3>
    <p class="lead" style="margin:2px 0 10px;font-size:.9rem">${me >= 0 ? 'Wybierz mapę – wygrywa ta z największą liczbą głosów, remis losuje. Zagłosowało ' + voted + '/' + v.length + '.' : 'Gracze głosują na następną mapę…'}</p>
    <div class="ar-maps">${M.list.map(([id, label]) => {
      const mm = M.get(id), who = v.map((x, i) => x === id ? `<i style="background:${COL[i]}" title="${esc(s.names[i])}"></i>` : '').join('');
      return `<button type="button" class="ar-map ${mine === id ? 'on' : ''}" data-m="${id}" ${me < 0 ? 'disabled' : ''}><b>${esc(label)}</b><small>${mm.big ? 'duża' : 'klasyczna'}${s.vote.cur === id ? ' · obecna' : ''}</small><span class="ar-dots">${who}</span></button>`;
    }).join('')}</div>`;
  box.querySelectorAll('.ar-map').forEach(b => b.onclick = () => { sfx('pick'); send('move', { type: 'vote', map: b.dataset.m }); });
}

function update(el, s) {
  renderVote(el, s);
  el.querySelector('#sc').innerHTML = s.team
    ? [0, 1].map(t => `<div class="chip" style="color:${TEAM_COL[t]}"><b>${s.teamKills[t]}</b><span>${TEAM_NAME[t]}: ${s.players.map((_, i) => i).filter(i => s.team[i] === t).map(i => esc(s.names[i]) + (i === me ? ' (ty)' : '')).join(' + ')}</span></div>`).join('')
    : s.players.map((p, i) => `<div class="chip" style="color:${COL[i]}">
    <b>${p.kills}</b><span>${esc(s.names[i])}${i === me ? ' (ty)' : ''}${s.wins[i] ? ' · 🏆' + s.wins[i] : ''}</span></div>`).join('');
  const st = el.querySelector('#st');
  if (s.phase === 'over') {
    if (s.team) {
      const mine = me >= 0 ? s.team[me] : -1, score = `${s.teamKills[s.winTeam]}:${s.teamKills[1 - s.winTeam]}`;
      st.innerHTML = mine === s.winTeam ? `🎉 Wygrywacie! ${score}` : `<span style="color:${TEAM_COL[s.winTeam]}">${TEAM_NAME[s.winTeam]}</span> wygrywają ${score}`;
    } else st.innerHTML = s.winner === me ? '🎉 Wygrywasz!' : `${esc(s.names[s.winner])} wygrywa ${s.players[s.winner].kills}:${s.players.filter((_, i) => i !== s.winner).reduce((m, p) => Math.max(m, p.kills), 0)}`;
  } else {
    const bits = [mp.icon + ' ' + mp.name, s.team ? `2 na 2 – pierwsza drużyna do ${s.kills} fragów` : `pierwszy do ${s.kills} fragów`];
    if (s.fog) bits.push('🔦 widzisz tylko przed sobą');
    if (mp.hasLava && me >= 0) bits.push('lawa parzy, kamienie są bezpieczne');
    st.textContent = bits.join(' · ');
  }
  el.querySelector('#hp').textContent = me >= 0 && s.phase === 'play'
    ? 'Ruch: WASD / strzałki · celowanie: myszka · strzał: lewy przycisk · unik: spacja lub prawy przycisk · dźwięk: M. Telefon: lewy kciuk – ruch, prawy – celuj i strzelaj.' + (s.events ? ' Co 30 s wydarzenie: boss, meteory, buffy – kto zada bossowi najwięcej obrażeń, zostaje legendą aż do śmierci.' : '') : '';
}

window.Games = window.Games || {};
Games.arena = {
  render(el, s, who, sendFn) {
    cur = s; me = who; send = sendFn; got = performance.now();
    mp = M.get(s.map);
    const key = `${s.round}-${s.phase === 'over' ? 'over' : 'play'}-${who}-${s.players.length}-${s.map}`;
    if (el.dataset.key !== key) { el.dataset.key = key; build(el, s); }
    s.fx.forEach(f => { if (f.id > lastFx) { lastFx = f.id; applyFx(f); } });
    s.players.forEach((p, i) => { // dźwięk strzału: licznik strzałów w stanie gracza się zwiększył
      if (shots[i] != null && p.sn !== shots[i] && !p.dead) sfx('shot', { w: p.w, vol: i === me ? 1 : 0.45 });
      shots[i] = p.sn;
    });
    update(el, s);
  }
};
})();
