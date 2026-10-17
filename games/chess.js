// Szachy dla 2 graczy, pełne zasady: roszada, bicie w przelocie, promocja, szach, mat, pat,
// remis przez powtórzenie (3x), 50 ruchów, za mało materiału oraz remis za zgodą i poddanie partii.
// Plansza: tablica 64 pól, indeks = rząd*8 + kolumna, rząd 0 to 8. linia (góra), białe grają "w górę".
// Małe litery = czarne, duże = białe: p n b r q k. Kolor 0 = białe, 1 = czarne.
// seat[kolor] = numer gracza w pokoju; w kolejnej partii kolory się zamieniają.
const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]], BISH = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const LET = { n: 'S', b: 'G', r: 'W', q: 'H', k: 'K' }; // polska notacja: skoczek, goniec, wieża, hetman, król
const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const colorOf = p => (p === p.toUpperCase() ? 0 : 1);
const mk = (col, t) => (col === 0 ? t.toUpperCase() : t);
const sqn = i => 'abcdefgh'[i & 7] + (8 - (i >> 3));

function startBoard() {
  const rows = ['rnbqkbnr', 'pppppppp', '', '', '', '', 'PPPPPPPP', 'RNBQKBNR'], b = Array(64).fill('');
  rows.forEach((row, r) => [...row].forEach((ch, c) => { b[r * 8 + c] = ch; }));
  return b;
}

function attacked(b, sq, by) {
  const r = sq >> 3, c = sq & 7, pr = r + (by === 0 ? 1 : -1);
  for (const dc of [-1, 1]) if (inb(pr, c + dc) && b[pr * 8 + c + dc] === mk(by, 'p')) return true;
  for (const [dr, dc] of KN) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && b[rr * 8 + cc] === mk(by, 'n')) return true; }
  for (const [dr, dc] of KG) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && b[rr * 8 + cc] === mk(by, 'k')) return true; }
  for (const [dirs, a] of [[ROOK, 'r'], [BISH, 'b']]) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (inb(rr, cc)) {
        const x = b[rr * 8 + cc];
        if (x) { if (x === mk(by, a) || x === mk(by, 'q')) return true; break; }
        rr += dr; cc += dc;
      }
    }
  }
  return false;
}

function pseudo(pos) {
  const { board: b, turn: col, castle, ep } = pos, out = [];
  const add = (from, to, extra) => out.push({ from, to, ...extra });
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (!p || colorOf(p) !== col) continue;
    const t = p.toLowerCase(), r = i >> 3, c = i & 7;
    if (t === 'p') {
      const dir = col === 0 ? -1 : 1, start = col === 0 ? 6 : 1, last = col === 0 ? 0 : 7;
      const put = to => { if ((to >> 3) === last) ['q', 'r', 'b', 'n'].forEach(x => add(i, to, { promo: x })); else add(i, to); };
      const f = (r + dir) * 8 + c;
      if (inb(r + dir, c) && !b[f]) { put(f); if (r === start && !b[f + dir * 8]) add(i, f + dir * 8); }
      for (const dc of [-1, 1]) {
        const cc = c + dc; if (!inb(r + dir, cc)) continue;
        const to = (r + dir) * 8 + cc;
        if (b[to] && colorOf(b[to]) !== col) put(to); else if (!b[to] && to === ep) add(i, to, { ep: true });
      }
    } else if (t === 'n' || t === 'k') {
      for (const [dr, dc] of t === 'n' ? KN : KG) {
        const rr = r + dr, cc = c + dc; if (!inb(rr, cc)) continue;
        const x = b[rr * 8 + cc]; if (!x || colorOf(x) !== col) add(i, rr * 8 + cc);
      }
    } else {
      for (const [dr, dc] of t === 'r' ? ROOK : t === 'b' ? BISH : [...ROOK, ...BISH]) {
        let rr = r + dr, cc = c + dc;
        while (inb(rr, cc)) {
          const x = b[rr * 8 + cc];
          if (!x) add(i, rr * 8 + cc); else { if (colorOf(x) !== col) add(i, rr * 8 + cc); break; }
          rr += dr; cc += dc;
        }
      }
    }
  }
  const opp = 1 - col, e = col === 0 ? 60 : 4, rk = col === 0 ? 'R' : 'r';
  if (b[e] === mk(col, 'k') && !attacked(b, e, opp)) {
    const ks = col === 0 ? castle.K : castle.k, qs = col === 0 ? castle.Q : castle.q;
    if (ks && b[e + 3] === rk && !b[e + 1] && !b[e + 2] && !attacked(b, e + 1, opp) && !attacked(b, e + 2, opp)) add(e, e + 2, { castle: 'K' });
    if (qs && b[e - 4] === rk && !b[e - 1] && !b[e - 2] && !b[e - 3] && !attacked(b, e - 1, opp) && !attacked(b, e - 2, opp)) add(e, e - 2, { castle: 'Q' });
  }
  return out;
}

