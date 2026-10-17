// Kalambury: rysujesz hasło, reszta zgaduje na czacie. Rysunek leci osobnym kanałem "relay" (patrz server.js).
const DRAW_MS = 80000, REVEAL_MS = 5000, CYCLES = 2, CHAT_MAX = 40;
const WORDS = {
  'Zwierzęta': ['KOT','PIES','ŻYRAFA','SŁOŃ','PINGWIN','REKIN','MOTYL','WĄŻ','KROKODYL','PAJĄK'],
  'Jedzenie': ['PIZZA','BANAN','HAMBURGER','LODY','ARBUZ','SPAGHETTI','JAJECZNICA','POPCORN'],
  'Przedmioty': ['PARASOL','OKULARY','ROWER','KLUCZ','ŻARÓWKA','NOŻYCZKI','ZEGAR','GITARA','LATARKA'],
  'Czynności': ['PŁYWANIE','TAŃCZENIE','SPANIE','GOTOWANIE','WSPINACZKA','JAZDA NA ROWERZE'],
  'Miejsca': ['PLAŻA','SZKOŁA','LOTNISKO','ZAMEK','KOSMOS','ZOO','WULKAN'],
  'Zawody': ['STRAŻAK','PILOT','LEKARZ','KUCHARZ','ASTRONAUTA','POLICJANT','FRYZJER']
};
const norm = t => String(t).toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/\s+/g, ' ').trim();
const say = (s, text, name) => { s.chat.push({ name: name || null, text }); if (s.chat.length > CHAT_MAX) s.chat.shift(); };

function pick(s) {
  const all = Object.entries(WORDS).flatMap(([c, ws]) => ws.map(w => [c, w]));
  let free = all.filter(([, w]) => !s.used.includes(w));
  if (!free.length) { s.used = []; free = all; }
  const [c, w] = free[Math.floor(Math.random() * free.length)];
  s.used.push(w); return [c, w];
}
function startTurn(s) {
  const [c, w] = pick(s);
  s.category = c; s.word = w; s.phase = 'draw'; s.solved = []; s.seq++;
  s.endsAt = Date.now() + DRAW_MS; say(s, `${s.names[s.drawer]} rysuje!`);
  return s;
}
function toReveal(s) { s.phase = 'reveal'; s.endsAt = Date.now() + REVEAL_MS; say(s, `Hasło: ${s.word}`); return s; }
function nextTurn(s) {
  s.turnNo++;
  if (s.turnNo >= s.totalTurns) { s.phase = 'over'; s.endsAt = null; s.word = null; return s; }
  s.drawer = (s.drawer + 1) % s.names.length;
  return startTurn(s);
}
function create(names) {
  return startTurn({ names, scores: names.map(() => 0), chat: [], used: [], seq: 0, turnNo: 0, totalTurns: names.length * CYCLES, drawer: 0 });
}

module.exports = {
  meta: { id: 'charades', name: 'Kalambury', icon: '🎨', desc: 'Rysuj hasło, a reszta zgaduje na czacie.', min: 2, max: 8 },

  init: players => create(players.map(p => p.name)),

  move(s, me, d) {
    if (d.type !== 'guess') return { error: 'Nieznany ruch.' };
    if (s.phase !== 'draw') return { error: 'Runda się skończyła.' };
    if (me === s.drawer) return { error: 'Rysujący nie zgaduje.' };
    if (s.solved.includes(me)) return { error: 'Już odgadłeś hasło.' };
    const text = String(d.text || '').trim().slice(0, 60);
    if (!text) return { error: 'Wpisz odpowiedź.' };
    if (norm(text) === norm(s.word)) {
      const left = Math.max(0, s.endsAt - Date.now());
      s.solved.push(me);
      s.scores[me] += 20 + Math.ceil(80 * left / DRAW_MS);
      s.scores[s.drawer] += 10;
      say(s, `${s.names[me]} odgaduje hasło!`);
      if (s.solved.length >= s.names.length - 1) toReveal(s);
    } else say(s, text, s.names[me]);
    return s;
  },

  tick(s) { return s.phase === 'draw' ? toReveal(s) : s.phase === 'reveal' ? nextTurn(s) : s; },
  canRelay: (s, me) => s.phase === 'draw' && me === s.drawer,

  view(s, me) {
    const out = { ...s, used: undefined, msLeft: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0, drawMs: DRAW_MS };
    out.hint = s.word ? [...s.word].map(c => (c === ' ' ? ' ' : '_')).join('') : '';
    out.word = (s.phase !== 'draw' || me === s.drawer) ? s.word : null;
    return out;
  },

  rematch: s => (s.phase === 'over' ? create(s.names) : s),

  onLeave(s, idx) {
    const wasDrawer = idx === s.drawer;
    s.names.splice(idx, 1); s.scores.splice(idx, 1);
    const n = s.names.length; if (n < 2) return null;
    s.solved = s.solved.filter(i => i !== idx).map(i => (i > idx ? i - 1 : i));
    if (s.phase === 'over') return s;
    if (wasDrawer) {
      if (s.phase === 'draw') { s.drawer = idx % n; return startTurn(s); }
      s.drawer = (idx - 1 + n) % n; return s;
    }
    if (idx < s.drawer) s.drawer--;
    if (s.phase === 'draw' && s.solved.length >= n - 1) toReveal(s);
    return s;
  }
};
