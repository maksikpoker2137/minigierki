// Wyścig pisania dla 2–8 graczy. 3 rundy, w każdej wszyscy przepisują to samo angielskie zdanie (małe litery, bez interpunkcji).
// Fazy: countdown (odliczanie, zdania jeszcze nie widać) -> race -> results -> (następna runda) -> over.
// Serwer sam liczy postęp (długość poprawnego początku tekstu) i czas ukończenia – klient niczego nie "zgłasza".
const SENTENCES = [
  'the quick brown fox jumps over the lazy dog',
  'a journey of a thousand miles begins with a single step',
  'all that glitters is not gold',
  'practice makes perfect so keep typing every day',
  'the early bird catches the worm',
  'rain is falling outside so we are staying in to play games',
  'she sells sea shells by the sea shore',
  'better late than never but never late is better',
  'a little patience goes a long way',
  'every cloud has a silver lining',
  'we will have pizza tonight and then watch a good movie',
  'the train to london leaves from platform three at noon',
  'a small turtle slowly climbed the big hill of sand',
  'good friends are like stars you do not always see them but you know they are there',
  'when the sun is shining everything looks much better',
  'in winter the streets are covered with snow and kids build a snowman',
  'the best coffee is the one you drink with good company',
  'the old clock in the tower struck midnight and everything went quiet',
  'spring fills the meadows with thousands of colorful flowers',
  'typing fast is great exercise for your fingers and your brain',
  'the ship left the harbor at dawn and vanished over the horizon',
  'every hero was once an ordinary child with big dreams',
  'you can ride a bike through the forest to the lake in an hour',
  'the cat sat on the windowsill and watched the falling leaves'
];
const ROUNDS = 3, COUNT_MS = 3500, RACE_MS = 60000, RESULT_MS = 8000;

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function startRound(s) {
  s.phase = 'countdown'; s.text = s.sentences[s.idx];
  s.progress = s.names.map(() => 0); s.finished = s.names.map(() => null); s.order = []; s.pts = s.names.map(() => 0);
  s.startedAt = null; s.endsAt = Date.now() + COUNT_MS;
  return s;
}
function create(names, wins, round) {
  return startRound({
    names, wins, round, idx: 0, sentences: shuffle([...SENTENCES]).slice(0, ROUNDS),
    scores: names.map(() => 0), endsAt: null
  });
}
// punkty za miejsce: pierwszy dostaje tyle punktów, ilu jest graczy, kolejny o 1 mniej (min. 1); kto nie skończył – 0
function toResults(s) {
  const n = s.names.length;
  s.order.forEach((p, k) => { s.pts[p] = Math.max(n - k, 1); s.scores[p] += s.pts[p]; });
  s.phase = 'results'; s.endsAt = Date.now() + RESULT_MS;
  return s;
}
function finish(s) {
  s.phase = 'over'; s.endsAt = null;
  const best = Math.max(...s.scores);
  s.scores.forEach((v, i) => { if (v === best) s.wins[i]++; });
  return s;
}

module.exports = {
  meta: { id: 'typing', name: 'Wyścig pisania', icon: '⌨️', desc: 'Kto pierwszy przepisze angielskie zdanie bez błędów? Trzy rundy, punkty za miejsce.', min: 2, max: 8 },

  init: players => create(players.map(p => p.name), players.map(() => 0), 0),

  move(s, me, d) {
    if (d.type !== 'progress') return { error: 'Nieznany ruch.' };
    if (s.phase !== 'race' || Date.now() > s.endsAt) return s; // spóźniony pakiet – ignorujemy po cichu
    if (s.finished[me]) return s;
    const text = String(d.text || '').slice(0, s.text.length + 1), target = s.text;
    let ok = 0; while (ok < text.length && ok < target.length && text[ok] === target[ok]) ok++;
    s.progress[me] = ok;
    if (ok === target.length && text.length === target.length) {
      const t = Date.now() - s.startedAt;
      s.finished[me] = { t, wpm: Math.round((target.length / 5) / (t / 60000)) };
      s.order.push(me);
      if (s.finished.every(Boolean)) return toResults(s);
    }
    return s;
  },

  tick(s) {
    if (s.phase === 'countdown') { s.phase = 'race'; s.startedAt = Date.now(); s.endsAt = s.startedAt + RACE_MS; return s; }
    if (s.phase === 'race') return toResults(s);
    if (s.phase === 'results') { if (s.idx + 1 >= ROUNDS) return finish(s); s.idx++; return startRound(s); }
    s.endsAt = null; return s;
  },

  // zdanie jest ukryte do startu wyścigu
  view(s) {
    return {
      names: s.names, scores: s.scores, wins: s.wins, round: s.round, phase: s.phase, idx: s.idx, rounds: ROUNDS,
      text: s.phase === 'race' || s.phase === 'results' ? s.text : null, len: s.text.length,
      progress: s.progress, finished: s.finished, order: s.order, pts: s.pts,
      msLeft: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0
    };
  },

  rematch(s) { return s.phase === 'over' ? create(s.names, s.wins, s.round + 1) : s; },

  onLeave(s, idx) {
    const re = i => (i > idx ? i - 1 : i);
    s.names.splice(idx, 1); s.scores.splice(idx, 1); s.wins.splice(idx, 1);
    if (s.names.length < 2) return null;
    if (s.phase === 'over') return s;
    s.progress.splice(idx, 1); s.finished.splice(idx, 1); s.pts.splice(idx, 1);
    s.order = s.order.filter(i => i !== idx).map(re);
    if (s.phase === 'race' && s.finished.every(Boolean)) return toResults(s);
    return s;
  }
};
