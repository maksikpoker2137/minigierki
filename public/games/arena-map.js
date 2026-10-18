// Arena Lawy – wspólna geometria map. Ten sam plik czyta serwer (require) i przeglądarka (<script>),
// dzięki temu obie strony zawsze zgadzają się, gdzie jest lawa, kamienie i przeszkody.
// Mapy to zwykłe dane: jeziora lawy (blob), suche przejścia (dry), kamienie na lawie, głazy, miejsca startu i przedmiotów.
(function (root) {
  const W = 1800, H = 1000, T = 18; // wymiary świata i rozmiar "piksela" lawy

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

  // blob: zaokrąglony prostokąt/elipsa (p = "kanciastość": 2 elipsa, 3 zaokrąglony, 10 prawie kwadrat), hole = dziura w środku (pierścień)
  const defs = [
    {
      id: 'jeziora', name: 'Dwa jeziora', theme: { ground: '#7b3d28', lava: '#f7870c' },
      blobs: [{ cx: 522, cy: 482, rx: 325, ry: 375 }, { cx: 1306, cy: 522, rx: 335, ry: 374 }],
      stones: [[436, 257], [614, 257], [389, 392], [523, 392], [346, 523], [569, 523], [747, 616], [435, 659], [569, 701],
        [1238, 299], [1463, 344], [1285, 434], [1553, 479], [1150, 481], [1373, 616], [1104, 659], [1328, 791]],
      boulders: [[95, 250], [95, 760], [1740, 300], [1740, 740], [700, 55], [1100, 55], [700, 950], [1150, 950]],
      spawns: [[110, 70], [1690, 930], [110, 930], [1690, 70], [905, 60], [905, 940], [70, 500], [1745, 520]],
      dirt: [[330, 55], [1480, 55], [270, 935], [1530, 945], [60, 500], [1750, 500], [905, 500], [905, 230], [905, 780]]
    },
    {
      id: 'rzeka', name: 'Lawowa rzeka', theme: { ground: '#5f4a3a', lava: '#f7870c' },
      blobs: [{ cx: 450, cy: 500, rx: 400, ry: 115, p: 3 }, { cx: 1350, cy: 500, rx: 400, ry: 115, p: 3 }], // między nimi most
      stones: [[200, 500], [450, 500], [700, 500], [1100, 500], [1350, 500], [1600, 500]],
      boulders: [[300, 230], [900, 200], [1500, 230], [300, 770], [900, 800], [1500, 770]],
      spawns: [[110, 100], [1690, 900], [110, 900], [1690, 100], [900, 60], [900, 940], [600, 300], [1200, 700]],
      dirt: [[330, 330], [1470, 330], [330, 670], [1470, 670], [900, 500], [900, 340], [900, 660], [600, 100], [1200, 900]]
    },
    {
      id: 'fosa', name: 'Fosa', theme: { ground: '#6a4a3e', lava: '#ff6a1a' },
      blobs: [{ cx: 900, cy: 500, rx: 600, ry: 430, hole: 0.62 }],
      dry: [[250, 455, 1550, 545], [855, 50, 945, 950]], // cztery mosty przez fosę
      stones: [[400, 250], [1400, 250], [400, 750], [1400, 750], [560, 330], [1240, 330], [560, 670], [1240, 670]],
      boulders: [[760, 400], [1040, 400], [760, 600], [1040, 600], [150, 150], [1650, 150], [150, 850], [1650, 850]],
      spawns: [[110, 70], [1690, 930], [110, 930], [1690, 70], [900, 60], [900, 940], [70, 500], [1745, 520]],
      dirt: [[900, 500], [900, 300], [900, 700], [700, 500], [1100, 500], [330, 500], [1470, 500], [250, 250], [1550, 750]]
    },
    {
      id: 'archipelag', name: 'Archipelag', theme: { ground: '#6b4631', lava: '#f58a10' },
      blobs: [{ cx: 350, cy: 300, rx: 200, ry: 150 }, { cx: 900, cy: 200, rx: 230, ry: 120 }, { cx: 1450, cy: 300, rx: 200, ry: 150 },
        { cx: 350, cy: 720, rx: 200, ry: 150 }, { cx: 900, cy: 790, rx: 230, ry: 120 }, { cx: 1450, cy: 720, rx: 200, ry: 150 }, { cx: 900, cy: 500, rx: 170, ry: 110 }],
      stones: [[350, 300], [260, 260], [440, 340], [900, 200], [1450, 300], [1360, 260], [1540, 340], [350, 720], [260, 760], [440, 680], [900, 790], [1450, 720], [1360, 760], [1540, 680], [900, 500]],
      boulders: [[620, 430], [1180, 570], [240, 500], [1580, 500], [620, 120], [1180, 120], [620, 880], [1180, 880]],
      spawns: [[110, 70], [1690, 930], [110, 930], [1690, 70], [640, 620], [1160, 380], [70, 500], [1745, 520]],
      dirt: [[640, 300], [1160, 700], [900, 60], [900, 940], [150, 500], [1650, 500], [620, 760], [1180, 240], [900, 350]]
    },
    {
      id: 'glazowisko', name: 'Głazowisko', theme: { ground: '#5a5560', lava: '#ff5a1f' },
      blobs: [{ cx: 500, cy: 500, rx: 130, ry: 90 }, { cx: 1300, cy: 500, rx: 130, ry: 90 }],
      stones: [[500, 500], [1300, 500]],
      boulders: [[300, 200], [600, 200], [900, 160], [1200, 200], [1500, 200], [250, 500], [700, 500], [900, 500], [1100, 500], [1550, 500],
        [300, 800], [600, 800], [900, 840], [1200, 800], [1500, 800]],
      spawns: [[110, 70], [1690, 930], [110, 930], [1690, 70], [900, 60], [900, 940], [70, 500], [1745, 520]],
      dirt: [[450, 350], [1350, 350], [450, 650], [1350, 650], [900, 330], [900, 670], [150, 350], [1650, 650], [800, 500], [1000, 500]]
    },
    {
      id: 'szachownica', name: 'Szachownica', theme: { ground: '#3f5b6b', lava: '#8a3cff' },
      blobs: [[300, 200], [900, 200], [1500, 200], [600, 500], [1200, 500], [300, 800], [900, 800], [1500, 800]].map(([cx, cy]) => ({ cx, cy, rx: 110, ry: 110, p: 10 })),
      stones: [[300, 200], [900, 200], [1500, 200], [600, 500], [1200, 500], [300, 800], [900, 800], [1500, 800], [600, 440], [1200, 560]],
      boulders: [[600, 200], [1200, 200], [300, 500], [900, 500], [1500, 500], [600, 800], [1200, 800]],
      spawns: [[110, 70], [1690, 930], [110, 930], [1690, 70], [600, 350], [1200, 650], [70, 500], [1745, 520]],
      dirt: [[450, 350], [1350, 650], [750, 350], [1050, 650], [150, 500], [1650, 500], [600, 100], [1200, 900], [900, 350], [900, 650]]
    }
  ];

  function build(d) {
    const blobs = d.blobs.map(b => Object.assign({ p: 2.6, hole: 0 }, b));
    const dry = d.dry || [];
    function isLava(x, y) {
      const px = Math.floor(x / T) * T + T / 2, py = Math.floor(y / T) * T + T / 2; // skok co "piksel" = poszarpany brzeg
      for (const r of dry) if (px >= r[0] && px <= r[2] && py >= r[1] && py <= r[3]) return false;
      const noise = 0.08 * Math.sin(px * 0.043 + py * 0.017) * Math.sin(py * 0.05 - px * 0.011);
      for (const b of blobs) {
        const v = Math.pow(Math.abs(px - b.cx) / b.rx, b.p) + Math.pow(Math.abs(py - b.cy) / b.ry, b.p);
        if (v < 1 + noise && (!b.hole || v > Math.pow(b.hole, b.p))) return true;
      }
      return false;
    }
    const stones = d.stones.map(([x, y]) => ({ x, y, r: 24 })); // kamienie na lawie – można na nich stać bezpiecznie
    const onStone = (x, y) => stones.some(s => (x - s.x) ** 2 + (y - s.y) ** 2 < (s.r + 6) ** 2);
    const boulders = d.boulders.map(([x, y]) => ({ x, y, r: 28 })); // głazy blokują ruch, pociski i widok
    const itemSpots = d.dirt.map(([x, y]) => ({ x, y })).concat(stones.filter((_, i) => i % 3 === 0).map(s => ({ x: s.x, y: s.y })));
    return { id: d.id, name: d.name, theme: d.theme, W, H, T, stones, boulders, spawns: d.spawns, itemSpots, isLava, onStone, segCircle };
  }

  const maps = {}; defs.forEach(d => { maps[d.id] = build(d); });
  const ids = defs.map(d => d.id);
  const api = { W, H, T, segCircle, ids, maps, get: id => maps[id] || maps[ids[0]] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ArenaMap = api;
})(typeof window !== 'undefined' ? window : globalThis);
