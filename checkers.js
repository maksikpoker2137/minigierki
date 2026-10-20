// Warcaby 8x8: bicie obowiązkowe, pionki biją też do tyłu, damki latają po całej przekątnej.
// Pola: 0 puste, 1 pionek gracza 0, 2 damka gracza 0, 3 pionek gracza 1, 4 damka gracza 1.
// Gracz 0 zaczyna na dole (rzędy 5-7) i idzie w górę.
const own = v => (v - 1) >> 1, isK = v => v % 2 === 0, inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function startBoard() {
  const b = Array(64).fill(0);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) { if (r < 3) b[r * 8 + c] = 3; else if (r > 4) b[r * 8 + c] = 1; }
  return b;
}
// bicia z pola idx; zbite w tej serii (caps) zostają na planszy do końca ruchu i nie można ich minąć ani bić drugi raz
function jumps(b, idx, caps) {
  const v = b[idx], p = own(v), king = isK(v), out = [], r = idx >> 3, c = idx & 7;
  for (const [dr, dc] of DIRS) {
    let rr = r + dr, cc = c + dc;
    if (king) while (inb(rr, cc) && b[rr * 8 + cc] === 0) { rr += dr; cc += dc; }
    if (!inb(rr, cc)) continue;
    const mid = rr * 8 + cc, m = b[mid];
    if (!m || own(m) === p || caps.includes(mid)) continue;
    let lr = rr + dr, lc = cc + dc;
    while (inb(lr, lc) && b[lr * 8 + lc] === 0) { out.push({ to: lr * 8 + lc, cap: mid }); if (!king) break; lr += dr; lc += dc; }
  }
  return out;
}
function steps(b, idx) {
  const v = b[idx], r = idx >> 3, c = idx & 7, out = [];
  const dirs = isK(v) ? DIRS : own(v) === 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
  for (const [dr, dc] of dirs) {
    let rr = r + dr, cc = c + dc;
    while (inb(rr, cc) && b[rr * 8 + cc] === 0) { out.push({ to: rr * 8 + cc }); if (!isK(v)) break; rr += dr; cc += dc; }
  }
  return out;
}
function legal(s) {
  const b = s.board;
  if (s.chain) return jumps(b, s.chain.from, s.chain.caps).map(m => ({ from: s.chain.from, ...m }));
  const caps = [], mv = [];
  for (let i = 0; i < 64; i++) if (b[i] && own(b[i]) === s.turn) jumps(b, i, []).forEach(m => caps.push({ from: i, ...m }));
  if (caps.length) return caps;
  for (let i = 0; i < 64; i++) if (b[i] && own(b[i]) === s.turn) steps(b, i).forEach(m => mv.push({ from: i, ...m }));
  return mv;
}
function create(names, scores, round) {
  const s = { board: startBoard(), turn: round % 2, chain: null, last: null, winner: null, quiet: 0, round, names, scores };
  s.legal = legal(s); return s;
}

module.exports = {
  meta: { id: 'checkers', name: 'Warcaby', icon: '⚪⚫', desc: 'Bicie obowiązkowe, damki latają po całej przekątnej.', min: 2, max: 2 },
  init: players => create(players.map(p => p.name), [0, 0], 0),

  move(s, me, d) {
    if (s.winner !== null) return { error: 'Partia skończona.' };
    if (me !== s.turn) return { error: 'Teraz ruch przeciwnika.' };
    const m = s.legal.find(x => x.from === d.from && x.to === d.to);
    if (!m) return { error: s.legal.some(x => x.cap !== undefined) ? 'Bicie jest obowiązkowe.' : 'Niedozwolony ruch.' };
    const b = s.board, wasKing = isK(b[m.from]);
    let v = b[m.from]; b[m.from] = 0;
    if (!isK(v) && (m.to >> 3) === (me === 0 ? 0 : 7)) v++; // awans na damkę (także w trakcie bicia)
    b[m.to] = v; s.last = { from: m.from, to: m.to };
    if (m.cap !== undefined) {
      const caps = (s.chain ? s.chain.caps : []).concat(m.cap);
      const more = jumps(b, m.to, caps);
      if (more.length) { s.chain = { from: m.to, caps }; s.legal = more.map(x => ({ from: m.to, ...x })); s.quiet = 0; return s; }
      caps.forEach(i => { b[i] = 0; }); s.chain = null; s.quiet = 0;
    } else s.quiet = wasKing ? s.quiet + 1 : 0;
    s.turn = 1 - me; s.legal = legal(s);
    if (!s.legal.length) { s.winner = me; s.scores[me]++; }
    else if (s.quiet >= 40) s.winner = 'draw';
    return s;
  },
  rematch: s => (s.winner !== null ? create(s.names, s.scores, s.round + 1) : s),
  _legal: legal
};
