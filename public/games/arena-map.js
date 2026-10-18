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

  function autoSpots(m) {
    const out = [];
    for (let x = 110; x <= W - 110; x += 110) for (let y = 110; y <= H - 110; y += 110) {
      if (m.rects.some(r => distRect(x, y, r) < 40)) continue;
      if (m.spawns.slice(0, 4).some(s => Math.hypot(s[0] - x, s[1] - y) < 110)) continue;
      if (Math.hypot(x - m.boss[0], y - m.boss[1]) < 90) continue;
      out.push({ x, y });
    }
    return out;
  }

  const maps = {};
  maps.lava = { id: 'lava', name: 'Arena Lawy', icon: '🌋', theme: 'lava', hasLava: true, isLava, stones, onStone, boulders, rects: [], paths: [], spawns, itemSpots, boss: [905, 500] };

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

  const get = id => maps[id] || maps.lava;
  const list = Object.values(maps).map(m => [m.id, m.icon + ' ' + m.name]);

  const api = { W, H, T, maps, get, list, BULLET_BLOCK, stones, boulders, spawns, itemSpots, isLava, onStone, segCircle, segRect, pushRect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ArenaMap = api;
})(typeof window !== 'undefined' ? window : globalThis);
