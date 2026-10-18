(function () {
// Arena Lawy – wygląd i sterowanie po stronie przeglądarki. Całą grę liczy serwer (games/arena.js);
// tu tylko rysujemy (z wygładzaniem pozycji) i wysyłamy własne wejście: kierunek, celowanie, strzał, unik.
const AM = window.ArenaMap, W = AM.W, H = AM.H, T = AM.T, PR = 18;
let M = AM.get(); // aktualna mapa (ustawiana w build() z s.map)
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COL = ['#ffd166', '#4cc9f0', '#ff5d8f', '#7ee0a1'];   // kolory graczy (jak w reszcie strony)
const DARK = '#14132c';
const WN = { pistol: 'Pistolet', smg: 'Pistolet maszynowy', rifle: 'Karabin', revolver: 'Rewolwer', shotgun: 'Strzelba', minigun: 'Minigun', flame: 'Miotacz ognia', sniper: 'Snajperka', rocket: 'Wyrzutnia rakiet' };
const GUN = { pistol: [16, 6, '#c9c4e8'], smg: [24, 7, '#9fb4d9'], shotgun: [30, 9, '#c08a4a'], sniper: [44, 5, '#6b7c8c'], rocket: [34, 13, '#6f9a4f'],
  rifle: [34, 6, '#7d8f6a'], revolver: [20, 7, '#d4c27a'], minigun: [36, 12, '#555a66'], flame: [28, 10, '#d9622b'] }; // długość, grubość, kolor
const ITEM_COL = { health: '#ff4d6d', shield: '#4cc9f0', boost: '#ffd166' };
const DASH_CD = 2200;

let cur = null, me = -1, send = null, got = 0, raf = 0, off = null, last = 0;
let bg = null, shimmer = [], disp = [], parts = [], rings = [], beams = [], shots = [], lastFx = 0, shake = 0, P = null;
const keys = {}; const mouse = { x: W / 2, y: H / 2 };
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
function syncFs() { const b = document.getElementById('fs'); if (b) b.textContent = fsEl() ? '✕ Wyjdź z pełnego ekranu' : '⛶ Pełny ekran'; }
document.addEventListener('fullscreenchange', syncFs);
document.addEventListener('webkitfullscreenchange', syncFs);

function stop() { cancelAnimationFrame(raf); raf = 0; if (off) { off(); off = null; } }

// ---------- tło: ziemia, lawa, kamienie, głazy (rysowane raz do bufora) ----------
// paleta mapy: kolory z mapy, chyba że gracz wybrał własne w panelu 🎨
function makePalette() {
  const mx = window.Theme ? Theme.mix : (a => a), u = window.Theme ? Theme.arena() : {};
  const ground = u.ground || M.theme.ground, lava = u.lava || M.theme.lava, K = '#000000', Wh = '#ffffff';
  return {
    ground, dirt: [mx(ground, K, 0.1), mx(ground, Wh, 0.07), mx(ground, K, 0.03)], pebble: mx(ground, Wh, 0.14),
    cliff1: mx(ground, K, 0.58), cliff2: mx(ground, K, 0.42),
    lava: [lava, mx(lava, Wh, 0.03), mx(lava, '#ffff80', 0.08)], glow: mx(lava, '#ffff80', 0.45), ember: mx(lava, K, 0.2),
    stone1: mx(ground, K, 0.35), stone2: mx(ground, K, 0.0), stone3: mx(ground, Wh, 0.14)
  };
}
function makeBg() {
  P = makePalette();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  g.fillStyle = P.ground; g.fillRect(0, 0, W, H);
  const dirt = P.dirt;
  for (let i = 0; i < 900; i++) { g.fillStyle = dirt[i % 3]; const s = 6 + rnd() * 14; g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), s, s * 0.7); }
  for (let i = 0; i < 120; i++) { // kamyczki na ziemi
    const x = rnd() * W, y = rnd() * H; if (M.isLava(x, y)) continue; const r = 4 + rnd() * 9;
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(x + 2, y + r * 0.5, r, r * 0.6, 0, 0, 7); g.fill();
    g.fillStyle = P.pebble; g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, 7); g.fill();
  }
  const cols = Math.ceil(W / T), rows = Math.ceil(H / T);
  const L = (cx, cy) => cx >= 0 && cy >= 0 && cx < cols && cy < rows && M.isLava(cx * T + T / 2, cy * T + T / 2);
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
    if (!L(cx, cy - 1)) { g.fillStyle = P.cliff1; g.fillRect(x, y - 9, T, 9); g.fillStyle = P.glow; g.fillRect(x, y, T, 4); }
    if (!L(cx, cy + 1)) { g.fillStyle = P.cliff2; g.fillRect(x, y + T, T, 5); g.fillStyle = P.glow; g.fillRect(x, y + T - 4, T, 4); }
    if (!L(cx - 1, cy)) { g.fillStyle = P.cliff2; g.fillRect(x - 5, y, 5, T); g.fillStyle = P.glow; g.fillRect(x, y, 4, T); }
    if (!L(cx + 1, cy)) { g.fillStyle = P.cliff2; g.fillRect(x + T, y, 5, T); g.fillStyle = P.glow; g.fillRect(x + T - 4, y, 4, T); }
    if (((cx + cy) & 1) && (!L(cx, cy - 1) || !L(cx, cy + 1) || !L(cx - 1, cy) || !L(cx + 1, cy))) { g.fillStyle = P.ember; g.fillRect(x + 5, y + 5, 4, 4); }
  }
  M.stones.forEach(s => drawStone(g, s));
  M.boulders.forEach(b => drawBoulder(g, b));
  return c;
}
function drawStone(g, s) {
  const { x, y, r } = s;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y + r * 0.55, r * 1.05, r * 0.45, 0, 0, 7); g.fill();
  g.fillStyle = P.glow; g.beginPath(); g.ellipse(x, y + r * 0.35, r, r * 0.6, 0, 0, 7); g.fill();
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
  else if (f.type === 'beam') beams.push({ x: f.x, y: f.y, x2: f.x2, y2: f.y2, t: 0, life: 0.22 });
  else if (f.type === 'spark') burst(f.x, f.y, 5, ['#ffe9a0', '#ffffff', '#c9c4e8'], 260, 0.25, 3);
  else if (f.type === 'boom') { burst(f.x, f.y, 44, ['#ffd24a', '#ff7a1a', '#4a2a20', '#ff4d2d'], 440, 0.8, 6); rings.push({ x: f.x, y: f.y, t: 0, life: 0.35, max: (cur ? cur.rocketR : 95) + 20, col: '#ffd24a' }); shake = Math.max(shake, 12); sfx('boom'); }
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
  const inLava = M.isLava(x, y) && !M.onStone(x, y) && !p.dashing;
  g.save();
  if (p.inv && Math.floor(now / 90) % 2) g.globalAlpha = 0.45;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 3, y + PR - 2, PR, PR * 0.55, 0, 0, 7); g.fill();
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
  g.fillStyle = p.hp > 50 ? '#52d66b' : p.hp > 25 ? '#ffd166' : '#ff4d4d'; g.fillRect(bx, by, bw * p.hp / 100, 6);
  if (p.sh > 0) { g.fillStyle = '#4cc9f0'; g.fillRect(bx, by - 4, bw * p.sh / 50, 3); }
  g.font = '600 15px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillStyle = c;
  g.fillText(cur.names[i], x, by - (p.sh > 0 ? 9 : 6));
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