// wykonuje ruch na kopii pozycji (bez sprawdzania legalności)
function play(pos, m) {
  const b = pos.board.slice(), col = pos.turn, piece = b[m.from];
  b[m.to] = m.promo ? mk(col, m.promo) : piece; b[m.from] = '';
  if (m.ep) b[(m.from >> 3) * 8 + (m.to & 7)] = '';
  if (m.castle === 'K') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = ''; }
  if (m.castle === 'Q') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = ''; }
  const castle = { ...pos.castle };
  if (piece === 'K') castle.K = castle.Q = false;
  if (piece === 'k') castle.k = castle.q = false;
  const corner = { 0: 'q', 7: 'k', 56: 'Q', 63: 'K' };
  if (corner[m.from]) castle[corner[m.from]] = false;
  if (corner[m.to]) castle[corner[m.to]] = false;
  const ep = piece.toLowerCase() === 'p' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1;
  return { board: b, turn: 1 - col, castle, ep };
}

const kingSq = (b, col) => b.indexOf(mk(col, 'k'));
const inCheck = (pos, col) => attacked(pos.board, kingSq(pos.board, col), 1 - col);
const legalMoves = pos => pseudo(pos).filter(m => !inCheck(play(pos, m), pos.turn));

function sanOf(pos, legal, m) {
  const b = pos.board, piece = b[m.from], t = piece.toLowerCase();
  if (m.castle) return m.castle === 'K' ? 'O-O' : 'O-O-O';
  const capture = !!b[m.to] || !!m.ep; let s = '';
  if (t === 'p') {
    if (capture) s += 'abcdefgh'[m.from & 7] + 'x';
    s += sqn(m.to); if (m.promo) s += '=' + LET[m.promo];
  } else {
    s += LET[t];
    const others = legal.filter(x => x !== m && x.to === m.to && b[x.from] === piece);
    if (others.length) {
      const sameFile = others.some(x => (x.from & 7) === (m.from & 7)), sameRank = others.some(x => (x.from >> 3) === (m.from >> 3));
      if (!sameFile) s += 'abcdefgh'[m.from & 7]; else if (!sameRank) s += 8 - (m.from >> 3); else s += sqn(m.from);
    }
    if (capture) s += 'x'; s += sqn(m.to);
  }
  return s;
}

// za mało materiału, żeby ktokolwiek mógł dać mata: gołe króle, król + 1 lekka figura, same gońcy na polach jednego koloru
function insufficient(b) {
  const rest = []; b.forEach((p, i) => { if (p && p.toLowerCase() !== 'k') rest.push({ t: p.toLowerCase(), sq: ((i >> 3) + (i & 7)) % 2 }); });
  if (!rest.length) return true;
  if (rest.length === 1) return rest[0].t === 'n' || rest[0].t === 'b';
  return rest.every(x => x.t === 'b' && x.sq === rest[0].sq);
}

const keyOf = (s, legal) => s.board.map(x => x || '.').join('') + s.turn + ['K', 'Q', 'k', 'q'].map(k => (s.castle[k] ? k : '')).join('')
  + (legal.some(m => m.ep) ? s.ep : '-');

