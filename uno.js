// UNO dla 2–8 graczy. Talia 108 kart, po 7 na start. Wygrywa rundę ten, kto pierwszy pozbędzie się kart (+1 pkt).
// Zasady: kolor lub wartość musi pasować, dzikie karty pasują zawsze. Stop (S), zmiana kierunku (V), +2, zmiana koloru (W), +4.
// Bez kumulowania +2/+4 (ofiara dobiera i traci kolejkę). Po dobraniu można zagrać tylko dobraną kartę albo spasować.
// Przy dwóch graczach zmiana kierunku działa jak stop.
// UNO: przy 1–2 kartach można zawołać UNO. Kto zostanie z jedną kartą bez zawołania, może zostać "złapany" (+2 karty)
// przez kogokolwiek, zanim następny gracz wykona ruch. Limit tury: po jego upływie serwer dobiera kartę za gracza.
const COLORS = ['R', 'Y', 'G', 'B'];
const CNAME = { R: 'czerwony', Y: 'żółty', G: 'zielony', B: 'niebieski' };
const TURN_MS = 40000;

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function makeDeck() {
  const d = [];
  for (const c of COLORS) {
    d.push({ c, v: '0' });
    for (let k = 0; k < 2; k++) {
      for (let n = 1; n <= 9; n++) d.push({ c, v: String(n) });
      ['S', 'V', '+2'].forEach(v => d.push({ c, v }));
    }
  }
  for (let k = 0; k < 4; k++) { d.push({ c: 'W', v: 'W' }); d.push({ c: 'W', v: '+4' }); }
  return shuffle(d);
}

const playable = (s, card) => card.c === 'W' || card.c === s.color || card.v === s.top.v;
const sym = { S: 'stop', V: 'zmiana kierunku', '+2': '+2', W: 'zmiana koloru', '+4': '+4 i zmiana koloru' };
const cardText = (card, color) => card.c === 'W' ? `${sym[card.v]} (${CNAME[color]})` : `${CNAME[card.c]} ${sym[card.v] || card.v}`;
const say = (s, t) => { s.log.push(t); if (s.log.length > 6) s.log.shift(); };

function refill(s) { // pusty stos dobierania: tasujemy odrzucone karty (zostaje tylko wierzchnia)
  if (s.deck.length || s.discard.length < 2) return;
  const top = s.discard.pop(); s.deck = shuffle(s.discard); s.discard = [top];
}
function drawCards(s, i, n) {
  for (let k = 0; k < n; k++) { refill(s); if (!s.deck.length) break; s.hands[i].push(s.deck.pop()); }
  s.called[i] = false;
}
function advance(s, steps) {
  const n = s.names.length;
  s.turn = ((s.turn + s.dir * steps) % n + n) % n;
  s.hasDrawn = false; s.endsAt = Date.now() + TURN_MS;
}

function create(names, scores, start, round) {
  const deck = makeDeck();
  const hands = names.map(() => []);
  for (let k = 0; k < 7; k++) hands.forEach(h => h.push(deck.pop()));
  const at = deck.findIndex(c => c.c !== 'W' && /^\d$/.test(c.v)); // pierwsza karta na stole zawsze liczbowa
  const top = deck.splice(at, 1)[0];
  return {
    names, scores, start, round, deck, discard: [top], top, color: top.c, hands, dir: 1, turn: start, hasDrawn: false,
    called: names.map(() => false), vuln: null, winner: null, phase: 'play', log: [], endsAt: Date.now() + TURN_MS
  };
}

