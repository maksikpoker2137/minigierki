// Arena Lawy – wspólna geometria mapy. Ten sam plik czyta serwer (require) i przeglądarka (<script>),
// dzięki temu obie strony zawsze zgadzają się, gdzie jest lawa, kamienie i przeszkody.
(function (root) {
  const W = 1800, H = 1000, T = 18; // wymiary świata i rozmiar "piksela" lawy

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

  const api = { W, H, T, stones, boulders, spawns, itemSpots, isLava, onStone, segCircle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ArenaMap = api;
})(typeof window !== 'undefined' ? window : globalThis);