// ---------- tryb widoku: cała plansza / tylko przed sobą (głazy zasłaniają widok) ----------
const FOG_KEY = 'arena.widok';
const FOV_HALF = Math.PI / 4, FOV_RANGE = 900;   // pół kąta widzenia (łącznie 90°) i zasięg wzroku
let fogOn = false; try { fogOn = localStorage.getItem(FOG_KEY) === 'front'; } catch (e) { /* bez pamięci – widok pełny */ }
const normA = a => Math.atan2(Math.sin(a), Math.cos(a));
// Wielokąt widoczności: promienie w stożku przed graczem, każdy ucięty przez najbliższy głaz albo krawędź mapy.
function visPoly(x, y, a) {
  const angs = [];
  const N = 90; for (let i = 0; i <= N; i++) angs.push(a - FOV_HALF + 2 * FOV_HALF * i / N);
  M.boulders.forEach(b => { // dodatkowe promienie na krawędziach głazów, żeby cień miał ostre brzegi
    const dx = b.x - x, dy = b.y - y, dist = Math.hypot(dx, dy); if (dist <= b.r || dist > FOV_RANGE + b.r) return;
    const a0 = Math.atan2(dy, dx), ha = Math.asin(b.r / dist);
    [-ha, ha].forEach(h => [-0.0008, 0.0008].forEach(e => { const q = a0 + h + e; if (Math.abs(normA(q - a)) <= FOV_HALF) angs.push(a + normA(q - a)); }));
  });
  angs.sort((p, q) => p - q);
  const pts = [[x, y]];
  angs.forEach(q => {
    const cx = Math.cos(q), cy = Math.sin(q);
    let t = 1;
    for (const b of M.boulders) { if (Math.hypot(b.x - x, b.y - y) <= b.r) continue; const k = M.segCircle(x, y, x + cx * FOV_RANGE, y + cy * FOV_RANGE, b.x, b.y, b.r); if (k >= 0 && k < t) t = k; }
    const tx = cx > 0 ? (W - x) / cx / FOV_RANGE : cx < 0 ? -x / cx / FOV_RANGE : 9, ty = cy > 0 ? (H - y) / cy / FOV_RANGE : cy < 0 ? -y / cy / FOV_RANGE : 9;
    t = Math.max(0, Math.min(t, tx, ty));
    pts.push([x + cx * FOV_RANGE * t, y + cy * FOV_RANGE * t]);
  });
  return pts;
}
const fogActive = s => fogOn && me >= 0 && s.phase === 'play' && !s.players[me].dead && !!disp[me];
function syncFog() { const b = document.getElementById('fog'); if (b) b.textContent = fogOn ? '👁 Widok: tylko przed sobą' : '👁 Widok: cała plansza'; }
function syncSnd() { const b = document.getElementById('snd'); if (b && window.Sfx) b.textContent = Sfx.isMuted() ? '🔇 Dźwięk: wył.' : '🔊 Dźwięk: wł.'; }
window.addEventListener('themechange', () => { if (bg && cur) bg = makeBg(); });
function toggleFog() { fogOn = !fogOn; try { localStorage.setItem(FOG_KEY, fogOn ? 'front' : 'all'); } catch (e) { /* trudno */ } syncFog(); }

