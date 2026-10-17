// Memory dla 2–4 graczy. Ilość kart zależy od liczby graczy (16 / 20 / 24, zawsze 4 kolumny).
// Trafiona para = punkt i kolejny ruch. Pudło: obie karty widać chwilę (endsAt), potem tick() odwraca je
// i oddaje kolej. Symbole zakrytych kart zna tylko serwer – view wysyła je dopiero po odkryciu.
const SYMBOLS = ['🐶','🐱','🦊','🐼','🐸','🦁','🐙','🦄','🍕','🍩','🚀','⚽','🎲','🌵','🍉','🎸'];
const COLS = 4, SHOW_MS = 1600;
const CARDS = { 2: 16, 3: 20, 4: 24 };

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function create(names, wins, round) {
  const n = CARDS[names.length] || 16;
  const pick = shuffle([...SYMBOLS]).slice(0, n / 2);
  return {
    names, wins, round, phase: 'play', turn: round % names.length,
    cards: shuffle([...pick, ...pick]),
    owner: Array(n).fill(null),   // null = wolna, liczba = kto zebrał parę, -1 = zebrał ktoś, kto wyszedł
    flipped: [],                  // aktualnie odkryte (jeszcze nie sparowane) karty, max 2
    scores: names.map(() => 0), endsAt: null, last: null
  };
}
const finish = s => {
  s.phase = 'over'; s.flipped = []; s.endsAt = null;
  const best = Math.max(...s.scores);
  s.scores.forEach((v, i) => { if (v === best) s.wins[i]++; });
};

module.exports = {
  meta: { id: 'memory', name: 'Memory', icon: '🃏', desc: 'Odkrywaj karty i zbieraj pary. Trafiona para = kolejny ruch.', min: 2, max: 4 },

  init: players => create(players.map(p => p.name), players.map(() => 0), 0),

  move(s, me, d) {
    if (d.type !== 'flip') return { error: 'Nieznany ruch.' };
    if (s.phase !== 'play') return { error: 'Runda skończona.' };
    if (me !== s.turn) return { error: 'Teraz kolej kogoś innego.' };
    if (s.endsAt) return { error: 'Chwila, karty się odwracają…' };
    const i = d.i;
    if (!Number.isInteger(i) || i < 0 || i >= s.cards.length) return { error: 'Nie ma takiej karty.' };
    if (s.owner[i] !== null || s.flipped.includes(i)) return { error: 'Ta karta jest już odkryta.' };
    s.flipped.push(i);
    if (s.flipped.length < 2) return s;
    const [a, b] = s.flipped;
    if (s.cards[a] === s.cards[b]) {
      s.owner[a] = s.owner[b] = me; s.scores[me]++; s.flipped = [];
      s.last = { by: me, hit: true, symbol: s.cards[a] };
      if (s.owner.every(o => o !== null)) finish(s);
    } else {
      s.last = { by: me, hit: false };
      s.endsAt = Date.now() + SHOW_MS; // po tym czasie serwer woła tick()
    }
    return s;
  },

  tick(s) {
    if (s.endsAt && s.flipped.length === 2) { s.flipped = []; s.turn = (s.turn + 1) % s.names.length; }
    s.endsAt = null;
    return s;
  },

  // zakryte karty nie opuszczają serwera
  view(s) {
    const open = new Set(s.flipped);
    return {
      names: s.names, scores: s.scores, wins: s.wins, round: s.round, phase: s.phase, turn: s.turn,
      cols: COLS, owner: s.owner, flipped: s.flipped, last: s.last, pending: !!s.endsAt,
      cards: s.cards.map((c, i) => (s.owner[i] !== null || open.has(i)) ? c : null)
    };
  },

  rematch(s) { return s.phase === 'over' ? create(s.names, s.wins, s.round + 1) : s; },

  // ktoś wyszedł (serwer już usunął go z listy graczy)
  onLeave(s, idx) {
    s.names.splice(idx, 1); s.scores.splice(idx, 1); s.wins.splice(idx, 1);
    const n = s.names.length; if (n < 2) return null;
    s.owner = s.owner.map(o => o === null ? null : o === idx ? -1 : o > idx ? o - 1 : o);
    if (s.phase === 'play') {
      if (idx < s.turn) s.turn--;
      else if (idx === s.turn) { s.flipped = []; s.endsAt = null; s.turn %= n; } // jego rozgrywka przepada
    } else s.turn %= n;
    return s;
  }
};
