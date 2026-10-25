// Paczki kart Pokémon – każdy gracz w rundzie otwiera własną paczkę 5 kart (po kolei albo wszystkie naraz).
// Punkty karty zależą od rzadkości (zwykła 1 … Gigantamax 15), karta „holo” daje ×2. Po ostatniej rundzie wygrywa najwięcej punktów.
// Co jest w zakrytych kartach, wie tylko serwer – view wysyła kartę dopiero po jej odkryciu.
// Tryb „Walka”: po otwarciu wszystkich paczek każdy układa drużynę 3 kart ze swojej kolekcji; drużyny walczą każda z każdą
// (wynik liczy serwer, przeglądarka tylko odtwarza przebieg walki).
const P = require('../public/games/pokemon-data.js');

const PACK = 5;          // kart w paczce
const HOLO = 0.12;       // szansa na karty holo (×2 punkty)
// szansa rzadkości dla kolejnych miejsc w paczce: 1–3 zwykłe, 4 lepsze, 5 „rzadkie” miejsce
const SLOTS = [
  { c: 75, u: 25 }, { c: 75, u: 25 }, { c: 75, u: 25 },
  { c: 40, u: 45, r: 15 },
  { u: 40, r: 40, e: 15, l: 5 }
];

const pickRarity = w => {
  const keys = Object.keys(w), total = keys.reduce((a, k) => a + w[k], 0);
  let x = Math.random() * total;
  for (const k of keys) { x -= w[k]; if (x < 0) return k; }
  return keys[0];
};
const ORDER = ['c', 'u', 'r', 'e', 'l'];
// karta wylosowanej rzadkości z puli paczki; gdy w puli nie ma takiej rzadkości, bierzemy najbliższą (najpierw niższą)
function drawCard(pool, rar) {
  const at = ORDER.indexOf(rar);
  for (let d = 0; d < ORDER.length; d++) for (const k of [at - d, at + d]) {
    const ids = pool.filter(id => P.CARDS[id].rarity === ORDER[k]);
    if (ORDER[k] && ids.length) return ids[Math.floor(Math.random() * ids.length)];
  }
}
const makePack = kind => {
  const pool = P.pack(kind).ids;
  return SLOTS.map(w => ({ id: drawCard(pool, pickRarity(w)), holo: Math.random() < HOLO, up: false }));
};
const value = c => P.RARITY[P.CARDS[c.id].rarity].pts * (c.holo ? 2 : 1);

// tryb 'choose': na starcie rundy każdy wybiera rodzaj paczki; tryb 'mixed': wszyscy dostają mieszaną
function startRound(s) {
  s.gained = s.names.map(() => 0);
  if (s.mode === 'choose') { s.phase = 'pick'; s.kinds = s.names.map(() => null); s.packs = s.names.map(() => []); }
  else { s.phase = 'open'; s.kinds = s.names.map(() => 'mixed'); s.packs = s.kinds.map(makePack); }
  return s;
}

function create(names, wins, rounds, game, mode, battle) {
  return startRound({
    names, wins, rounds, game, mode, battle: !!battle, round: 0,
    packs: [], kinds: [],
    coll: names.map(() => []),   // tryb walki: wszystkie otwarte karty gracza (z powtórkami) – z nich buduje się drużynę
    team: names.map(() => null), // wybrana drużyna: indeksy w coll
    results: null,
    scores: names.map(() => 0), gained: names.map(() => 0),
    dex: names.map(() => [])   // unikalne karty zebrane w tej grze (id)
  });
}

const allOpen = s => s.packs.every(p => p.every(c => c.up));

// koniec rundy: policz punkty, dopisz karty do kolekcji; po ostatniej rundzie wyłoń zwycięzcę
function endRound(s) {
  s.packs.forEach((pack, i) => {
    s.gained[i] = pack.reduce((a, c) => a + value(c), 0);
    s.scores[i] += s.gained[i];
    pack.forEach(c => { if (!s.dex[i].includes(c.id)) s.dex[i].push(c.id); if (s.battle) s.coll[i].push({ id: c.id, holo: c.holo }); });
  });
  if (s.round + 1 >= s.rounds && s.battle) s.phase = 'team';
  else if (s.round + 1 >= s.rounds) {
    s.phase = 'over';
    const best = Math.max(...s.scores);
    s.scores.forEach((v, i) => { if (v === best) s.wins[i]++; });
  } else s.phase = 'between';
  return s;
}

