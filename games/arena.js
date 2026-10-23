// Arena Lawy – strzelanka z góry dla 2–4 graczy. Gra na żywo: serwer symuluje wszystko (step() ~30x/s, patrz server.js).
// Klient wysyła tylko swoje wejście (kierunek, celowanie, strzał) i prośbę o unik, więc nie da się oszukiwać pozycją.
// Mapa (lawa, kamienie, głazy) jest we wspólnym pliku public/games/arena-map.js.
const M = require('../public/games/arena-map.js');

const KILLS = 5, TEAM_KILLS = 10;      // do ilu fragów gramy (solo / 2v2 – liczą się fragi drużyny)
const PR = 18;                         // promień gracza
const SPEED = 235, BOOST_MUL = 1.4;    // prędkość biegu i mnożnik po wzmocnieniu
const DASH_SPEED = 720, DASH_MS = 170, DASH_CD = 2200; // unik: krótki zryw, w trakcie którego lawa nie parzy
const LAVA_DPS = 32;                   // obrażenia od lawy na sekundę
const RESPAWN_MS = 3000, INV_MS = 2000, START_MS = 3000;
const VOTE_MS = 20000;                 // ile trwa głosowanie na następną mapę po wygranej
const ITEM_EVERY = 5000, MAX_ITEMS = 8, BOOST_MS = 6000, ROCKET_R = 95;
const EVENT_EVERY = 30000;             // co ile ms rusza nowe wydarzenie (boss, meteory, buffy…)
const BOSS_R = 38, BOSS_MS = 28000, BOSS_LEGEND_MAX = 3;
const FOG_R = 400, FOG_NEAR = 60, FOG_HALF = Math.PI / 4, FOG_TOL = 0.14; // tryb stożka: zasięg, mały krąg wokół gracza, pół kąta (90° razem), zapas na opóźnienie celowania

// ammo: -1 = bez limitu. spread = szerokość stożka rozrzutu w radianach.
const WEAPONS = {
  pistol:  { dmg: 14, rate: 280,  speed: 950,  range: 760,  spread: 0.03, pellets: 1, ammo: -1 },
  smg:     { dmg: 8,  rate: 85,   speed: 1000, range: 640,  spread: 0.10, pellets: 1, ammo: 45 },
  rifle:   { dmg: 11, rate: 120,  speed: 1150, range: 900,  spread: 0.045, pellets: 1, ammo: 36 },
  revolver:{ dmg: 42, rate: 620,  speed: 1400, range: 950,  spread: 0.01, pellets: 1, ammo: 10 },
  shotgun: { dmg: 9,  rate: 750,  speed: 900,  range: 430,  spread: 0.50, pellets: 7, ammo: 8 },
  minigun: { dmg: 5,  rate: 45,   speed: 1050, range: 620,  spread: 0.20, pellets: 1, ammo: 140 },
  flame:   { dmg: 4,  rate: 40,   speed: 520,  range: 240,  spread: 0.40, pellets: 1, ammo: 110 },
  sniper:  { dmg: 70, rate: 1300, speed: 2400, range: 2100, spread: 0,    pellets: 1, ammo: 5 },
  rocket:  { dmg: 0,  rate: 1100, speed: 560,  range: 1100, spread: 0.02, pellets: 1, ammo: 4 }
};
const LOOT = [['smg', 14], ['rifle', 14], ['revolver', 12], ['shotgun', 14], ['minigun', 8], ['flame', 8], ['sniper', 10], ['rocket', 10], ['health', 14], ['shield', 10], ['boost', 8], ['rage', 7]];
const EVENTS = [['boss', 30], ['meteors', 20], ['frenzy', 14], ['haste', 12], ['airdrop', 14], ['heal', 10]]; // typ, waga losowania