function create(names, scores, round) {
  const s = {
    names, scores, round, seat: round % 2 ? [1, 0] : [0, 1], board: startBoard(), turn: 0,
    castle: { K: true, Q: true, k: true, q: true }, ep: -1, half: 0, last: null, check: -1, winner: null, reason: null,
    drawOffer: null, moves: [], cap: [[], []], seen: {}
  };
  s.legal = legalMoves(s); s.seen[keyOf(s, s.legal)] = 1;
  return s;
}
const end = (s, winner, reason) => { s.winner = winner; s.reason = reason; if (winner !== 'draw') s.scores[winner]++; s.drawOffer = null; s.legal = []; return s; };

module.exports = {
  meta: { id: 'chess', name: 'Szachy', icon: '♟️', desc: 'Pełne zasady: roszada, bicie w przelocie, promocja, remis. Kolory zmieniają się co partię.', min: 2, max: 2 },
  init: players => create(players.map(p => p.name), [0, 0], 0),

  move(s, me, d) {
    const col = s.seat.indexOf(me);
    if (s.winner !== null) return { error: 'Partia skończona.' };
    if (d.type === 'resign') return end(s, s.seat[1 - col], 'resign');
    if (d.type === 'draw') {
      if (s.drawOffer === null) { s.drawOffer = me; return s; }
      if (s.drawOffer !== me) return end(s, 'draw', 'agreement'); // przyjęcie oferty przeciwnika
      return s;
    }
    if (d.type === 'decline') { if (s.drawOffer !== null && s.drawOffer !== me) s.drawOffer = null; return s; }
    if (d.type !== 'move') return { error: 'Nieznany ruch.' };
    if (col !== s.turn) return { error: 'Teraz ruch przeciwnika.' };

    const cand = s.legal.filter(m => m.from === d.from && m.to === d.to);
    if (!cand.length) return { error: 'Niedozwolony ruch.' };
    const m = cand.length > 1 ? cand.find(x => x.promo === d.promo) : cand[0];
    if (!m) return { error: 'Wybierz figurę, na którą promujesz pionka.' };

    const pos = { board: s.board, turn: s.turn, castle: s.castle, ep: s.ep };
    const piece = s.board[m.from], victim = m.ep ? mk(1 - col, 'p') : s.board[m.to];
    let text = sanOf(pos, s.legal, m);
    if (victim) s.cap[col].push(victim);
    Object.assign(s, play(pos, m));
    s.half = piece.toLowerCase() === 'p' || victim ? 0 : s.half + 1;
    s.last = { from: m.from, to: m.to };
    s.legal = legalMoves(s);
    s.check = inCheck(s, s.turn) ? kingSq(s.board, s.turn) : -1;
    if (!s.legal.length) { text += s.check >= 0 ? '#' : ''; s.moves.push(text); return end(s, s.check >= 0 ? me : 'draw', s.check >= 0 ? 'mate' : 'stalemate'); }
    if (s.check >= 0) text += '+';
    s.moves.push(text); s.drawOffer = null;
    const k = keyOf(s, s.legal); s.seen[k] = (s.seen[k] || 0) + 1;
    if (insufficient(s.board)) return end(s, 'draw', 'material');
    if (s.seen[k] >= 3) return end(s, 'draw', 'repetition');
    if (s.half >= 100) return end(s, 'draw', 'fifty');
    return s;
  },

  // ruchy widzi tylko gracz, który jest na ruchu; promocje zwijamy do jednego wpisu [z, na, czyPromocja]
  view(s, me) {
    const col = s.seat.indexOf(me);
    return {
      names: s.names, scores: s.scores, round: s.round, seat: s.seat, board: s.board, turn: s.turn, last: s.last,
      check: s.check, winner: s.winner, reason: s.reason, drawOffer: s.drawOffer, moves: s.moves, cap: s.cap,
      legal: col >= 0 && col === s.turn && s.winner === null ? s.legal.filter(m => !m.promo || m.promo === 'q').map(m => [m.from, m.to, m.promo ? 1 : 0]) : []
    };
  },

  rematch: s => (s.winner !== null ? create(s.names, s.scores, s.round + 1) : s),
  _test: { legalMoves, play, create, sanOf, insufficient }
};