// ---- walka ----
const unit = c => { const d = P.CARDS[c.id], st = P.stats(d, c.holo); return { id: c.id, holo: c.holo, hp: st.hp, max: st.hp, atk: st.atk, def: st.def, spd: st.spd }; };
const alive = t => t.filter(u => u.hp > 0);

// pojedynek drużyn: pierwsza żywa karta z każdej strony, szybsza bije pierwsza; zwraca zapis przebiegu do odtworzenia
function duel(teamA, teamB) {
  const T = { a: teamA.map(unit), b: teamB.map(unit) }, at = { a: 0, b: 0 }, log = [];
  const start = { a: T.a.map(u => ({ id: u.id, holo: u.holo, max: u.max })), b: T.b.map(u => ({ id: u.id, holo: u.holo, max: u.max })) };
  log.push({ k: 'send', side: 'a', i: 0 }, { k: 'send', side: 'b', i: 0 });
  let winner = null;
  for (let turn = 0; turn < 500 && !winner; turn++) {
    const A = T.a[at.a], B = T.b[at.b];
    const first = A.spd > B.spd ? 'a' : B.spd > A.spd ? 'b' : (Math.random() < 0.5 ? 'a' : 'b');
    for (const side of [first, first === 'a' ? 'b' : 'a']) {
      const other = side === 'a' ? 'b' : 'a', X = T[side][at[side]], Y = T[other][at[other]];
      if (X.hp <= 0 || Y.hp <= 0) continue;
      const mv = P.bestMove(P.CARDS[X.id].types, P.CARDS[Y.id].types), crit = Math.random() < 0.06;
      const dmg = Math.max(1, Math.round(X.atk * mv.eff * (0.85 + Math.random() * 0.3) * 100 / (100 + Y.def) * (crit ? 1.5 : 1)));
      Y.hp = Math.max(0, Y.hp - dmg);
      log.push({ k: 'atk', side, from: at[side], to: at[other], dmg, eff: mv.eff, crit, move: mv.type, struggle: !!mv.struggle, hp: Y.hp, ko: Y.hp === 0 });
      if (Y.hp === 0) {
        const next = T[other].findIndex(u => u.hp > 0);
        if (next < 0) { winner = side; break; }
        at[other] = next; log.push({ k: 'send', side: other, i: next });
      }
    }
  }
  if (!winner) winner = alive(T.a).length >= alive(T.b).length ? 'a' : 'b'; // zabezpieczenie, nie powinno się zdarzyć
  log.push({ k: 'end', winner });
  return { start, log, winner, left: T[winner].reduce((a, u) => a + u.hp, 0) };
}

// wszyscy z każdym; wygrywa najwięcej wygranych pojedynków, przy remisie – więcej pozostałego życia
function runBattle(s) {
  const n = s.names.length, table = s.names.map(name => ({ name, wins: 0, hp: 0 })), duels = [];
  const squad = i => s.team[i].map(k => s.coll[i][k]);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = duel(squad(i), squad(j)), w = d.winner === 'a' ? i : j;
    table[w].wins++; table[w].hp += d.left;
    duels.push({ an: s.names[i], bn: s.names[j], start: d.start, log: d.log, winner: d.winner });
  }
  s.results = { duels, table };
  const key = r => r.wins * 100000 + r.hp, best = Math.max(...table.map(key));
  table.forEach((r, i) => { if (key(r) === best) s.wins[i]++; });
  s.phase = 'over';
  return s;
}
const allReady = s => s.team.every(Boolean);