const r1 = v => Math.round(v * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

const isAlly = (s, a, b) => !!s.team && a >= 0 && b >= 0 && a !== b && s.team[a] === s.team[b];
const maxHp = p => 100 + 40 * p.lv;                                              // legenda (po bossie) = więcej życia
const dmgMul = (s, p, now) => Math.min(3, (1 + 0.25 * p.lv) * (s.frenzyUntil > now ? 2 : 1) * (p.rageUntil > now ? 2 : 1));
const speedMul = (s, p, now) => (p.boostUntil > now ? BOOST_MUL : 1) * (1 + 0.08 * p.lv) * (s.hasteUntil > now ? 1.35 : 1);

function pickLoot() {
  let x = Math.random() * LOOT.reduce((s, l) => s + l[1], 0);
  for (const [t, w] of LOOT) { if ((x -= w) < 0) return t; }
  return 'smg';
}
function fx(s, type, x, y, extra) { s.fx.push(Object.assign({ id: ++s.nid, t: Date.now(), type, x: r1(x), y: r1(y) }, extra)); }

function newPlayer(i, mp) {
  const sp = mp.spawns[i];
  return {
    x: sp[0], y: sp[1], aim: Math.atan2(mp.H / 2 - sp[1], mp.W / 2 - sp[0]), vx: 0, vy: 0, kx: 0, ky: 0,
    hp: 100, sh: 0, w: 'pistol', ammo: -1, dead: false, respawnAt: 0, inv: 0, boostUntil: 0,
    nextShot: 0, lastShot: 0, dashUntil: 0, dashReady: 0, dvx: 0, dvy: 0,
    kills: 0, deaths: 0, lastBy: null, lastAt: 0, lv: 0, rageUntil: 0, lastHurt: 0, shots: 0
  };
}

function freeSpot(s) {
  const spots = s.mp.itemSpots.slice().sort(() => Math.random() - 0.5);
  return spots.find(p => !s.items.some(it => Math.hypot(it.x - p.x, it.y - p.y) < 40));
}
function spawnItem(s, type) {
  const p = freeSpot(s); if (!p) return;
  s.items.push({ id: ++s.nid, type: type || pickLoot(), x: p.x, y: p.y });
}

function create(names, wins, round, opts) {
  opts = opts || {};
  const now = Date.now(), n = names.length, mp = M.get(opts.map);
  const teams = opts.mode === 'teams' && n === 4;
  const s = {
    names, wins, round, opts, mp, map: mp.id, phase: 'play', winner: null, winTeam: null, startAt: now + START_MS, nextItemAt: now + 1500,
    team: teams ? [0, 1, 0, 1] : null, teamKills: [0, 0], target: teams ? TEAM_KILLS : KILLS,
    fog: opts.fog === 'cone', events: opts.events !== 'off', nextEventAt: now + START_MS + EVENT_EVERY, lastEvent: null,
    boss: null, hazards: [], frenzyUntil: 0, hasteUntil: 0, banner: null,
    players: names.map((_, i) => newPlayer(i, mp)),
    inputs: names.map(() => ({ dx: 0, dy: 0, aim: 0, fire: false })),
    bullets: [], items: [], fx: [], feed: [], nid: 0
  };
  s.players.forEach((p, i) => { s.inputs[i].aim = p.aim; });
  ['smg', 'shotgun', 'health', undefined].forEach(t => spawnItem(s, t)); // na start kilka przedmiotów na mapie
  return s;
}

function startVote(s, now) { s.votes = s.names.map(() => null); s.voteEnd = now + VOTE_MS; s.voteDirty = true; }
// kończy głosowanie: wygrywa mapa z największą liczbą głosów (remis losowo, brak głosów = ta sama mapa) i od razu startuje nowa runda
function nextRound(s) {
  const tally = {}; (s.votes || []).forEach(v => { if (v) tally[v] = (tally[v] || 0) + 1; });
  const top = Math.max(0, ...Object.values(tally)), best = Object.keys(tally).filter(k => tally[k] === top);
  const map = best.length ? best[Math.floor(Math.random() * best.length)] : s.map;
  return create(s.names, s.wins, s.round + 1, Object.assign({}, s.opts, { map }));
}

function damage(s, i, amt, by, weapon, now, ignoreShield) {
  const p = s.players[i];
  if (p.dead || p.inv > now || s.phase !== 'play') return;
  if (by != null && isAlly(s, by, i)) return; // brak friendly fire
  p.lastHurt = now;
  if (!ignoreShield && p.sh > 0) { const a = Math.min(p.sh, amt); p.sh -= a; amt -= a; }
  p.hp -= amt;
  if (by != null && by !== i) { p.lastBy = by; p.lastAt = now; }
  if (p.hp <= 0) die(s, i, by, weapon, now);
}

function die(s, i, by, weapon, now) {
  const p = s.players[i];
  p.dead = true; p.hp = 0; p.sh = 0; p.respawnAt = now + RESPAWN_MS; p.deaths++; p.vx = p.vy = p.kx = p.ky = 0;
  p.lv = 0; p.rageUntil = 0; // legendarne buffy i rage znikają ze śmiercią
  const envKill = weapon === 'boss' || weapon === 'meteor';
  const killer = by != null && by !== i ? by : (!envKill && now - p.lastAt < 4000 && p.lastBy != null ? p.lastBy : null); // wpadł w lawę po czyimś strzale = fragment dla strzelca
  fx(s, 'death', p.x, p.y, { v: i, k: killer });
  s.feed.push({ id: ++s.nid, t: now, k: killer, v: i, w: killer == null || by == null ? (weapon || 'lava') : weapon });
  if (s.feed.length > 6) s.feed.shift();
  if (p.w !== 'pistol' && s.items.length < 12 && (!s.mp.isLava(p.x, p.y) || s.mp.onStone(p.x, p.y))) s.items.push({ id: ++s.nid, type: p.w, x: p.x, y: p.y }); // broń wypada na ziemię
  p.w = 'pistol'; p.ammo = -1;
  if (killer != null) {
    const k = s.players[killer]; k.kills++;
    if (s.team) {
      const t = s.team[killer]; s.teamKills[t]++;
      if (s.teamKills[t] >= s.target) { s.phase = 'over'; startVote(s, now); s.winner = killer; s.winTeam = t; s.team.forEach((tt, j) => { if (tt === t) s.wins[j]++; }); }
    } else if (k.kills >= s.target) { s.phase = 'over'; startVote(s, now); s.winner = killer; s.wins[killer]++; }
  }
}

function explode(s, b, x, y, now) {
  fx(s, 'boom', x, y);
  const m = b.m || 1;
  s.players.forEach((p, j) => {
    if (p.dead || isAlly(s, b.o, j)) return; // rakieta nie rani sojuszników
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
    if (d > ROCKET_R + PR) return;
    let dmg = 65 * m * (1 - 0.6 * Math.min(1, d / ROCKET_R));
    if (j === b.o) dmg *= 0.5; // własna rakieta boli mniej
    if (p.inv <= now) { const n = d || 1; p.kx += dx / n * 420; p.ky += dy / n * 420; } // odrzut – można wylądować w lawie
    damage(s, j, dmg, b.o >= 0 ? b.o : null, 'rocket', now);
  });
  if (s.boss && b.o >= 0) {
    const d = Math.hypot(s.boss.x - x, s.boss.y - y);
    if (d <= ROCKET_R + s.boss.r) hurtBoss(s, b.o, 65 * m * (1 - 0.6 * Math.min(1, d / ROCKET_R)), now, x, y);
  }
}

// ---------- wydarzenia co 30 s: boss, meteory, buffy ----------
function banner(s, text, sub, now) { s.banner = { text, sub, until: now + 4500 }; }

function spawnBoss(s, now) {
  const hp = 380 + 130 * s.players.length;
  s.boss = { x: s.mp.boss[0], y: s.mp.boss[1], r: BOSS_R, hp, max: hp, dmg: s.players.map(() => 0), until: now + BOSS_MS, nextRing: now + 1600, nextAim: now + 900, spin: 0 };
  fx(s, 'bossSpawn', s.boss.x, s.boss.y);
}

function hurtBoss(s, owner, amt, now, hx, hy) {
  const b = s.boss; if (!b || owner < 0) return;
  b.hp -= amt; b.dmg[owner] += amt;
  fx(s, 'hit', hx == null ? b.x : hx, hy == null ? b.y : hy, { v: -1, o: owner });
  if (b.hp <= 0) killBoss(s, now);
}

// kto zadał bossowi najwięcej obrażeń, dostaje poziom legendy: więcej obrażeń, życia i prędkości, regenerację – aż do śmierci
function killBoss(s, now) {
  const b = s.boss; s.boss = null;
  let top = -1, best = 0; b.dmg.forEach((d, i) => { if (d > best) { best = d; top = i; } });
  fx(s, 'boom', b.x, b.y, { r: 160 });
  ['rocket', 'health', 'shield'].forEach(t => spawnItem(s, t)); // łup z bossa
  if (top < 0) return banner(s, '👹 Boss pokonany!', '', now);
  const p = s.players[top];
  p.lv = Math.min(BOSS_LEGEND_MAX, p.lv + 1);
  if (!p.dead) { p.hp = maxHp(p); p.sh = 50; fx(s, 'legend', p.x, p.y, { v: top }); }
  banner(s, '👑 ' + s.names[top] + ' zostaje LEGENDĄ!', 'Najwięcej obrażeń w bossa (' + Math.round(best) + '). Buffy aż do śmierci.', now);
}

function bossStep(s, now, dt) {
  const b = s.boss; if (!b) return;
  if (now >= b.until) { s.boss = null; return banner(s, '👹 Boss uciekł…', 'Nikt go nie pokonał', now); }
  b.spin += dt;
  const alive = s.players.map((p, i) => ({ p, i })).filter(o => !o.p.dead);
  if (now >= b.nextRing) { // pierścień pocisków
    b.nextRing = now + 2200;
    const off = Math.random() * 6.28, N = 14;
    for (let k = 0; k < N; k++) { const a = off + k * 6.283 / N; s.bullets.push({ id: ++s.nid, o: -2, w: 'boss', x: b.x, y: b.y, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, dmg: 9, left: 760, m: 1 }); }
  }
  if (now >= b.nextAim && alive.length) { // salwa w najbliższego gracza
    b.nextAim = now + 1100;
    const t = alive.reduce((m, o) => Math.hypot(o.p.x - b.x, o.p.y - b.y) < Math.hypot(m.p.x - b.x, m.p.y - b.y) ? o : m);
    const a0 = Math.atan2(t.p.y - b.y, t.p.x - b.x);
    for (let k = -1; k <= 1; k++) { const a = a0 + k * 0.16; s.bullets.push({ id: ++s.nid, o: -2, w: 'boss', x: b.x, y: b.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, dmg: 11, left: 1000, m: 1 }); }
  }
}

function startEvent(s, now) {
  let pool = EVENTS.filter(e => e[0] !== s.lastEvent && (e[0] !== 'boss' || !s.boss));
  let type = 'boss';
  if (s.lastEvent !== null) { // pierwsze wydarzenie to zawsze boss
    let x = Math.random() * pool.reduce((a, e) => a + e[1], 0); type = pool[0][0];
    for (const [t, w] of pool) { if ((x -= w) < 0) { type = t; break; } }
  }
  s.lastEvent = type;
  if (type === 'boss') { spawnBoss(s, now); banner(s, '👹 BOSS NA ŚRODKU!', 'Kto zada mu najwięcej obrażeń, dostaje buffy aż do śmierci', now); }
  else if (type === 'meteors') {
    banner(s, '☄️ DESZCZ METEORÓW', 'Uciekaj z czerwonych kręgów!', now);
    for (let k = 0; k < 10; k++) {
      const alive = s.players.filter(p => !p.dead), near = alive.length && Math.random() < 0.5 ? alive[Math.floor(Math.random() * alive.length)] : null;
      const x = near ? near.x + rnd(-120, 120) : rnd(80, s.mp.W - 80), y = near ? near.y + rnd(-120, 120) : rnd(80, s.mp.H - 80);
      s.hazards.push({ id: ++s.nid, x: clamp(x, 40, s.mp.W - 40), y: clamp(y, 40, s.mp.H - 40), r: 90, at: now + 900 + k * 550 });
    }
  }
  else if (type === 'frenzy') { s.frenzyUntil = now + 10000; banner(s, '🔥 SZAŁ OBRAŻEŃ', 'Wszyscy zadają podwójne obrażenia przez 10 s', now); }
  else if (type === 'haste') { s.hasteUntil = now + 10000; banner(s, '⚡ PRZYSPIESZENIE', 'Wszyscy biegają szybciej przez 10 s', now); }
  else if (type === 'airdrop') { for (let k = 0; k < 5; k++) spawnItem(s); banner(s, '📦 ZRZUT Z POWIETRZA', 'Nowe bronie i przedmioty leżą na mapie', now); }
  else if (type === 'heal') {
    s.players.forEach(p => { if (!p.dead) { p.hp = Math.min(maxHp(p), p.hp + 50); p.sh = Math.max(p.sh, 25); fx(s, 'pick', p.x, p.y, { item: 'health' }); } });
    banner(s, '💖 FALA UZDRAWIAJĄCA', '+50 życia i tarcza dla wszystkich', now);
  }
}

function hazardStep(s, now) {
  for (const hz of s.hazards) {
    if (now < hz.at) continue;
    hz.dead = true; fx(s, 'boom', hz.x, hz.y, { r: hz.r });
    s.players.forEach((p, j) => {
      if (p.dead) return;
      const d = Math.hypot(p.x - hz.x, p.y - hz.y); if (d > hz.r + PR) return;
      damage(s, j, 45 * (1 - 0.5 * Math.min(1, d / hz.r)), null, 'meteor', now);
    });
  }
  s.hazards = s.hazards.filter(h => !h.dead);
}

// ---------- tryb stożka: serwer wysyła tylko to, co gracz (lub sojusznik) widzi ----------
function sees(s, j, x, y) {
  const p = s.players[j], dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
  if (d <= FOG_NEAR) return true;
  if (d > FOG_R + 40) return false;
  let da = Math.atan2(dy, dx) - p.aim; da = Math.atan2(Math.sin(da), Math.cos(da));
  return Math.abs(da) <= FOG_HALF + FOG_TOL;
}
function visibleTo(s, me, x, y) {
  if (!s.fog || me < 0 || !s.players[me] || s.players[me].dead) return true;
  return s.players.some((q, j) => !q.dead && (j === me || (s.team && s.team[j] === s.team[me])) && sees(s, j, x, y));
}

function respawn(s, i, now) {
  const p = s.players[i];
  const alive = s.players.filter((q, j) => j !== i && !q.dead && !isAlly(s, i, j)); // odradzamy się z dala od wrogów
  let best = s.mp.spawns[0], bd = -1;
  for (const sp of s.mp.spawns) {
    const d = alive.length ? Math.min(...alive.map(q => Math.hypot(q.x - sp[0], q.y - sp[1]))) : 0;
    if (d + Math.random() * 60 > bd) { bd = d + Math.random() * 60; best = sp; }
  }
  Object.assign(p, { x: best[0], y: best[1], hp: 100, sh: 0, w: 'pistol', ammo: -1, dead: false, inv: now + INV_MS, boostUntil: 0, dashUntil: 0, kx: 0, ky: 0, vx: 0, vy: 0, lv: 0, rageUntil: 0 });
  fx(s, 'spawn', p.x, p.y, { v: i });
}

function shoot(s, i, now) {
  const p = s.players[i], w = WEAPONS[p.w], m = dmgMul(s, p, now);
  p.nextShot = now + w.rate / (1 + 0.15 * p.lv); p.lastShot = now; p.shots++;
  for (let k = 0; k < w.pellets; k++) {
    const a = p.aim + (Math.random() - 0.5) * w.spread, sp = w.speed * (w.pellets > 1 ? rnd(0.92, 1.08) : 1);
    s.bullets.push({ id: ++s.nid, o: i, w: p.w, x: p.x + Math.cos(p.aim) * 10, y: p.y + Math.sin(p.aim) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: w.dmg * m, m, left: w.range });
  }
  if (w.ammo >= 0 && --p.ammo <= 0) { p.w = 'pistol'; p.ammo = -1; }
}

// ruch małymi krokami, żeby szybki unik nie przeskoczył przez cienki płot
function solidify(s, p) {
  for (const b of s.mp.boulders) { // głazy nie przepuszczają
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy), min = b.r + PR;
    if (d < min) { const n = d || 1; p.x = b.x + dx / n * min; p.y = b.y + dy / n * min; }
  }
  for (const r of s.mp.rects) { const o = M.pushRect(p.x, p.y, PR, r); if (o) { p.x = o[0]; p.y = o[1]; } }
  if (s.boss) { const dx = p.x - s.boss.x, dy = p.y - s.boss.y, d = Math.hypot(dx, dy), min = s.boss.r + PR; if (d < min) { const n = d || 1; p.x = s.boss.x + dx / n * min; p.y = s.boss.y + dy / n * min; } }
  p.x = clamp(p.x, PR, s.mp.W - PR); p.y = clamp(p.y, PR, s.mp.H - PR);
}
function moveP(s, p, dx, dy) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 9));
  for (let k = 0; k < n; k++) { p.x += dx / n; p.y += dy / n; solidify(s, p); }
}

