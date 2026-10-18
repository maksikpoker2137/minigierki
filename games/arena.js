// Arena Lawy – strzelanka z góry dla 2–4 graczy. Gra na żywo: serwer symuluje wszystko (step() ~30x/s, patrz server.js).
// Klient wysyła tylko swoje wejście (kierunek, celowanie, strzał) i prośbę o unik, więc nie da się oszukiwać pozycją.
// Mapa (lawa, kamienie, głazy) jest we wspólnym pliku public/games/arena-map.js.
const AM = require('../public/games/arena-map.js'); // zestaw map; konkretną mapę trzyma stan gry (s.M)
const { W, H } = AM;

const KILLS = 5;                       // do ilu fragów gramy
const PR = 18;                         // promień gracza
const SPEED = 235, BOOST_MUL = 1.4;    // prędkość biegu i mnożnik po wzmocnieniu
const DASH_SPEED = 720, DASH_MS = 170, DASH_CD = 2200; // unik: krótki zryw, w trakcie którego lawa nie parzy
const LAVA_DPS = 32;                   // obrażenia od lawy na sekundę
const RESPAWN_MS = 3000, INV_MS = 2000, START_MS = 3000;
const ITEM_EVERY = 5000, MAX_ITEMS = 8, BOOST_MS = 6000, ROCKET_R = 95;

// ammo: -1 = bez limitu. spread = szerokość stożka rozrzutu w radianach.
const WEAPONS = {
  pistol:   { dmg: 14, rate: 280,  speed: 950,  range: 760,  spread: 0.03, pellets: 1, ammo: -1 },
  smg:      { dmg: 8,  rate: 85,   speed: 1000, range: 640,  spread: 0.10, pellets: 1, ammo: 45 },
  rifle:    { dmg: 11, rate: 120,  speed: 1150, range: 900,  spread: 0.045, pellets: 1, ammo: 36 },
  revolver: { dmg: 42, rate: 620,  speed: 1400, range: 950,  spread: 0.01, pellets: 1, ammo: 10 },
  shotgun:  { dmg: 9,  rate: 750,  speed: 900,  range: 430,  spread: 0.50, pellets: 7, ammo: 8 },
  minigun:  { dmg: 5,  rate: 45,   speed: 1050, range: 620,  spread: 0.20, pellets: 1, ammo: 140 },
  flame:    { dmg: 4,  rate: 40,   speed: 520,  range: 240,  spread: 0.40, pellets: 1, ammo: 110 },
  sniper:   { dmg: 70, rate: 1300, speed: 0,    range: 2100, spread: 0,    pellets: 1, ammo: 5, hitscan: true }, // trafia natychmiast, bez lotu pocisku
  rocket:   { dmg: 0,  rate: 1100, speed: 560,  range: 1100, spread: 0.02, pellets: 1, ammo: 4 }
};
const LOOT = [['smg', 14], ['rifle', 14], ['revolver', 12], ['shotgun', 14], ['minigun', 8], ['flame', 8], ['sniper', 10], ['rocket', 10], ['health', 14], ['shield', 10], ['boost', 8]];