// laser snajperki widoczny dla wszystkich – można zdążyć uciec
function laser(g, x, y, a, mine) {
  const cx = Math.cos(a), cy = Math.sin(a), L = 2400;
  let t = 1;
  for (const b of M.boulders) { const k = M.segCircle(x, y, x + cx * L, y + cy * L, b.x, b.y, b.r); if (k >= 0 && k < t) t = k; }
  const tx = cx > 0 ? (W - x) / cx / L : cx < 0 ? -x / cx / L : 9, ty = cy > 0 ? (H - y) / cy / L : cy < 0 ? -y / cy / L : 9;
  t = Math.min(t, tx, ty);
  const sx = x + cx * 30, sy = y + cy * 30, ex = x + cx * L * t, ey = y + cy * L * t;
  g.strokeStyle = mine ? 'rgba(255,40,40,.9)' : 'rgba(255,40,40,.65)'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
  g.fillStyle = '#ff2828'; g.fillRect(Math.round(ex) - 3, Math.round(ey) - 3, 6, 6);
}

function drawHud(g, s, now) {
  const n = s.players.length, sw = 340, x0 = (W - n * sw) / 2 + 10;
  s.players.forEach((p, i) => {
    const x = x0 + i * sw, y = 16, c = COL[i];
    g.globalAlpha = p.dead ? 0.5 : 1;
    g.fillStyle = 'rgba(20,19,44,.5)'; g.fillRect(x - 8, y - 8, sw - 22, 108);
    g.fillStyle = DARK; g.fillRect(x, y, 56, 56); g.fillStyle = c; g.fillRect(x + 4, y + 4, 48, 48);
    g.fillStyle = '#fff'; g.fillRect(x + 12, y + 18, 11, 13); g.fillRect(x + 32, y + 18, 11, 13); g.fillStyle = DARK; g.fillRect(x + 16, y + 22, 6, 7); g.fillRect(x + 36, y + 22, 6, 7);
    const bx = x + 70, by = y + 24, bw = 200, bh = 26;
    g.font = '600 18px Fredoka, sans-serif'; g.textAlign = 'left'; g.fillStyle = c; g.fillText(s.names[i] + (i === me ? ' (ty)' : ''), bx, y + 14);
    g.fillStyle = DARK; g.fillRect(bx - 3, by - 3, bw + 6, bh + 6); g.fillStyle = '#2a1410'; g.fillRect(bx, by, bw, bh);
    g.fillStyle = p.hp > 50 ? '#35d44f' : p.hp > 25 ? '#ffd166' : '#ff4d4d'; g.fillRect(bx, by, bw * p.hp / 100, bh);
    if (p.sh > 0) { g.fillStyle = '#4cc9f0'; g.fillRect(bx, by + bh - 8, bw * p.sh / 100, 8); }
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(bx, by, bw * p.hp / 100, 5);
    g.font = '700 34px Fredoka, sans-serif'; g.fillStyle = '#f4f2ff'; g.fillText(`${p.kills} / ${s.kills}`, bx, y + 88);
    g.font = '500 17px Fredoka, sans-serif'; g.textAlign = 'right'; g.fillStyle = '#cbbfe6';
    g.fillText(WN[p.w] + (p.ammo >= 0 ? ' · ' + p.ammo : ''), bx + bw, y + 86);
    g.globalAlpha = 1;
  });
  if (me >= 0) { // pasek uniku
    const p = s.players[me], cd = Math.max(0, p.dashCd - (now - got)), r = 1 - cd / DASH_CD;
    g.fillStyle = 'rgba(20,19,44,.7)'; g.fillRect(W / 2 - 100, H - 46, 200, 28);
    g.fillStyle = r >= 1 ? '#7ee0a1' : '#a9a5d6'; g.fillRect(W / 2 - 96, H - 42, 192 * r, 20);
    g.font = '600 16px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillStyle = DARK; g.fillText(r >= 1 ? 'UNIK GOTOWY (spacja)' : 'unik…', W / 2, H - 27);
  }
}
function drawFeed(g, s) {
  g.font = '600 20px Fredoka, sans-serif'; g.textAlign = 'right';
  s.feed.slice(-5).forEach((f, i) => {
    const y = 150 + i * 30, v = s.names[f.v] || '?', k = f.k != null ? s.names[f.k] : null;
    const wn = f.w === 'lava' ? 'lawa' : (WN[f.w] || f.w);
    const parts2 = k != null && f.w !== 'lava' ? [[v, COL[f.v]], [' ✖ ', '#a9a5d6'], [k, COL[f.k]], [` (${wn})`, '#a9a5d6']] : k != null ? [[v, COL[f.v]], [' spalony – lawa + ', '#a9a5d6'], [k, COL[f.k]]] : [[v, COL[f.v]], [' wpadł w lawę', '#a9a5d6']];
    const tw = parts2.reduce((a, [t]) => a + g.measureText(t).width, 0);
    g.fillStyle = 'rgba(20,19,44,.55)'; g.fillRect(W - 24 - tw - 12, y - 22, tw + 24, 30);
    let x = W - 24; g.textAlign = 'right';
    for (let j = parts2.length - 1; j >= 0; j--) { g.fillStyle = parts2[j][1]; g.fillText(parts2[j][0], x, y); x -= g.measureText(parts2[j][0]).width; }
  });
}

