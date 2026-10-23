// Arena Lawy – wspólna geometria mapy. Ten sam plik czyta serwer (require) i przeglądarka (<script>),
// dzięki temu obie strony zawsze zgadzają się, gdzie jest lawa, kamienie i przeszkody.
(function (root) {
  const W = 1800, H = 1000, T = 18; // wymiary świata i rozmiar "piksela" lawy
  const rot = r => Object.assign({}, r, { x: W - r.x - r.w, y: H - r.y - r.h }); // obrót o 180° (mapy są symetryczne = uczciwe)
  const sym = list => list.concat(list.map(rot));

  // dwa jeziora lawy (zaokrąglone prostokąty z lekkim szumem na brzegu)
  const blobs = [
    { cx: 522, cy: 482, rx: 325, ry: 375 },
    { cx: 1306, cy: 522, rx: 335, ry: 374 }
  ];
  function isLava(x, y) {
    const px = Math.floor(x / T) * T + T / 2, py = Math.floor(y / T) * T + T / 2; // skok co "piksel" = poszarpany brzeg
    const noise = 0.08 * Math.sin(px * 0.043 + py * 0.017) * Math.sin(py * 0.05 - px * 0.011);
    for (const b of blobs) {
      const u = Math.abs(px - b.cx) / b.rx, v = Math.abs(py - b.cy) / b.ry;
      if (Math.pow(u, 2.6) + Math.pow(v, 2.6) < 1 + noise) return true;
    }
    return false;
  }

  // kamienie na lawie – na nich można stać bezpiecznie
  const stones = [
    [436, 257], [614, 257], [389, 392], [523, 392], [346, 523], [569, 523], [747, 616], [435, 659], [569, 701],
    [1238, 299], [1463, 344], [1285, 434], [1553, 479], [1150, 481], [1373, 616], [1104, 659], [1328, 791]
  ].map(([x, y]) => ({ x, y, r: 24 }));
  const onStone = (x, y) => stones.some(s => (x - s.x) ** 2 + (y - s.y) ** 2 < (s.r + 6) ** 2);

  // głazy na suchym lądzie – blokują ruch i pociski
  const boulders = [[95, 250], [95, 760], [1740, 300], [1740, 740], [700, 55], [1100, 55], [700, 950], [1150, 950]]
    .map(([x, y]) => ({ x, y, r: 28 }));

  const spawns = [[110, 70], [1690, 930], [110, 930], [1690, 70], [905, 60], [905, 940], [70, 500], [1745, 520]];
  const dirtSpots = [[330, 55], [1480, 55], [270, 935], [1530, 945], [60, 500], [1750, 500], [905, 500], [905, 230], [905, 780]];
  const itemSpots = dirtSpots.map(([x, y]) => ({ x, y })).concat(stones.filter((_, i) => i % 3 === 0).map(s => ({ x: s.x, y: s.y })));

  // pierwszy punkt przecięcia odcinka a→b z okręgiem; zwraca t w [0,1] albo -1
  function segCircle(ax, ay, bx, by, cx, cy, r) {
    const dx = bx - ax, dy = by - ay, fx = ax - cx, fy = ay - cy;
    const a = dx * dx + dy * dy, c = fx * fx + fy * fy - r * r;
    if (c <= 0) return 0;
    if (a === 0) return -1;
    const b = 2 * (fx * dx + fy * dy), disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : -1;
  }

  // pierwszy punkt przecięcia odcinka a→b z prostokątem (Liang–Barsky); zwraca t w [0,1] albo -1
  function segRect(ax, ay, bx, by, r) {
    const dx = bx - ax, dy = by - ay; let t0 = 0, t1 = 1;
    const tests = [[-dx, ax - r.x], [dx, r.x + r.w - ax], [-dy, ay - r.y], [dy, r.y + r.h - ay]];
    for (const [p, q] of tests) {
      if (p === 0) { if (q < 0) return -1; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return -1; if (t > t0) t0 = t; } else { if (t < t0) return -1; if (t < t1) t1 = t; }
    }
    return t0;
  }
  // wypchnięcie koła (x,y,rad) z prostokąta; zwraca [nx, ny] albo null, gdy nie ma kolizji
  function pushRect(x, y, rad, r) {
    const cx = Math.max(r.x, Math.min(x, r.x + r.w)), cy = Math.max(r.y, Math.min(y, r.y + r.h));
    const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= rad * rad) return null;
    if (d2 > 1e-6) { const d = Math.sqrt(d2); return [cx + dx / d * rad, cy + dy / d * rad]; }
    const l = x - r.x, rr = r.x + r.w - x, t = y - r.y, b = r.y + r.h - y, m = Math.min(l, rr, t, b);
    if (m === l) return [r.x - rad, y]; if (m === rr) return [r.x + r.w + rad, y]; if (m === t) return [x, r.y - rad];
    return [x, r.y + r.h + rad];
  }
  const distRect = (x, y, r) => Math.hypot(Math.max(r.x - x, 0, x - r.x - r.w), Math.max(r.y - y, 0, y - r.y - r.h));
  // rodzaje przeszkód: drzewa i skały zatrzymują pociski; woda i płotki tylko blokują ruch (przez nie można strzelać)
  const BULLET_BLOCK = { trees: true, rock: true };

  // ---------- zestaw map ----------
  const border = [{ k: 'trees', x: 0, y: 0, w: W, h: 44 }, { k: 'trees', x: 0, y: H - 44, w: W, h: 44 }, { k: 'trees', x: 0, y: 44, w: 44, h: H - 88 }, { k: 'trees', x: W - 44, y: 44, w: 44, h: H - 88 }];
  const cornerSpawns = [[110, 100], [1690, 900], [110, 900], [1690, 100], [900, 110], [900, 890]]; // 0 i 2 (lewa strona) kontra 1 i 3 (prawa) w trybie 2v2

  function autoSpots(m, step) {
    const out = [], MW = m.W || W, MH = m.H || H; step = step || 110;
    for (let x = 110; x <= MW - 110; x += step) for (let y = 110; y <= MH - 110; y += step) {
      if (m.rects.some(r => distRect(x, y, r) < 40)) continue;
      if (m.spawns.slice(0, 4).some(s => Math.hypot(s[0] - x, s[1] - y) < 110)) continue;
      if (Math.hypot(x - m.boss[0], y - m.boss[1]) < 90) continue;
      out.push({ x, y });
    }
    return out;
  }

  const maps = {};
  maps.lava = { id: 'lava', name: 'Arena Lawy', icon: '🌋', theme: 'lava', colors: { ground: '#7b3d28', lava: '#f7870c' }, hasLava: true, isLava, stones, onStone, boulders, rects: [], paths: [], spawns, itemSpots, boss: [905, 500] };

  // dodatkowe mapy lawowe (jeziora, mosty, kamienie na lawie, głazy) – opisane danymi, budowane tą samą funkcją
  // blob: zaokrąglony prostokąt/elipsa (p = „kanciastość”: 2 elipsa, 3 zaokrąglony, 10 prawie kwadrat), hole = dziura w środku (pierścień), dry = suche przejścia
  const lavaDefs = [
    {
      id: 'rzeka', name: 'Lawowa rzeka', icon: '🏞️', colors: { ground: '#5f4a3a', lava: '#f7870c' },
      blobs: [{ cx: 450, cy: 500, rx: 400, ry: 115, p: 3 }, { cx: 1350, cy: 500, rx: 400, ry: 115, p: 3 }], // między nimi most
      stones: [[200, 500], [450, 500], [700, 500], [1100, 500], [1350, 500], [1600, 500]],
      boulders: [[300, 230], [900, 200], [1500, 230], [300, 770], [900, 800], [1500, 770]],
      spawns: [[110, 100], [1690, 900], [110, 900], [1690, 100], [900, 60], [900, 940], [600, 300], [1200, 700]],
      dirt: [[330, 330], [1470, 330], [330, 670], [1470, 670], [900, 500], [900, 340], [900, 660], [600, 100], [1200, 900]]
    },
    {
      id: 'fosa', name: 'Fosa', icon: '🏰', colors: { ground: '#6a4a3e', lava: '#ff6a1a' },
      blobs: [{ cx: 900, cy: 500, rx: 600, ry: 430, hole: 0.62 }],
      dry: [[250, 455, 1550, 545], [855, 50, 945, 950]], // cztery mosty przez fosę
      stones: [[400, 250], [1400, 250], [400, 750], [1400, 750], [560, 330], [1240, 330], [560, 670], [1240, 670]],
      boulders: [[760, 400], [1040, 400], [760, 600], [1040, 600], [150, 150], [1650, 150], [150, 850], [1650, 850]],
      spawns: [[110, 70], [1690, 930], [110, 930], [1690, 70], [900, 60], [900, 940], [70, 500], [1745, 520]],
      dirt: [[900, 500], [900, 300], [900, 700], [700, 500], [1100, 500], [330, 500], [1470, 500], [250, 250], [1550, 750]]
    },
    {
      id: 'archipelag', name: 'Archipelag', icon: '🏝️', colors: { ground: '#6b4631', lava: '#f58a10' }, boss: [900, 500],
      blobs: [{ cx: 350, cy: 300, rx: 200, ry: 150 }, { cx: 900, cy: 200, rx: 230, ry: 120 }, { cx: 1450, cy: 300, rx: 200, ry: 150 },
        { cx: 350, cy: 720, rx: 200, ry: 150 }, { cx: 900, cy: 790, rx: 230, ry: 120 }, { cx: 1450, cy: 720, rx: 200, ry: 150 }, { cx: 900, cy: 500, rx: 170, ry: 110 }],
      stones: [[350, 300], [260, 260], [440, 340], [900, 200], [1450, 300], [1360, 260], [1540, 340], [350, 720], [260, 760], [440, 680], [900, 790], [1450, 720], [1360, 760], [1540, 680], [900, 500]],
      boulders: [[620, 430], [1180, 570], [240, 500], [1580, 500], [620, 120], [1180, 120], [620, 880], [1180, 880]],
      spawns: [[110, 70], [1690, 930], [110, 930], [1690, 70], [640, 620], [1160, 380], [70, 500], [1745, 520]],
      dirt: [[640, 300], [1160, 700], [900, 60], [900, 940], [150, 500], [1650, 500], [620, 760], [1180, 240], [900, 350]]
    },
    {
      id: 'glazowisko', name: 'Głazowisko', icon: '🪨', colors: { ground: '#5a5560', lava: '#ff5a1f' }, boss: [900, 380],
      blobs: [{ cx: 500, cy: 500, rx: 130, ry: 90 }, { cx: 1300, cy: 500, rx: 130, ry: 90 }],
      stones: [[500, 500], [1300, 500]],
      boulders: [[300, 200], [600, 200], [900, 160], [1200, 200], [1500, 200], [250, 500], [700, 500], [900, 500], [1100, 500], [1550, 500],
        [300, 800], [600, 800], [900, 840], [1200, 800], [1500, 800]],
      spawns: [[110, 70], [1690, 930], [110, 930], [1690, 70], [900, 60], [900, 940], [70, 500], [1745, 520]],
      dirt: [[450, 350], [1350, 350], [450, 650], [1350, 650], [900, 330], [900, 670], [150, 350], [1650, 650], [800, 500], [1000, 500]]
    },
    {
      id: 'szachownica', name: 'Szachownica', icon: '♟️', colors: { ground: '#3f5b6b', lava: '#8a3cff' }, boss: [900, 350],
      blobs: [[300, 200], [900, 200], [1500, 200], [600, 500], [1200, 500], [300, 800], [900, 800], [1500, 800]].map(([cx, cy]) => ({ cx, cy, rx: 110, ry: 110, p: 10 })),
      stones: [[300, 200], [900, 200], [1500, 200], [600, 500], [1200, 500], [300, 800], [900, 800], [1500, 800], [600, 440], [1200, 560]],
      boulders: [[600, 200], [1200, 200], [300, 500], [900, 500], [1500, 500], [600, 800], [1200, 800]],
      spawns: [[110, 70], [1690, 930], [110, 930], [1690, 70], [600, 350], [1200, 650], [70, 500], [1745, 520]],
      dirt: [[450, 350], [1350, 650], [750, 350], [1050, 650], [150, 500], [1650, 500], [600, 100], [1200, 900], [900, 350], [900, 650]]
    }
  ];
  function buildLava(d) {
    const bl = d.blobs.map(b => Object.assign({ p: 2.6, hole: 0 }, b)), dry = d.dry || [];
    const lavaAt = (x, y) => {
      const px = Math.floor(x / T) * T + T / 2, py = Math.floor(y / T) * T + T / 2; // skok co „piksel” = poszarpany brzeg
      for (const r of dry) if (px >= r[0] && px <= r[2] && py >= r[1] && py <= r[3]) return false;
      const noise = 0.08 * Math.sin(px * 0.043 + py * 0.017) * Math.sin(py * 0.05 - px * 0.011);
      for (const b of bl) {
        const v = Math.pow(Math.abs(px - b.cx) / b.rx, b.p) + Math.pow(Math.abs(py - b.cy) / b.ry, b.p);
        if (v < 1 + noise && (!b.hole || v > Math.pow(b.hole, b.p))) return true;
      }
      return false;
    };
    const st = d.stones.map(([x, y]) => ({ x, y, r: 24 }));
    const bo = d.boulders.map(([x, y]) => ({ x, y, r: 28 }));
    const onSt = (x, y) => st.some(q => (x - q.x) ** 2 + (y - q.y) ** 2 < (q.r + 6) ** 2);
    const spots = d.dirt.map(([x, y]) => ({ x, y })).concat(st.filter((_, i) => i % 3 === 0).map(q => ({ x: q.x, y: q.y })));
    return { id: d.id, name: d.name, icon: d.icon, theme: 'lava', colors: d.colors, hasLava: true, isLava: lavaAt, stones: st, onStone: onSt, boulders: bo, rects: [], paths: [], spawns: d.spawns, itemSpots: spots, boss: d.boss || [900, 500] };
  }
  lavaDefs.forEach(d => { maps[d.id] = buildLava(d); });

  // łąka z pinii, ścieżek i stawu – ułożona na wzór planszy z gry w stylu Pokémon
  maps.meadow = {
    id: 'meadow', name: 'Zielona łąka', icon: '🌲', theme: 'meadow', hasLava: false, isLava: () => false, stones: [], onStone: () => false, boulders: [],
    rects: border.concat(sym([
      { k: 'trees', x: 190, y: 190, w: 400, h: 50 }, { k: 'trees', x: 190, y: 190, w: 50, h: 190 },
      { k: 'trees', x: 390, y: 380, w: 50, h: 300 }, { k: 'trees', x: 600, y: 640, w: 300, h: 50 },
      { k: 'water', x: 56, y: 420, w: 130, h: 170 },
      { k: 'fence', x: 120, y: 780, w: 260, h: 18 }, { k: 'fence', x: 362, y: 780, w: 18, h: 110 },
      { k: 'rock', x: 620, y: 150, w: 56, h: 56 },
      { k: 'trees', x: 790, y: 390, w: 50, h: 50 }, { k: 'trees', x: 960, y: 390, w: 50, h: 50 }
    ])),
    paths: [{ x: 44, y: 478, w: W - 88, h: 44 }, { x: 878, y: 44, w: 44, h: H - 88 }],
    plaza: [900, 500, 120],
    spawns: cornerSpawns, boss: [900, 500]
  };

  // zimowe jezioro: skute lodem oczko pośrodku (nie wejdziesz, ale można strzelać nad nim)
  maps.winter = {
    id: 'winter', name: 'Zimowe jezioro', icon: '❄️', theme: 'winter', hasLava: false, isLava: () => false, stones: [], onStone: () => false, boulders: [],
    rects: border.concat(sym([
      { k: 'trees', x: 250, y: 160, w: 150, h: 52 }, { k: 'trees', x: 250, y: 160, w: 52, h: 150 },
      { k: 'trees', x: 560, y: 300, w: 52, h: 160 }, { k: 'trees', x: 400, y: 600, w: 170, h: 52 },
      { k: 'trees', x: 140, y: 440, w: 100, h: 52 }, { k: 'trees', x: 650, y: 760, w: 200, h: 52 },
      { k: 'rock', x: 580, y: 540, w: 60, h: 56 }
    ])).concat([{ k: 'water', x: 760, y: 420, w: 280, h: 160 }]),
    paths: [],
    spawns: cornerSpawns, boss: [900, 500]
  };
  ['meadow', 'winter'].forEach(id => { maps[id].itemSpots = autoSpots(maps[id]); });

  // ---------- DUŻE MAPY (kamera podąża za graczem): las, miasto i labirynt – dużo ścian, deterministyczne (ten sam układ na serwerze i w przeglądarce) ----------
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const overlap = (a, b, pad) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
  function bigBase(d) {
    const BW = d.W, BH = d.H, rotB = r => Object.assign({}, r, { x: BW - r.x - r.w, y: BH - r.y - r.h });
    const bord = [{ k: 'trees', x: 0, y: 0, w: BW, h: 44 }, { k: 'trees', x: 0, y: BH - 44, w: BW, h: 44 }, { k: 'trees', x: 0, y: 44, w: 44, h: BH - 88 }, { k: 'trees', x: BW - 44, y: 44, w: 44, h: BH - 88 }];
    return { BW, BH, rotB, bord };
  }
  function finishBig(d, rects, extra) {
    const m = Object.assign({ id: d.id, name: d.name, icon: d.icon, theme: d.theme, W: d.W, H: d.H, big: true, hasLava: false, isLava: () => false, stones: [], onStone: () => false, boulders: [], rects, paths: [], spawns: d.spawns, boss: d.boss, itemMax: 16, itemEvery: 3200 }, extra || {});
    m.itemSpots = autoSpots(m, 150);
    return m;
  }

  // 1) Wielki las: kępy drzew, skały, płoty i stawy rozrzucone losowo (symetrycznie o 180°)
  (function () {
    const d = { id: 'las', name: 'Wielki las', icon: '🌳', theme: 'meadow', W: 3200, H: 1800 };
    d.spawns = [[130, 130], [d.W - 130, d.H - 130], [130, d.H - 130], [d.W - 130, 130], [d.W / 2, 130], [d.W / 2, d.H - 130], [130, d.H / 2], [d.W - 130, d.H / 2]];
    d.boss = [d.W / 2, d.H / 2];
    const { rotB, bord } = bigBase(d), rnd = mulberry(20260);
    const keep = d.spawns.concat([d.boss]), rects = [];
    const clear = r => keep.every(p => Math.hypot(Math.max(r.x - p[0], 0, p[0] - r.x - r.w), Math.max(r.y - p[1], 0, p[1] - r.y - r.h)) > (p === d.boss ? 190 : 150));
    let guard = 0;
    while (rects.length < 260 && guard++ < 30000) {
      const roll = rnd(), horiz = rnd() < 0.5; let r;
      if (roll < 0.5) { const l = 120 + rnd() * 300, t = 50; r = { k: 'trees', x: 0, y: 0, w: horiz ? l : t, h: horiz ? t : l }; }
      else if (roll < 0.72) { const a = 60 + rnd() * 70, b = 60 + rnd() * 70; r = { k: 'rock', x: 0, y: 0, w: a, h: b }; }
      else if (roll < 0.88) { const l = 140 + rnd() * 260; r = { k: 'fence', x: 0, y: 0, w: horiz ? l : 18, h: horiz ? 18 : l }; }
      else { r = { k: 'water', x: 0, y: 0, w: 160 + rnd() * 160, h: 110 + rnd() * 110 }; }
      r.x = Math.round(80 + rnd() * (d.W - 160 - r.w)); r.y = Math.round(80 + rnd() * (d.H - 160 - r.h));
      const q = rotB(r);
      if (!clear(r) || !clear(q) || overlap(r, q, 100)) continue;
      if (rects.some(o => overlap(o, r, 100) || overlap(o, q, 100))) continue;
      rects.push(r, q);
    }
    maps.las = finishBig(d, bord.concat(rects), { paths: [], plaza: null });
  })();

  // 2) Miasto: siatka kwartałów (budynki, parki, oczka wodne) przedzielona ulicami, plac z bossem pośrodku
  (function () {
    const d = { id: 'miasto', name: 'Miasto', icon: '🏙️', theme: 'meadow', W: 3200, H: 1800 };
    const { rotB, bord } = bigBase(d), rnd = mulberry(7741);
    const BWD = 300, BHT = 260, GAP = 140, X0 = 130, Y0 = 170, COLS = 7, ROWS = 4;
    const gx = k => X0 + BWD + GAP / 2 + k * (BWD + GAP), gy = k => Y0 + BHT + GAP / 2 + k * (BHT + GAP);
    const rects = [], seen = new Set();
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const mc = COLS - 1 - c, mr = ROWS - 1 - r, key = c + ',' + r, mkey = mc + ',' + mr;
      if (seen.has(key)) continue; seen.add(key); seen.add(mkey);
      if (c === 3 && (r === 1 || r === 2)) continue; // plac pośrodku
      const x = X0 + c * (BWD + GAP), y = Y0 + r * (BHT + GAP), t = rnd(), blk = [];
      if (t < 0.45) blk.push({ k: 'rock', x: x + 10, y: y + 10, w: BWD - 20, h: BHT - 20 });
      else if (t < 0.7) { blk.push({ k: 'rock', x: x + 10, y: y + 10, w: 130, h: BHT - 20 }, { k: 'rock', x: x + BWD - 140, y: y + 10, w: 130, h: BHT - 20 }); }
      else if (t < 0.85) { blk.push({ k: 'trees', x: x + 20, y: y + 20, w: BWD - 40, h: 50 }, { k: 'trees', x: x + 20, y: y + BHT - 70, w: BWD - 40, h: 50 }, { k: 'fence', x: x + 20, y: y + BHT / 2 - 9, w: BWD - 40, h: 18 }); }
      else blk.push({ k: 'water', x: x + 40, y: y + 40, w: BWD - 80, h: BHT - 80 }, { k: 'fence', x: x + 10, y: y + 10, w: BWD - 20, h: 18 });
      blk.forEach(b => { rects.push(b); const q = rotB(b); if (!(c === mc && r === mr)) rects.push(q); });
      if (c === mc && r === mr) blk.forEach(b => rects.push(rotB(b)));
    }
    const paths = [];
    for (let k = 0; k < ROWS - 1; k++) paths.push({ x: 44, y: gy(k) - GAP / 2, w: d.W - 88, h: GAP });
    for (let k = 0; k < COLS - 1; k++) paths.push({ x: gx(k) - GAP / 2, y: 44, w: GAP, h: d.H - 88 });
    d.spawns = [[gx(0), gy(0)], [gx(5), gy(2)], [gx(0), gy(2)], [gx(5), gy(0)], [gx(2), gy(1)], [gx(3), gy(1)], [gx(1), gy(0)], [gx(4), gy(2)]];
    d.boss = [d.W / 2, d.H / 2];
    maps.miasto = finishBig(d, bord.concat(rects), { paths, plaza: [d.W / 2, d.H / 2, 150] });
  })();

  // 3) Labirynt: zimowy żywopłot z drzew; symetryczny, z otwartym pokojem pośrodku (boss) i pętlami, żeby nie było ślepych zaułków wszędzie
  (function () {
    const d = { id: 'labirynt', name: 'Labirynt', icon: '🧱', theme: 'winter', W: 3200, H: 1800 };
    const { bord } = bigBase(d), rnd = mulberry(913), C = 200, NC = 16, NR = 9, TH = 36;
    const open = new Set(), ek = (c, r, dir) => c + ',' + r + ',' + dir; // dir 'h' = przejście w prawo (c→c+1), 'v' = w dół (r→r+1)
    const rotEdge = (c, r, dir) => dir === 'h' ? [NC - 2 - c, NR - 1 - r, 'h'] : [NC - 1 - c, NR - 2 - r, 'v'];
    const HC = NC / 2, vis = Array.from({ length: NC * NR }, () => false), stack = [[0, 0]]; vis[0] = true;
    while (stack.length) { // DFS tylko na lewej połowie (c < 8): spójny labirynt, który potem odbijamy o 180°
      const [c, r] = stack[stack.length - 1], nb = [];
      if (c + 1 < HC && !vis[r * NC + c + 1]) nb.push([c + 1, r, ek(c, r, 'h')]);
      if (c > 0 && !vis[r * NC + c - 1]) nb.push([c - 1, r, ek(c - 1, r, 'h')]);
      if (r + 1 < NR && !vis[(r + 1) * NC + c]) nb.push([c, r + 1, ek(c, r, 'v')]);
      if (r > 0 && !vis[(r - 1) * NC + c]) nb.push([c, r - 1, ek(c, r - 1, 'v')]);
      if (!nb.length) { stack.pop(); continue; }
      const [nc, nr, e] = nb[Math.floor(rnd() * nb.length)]; open.add(e); vis[nr * NC + nc] = true; stack.push([nc, nr]);
    }
    for (let i = 0; i < 9; i++) { // kilka dodatkowych przejść (pętle), tylko w lewej połowie
      const c = Math.floor(rnd() * (HC - 1)), r = Math.floor(rnd() * (NR - 1)), dir = rnd() < 0.5 ? 'h' : 'v';
      open.add(ek(c, r, dir));
    }
    for (const e of [...open]) { const [c, r, dir] = e.split(','); open.add(ek(...rotEdge(+c, +r, dir))); } // prawa połowa = obrócona lewa
    [1, 4, 7].forEach(r => open.add(ek(HC - 1, r, 'h'))); // drzwi w środkowej linii łączą obie połowy
    for (let r = 3; r <= 5; r++) { open.add(ek(HC - 1, r, 'h')); if (r < 5) { open.add(ek(HC - 1, r, 'v')); open.add(ek(HC, r, 'v')); } } // pokój pośrodku (boss)
    const rects = [];
    for (let r = 0; r < NR; r++) { let run = null; // ściany pionowe (między c i c+1) scalone w pasy
      for (let c = 0; c < NC - 1; c++) { /* składane niżej po kolumnach */ } }
    for (let c = 0; c < NC - 1; c++) { let start = -1; // pionowe: linia x = (c+1)*C, odcinki po r
      for (let r = 0; r <= NR; r++) { const wall = r < NR && !open.has(ek(c, r, 'h')); if (wall && start < 0) start = r; if (!wall && start >= 0) { rects.push({ k: 'trees', x: (c + 1) * C - TH / 2, y: start * C, w: TH, h: (r - start) * C }); start = -1; } } }
    for (let r = 0; r < NR - 1; r++) { let start = -1; // poziome: linia y = (r+1)*C
      for (let c = 0; c <= NC; c++) { const wall = c < NC && !open.has(ek(c, r, 'v')); if (wall && start < 0) start = c; if (!wall && start >= 0) { rects.push({ k: 'trees', x: start * C, y: (r + 1) * C - TH / 2, w: (c - start) * C, h: TH }); start = -1; } } }
    const cc = (c, r) => [c * C + C / 2, r * C + C / 2];
    d.spawns = [cc(0, 0), cc(15, 8), cc(0, 8), cc(15, 0), cc(7, 0), cc(8, 8), cc(0, 4), cc(15, 4)];
    d.boss = [d.W / 2, d.H / 2];
    maps.labirynt = finishBig(d, bord.concat(rects), { paths: [], itemMax: 14 });
  })();

  Object.values(maps).forEach(m => { m.W = m.W || W; m.H = m.H || H; });
  const get = id => maps[id] || maps.lava;
  const list = Object.values(maps).map(m => [m.id, m.icon + ' ' + m.name]);

  const api = { W, H, T, maps, get, list, BULLET_BLOCK, stones, boulders, spawns, itemSpots, isLava, onStone, segCircle, segRect, pushRect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ArenaMap = api;
})(typeof window !== 'undefined' ? window : globalThis);