module.exports = {
  meta: {
    id: 'arena', name: 'Arena Lawy', icon: '🔫', desc: 'Strzelanka z góry: lawa, bronie, bossowie i 2v2. Kto pierwszy do 5 fragów?', min: 2, max: 4,
    options: [
      { id: 'map', label: 'Mapa', def: 'lava', values: M.list },
      { id: 'mode', label: 'Tryb', def: 'ffa', values: [['ffa', 'Każdy na każdego'], ['teams', '2 na 2 (4 graczy)']] },
      { id: 'fog', label: 'Widzenie', def: 'off', values: [['off', 'Normalne'], ['cone', '🔦 Tylko przed sobą (90°)']] },
      { id: 'events', label: 'Wydarzenia co 30 s', def: 'on', values: [['on', 'Boss, meteory, buffy'], ['off', 'Wyłączone']] }
    ]
  },

  canStart: (players, o) => o && o.mode === 'teams' && players.length !== 4 ? `2 na 2 wymaga dokładnie 4 graczy (jest ${players.length})` : null,

  init: (players, opts) => create(players.map(p => p.name), players.map(() => 0), 0, opts),

  move(s, me, d) {
    const p = s.players[me], now = Date.now();
    if (d.type === 'vote') {
      if (s.phase !== 'over' || !s.votes) return { error: 'Głosować można po zakończonej rundzie.' };
      if (!M.maps[d.map]) return { error: 'Nie ma takiej mapy.' };
      s.votes[me] = d.map; s.voteDirty = true; return s;
    }
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
    if (s.phase === 'over') { // po wygranej: głosowanie na następną mapę, potem nowa runda
      if (s.votes && (s.votes.every(v => v != null) || Date.now() >= s.voteEnd)) {
        const fresh = nextRound(s); Object.keys(s).forEach(k => delete s[k]); Object.assign(s, fresh); return true;
      }
      if (s.voteDirty) { s.voteDirty = false; return true; }
      return false;
    }
    if (s.phase !== 'play') return false;
    const now = Date.now();
    if (now < s.startAt) return true; // odliczanie do startu

    // --- gracze ---
    s.players.forEach((p, i) => {
      if (p.dead) { if (now >= p.respawnAt) respawn(s, i, now); return; }
      const inp = s.inputs[i], dashing = p.dashUntil > now;
      let vx, vy;
      if (dashing) { vx = p.dvx * DASH_SPEED; vy = p.dvy * DASH_SPEED; }
      else { const sp = SPEED * speedMul(s, p, now); vx = inp.dx * sp; vy = inp.dy * sp; }
      p.vx = vx; p.vy = vy; p.aim = inp.aim;
      moveP(s, p, (vx + p.kx) * dt, (vy + p.ky) * dt);
      const decay = Math.exp(-6 * dt); p.kx *= decay; p.ky *= decay;
      if (p.lv > 0 && now - p.lastHurt > 3000 && p.hp < maxHp(p)) p.hp = Math.min(maxHp(p), p.hp + 3 * p.lv * dt); // legenda się regeneruje
      if (!dashing && s.mp.isLava(p.x, p.y) && !s.mp.onStone(p.x, p.y)) damage(s, i, LAVA_DPS * dt, null, 'lava', now, true);
      if (p.dead) return;
      if (inp.fire && now >= p.nextShot) shoot(s, i, now);

      // zbieranie przedmiotów
      for (let k = s.items.length - 1; k >= 0; k--) {
        const it = s.items[k];
        if (Math.hypot(it.x - p.x, it.y - p.y) > PR + 14) continue;
        if (WEAPONS[it.type]) { p.w = it.type; p.ammo = WEAPONS[it.type].ammo; }
        else if (it.type === 'health') { if (p.hp >= maxHp(p)) continue; p.hp = Math.min(maxHp(p), p.hp + 40); }
        else if (it.type === 'shield') { if (p.sh >= 50) continue; p.sh = Math.min(50, p.sh + 50); }
        else if (it.type === 'boost') p.boostUntil = now + BOOST_MS;
        else if (it.type === 'rage') p.rageUntil = now + 8000;
        fx(s, 'pick', it.x, it.y, { v: i, item: it.type });
        s.items.splice(k, 1);
      }
    });

    // --- nowe przedmioty ---
    if (now >= s.nextItemAt) { s.nextItemAt = now + (s.mp.itemEvery || ITEM_EVERY); if (s.items.length < (s.mp.itemMax || MAX_ITEMS)) spawnItem(s); }

    // --- wydarzenia co 30 s, boss, meteory ---
    if (s.events && now >= s.nextEventAt) { s.nextEventAt = now + EVENT_EVERY; startEvent(s, now); }
    try { bossStep(s, now, dt); } catch (e) { console.error('Błąd bossa', e); s.boss = null; }
    hazardStep(s, now);
    if (s.phase !== 'play') return true;

    // --- pociski (sprawdzamy cały odcinek ruchu, żeby szybki pocisk nie przeleciał przez gracza) ---
    for (const b of s.bullets) {
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      let bestT = 2, hit = null;
      for (const bo of s.mp.boulders) { const t = M.segCircle(b.x, b.y, nx, ny, bo.x, bo.y, bo.r); if (t >= 0 && t < bestT) { bestT = t; hit = { wall: true }; } }
      for (const r of s.mp.rects) { if (!M.BULLET_BLOCK[r.k]) continue; const t = M.segRect(b.x, b.y, nx, ny, r); if (t >= 0 && t < bestT) { bestT = t; hit = { wall: true }; } }
      if (s.boss && b.o >= 0) { const t = M.segCircle(b.x, b.y, nx, ny, s.boss.x, s.boss.y, s.boss.r); if (t >= 0 && t < bestT) { bestT = t; hit = { boss: true }; } }
      s.players.forEach((p, j) => {
        if (j === b.o || p.dead || p.inv > now || (b.o >= 0 && isAlly(s, b.o, j))) return;
        const t = M.segCircle(b.x, b.y, nx, ny, p.x, p.y, PR); if (t >= 0 && t < bestT) { bestT = t; hit = { p: j }; }
      });
      if (hit) {
        const hx = b.x + (nx - b.x) * bestT, hy = b.y + (ny - b.y) * bestT;
        if (b.w === 'rocket') explode(s, b, hx, hy, now);
        else if (hit.boss) hurtBoss(s, b.o, b.dmg, now, hx, hy);
        else if (hit.p != null) { fx(s, 'hit', hx, hy, { v: hit.p, o: b.o }); damage(s, hit.p, b.dmg, b.o >= 0 ? b.o : null, b.w, now); }
        else fx(s, 'spark', hx, hy);
        b.dead = true; continue;
      }
      b.x = nx; b.y = ny; b.left -= Math.hypot(b.vx, b.vy) * dt;
      if (b.left <= 0 || nx < 0 || ny < 0 || nx > s.mp.W || ny > s.mp.H) { if (b.w === 'rocket') explode(s, b, clamp(nx, 0, s.mp.W), clamp(ny, 0, s.mp.H), now); b.dead = true; }
    }
    s.bullets = s.bullets.filter(b => !b.dead);
    s.fx = s.fx.filter(f => now - f.t < 700);
    return true;
  },

  view(s, me = -1) {
    const now = Date.now(), vis = (x, y) => visibleTo(s, me, x, y);
    const mine = s.players[me], hideOthers = s.fog && mine && !mine.dead;
    return {
      names: s.names, wins: s.wins, round: s.round, phase: s.phase, winner: s.winner, kills: s.target, rocketR: ROCKET_R,
      map: s.map, team: s.team, teamKills: s.teamKills, winTeam: s.winTeam,
      fog: s.fog ? { r: FOG_R, near: FOG_NEAR, half: FOG_HALF } : null, events: s.events,
      nextEvMs: s.events ? Math.max(0, s.nextEventAt - now) : 0,
      banner: s.banner && s.banner.until > now ? { text: s.banner.text, sub: s.banner.sub, ms: s.banner.until - now } : null,
      buffs: [s.frenzyUntil > now && { k: 'frenzy', ms: s.frenzyUntil - now }, s.hasteUntil > now && { k: 'haste', ms: s.hasteUntil - now }].filter(Boolean),
      goMs: Math.max(0, s.startAt - now),
      vote: s.phase === 'over' && s.votes ? { votes: s.votes, ms: Math.max(0, s.voteEnd - now), cur: s.map } : null,
      players: s.players.map((p, j) => {
        const shown = !hideOthers || j === me || (s.team && s.team[j] === s.team[me]) || vis(p.x, p.y) || p.dead;
        if (!shown) return { hidden: true, dead: false, kills: p.kills, deaths: p.deaths, lv: p.lv };
        return {
          x: r1(p.x), y: r1(p.y), a: Math.round(p.aim * 100) / 100, vx: Math.round(p.vx), vy: Math.round(p.vy),
          hp: Math.max(0, Math.round(p.hp)), maxhp: maxHp(p), sh: Math.round(p.sh), w: p.w, ammo: p.ammo, ammoMax: WEAPONS[p.w].ammo, dead: p.dead,
          respawnMs: p.dead ? Math.max(0, p.respawnAt - now) : 0, inv: p.inv > now, boost: p.boostUntil > now,
          rage: p.rageUntil > now ? p.rageUntil - now : 0, lv: p.lv,
          dashing: p.dashUntil > now, dashCd: Math.max(0, p.dashReady - now), fired: now - p.lastShot < 90,
          kills: p.kills, deaths: p.deaths, sn: p.shots
        };
      }),
      boss: s.boss ? { x: r1(s.boss.x), y: r1(s.boss.y), r: s.boss.r, hp: Math.max(0, Math.round(s.boss.hp)), max: s.boss.max, seen: vis(s.boss.x, s.boss.y), ms: Math.max(0, s.boss.until - now), dmg: s.boss.dmg.map(Math.round) } : null,
      hazards: s.hazards.filter(h => h.at - now <= 1300 && vis(h.x, h.y)).map(h => ({ id: h.id, x: Math.round(h.x), y: Math.round(h.y), r: h.r, ms: Math.max(0, h.at - now) })), // meteor widać ~1,3 s przed uderzeniem
      bullets: s.bullets.filter(b => vis(b.x, b.y)).map(b => ({ id: b.id, x: r1(b.x), y: r1(b.y), vx: Math.round(b.vx), vy: Math.round(b.vy), w: b.w, l: Math.round(b.left) })),
      items: s.items.filter(it => vis(it.x, it.y)).map(it => ({ id: it.id, type: it.type, x: it.x, y: it.y })),
      fx: s.fx.filter(f => f.v === me || vis(f.x, f.y)), feed: s.feed.filter(f => now - f.t < 6000).map(f => ({ id: f.id, k: f.k, v: f.v, w: f.w }))
    };
  },

  rematch(s) { return s.phase === 'over' ? nextRound(s) : s; },

  // ktoś wyszedł w trakcie gry: usuwamy go i gramy dalej, jeśli zostało ≥2 graczy
  onLeave(s, idx) {
    if (s.team) return null; // 2v2 bez kompletu graczy = powrót do poczekalni
    ['names', 'wins', 'players', 'inputs', 'votes'].forEach(k => { if (s[k]) s[k].splice(idx, 1); });
    if (s.boss) s.boss.dmg.splice(idx, 1);
    if (s.players.length < 2) return null;
    const re = o => (o == null || o === idx ? null : o > idx ? o - 1 : o);
    s.bullets.forEach(b => { const o = re(b.o); b.o = o == null ? -1 : o; });
    s.players.forEach(p => { p.lastBy = re(p.lastBy); });
    s.winner = re(s.winner); s.feed = [];
    return s;
  }
};
