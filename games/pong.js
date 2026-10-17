// Pong dla 2 graczy, do 7 punktów. Gra na żywo: serwer symuluje piłkę i paletki (step() ~30x/s, patrz server.js).
// Gracz 0 = lewa paletka, gracz 1 = prawa. Klient wysyła tylko docelową pozycję paletki, a serwer przesuwa ją
// z ograniczoną prędkością, więc nie da się "teleportować" paletki.
const W = 1000, H = 600, PW = 14, PH = 110, MARGIN = 24, R = 9;
const PADDLE_SPEED = 750, START_SPEED = 430, MAX_SPEED = 950, SPEEDUP = 1.06, MAX_ANGLE = 1.05;
const WIN = 7, SERVE_MS = 1400;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function serve(s, toward) { // toward: 0 = w lewo, 1 = w prawo
  const a = (Math.random() * 0.6 - 0.3);
  s.ball = { x: W / 2, y: H / 2, vx: (toward === 0 ? -1 : 1) * START_SPEED * Math.cos(a), vy: START_SPEED * Math.sin(a) };
  s.serveAt = Date.now() + SERVE_MS;
}
function create(names, wins, round) {
  const s = { names, wins, round, phase: 'play', scores: [0, 0], paddles: [H / 2, H / 2], targets: [H / 2, H / 2], winner: null, ball: null, serveAt: 0 };
  serve(s, round % 2);
  return s;
}

module.exports = {
  meta: { id: 'pong', name: 'Pong', icon: '🏓', desc: 'Klasyczny pojedynek paletek na żywo. Kto pierwszy do 7 punktów?', min: 2, max: 2 },

  init: players => create(players.map(p => p.name), players.map(() => 0), 0),

  move(s, me, d) {
    if (d.type !== 'paddle' || typeof d.y !== 'number' || !isFinite(d.y)) return { error: 'Nieznany ruch.' };
    s.targets[me] = clamp(d.y, PH / 2, H - PH / 2);
    return s;
  },

  // zwraca true, gdy stan się zmienił i trzeba go wysłać
  step(s, dt) {
    if (s.phase !== 'play') return false;
    for (let i = 0; i < 2; i++) {
      const d = s.targets[i] - s.paddles[i], m = PADDLE_SPEED * dt;
      s.paddles[i] = clamp(s.paddles[i] + clamp(d, -m, m), PH / 2, H - PH / 2);
    }
    if (Date.now() < s.serveAt) return true; // piłka czeka na serwis
    const b = s.ball, px = b.x, py = b.y;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); }
    else if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy); }

    // odbicie od paletki: sprawdzamy przejście przez jej przód (żeby szybka piłka nie przeleciała na wylot)
    const faces = [MARGIN + PW, W - MARGIN - PW];
    for (let i = 0; i < 2; i++) {
      const f = faces[i], dir = i === 0 ? -1 : 1;
      const crossing = i === 0 ? (b.vx < 0 && px - R >= f && b.x - R <= f) : (b.vx > 0 && px + R <= f && b.x + R >= f);
      if (!crossing) continue;
      const t = (i === 0 ? px - R - f : f - px - R) / Math.abs(b.x - px || 1);
      const yc = py + (b.y - py) * clamp(t, 0, 1);
      if (Math.abs(yc - s.paddles[i]) > PH / 2 + R) continue; // pudło
      const rel = clamp((yc - s.paddles[i]) / (PH / 2), -1, 1), ang = rel * MAX_ANGLE;
      const sp = Math.min(Math.hypot(b.vx, b.vy) * SPEEDUP, MAX_SPEED);
      b.vx = -dir * sp * Math.cos(ang); b.vy = sp * Math.sin(ang);
      b.x = i === 0 ? f + R : f - R; b.y = yc;
    }

    // gol
    const out = b.x < -R ? 1 : b.x > W + R ? 0 : -1; // kto zdobył punkt
    if (out >= 0) {
      s.scores[out]++;
      if (s.scores[out] >= WIN) {
        s.phase = 'over'; s.winner = out; s.wins[out]++;
      } else serve(s, 1 - out); // piłka leci do tego, kto stracił punkt
    }
    return true;
  },

  view(s) {
    const b = s.ball, r1 = v => Math.round(v * 10) / 10;
    return {
      names: s.names, scores: s.scores, wins: s.wins, round: s.round, phase: s.phase, winner: s.winner,
      paddles: s.paddles.map(r1), ball: { x: r1(b.x), y: r1(b.y), vx: r1(b.vx), vy: r1(b.vy) },
      serveMs: Math.max(0, s.serveAt - Date.now()), win: WIN, dim: { W, H, PW, PH, MARGIN, R }
    };
  },

  rematch(s) { return s.phase === 'over' ? create(s.names, s.wins, s.round + 1) : s; },

  onLeave: () => null // gra tylko dla dwojga – po wyjściu wracamy do poczekalni
};
