(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Pong – wygląd i sterowanie po stronie przeglądarki. Fizykę liczy serwer; tu tylko rysujemy
// (piłkę lekko przewidujemy między pakietami) i wysyłamy docelową pozycję własnej paletki.
const COL = ['#ffd166', '#4cc9f0']; // gracz 0 (lewy), gracz 1 (prawy)
const KEY_SPEED = 750;              // tyle samo co PADDLE_SPEED na serwerze
let cur = null, me = -1, send = null, got = 0, raf = 0, off = null;
let myY = 300, target = 300, lastSent = -1, sentAt = 0;

function stop() { cancelAnimationFrame(raf); raf = 0; if (off) { off(); off = null; } }

function draw(ctx, s, now) {
  const { W, H, PW, PH, MARGIN, R } = s.dim;
  ctx.fillStyle = '#14132c'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#3c3873'; ctx.lineWidth = 4; ctx.setLineDash([16, 18]);
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = '700 120px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.07)';
  ctx.fillText(s.scores[0], W * 0.25, 150); ctx.fillText(s.scores[1], W * 0.75, 150);

  // paletki: własną rysujemy z lokalnej pozycji (bez opóźnienia), cudzą z serwera
  [0, 1].forEach(i => {
    const y = i === me ? myY : s.paddles[i], x = i === 0 ? MARGIN : W - MARGIN - PW;
    ctx.fillStyle = COL[i]; ctx.globalAlpha = i === me ? 1 : .9;
    ctx.beginPath(); ctx.roundRect(x, y - PH / 2, PW, PH, 6); ctx.fill(); ctx.globalAlpha = 1;
  });

  // piłka: przewidujemy ją do przodu od ostatniego pakietu (max 100 ms)
  const dt = Math.min((now - got) / 1000, 0.1), b = s.ball, waiting = s.serveMs - (now - got) > 0;
  const bx = waiting ? b.x : b.x + b.vx * dt, by = waiting ? b.y : clampY(b.y + b.vy * dt, R, H - R);
  ctx.fillStyle = '#f4f2ff'; ctx.globalAlpha = waiting && Math.floor(now / 200) % 2 ? .35 : 1;
  ctx.beginPath(); ctx.arc(bx, by, R, 0, 7); ctx.fill(); ctx.globalAlpha = 1;

  if (s.phase === 'play' && waiting && s.scores[0] + s.scores[1] === 0) {
    ctx.fillStyle = '#f4f2ff'; ctx.font = '600 44px Fredoka, sans-serif'; ctx.fillText('Gotowi?', W / 2, H / 2 - 50);
  }
}
const clampY = (v, a, b) => Math.max(a, Math.min(b, v));

function frame(el, last) {
  const cv = document.getElementById('pong'); if (!cv) return stop();
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05);
  const s = cur, H = s.dim.H, PH = s.dim.PH;
  if (me >= 0 && s.phase === 'play') {
    const k = keys.down - keys.up; if (k) target = clampY(target + k * KEY_SPEED * dt, PH / 2, H - PH / 2);
    // własna paletka goni cel w tym samym tempie co serwer; gdy rozjedzie się z serwerem, przeskakujemy do jego pozycji
    const d = target - myY, m = KEY_SPEED * dt; myY = clampY(myY + clampY(d, -m, m), PH / 2, H - PH / 2);
    if (Math.abs(myY - s.paddles[me]) > 90) myY = s.paddles[me];
    if (Math.abs(target - lastSent) > 0.5 && now - sentAt > 33) { lastSent = target; sentAt = now; send('move', { type: 'paddle', y: target }); }
  }
  draw(cv.getContext('2d'), s, now);
  raf = requestAnimationFrame(() => frame(el, now));
}

const keys = { up: 0, down: 0 };

function build(el, s) {
  stop();
  const over = s.phase === 'over';
  el.innerHTML = `<div class="bar"><div class="score" id="sc"></div></div>
    <div class="status" id="st" aria-live="polite"></div>
    <canvas id="pong" class="pong" width="${s.dim.W}" height="${s.dim.H}" aria-label="Plansza Ponga"></canvas>
    <p class="lead pong-help" id="hp" style="text-align:center;margin:10px auto 0;font-size:.9rem"></p>
    <div class="actions">${over ? '<button id="again">Jeszcze raz</button>' : ''}<button class="ghost" id="leave">Wyjdź</button></div>`;
  const cv = el.querySelector('#pong');
  myY = target = s.paddles[Math.max(me, 0)]; lastSent = -1; keys.up = keys.down = 0;
  if (me >= 0 && !over) {
    const toY = e => { const r = cv.getBoundingClientRect(); return clampY((e.clientY - r.top) / r.height * s.dim.H, s.dim.PH / 2, s.dim.H - s.dim.PH / 2); };
    cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); target = toY(e); };
    cv.onpointermove = e => { target = toY(e); };
    const kd = e => {
      if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      const k = e.key.toLowerCase(), u = k === 'arrowup' || k === 'w', d = k === 'arrowdown' || k === 's';
      if (u || d) { e.preventDefault(); keys.up = u ? 1 : keys.up; keys.down = d ? 1 : keys.down; }
    };
    const ku = e => { const k = e.key.toLowerCase(); if (k === 'arrowup' || k === 'w') keys.up = 0; if (k === 'arrowdown' || k === 's') keys.down = 0; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    off = () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }
  el.querySelector('#leave').onclick = () => send('leave');
  const again = el.querySelector('#again'); if (again) again.onclick = () => send('rematch');
  raf = requestAnimationFrame(() => frame(el, performance.now()));
}

function update(el, s) {
  el.querySelector('#sc').innerHTML = [0, 1].map(i => `<div class="chip" style="color:${COL[i]}">
    <b>${s.scores[i]}</b><span>${i === 0 ? '◀ ' : ''}${esc(s.names[i])}${i === me ? ' (ty)' : ''}${i === 1 ? ' ▶' : ''}${s.wins[i] ? ' · 🏆' + s.wins[i] : ''}</span></div>`).join('');
  const st = el.querySelector('#st');
  if (s.phase === 'over') st.innerHTML = s.winner === me ? '🎉 Wygrywasz!' : `${esc(s.names[s.winner])} wygrywa ${s.scores[s.winner]}:${s.scores[1 - s.winner]}`;
  else st.innerHTML = me < 0 ? `Do ${s.win} punktów` : `Grasz ${me === 0 ? 'po lewej' : 'po prawej'} · do ${s.win} punktów`;
  el.querySelector('#hp').textContent = me >= 0 && s.phase === 'play' ? 'Steruj: strzałki ↑↓ lub W/S, albo przesuwaj palcem / myszką po planszy.' : '';
}

window.Games = window.Games || {};
Games.pong = {
  render(el, s, who, sendFn) {
    cur = s; me = who; send = sendFn; got = performance.now();
    const key = `${s.round}-${s.phase === 'over' ? 'over' : 'play'}-${who}`;
    if (el.dataset.key !== key) { el.dataset.key = key; build(el, s); }
    update(el, s);
  }
};
})();
