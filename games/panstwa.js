// Państwa-miasta dla 2–8 graczy. Wszyscy wpisują słowa na wylosowaną literę, potem razem sprawdzają odpowiedzi.
// Odpowiedzi innych graczy są ukryte do końca rundy (patrz view).
// Domyślne kategorie. Gospodarz może je zmienić w ekranie przygotowania (faza 'setup') przed pierwszą rundą.
const DEFAULT_CATS = ['Państwo', 'Miasto', 'Imię', 'Zwierzę', 'Rzecz'];
const MAX_CATS = 12, MAX_CAT_LEN = 24;
const LETTERS = 'ABCDEFGHIJKLMNOPRSTUWZ'.split('');
const ROUNDS = 5;
const PLAY_MS = 90000;   // czas rundy
const STOP_MS = 10000;   // ile zostaje reszcie, gdy ktoś skończy pierwszy
const GRACE_MS = 1500;   // zapas na ostatnie odpowiedzi w drodze do serwera
const REVIEW_MS = 60000; // czas na sprawdzanie wyników

// bez wielkości liter, ogonków i znaków specjalnych: "Łódź" -> "lodz"
const norm = t => String(t).toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ł/g, 'l').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const fits = (a, letter) => { const k = norm(a); return k.length >= 2 && k[0] === letter.toLowerCase(); };

function startRound(s) {
  const free = LETTERS.filter(l => !s.used.includes(l));
  s.letter = free[Math.floor(Math.random() * free.length)];
  s.used.push(s.letter);
  s.phase = 'play';
  s.answers = s.names.map(() => s.cats.map(() => ''));
  s.done = s.names.map(() => false);
  s.stoppedBy = null; s.flags = []; s.ready = [];
  s.deadline = Date.now() + PLAY_MS; s.endsAt = s.deadline + GRACE_MS;
  return s;
}
function toReview(s) {
  s.phase = 'review'; s.deadline = null; s.endsAt = Date.now() + REVIEW_MS; s.ready = [];
  return s;
}
function calc(s) {
  const n = s.names.length;
  const cells = s.cats.map((_, c) => {
    const row = s.names.map((_, p) => {
      const a = s.answers[p][c], k = norm(a);
      const flags = s.flags.filter(f => f.cat === c && f.target === p).length;
      let st = !k ? 'empty' : !fits(a, s.letter) ? 'bad' : flags * 2 > n - 1 ? 'rejected' : 'ok';
      return { a, k, st, pts: 0, flags };
    });
    const valid = row.filter(x => x.st === 'ok');
    valid.forEach(x => {
      if (valid.filter(y => y.k === x.k).length > 1) { x.st = 'dup'; x.pts = 5; }
      else if (valid.length === 1) { x.st = 'solo'; x.pts = 15; }
      else x.pts = 10;
    });
    return row;
  });
  return { cells, total: s.names.map((_, p) => cells.reduce((sum, row) => sum + row[p].pts, 0)) };
}
function advance(s) {
  const { total } = calc(s);
  s.scores = s.scores.map((v, i) => v + total[i]);
  s.ready = [];
  if (s.round + 1 >= ROUNDS) { s.phase = 'over'; s.endsAt = null; s.deadline = null; return s; }
  s.round++;
  return startRound(s);
}
// najpierw ekran przygotowania: gospodarz (gracz nr 0) ustawia kategorie i dopiero potem startuje pierwsza runda
function create(names, cats) {
  return { names, scores: names.map(() => 0), round: 0, used: [], phase: 'setup', cats: [...(cats || DEFAULT_CATS)] };
}
const cleanCat = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, MAX_CAT_LEN);
const cleanAnswers = (a, n) => Array.isArray(a) && a.length === n
  ? a.map(x => String(x == null ? '' : x).trim().replace(/\s+/g, ' ').slice(0, 30)) : null;

