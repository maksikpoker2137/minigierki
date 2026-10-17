// Statki 10x10 dla 2 graczy. Flota: 5, 4, 3, 3, 2.
// Statki nie mogą się stykać (także rogami). Trafiony strzela dalej.
// Po zatopieniu pola wokół statku są automatycznie oznaczane jako pudła.
// Ukryta jest flota przeciwnika – każdy gracz dostaje własny "widok" (view).
const N = 10, LENS = [5, 4, 3, 3, 2];

// pole + wszystkie osiem sąsiadów
const near = i => {
  const r = (i / N) | 0, c = i % N, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
  }
  return out;
};

// sprawdza rozstawienie od gracza, zwraca [[pola statku], ...] albo null
function parse(ships) {
  if (!Array.isArray(ships) || ships.length !== LENS.length) return null;
  const lens = ships.map(x => x && x.len).sort((a, b) => b - a);
  if (lens.some((l, i) => l !== LENS[i])) return null;
  const occ = new Set(), fleet = [];
  for (const { len, r, c, h } of ships) {
    if (![r, c].every(Number.isInteger)) return null;
    const cells = [];
    for (let k = 0; k < len; k++) {
      const rr = h ? r : r + k, cc = h ? c + k : c;
      if (rr < 0 || rr >= N || cc < 0 || cc >= N) return null;
      cells.push(rr * N + cc);
    }
    if (cells.some(i => near(i).some(j => occ.has(j)))) return null;
    cells.forEach(i => occ.add(i));
    fleet.push(cells);
  }
  return fleet;
}

const create = (names, scores, round) => ({
  names, scores, round, phase: 'setup', ready: [false, false], fleets: [null, null],
  shots: [[], []], turn: round % 2, winner: null, last: null
});

module.exports = {
  meta: { id: 'battleship', name: 'Statki', icon: '🚢', desc: 'Rozstaw flotę i zatop okręty przeciwnika. Trafiony strzela dalej.', min: 2, max: 2 },

  init: players => create(players.map(p => p.name), [0, 0], 0),

  move(s, me, d) {
    if (d.type === 'ready') {
      if (s.phase !== 'setup' || s.ready[me]) return { error: 'Flota jest już rozstawiona.' };
      const fleet = parse(d.ships);
      if (!fleet) return { error: 'Niepoprawne rozstawienie floty.' };
      s.fleets[me] = fleet; s.ready[me] = true;
      if (s.ready[0] && s.ready[1]) s.phase = 'play';
      return s;
    }

    if (d.type === 'fire') {
      if (s.phase !== 'play') return { error: 'Gra się teraz nie toczy.' };
      if (me !== s.turn) return { error: 'Teraz strzela przeciwnik.' };
      const cell = d.cell;
      if (!Number.isInteger(cell) || cell < 0 || cell >= N * N) return { error: 'Nie ma takiego pola.' };
      const mine = s.shots[me];
      if (mine.includes(cell)) return { error: 'Tu już strzelałeś.' };
      const opp = 1 - me, ship = s.fleets[opp].find(f => f.includes(cell));
      mine.push(cell);
      let sunk = false;
      if (ship) {
        sunk = ship.every(i => mine.includes(i));
        if (sunk) ship.forEach(i => near(i).forEach(j => { if (!mine.includes(j)) mine.push(j); }));
        if (s.fleets[opp].every(f => f.every(i => mine.includes(i)))) { s.phase = 'over'; s.winner = me; s.scores[me]++; }
      } else s.turn = opp; // pudło = kolej przeciwnika, trafienie = strzelasz dalej
      s.last = { by: me, cell, hit: !!ship, sunk };
      return s;
    }
    return { error: 'Nieznany ruch.' };
  },

  // Co widzi dany gracz: swoją flotę w całości, a z floty przeciwnika
  // tylko zatopione statki (całą dopiero po końcu partii).
  view(s, me) {
    const opp = 1 - me, oppFleet = s.fleets[opp], mine = s.shots[me];
    const oppCells = new Set((oppFleet || []).flat());
    return {
      names: s.names, scores: s.scores, round: s.round, phase: s.phase, turn: s.turn,
      winner: s.winner, ready: s.ready, last: s.last,
      mine: s.fleets[me],
      oppShots: s.shots[opp],
      myShots: mine.map(c => ({ c, hit: oppCells.has(c) })),
      oppSunk: (oppFleet || []).filter(f => f.every(i => mine.includes(i))),
      oppFleet: s.phase === 'over' ? oppFleet : null
    };
  },

  // kolejna partia: nowe rozstawienie, wyniki zostają, zaczyna druga osoba
  rematch(s) { return s.phase === 'over' ? create(s.names, s.scores, s.round + 1) : s; }
};