function draw(g, s, now, dt) {
  g.imageSmoothingEnabled = false;
  g.save();
  shake *= Math.exp(-9 * dt);
  if (shake > 0.3) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  const fog = fogActive(s);
  g.drawImage(bg, 0, 0);
  if (fog) { // poza stożkiem widzenia plansza jest ciemna i nic na niej nie widać
    g.fillStyle = 'rgba(8,6,24,.9)'; g.fillRect(0, 0, W, H);
    const d0 = disp[me], poly = visPoly(d0.x, d0.y, d0.a);
    g.save(); g.beginPath(); poly.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); g.clip();
    g.drawImage(bg, 0, 0);
  }
  const pulse = now / 400;
  g.fillStyle = '#ffe27a';
  shimmer.forEach(sh => { g.globalAlpha = 0.12 + 0.14 * Math.sin(pulse + sh.p); g.fillRect(sh.x, sh.y, 8, 8); }); g.globalAlpha = 1;

  s.items.forEach(it => drawItem(g, it, now));
  s.players.forEach((p, i) => { if (!p.dead && p.w === 'sniper') laser(g, disp[i].x, disp[i].y, disp[i].a, i === me); });
  s.players.forEach((p, i) => {
    if (p.dead) return;
    const d = disp[i];
    if (p.dashing) burst(d.x, d.y, 1, ['#ffffff'], 40, 0.25, 8);
    if (M.isLava(d.x, d.y) && !M.onStone(d.x, d.y) && !p.dashing && Math.random() < 0.5) burst(d.x, d.y + 8, 1, ['#ffb02e', '#ff5d3a'], 120, 0.5, 4);
    drawPlayer(g, p, i, d, now);
  });
  s.bullets.forEach(b => drawBullet(g, b, now));
  for (let i = beams.length - 1; i >= 0; i--) { // ślad strzału z snajperki (trafia natychmiast, ślad tylko gaśnie)
    const b = beams[i]; b.t += dt; if (b.t >= b.life) { beams.splice(i, 1); continue; }
    const a = 1 - b.t / b.life;
    g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 3 + 3 * a; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x2, b.y2); g.stroke();
    g.strokeStyle = `rgba(120,200,255,${a * 0.6})`; g.lineWidth = 9 * a; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x2, b.y2); g.stroke();
  }

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
  if (fog) { // własna postać zawsze widoczna, nawet poza stożkiem
    g.restore();
    if (!s.players[me].dead) drawPlayer(g, s.players[me], me, disp[me], now);
  }
  g.restore();

  drawHud(g, s, now); drawFeed(g, s);
  g.textAlign = 'center';
  const go = s.goMs - (now - got);
  if (s.phase === 'play' && go > 0) {
    g.fillStyle = 'rgba(20,19,44,.55)'; g.fillRect(0, H / 2 - 110, W, 200);
    g.fillStyle = '#f4f2ff'; g.font = '700 110px Fredoka, sans-serif'; g.fillText(String(Math.ceil(go / 1000)), W / 2, H / 2 + 20);
    g.font = '600 30px Fredoka, sans-serif'; g.fillStyle = '#a9a5d6'; g.fillText(me >= 0 ? 'Przygotuj się… unikaj lawy, zbieraj bronie!' : 'Walka zaraz się zacznie', W / 2, H / 2 + 65);
    g.font = '600 24px Fredoka, sans-serif'; g.fillStyle = '#ffd166'; g.fillText('🗺 Mapa: ' + s.mapName, W / 2, H / 2 - 82);
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
  let aim = Math.atan2(mouse.y - d.y, mouse.x - d.x);
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
    const d = disp[i] || (disp[i] = { x: p.x, y: p.y, a: p.a });
    if (Math.hypot(p.x - d.x, p.y - d.y) > 150 || p.dead) { d.x = p.x; d.y = p.y; } else { d.x += (p.x - d.x) * k; d.y += (p.y - d.y) * k; }
    if (i === me && s.phase === 'play' && !p.dead) d.a = aimA; // własne celowanie bez opóźnienia
    else { let da = p.a - d.a; da = Math.atan2(Math.sin(da), Math.cos(da)); d.a += da * ka; }
  });
  s.players.forEach((p, i) => { // dźwięk strzału: licznik strzałów w stanie gracza się zwiększył
    if (shots[i] != null && p.sn !== shots[i] && !p.dead) sfx('shot', { w: p.w, vol: i === me ? 1 : 0.45 });
    shots[i] = p.sn;
  });
  draw(g, s, now, dt);
  raf = requestAnimationFrame(frame);
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
  M = AM.get(s.map); beams = []; shots = s.players.map(p => p.sn);
  const over = s.phase === 'over';
  el.innerHTML = `<div class="bar"><div class="score" id="sc"></div></div>
    <div class="status" id="st" aria-live="polite"></div>
    <canvas id="arena" class="arena" width="${W}" height="${H}" aria-label="Plansza Areny Lawy"></canvas>
    <p class="lead pong-help" id="hp" style="text-align:center;margin:10px auto 0;font-size:.9rem;max-width:none"></p>
    <div class="actions">${over ? '<button id="again">Jeszcze raz</button>' : '<button class="ghost" id="dash" type="button">💨 Unik</button>'}${me >= 0 && !over ? '<button class="ghost" id="fog" type="button"></button>' : ''}${fsOk() ? '<button class="ghost" id="fs" type="button">⛶ Pełny ekran</button>' : ''}<button class="ghost" id="snd" type="button"></button><button class="ghost" id="leave">Wyjdź</button></div>
    ${me >= 0 ? xhPanel() : ''}`;
  const cv = el.querySelector('#arena');
  syncFs(); syncFog(); syncSnd();
  el.querySelector('#snd').onclick = () => { Sfx.toggle(); syncSnd(); };
  const fgb = el.querySelector('#fog'); if (fgb) fgb.onclick = () => toggleFog();
  const fb = el.querySelector('#fs'); if (fb) fb.onclick = () => toggleFs(el);
  if (me >= 0) bindXh(el, cv, over);
  bg = makeBg(); parts = []; rings = []; shake = 0; touches.clear();
  Object.keys(keys).forEach(k => delete keys[k]); firing = dashQ = false; lastKey = ''; sentAt = 0;
  disp = s.players.map(p => ({ x: p.x, y: p.y, a: p.a })); aimA = me >= 0 ? s.players[me].a : 0;
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
      if (k === 'v' && !e.repeat) { toggleFog(); return; }
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