module.exports = {
  meta: { id: 'uno', name: 'UNO', icon: '🃏', desc: 'Pozbądź się kart jako pierwszy. Pamiętaj, żeby zawołać UNO!', min: 2, max: 8 },

  init: players => create(players.map(p => p.name), players.map(() => 0), 0, 0),

  move(s, me, d) {
    if (s.phase !== 'play') return { error: 'Runda się skończyła.' };
    const name = s.names[me];

    if (d.type === 'uno') {
      if (s.hands[me].length > 2) return { error: 'UNO możesz zawołać, gdy masz 1–2 karty.' };
      s.called[me] = true; if (s.vuln === me) s.vuln = null;
      say(s, `${name}: UNO!`); return s;
    }
    if (d.type === 'catch') {
      if (s.vuln === null || s.vuln === me) return { error: 'Nie ma kogo łapać.' };
      const v = s.vuln; drawCards(s, v, 2); s.vuln = null;
      say(s, `${name} przyłapuje ${s.names[v]} bez UNO (+2 karty)`); return s;
    }
    if (me !== s.turn) return { error: 'Teraz tura kogoś innego.' };

    if (d.type === 'draw') {
      if (s.hasDrawn) return { error: 'Już dobrałeś kartę w tej turze.' };
      s.vuln = null; drawCards(s, me, 1);
      const card = s.hands[me][s.hands[me].length - 1];
      if (card && playable(s, card)) { s.hasDrawn = true; s.endsAt = Date.now() + TURN_MS; say(s, `${name} dobiera kartę`); }
      else { say(s, `${name} dobiera kartę i pasuje`); advance(s, 1); }
      return s;
    }
    if (d.type === 'pass') {
      if (!s.hasDrawn) return { error: 'Najpierw dobierz kartę.' };
      s.vuln = null; say(s, `${name} pasuje`); advance(s, 1); return s;
    }
    if (d.type === 'play') {
      const hand = s.hands[me], i = d.i;
      if (!Number.isInteger(i) || i < 0 || i >= hand.length) return { error: 'Nie ma takiej karty.' };
      if (s.hasDrawn && i !== hand.length - 1) return { error: 'Po dobraniu możesz zagrać tylko dobraną kartę.' };
      const card = hand[i];
      if (!playable(s, card)) return { error: 'Ta karta nie pasuje.' };
      if (card.c === 'W' && !COLORS.includes(d.color)) return { error: 'Wybierz kolor.' };
      s.vuln = null;
      hand.splice(i, 1); s.discard.push(card); s.top = card;
      s.color = card.c === 'W' ? d.color : card.c;
      say(s, `${name} zagrywa: ${cardText(card, s.color)}`);
      if (!hand.length) { s.phase = 'over'; s.winner = me; s.scores[me]++; s.endsAt = null; return s; }
      if (hand.length === 1 && !s.called[me]) s.vuln = me; // zapomniał zawołać UNO – można go złapać
      const n = s.names.length, next = ((s.turn + s.dir) % n + n) % n;
      if (card.v === 'V') { s.dir = -s.dir; advance(s, n === 2 ? 2 : 1); }
      else if (card.v === 'S') { say(s, `${s.names[next]} traci kolejkę`); advance(s, 2); }
      else if (card.v === '+2' || card.v === '+4') {
        const k = card.v === '+2' ? 2 : 4; drawCards(s, next, k);
        say(s, `${s.names[next]} dobiera ${k} i traci kolejkę`); advance(s, 2);
      } else advance(s, 1);
      return s;
    }
    return { error: 'Nieznany ruch.' };
  },

  // upłynął limit tury: gracz dobiera kartę (albo pasuje, jeśli już dobrał) i kolej przechodzi dalej
  tick(s) {
    if (s.phase !== 'play') { s.endsAt = null; return s; }
    const name = s.names[s.turn]; s.vuln = null;
    if (!s.hasDrawn) { drawCards(s, s.turn, 1); say(s, `${name} nie zdążył – dobiera kartę`); }
    else say(s, `${name} nie zdążył – pasuje`);
    advance(s, 1); return s;
  },

  view(s, me) {
    const mine = me >= 0 ? s.hands[me] : [];
    return {
      names: s.names, scores: s.scores, phase: s.phase, round: s.round, counts: s.hands.map(h => h.length),
      hand: mine, can: me >= 0 && s.phase === 'play' && s.turn === me ? mine.map(c => playable(s, c)) : [],
      top: s.top, color: s.color, dir: s.dir, turn: s.turn, hasDrawn: s.hasDrawn, called: s.called,
      vuln: s.vuln, deckLeft: s.deck.length, winner: s.winner, log: s.log,
      msLeft: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0
    };
  },

  rematch(s) { return s.phase === 'over' ? create(s.names, s.scores, (s.start + 1) % s.names.length, s.round + 1) : s; },

  onLeave(s, idx) {
    const wasTurn = idx === s.turn, leaver = s.hands[idx];
    s.names.splice(idx, 1); s.scores.splice(idx, 1); s.hands.splice(idx, 1); s.called.splice(idx, 1);
    const n = s.names.length; if (n < 2) return null;
    if (s.winner === idx) s.winner = null; else if (s.winner !== null && s.winner > idx) s.winner--;
    if (s.phase === 'over') return s;
    s.deck.unshift(...leaver); // karty wychodzącego wracają na spód stosu
    if (s.vuln === idx) s.vuln = null; else if (s.vuln !== null && s.vuln > idx) s.vuln--;
    if (idx < s.start) s.start--; s.start %= n;
    if (idx < s.turn) s.turn--;
    else if (wasTurn) { s.turn = s.dir === 1 ? idx % n : (idx - 1 + n) % n; s.hasDrawn = false; s.endsAt = Date.now() + TURN_MS; }
    return s;
  },

  _test: { makeDeck }
};