module.exports = {
  meta: {
    id: 'packs', name: 'Paczki kart Pokémon', icon: '🎴',
    desc: 'Otwieraj paczki kart z Pokémonami i zbieraj punkty – albo ułóż drużynę z wylosowanych kart i walcz!',
    min: 2, max: 6,
    options: [
      { id: 'rounds', label: 'Liczba paczek', def: '5', values: [['3', '3 paczki'], ['5', '5 paczek'], ['10', '10 paczek']] },
      { id: 'game', label: 'Tryb gry', def: 'points', values: [['points', '🏆 Punkty (najlepsze karty)'], ['battle', '⚔️ Walka drużyn']] },
      { id: 'mode', label: 'Rodzaj paczek', def: 'choose', values: [['choose', 'Wybierasz typ (roślinna, ogień…)'], ['mixed', 'Tylko mieszane']] }
    ]
  },

  init: (players, o) => create(players.map(p => p.name), players.map(() => 0), +((o && o.rounds) || 5) || 5, 0, o && o.mode === 'mixed' ? 'mixed' : 'choose', o && o.game === 'battle'),

  move(s, me, d) {
    if (d.type === 'pick') {
      if (s.phase !== 'pick') return { error: 'Paczki są już wybrane.' };
      if (s.kinds[me]) return { error: 'Już wybrałeś paczkę.' };
      if (!P.PACKS.some(p => p.id === d.kind)) return { error: 'Nie ma takiej paczki.' };
      s.kinds[me] = d.kind; s.packs[me] = makePack(d.kind);
      if (s.kinds.every(Boolean)) s.phase = 'open';
      return s;
    }
    if (d.type === 'flip' || d.type === 'flipall') {
      if (s.phase !== 'open') return { error: 'Ta runda już się skończyła.' };
      const pack = s.packs[me];
      if (d.type === 'flipall') pack.forEach(c => { c.up = true; });
      else {
        const i = d.i;
        if (!Number.isInteger(i) || i < 0 || i >= pack.length) return { error: 'Nie ma takiej karty.' };
        if (pack[i].up) return { error: 'Ta karta jest już odkryta.' };
        pack[i].up = true;
      }
      return allOpen(s) ? endRound(s) : s;
    }
    if (d.type === 'team') {
      if (s.phase !== 'team') return { error: 'Drużyna jest teraz niepotrzebna.' };
      if (s.team[me]) return { error: 'Drużyna już wybrana.' };
      const idx = d.idx;
      if (!Array.isArray(idx) || idx.length !== P.TEAM || idx.some(k => !Number.isInteger(k) || k < 0 || k >= s.coll[me].length) || new Set(idx).size !== idx.length)
        return { error: `Wybierz dokładnie ${P.TEAM} różne karty.` };
      s.team[me] = idx.slice();
      return allReady(s) ? runBattle(s) : s;
    }
    if (d.type === 'next') {
      if (s.phase !== 'between') return { error: 'Jeszcze nie teraz.' };
      s.round++;
      return startRound(s);
    }
    return { error: 'Nieznany ruch.' };
  },

  // zakryte karty nie opuszczają serwera
  view(s, me) {
    const team = s.phase === 'team';
    return {
      battle: s.battle, teamSize: P.TEAM, results: s.results,
      coll: s.coll.map((c, i) => (i === me && (team || s.phase === 'over')) ? c : (s.phase === 'over' ? c : [])),
      collN: s.coll.map(c => c.length),
      team: s.team.map((t, i) => (i === me || s.phase === 'over') ? t : !!t),
      names: s.names, wins: s.wins, rounds: s.rounds, game: s.game, round: s.round, phase: s.phase,
      kinds: s.phase === 'pick' ? s.kinds.map(k => !!k) : s.kinds,
      scores: s.scores, gained: s.gained, dex: s.dex, total: P.CARDS.length,
      packs: s.packs.map(p => p.map(c => c.up ? c : { up: false }))
    };
  },

  rematch: s => s.phase === 'over' ? create(s.names, s.wins, s.rounds, s.game + 1, s.mode, s.battle) : s,

  // ktoś wyszedł (serwer już usunął go z listy graczy)
  onLeave(s, idx) {
    ['names', 'wins', 'scores', 'gained', 'dex', 'packs', 'kinds', 'coll', 'team'].forEach(k => s[k].splice(idx, 1));
    if (s.names.length < 2) return null;
    if (s.phase === 'pick' && s.kinds.every(Boolean)) s.phase = 'open';
    if (s.phase === 'open' && allOpen(s)) endRound(s);
    if (s.phase === 'team' && allReady(s)) runBattle(s);
    return s;
  }
};