function update(el, s) {
  el.querySelector('#sc').innerHTML = s.players.map((p, i) => `<div class="chip" style="color:${COL[i]}">
    <b>${p.kills}</b><span>${esc(s.names[i])}${i === me ? ' (ty)' : ''}${s.wins[i] ? ' · 🏆' + s.wins[i] : ''}</span></div>`).join('');
  const st = el.querySelector('#st');
  if (s.phase === 'over') st.innerHTML = s.winner === me ? '🎉 Wygrywasz!' : `${esc(s.names[s.winner])} wygrywa ${s.players[s.winner].kills}:${s.players.filter((_, i) => i !== s.winner).reduce((m, p) => Math.max(m, p.kills), 0)}`;
  else st.textContent = me < 0 ? `Mapa: ${s.mapName} · pierwszy do ${s.kills} fragów` : `Mapa: ${esc(s.mapName)} · pierwszy do ${s.kills} fragów · lawa parzy, kamienie są bezpieczne`;
  el.querySelector('#hp').textContent = me >= 0 && s.phase === 'play'
    ? 'Ruch: WASD / strzałki · celowanie: myszka · strzał: lewy przycisk · unik: spacja lub prawy przycisk · widok: V (cała plansza / tylko przed sobą – głazy zasłaniają widok) · dźwięk: M. Telefon: lewy kciuk – ruch, prawy – celuj i strzelaj.' : '';
}

window.Games = window.Games || {};
Games.arena = {
  render(el, s, who, sendFn) {
    cur = s; me = who; send = sendFn; got = performance.now();
    const key = `${s.round}-${s.map}-${s.phase === 'over' ? 'over' : 'play'}-${who}-${s.players.length}`;
    if (el.dataset.key !== key) { el.dataset.key = key; build(el, s); }
    s.fx.forEach(f => { if (f.id > lastFx) { lastFx = f.id; applyFx(f); } });
    update(el, s);
  }
};
})();