const r1 = v => Math.round(v * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

// losowa mapa na rundę – inna niż poprzednia
function pickMap(prev) {
  const ids = AM.ids.filter(id => id !== prev);
  return AM.get(ids[Math.floor(Math.random() * ids.length)]);
}
function pickLoot() {
  let x = Math.random() * LOOT.reduce((s, l) => s + l[1], 0);
  for (const [t, w] of LOOT) { if ((x -= w) < 0) return t; }
  return 'smg';
}
function fx(s, type, x, y, extra) { s.fx.push(Object.assign({ id: ++s.nid, t: Date.now(), type, x: r1(x), y: r1(y) }, extra)); }

function newPlayer(i, M) {
  const sp = M.spawns[i];
  return {
    x: sp[0], y: sp[1], aim: Math.atan2(H / 2 - sp[1], W / 2 - sp[0]), vx: 0, vy: 0, kx: 0, ky: 0,
    hp: 100, sh: 0, w: 'pistol', ammo: -1, dead: false, respawnAt: 0, inv: 0, boostUntil: 0,
    nextShot: 0, lastShot: 0, dashUntil: 0, dashReady: 0, dvx: 0, dvy: 0,
    kills: 0, deaths: 0, lastBy: null, lastAt: 0, shots: 0
  };
}

function freeSpot(s) {
  const M = s.M;
  const spots = M.itemSpots.slice().sort(() => Math.random() - 0.5);
  return spots.find(p => !s.items.some(it => Math.hypot(it.x - p.x, it.y - p.y) < 40));
}
function spawnItem(s, type) {
  const p = freeSpot(s); if (!p) return;
  s.items.push({ id: ++s.nid, type: type || pickLoot(), x: p.x, y: p.y });
}

function create(names, wins, round, prevMap) {
  const now = Date.now(), M = pickMap(prevMap);
  const s = {
    M, names, wins, round, phase: 'play', winner: null, startAt: now + START_MS, nextItemAt: now + 1500,
    players: names.map((_, i) => newPlayer(i, M)),
    inputs: names.map(() => ({ dx: 0, dy: 0, aim: 0, fire: false })),
    bullets: [], items: [], fx: [], feed: [], nid: 0
  };
  s.players.forEach((p, i) => { s.inputs[i].aim = p.aim; });
  ['smg', 'shotgun', 'health', undefined].forEach(t => spawnItem(s, t)); // na start kilka przedmiotów na mapie
  return s;
}

function damage(s, i, amt, by, weapon, now, ignoreShield) {
  const p = s.players[i];
  if (p.dead || p.inv > now || s.phase !== 'play') return;
  if (!ignoreShield && p.sh > 0) { const a = Math.min(p.sh, amt); p.sh -= a; amt -= a; }
  p.hp -= amt;
  if (by != null && by !== i) { p.lastBy = by; p.lastAt = now; }
  if (p.hp <= 0) die(s, i, by, weapon, now);
}

function die(s, i, by, weapon, now) {
  const M = s.M, p = s.players[i];
  p.dead = true; p.hp = 0; p.sh = 0; p.respawnAt = now + RESPAWN_MS; p.deaths++; p.vx = p.vy = p.kx = p.ky = 0;
  const killer = by != null && by !== i ? by : (now - p.lastAt < 4000 && p.lastBy != null ? p.lastBy : null); // wpadł w lawę po czyimś strzale = fragment dla strzelca
  fx(s, 'death', p.x, p.y, { v: i, k: killer });
  s.feed.push({ id: ++s.nid, t: now, k: killer, v: i, w: killer == null || by == null ? (weapon || 'lava') : weapon });
  if (s.feed.length > 6) s.feed.shift();
  if (p.w !== 'pistol' && s.items.length < 12 && (!M.isLava(p.x, p.y) || M.onStone(p.x, p.y))) s.items.push({ id: ++s.nid, type: p.w, x: p.x, y: p.y }); // broń wypada na ziemię
  p.w = 'pistol'; p.ammo = -1;
  if (killer != null) {
    const k = s.players[killer]; k.kills++;
    if (k.kills >= KILLS) { s.phase = 'over'; s.winner = killer; s.wins[killer]++; }
  }
}

function explode(s, b, x, y, now) {
  fx(s, 'boom', x, y);
  s.players.forEach((p, j) => {
    if (p.dead) return;
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
    if (d > ROCKET_R + PR) return;
    let dmg = 65 * (1 - 0.6 * Math.min(1, d / ROCKET_R));
    if (j === b.o) dmg *= 0.5; // własna rakieta boli mniej
    if (p.inv <= now) { const n = d || 1; p.kx += dx / n * 420; p.ky += dy / n * 420; } // odrzut – można wylądować w lawie
    damage(s, j, dmg, b.o >= 0 ? b.o : null, 'rocket', now);
  });
}

function respawn(s, i, now) {
  const M = s.M, p = s.players[i];
  const alive = s.players.filter((q, j) => j !== i && !q.dead);
  let best = M.spawns[0], bd = -1;
  for (const sp of M.spawns) {
    const d = alive.length ? Math.min(...alive.map(q => Math.hypot(q.x - sp[0], q.y - sp[1]))) : 0;
    if (d + Math.random() * 60 > bd) { bd = d + Math.random() * 60; best = sp; }
  }
  Object.assign(p, { x: best[0], y: best[1], hp: 100, sh: 0, w: 'pistol', ammo: -1, dead: false, inv: now + INV_MS, boostUntil: 0, dashUntil: 0, kx: 0, ky: 0, vx: 0, vy: 0 });
  fx(s, 'spawn', p.x, p.y, { v: i });
}

// snajperka: promień trafia od razu pierwszy obiekt na linii strzału (głaz albo gracz)
function hitscan(s, i, w, now) {
  const M = s.M, p = s.players[i], cx = Math.cos(p.aim), cy = Math.sin(p.aim), ex = p.x + cx * w.range, ey = p.y + cy * w.range;
  let bestT = 1, hit = null;
  for (const bo of M.boulders) { const t = M.segCircle(p.x, p.y, ex, ey, bo.x, bo.y, bo.r); if (t >= 0 && t < bestT) { bestT = t; hit = { wall: true }; } }
  s.players.forEach((q, j) => {
    if (j === i || q.dead || q.inv > now) return;
    const t = M.segCircle(p.x, p.y, ex, ey, q.x, q.y, PR); if (t >= 0 && t < bestT) { bestT = t; hit = { p: j }; }
  });
  let hx = p.x + (ex - p.x) * bestT, hy = p.y + (ey - p.y) * bestT;
  hx = clamp(hx, 0, W); hy = clamp(hy, 0, H);
  fx(s, 'beam', p.x, p.y, { x2: r1(hx), y2: r1(hy), v: i });
  if (hit && hit.p != null) { fx(s, 'hit', hx, hy, { v: hit.p, o: i }); damage(s, hit.p, w.dmg, i, p.w, now); }
  else if (hit) fx(s, 'spark', hx, hy);
}

function shoot(s, i, now) {
  const p = s.players[i], w = WEAPONS[p.w];
  p.nextShot = now + w.rate; p.lastShot = now; p.shots++;
  if (w.hitscan) hitscan(s, i, w, now);
  else for (let k = 0; k < w.pellets; k++) {
    const a = p.aim + (Math.random() - 0.5) * w.spread, sp = w.speed * (w.pellets > 1 ? rnd(0.92, 1.08) : 1);
    s.bullets.push({ id: ++s.nid, o: i, w: p.w, x: p.x + Math.cos(p.aim) * 10, y: p.y + Math.sin(p.aim) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: w.dmg, left: w.range });
  }
  if (w.ammo >= 0 && --p.ammo <= 0) { p.w = 'pistol'; p.ammo = -1; }
}

module.exports = {
  meta: { id: 'arena', name: 'Arena Lawy', icon: '🔫', desc: 'Strzelanka z góry: 6 map (co rundę inna), lawa, bronie i power-upy. Kto pierwszy do 5 fragów?', min: 2, max: 4 },

  init: players => create(players.map(p => p.name), players.map(() => 0), 0),

  move(s, me, d) {
    const p = s.players[me], now = Date.now();
    if (s.phase !== 'play') return s;
    if (d.type === 'in') {
      let dx = +d.dx, dy = +d.dy; const aim = +d.aim;
      if (![dx, dy, aim].every(isFinite)) return { error: 'Nieznany ruch.' };
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      s.inputs[me] = { dx, dy, aim, fire: !!d.fire };
      return s;
    }
    if (d.type === 'dash') {
      if (p.dead || now < s.startAt || now < p.dashReady) return s;
      const inp = s.inputs[me], l = Math.hypot(inp.dx, inp.dy);
      p.dvx = l > 0.1 ? inp.dx / l : Math.cos(p.aim); p.dvy = l > 0.1 ? inp.dy / l : Math.sin(p.aim);
      p.dashUntil = now + DASH_MS; p.dashReady = now + DASH_CD;
      fx(s, 'dash', p.x, p.y, { v: me });
      return s;
    }
    return { error: 'Nieznany ruch.' };
  },

  // zwraca true, gdy stan się zmienił i trzeba go wysłać
  step(s, dt) {
    if (s.phase !== 'play') return false;
    const M = s.M, now = Date.now();
    if (now < s.startAt) return true; // odliczanie do startu

    // --- gracze ---
    s.players.forEach((p, i) => {
      if (p.dead) { if (now >= p.respawnAt) respawn(s, i, now); return; }
      const inp = s.inputs[i], dashing = p.dashUntil > now;
      let vx, vy;
      if (dashing) { vx = p.dvx * DASH_SPEED; vy = p.dvy * DASH_SPEED; }
      else { const sp = SPEED * (p.boostUntil > now ? BOOST_MUL : 1); vx = inp.dx * sp; vy = inp.dy * sp; }
      p.vx = vx; p.vy = vy; p.aim = inp.aim;
      p.x += (vx + p.kx) * dt; p.y += (vy + p.ky) * dt;
      const decay = Math.exp(-6 * dt); p.kx *= decay; p.ky *= decay;
      for (const b of M.boulders) { // głazy nie przepuszczają
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy), min = b.r + PR;
        if (d < min) { const n = d || 1; p.x = b.x + dx / n * min; p.y = b.y + dy / n * min; }
      }
      p.x = clamp(p.x, PR, W - PR); p.y = clamp(p.y, PR, H - PR);
      if (!dashing && M.isLava(p.x, p.y) && !M.onStone(p.x, p.y)) damage(s, i, LAVA_DPS * dt, null, 'lava', now, true);
      if (p.dead) return;
      if (inp.fire && now >= p.nextShot) shoot(s, i, now);

      // zbieranie przedmiotów
      for (let k = s.items.length - 1; k >= 0; k--) {
        const it = s.items[k];
        if (Math.hypot(it.x - p.x, it.y - p.y) > PR + 14) continue;
        if (WEAPONS[it.type]) { p.w = it.type; p.ammo = WEAPONS[it.type].ammo; }
        else if (it.type === 'health') { if (p.hp >= 100) continue; p.hp = Math.min(100, p.hp + 40); }
        else if (it.type === 'shield') { if (p.sh >= 50) continue; p.sh = Math.min(50, p.sh + 50); }
        else if (it.type === 'boost') p.boostUntil = now + BOOST_MS;
        fx(s, 'pick', it.x, it.y, { v: i, item: it.type });
        s.items.splice(k, 1);
      }
    });

    // --- nowe przedmioty ---
    if (now >= s.nextItemAt) { s.nextItemAt = now + ITEM_EVERY; if (s.items.length < MAX_ITEMS) spawnItem(s); }

    // --- pociski (sprawdzamy cały odcinek ruchu, żeby szybki pocisk nie przeleciał przez gracza) ---
    for (const b of s.bullets) {
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      let bestT = 2, hit = null;
      for (const bo of M.boulders) { const t = M.segCircle(b.x, b.y, nx, ny, bo.x, bo.y, bo.r); if (t >= 0 && t < bestT) { bestT = t; hit = { wall: true }; } }
      s.players.forEach((p, j) => {
        if (j === b.o || p.dead || p.inv > now) return;
        const t = M.segCircle(b.x, b.y, nx, ny, p.x, p.y, PR); if (t >= 0 && t < bestT) { bestT = t; hit = { p: j }; }
      });
      if (hit) {
        const hx = b.x + (nx - b.x) * bestT, hy = b.y + (ny - b.y) * bestT;
        if (b.w === 'rocket') explode(s, b, hx, hy, now);
        else if (hit.p != null) { fx(s, 'hit', hx, hy, { v: hit.p, o: b.o }); damage(s, hit.p, b.dmg, b.o >= 0 ? b.o : null, b.w, now); }
        else fx(s, 'spark', hx, hy);
        b.dead = true; continue;
      }
      b.x = nx; b.y = ny; b.left -= Math.hypot(b.vx, b.vy) * dt;
      if (b.left <= 0 || nx < 0 || ny < 0 || nx > W || ny > H) { if (b.w === 'rocket') explode(s, b, clamp(nx, 0, W), clamp(ny, 0, H), now); b.dead = true; }
    }
    s.bullets = s.bullets.filter(b => !b.dead);
    s.fx = s.fx.filter(f => now - f.t < 700);
    return true;
  },

  view(s) {
    const now = Date.now();
    return {
      names: s.names, wins: s.wins, round: s.round, map: s.M.id, mapName: s.M.name, phase: s.phase, winner: s.winner, kills: KILLS, rocketR: ROCKET_R,
      goMs: Math.max(0, s.startAt - now),
      players: s.players.map(p => ({
        x: r1(p.x), y: r1(p.y), a: Math.round(p.aim * 100) / 100, vx: Math.round(p.vx), vy: Math.round(p.vy),
        hp: Math.max(0, Math.round(p.hp)), sh: Math.round(p.sh), w: p.w, ammo: p.ammo, dead: p.dead,
        respawnMs: p.dead ? Math.max(0, p.respawnAt - now) : 0, inv: p.inv > now, boost: p.boostUntil > now,
        dashing: p.dashUntil > now, dashCd: Math.max(0, p.dashReady - now), fired: now - p.lastShot < 90,
        kills: p.kills, deaths: p.deaths, sn: p.shots
      })),
      bullets: s.bullets.map(b => ({ id: b.id, x: r1(b.x), y: r1(b.y), vx: Math.round(b.vx), vy: Math.round(b.vy), w: b.w, l: Math.round(b.left) })),
      items: s.items.map(it => ({ id: it.id, type: it.type, x: it.x, y: it.y })),
      fx: s.fx, feed: s.feed.filter(f => now - f.t < 6000).map(f => ({ id: f.id, k: f.k, v: f.v, w: f.w }))
    };
  },

  rematch(s) { return s.phase === 'over' ? create(s.names, s.wins, s.round + 1, s.M.id) : s; },

  // ktoś wyszedł w trakcie gry: usuwamy go i gramy dalej, jeśli zostało ≥2 graczy
  onLeave(s, idx) {
    ['names', 'wins', 'players', 'inputs'].forEach(k => s[k].splice(idx, 1));
    if (s.players.length < 2) return null;
    const re = o => (o == null || o === idx ? null : o > idx ? o - 1 : o);
    s.bullets.forEach(b => { const o = re(b.o); b.o = o == null ? -1 : o; });
    s.players.forEach(p => { p.lastBy = re(p.lastBy); });
    s.winner = re(s.winner); s.feed = [];
    return s;
  }
};
