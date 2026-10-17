// Wisielec dla 2–8 graczy. Hasło zna tylko serwer – każdy gracz dostaje swój "widok" (view).
const MAX_WRONG = 6;
const OK = /^[A-ZĄĆĘŁŃÓŚŹŻ]+$/;
const WORDS = ['KOMPUTER','KLAWIATURA','SAMOLOT','CZEKOLADA','PLAŻA','RODZINA','ROWER','KSIĄŻKA','GITARA','TELEFON','SŁOŃCE','ZIMA','PIZZA','PIŁKA','OKULARY','LATARNIA','WAKACJE','ŻÓŁW','KROKODYL','MOTYL','PINGWIN','TRAKTOR','BUDZIK','PARASOL','SZKOŁA','KANAPKA','LODÓWKA','PLECAK','TELEWIZOR','ZEGAREK','WULKAN','GÓRA','JEZIORO','DINOZAUR','ROBOT','KOSMOS','RAKIETA','PIRAT','SKARB','CYRK','TEATR','ZAMEK','SMOK','KRÓLEWNA','RYCERZ','NAUCZYCIEL','LODY','TRUSKAWKA','ARBUZ','OGRÓD'];

const eligible = (s, i) => s.random || i !== s.setter;
function nextTurn(s) {
  const n = s.names.length; let i = s.turn;
  for (let k = 0; k < n; k++) { i = (i + 1) % n; if (eligible(s, i)) return i; }
  return s.turn;
}
const fresh = (s, setter) => ({ ...s, setter, phase: 'setup', word: null, random: false, guessed: [], wrong: [], turn: 0, result: null, round: (s.round || 0) + 1 });

module.exports = {
  meta: { id: 'hangman', name: 'Wisielec', icon: '🔤', desc: 'Jedna osoba układa hasło, reszta zgaduje litery.', min: 2, max: 8 },

  init(players) {
    return fresh({ names: players.map(p => p.name), scores: players.map(() => 0), round: 0 }, 0);
  },

  move(s, me, d) {
    if (d.type === 'setWord' || d.type === 'random') {
      if (s.phase !== 'setup' || me !== s.setter) return { error: 'Teraz nie możesz ustawić hasła.' };
      if (d.type === 'random') { s.word = WORDS[Math.floor(Math.random() * WORDS.length)]; s.random = true; }
      else {
        const w = String(d.word || '').trim().toLocaleUpperCase('pl');
        if (!OK.test(w) || w.length < 3 || w.length > 20) return { error: 'Hasło: 3–20 liter, bez spacji i cyfr.' };
        s.word = w; s.random = false;
      }
      s.phase = 'play'; s.turn = s.setter; s.turn = nextTurn(s);
      return s;
    }
    if (d.type === 'guess') {
      if (s.phase !== 'play') return { error: 'Runda nie trwa.' };
      if (me !== s.turn) return { error: 'Teraz kolej kogoś innego.' };
      const l = String(d.letter || '').toLocaleUpperCase('pl');
      if (l.length !== 1 || !OK.test(l)) return { error: 'To nie jest litera.' };
      if (s.guessed.includes(l)) return { error: 'Ta litera już była.' };
      s.guessed.push(l);
      const count = [...s.word].filter(c => c === l).length;
      if (count) {
        s.scores[me] += count;
        if ([...s.word].every(c => s.guessed.includes(c))) { s.scores[me] += 3; s.phase = 'over'; s.result = { won: true, by: me }; }
      } else {
        s.wrong.push(l);
        if (s.wrong.length >= MAX_WRONG) { s.phase = 'over'; s.result = { won: false }; if (!s.random) s.scores[s.setter] += 3; }
        else s.turn = nextTurn(s);
      }
      return s;
    }
    return { error: 'Nieznany ruch.' };
  },

  // co widzi dany gracz – hasło tylko po rundzie albo autor hasła
  view(s, me) {
    const out = { ...s, maxWrong: MAX_WRONG };
    out.masked = s.word ? [...s.word].map(c => (s.guessed.includes(c) || s.phase === 'over') ? c : '_') : [];
    out.word = (s.phase === 'over' || (me === s.setter && !s.random)) ? s.word : null;
    return out;
  },

  rematch(s) { return s.phase === 'over' ? fresh(s, (s.setter + 1) % s.names.length) : s; },

  // ktoś wyszedł (serwer już usunął go z listy graczy)
  onLeave(s, idx) {
    s.names.splice(idx, 1); s.scores.splice(idx, 1);
    const n = s.names.length; if (n < 2) return null;
    const key = idx === s.setter || (s.phase === 'play' && idx === s.turn);
    if (idx < s.setter) s.setter--;
    if (idx < s.turn) s.turn--;
    return key ? fresh(s, s.setter % n) : s;
  }
};