module.exports = {
  meta: { id: 'panstwa', name: 'Państwa-miasta', icon: '🌍', desc: 'Słowa na wylosowaną literę. Kto będzie szybszy i bardziej pomysłowy?', min: 2, max: 8 },

  init: players => create(players.map(p => p.name)),

  move(s, me, d) {
    if (s.phase === 'setup') {
      if (me !== 0) return { error: 'Kategorie ustawia gospodarz.' };
      if (d.type === 'addcat') {
        const name = cleanCat(d.name);
        if (name.length < 2) return { error: 'Nazwa kategorii jest za krótka.' };
        if (s.cats.length >= MAX_CATS) return { error: `Maksymalnie ${MAX_CATS} kategorii.` };
        if (s.cats.some(c => c.toLocaleLowerCase('pl') === name.toLocaleLowerCase('pl'))) return { error: 'Taka kategoria już jest.' };
        s.cats.push(name); return s;
      }
      if (d.type === 'delcat') {
        if (!Number.isInteger(d.i) || d.i < 0 || d.i >= s.cats.length) return { error: 'Nie ma takiej kategorii.' };
        if (s.cats.length <= 1) return { error: 'Musi zostać przynajmniej jedna kategoria.' };
        s.cats.splice(d.i, 1); return s;
      }
      if (d.type === 'begin') return startRound(s);
      return { error: 'Najpierw trzeba zacząć grę.' };
    }
    if (d.type === 'addcat' || d.type === 'delcat' || d.type === 'begin') return { error: 'Kategorie można zmieniać tylko przed grą.' };
    if (d.type === 'draft' || d.type === 'stop') {
      if (s.phase !== 'play') return d.type === 'draft' ? s : { error: 'Runda się skończyła.' };
      if (Date.now() > s.endsAt) return d.type === 'draft' ? s : { error: 'Czas minął.' };
      if (s.done[me]) return d.type === 'draft' ? s : { error: 'Już skończyłeś tę rundę.' };
      const a = cleanAnswers(d.answers, s.cats.length);
      if (!a) return d.type === 'draft' ? s : { error: 'Nieprawidłowe odpowiedzi.' };
      if (d.type === 'draft') { s.answers[me] = a; return s; }
      // pierwszy, kto kończy, musi mieć komplet. Reszta może skończyć z tym, co ma.
      if (s.stoppedBy === null && !a.every(x => fits(x, s.letter)))
        return { error: `Uzupełnij wszystko na literę ${s.letter}, zanim zakończysz.` };
      s.answers[me] = a; s.done[me] = true;
      if (s.done.every(Boolean)) return toReview(s);
      if (s.stoppedBy === null) s.stoppedBy = me;
      s.deadline = Math.min(s.deadline, Date.now() + STOP_MS); s.endsAt = s.deadline + GRACE_MS;
      return s;
    }
    if (d.type === 'flag') {
      if (s.phase !== 'review') return { error: 'Teraz nie można odrzucać odpowiedzi.' };
      const { cat, target } = d;
      if (!Number.isInteger(cat) || cat < 0 || cat >= s.cats.length || !Number.isInteger(target) || target < 0 || target >= s.names.length)
        return { error: 'Nieznana odpowiedź.' };
      if (target === me) return { error: 'Własnej odpowiedzi nie odrzucisz.' };
      if (!s.answers[target][cat]) return { error: 'Tu nie ma odpowiedzi.' };
      const i = s.flags.findIndex(f => f.cat === cat && f.target === target && f.voter === me);
      if (i >= 0) s.flags.splice(i, 1); else s.flags.push({ cat, target, voter: me });
      return s;
    }
    if (d.type === 'ready') {
      if (s.phase !== 'review') return s;
      if (!s.ready.includes(me)) s.ready.push(me);
      return s.ready.length >= s.names.length ? advance(s) : s;
    }
    return { error: 'Nieznany ruch.' };
  },

  tick(s) { return s.phase === 'play' ? toReview(s) : s.phase === 'review' ? advance(s) : s; },

  // co widzi dany gracz: w trakcie rundy tylko własne odpowiedzi
  view(s, me) {
    const out = { ...s, rounds: ROUNDS, used: undefined, answers: undefined, flags: undefined, deadline: undefined };
    out.msLeft = s.endsAt ? Math.max(0, (s.phase === 'play' ? s.deadline : s.endsAt) - Date.now()) : 0;
    if (s.phase === 'play') out.mine = s.answers[me];
    if (s.phase === 'review' || s.phase === 'over') {
      const { cells, total } = calc(s);
      out.table = cells.map(row => row.map(({ a, st, pts, flags }) => ({ a, st, pts, flags })));
      out.roundPts = total;
      out.myFlags = s.flags.filter(f => f.voter === me).map(f => f.cat + ':' + f.target);
    }
    return out;
  },

  rematch: s => (s.phase === 'over' ? create(s.names, s.cats) : s),

  // ktoś wyszedł (serwer już usunął go z listy graczy)
  onLeave(s, idx) {
    s.names.splice(idx, 1); s.scores.splice(idx, 1);
    const n = s.names.length; if (n < 2) return null;
    if (s.phase === 'setup') return s; // gospodarzem zostaje kolejny gracz (serwer przesuwa go na pozycję 0)
    s.answers.splice(idx, 1); s.done.splice(idx, 1);
    const re = i => (i > idx ? i - 1 : i);
    s.flags = s.flags.filter(f => f.target !== idx && f.voter !== idx).map(f => ({ ...f, target: re(f.target), voter: re(f.voter) }));
    s.ready = s.ready.filter(i => i !== idx).map(re);
    s.stoppedBy = s.stoppedBy === null || s.stoppedBy === idx ? null : re(s.stoppedBy);
    if (s.phase === 'play' && s.done.every(Boolean)) return toReview(s);
    if (s.phase === 'review' && s.ready.length >= n) return advance(s);
    return s;
  }
};
