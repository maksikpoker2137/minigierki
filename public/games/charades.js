(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLORS = ['#1b1a3a', '#e63946', '#f4a261', '#ffd166', '#2a9d8f', '#4cc9f0', '#7b5cff', '#ff5d8f'];
const pen = { c: COLORS[0], w: 6, eraser: false };
let cur = null, deadline = 0, timer = null;

function seg(ctx, d) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.strokeStyle = d.c; ctx.lineWidth = d.w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(d.a[0] * W, d.a[1] * H); ctx.lineTo(d.a[2] * W, d.a[3] * H); ctx.stroke();
}
const wipe = ctx => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); };

function build(el, s, me, send) {
  clearInterval(timer);
  if (s.phase === 'over') {
    const rank = s.names.map((n, i) => ({ n, p: s.scores[i], me: i === me })).sort((a, b) => b.p - a.p);
    el.innerHTML = `<div class="panel" style="max-width:480px;margin:10px auto;text-align:center"><h2>Koniec gry</h2>
      <ul class="players" style="text-align:left">${rank.map((r, i) => `<li><b>${i + 1}.</b> ${esc(r.n)}${r.me ? ' (ty)' : ''}<span class="tag" style="font-size:1.1rem;color:var(--text)">${r.p} pkt</span></li>`).join('')}</ul>
      <div class="actions"><button id="again">Zagraj jeszcze raz</button><button class="ghost" id="leave">Wyjdź</button></div></div>`;
    el.querySelector('#again').onclick = () => send('rematch');
    el.querySelector('#leave').onclick = () => send('leave');
    return;
  }
  const drawer = me === s.drawer;
  el.innerHTML = `<div class="bar"><div class="score" id="sc"></div></div>
    <div class="cl-top"><div class="status" id="st" style="margin:0;text-align:left" aria-live="polite"></div><div class="cl-timer" id="tm"></div></div>
    <div class="cl"><div>
      <canvas id="cv" width="800" height="560" aria-label="Tablica do rysowania"></canvas>
      ${drawer ? `<div class="tools"><div class="colors">${COLORS.map((c, i) => `<button class="sw" data-c="${c}" style="background:${c}" aria-label="Kolor ${i + 1}"></button>`).join('')}</div>
        <button class="ghost tl" data-w="3">Cienki</button><button class="ghost tl" data-w="7">Średni</button><button class="ghost tl" data-w="16">Gruby</button>
        <button class="ghost tl" id="er">Gumka</button><button class="ghost tl" id="clr">Wyczyść</button></div>` : ''}
    </div>
    <div class="chat"><div class="log" id="log"></div>
      <div class="row" style="flex-wrap:nowrap"><input id="gs" maxlength="60" autocomplete="off" placeholder="Wpisz odpowiedź…"><button id="go">Wyślij</button></div></div></div>
    <div class="actions"><button class="ghost" id="leave">Wyjdź</button></div>`;
  const c = el.querySelector('#cv'), ctx = c.getContext('2d'); wipe(ctx);
  if (drawer) {
    let last = null;
    const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    const draw = a => { const d = { c: pen.eraser ? '#fff' : pen.c, w: pen.eraser ? pen.w * 2.5 : pen.w, a }; seg(ctx, d); send('relay', { t: 's', ...d }); };
    c.onpointerdown = e => { if (cur.phase !== 'draw') return; c.setPointerCapture(e.pointerId); last = pos(e); draw([last[0], last[1], last[0] + 0.0002, last[1]]); };
    c.onpointermove = e => { if (!last || cur.phase !== 'draw') return; const p = pos(e); draw([last[0], last[1], p[0], p[1]]); last = p; };
    c.onpointerup = c.onpointercancel = () => { last = null; };
    const mark = () => {
      el.querySelectorAll('.sw').forEach(b => b.classList.toggle('on', !pen.eraser && b.dataset.c === pen.c));
      el.querySelectorAll('[data-w]').forEach(b => b.classList.toggle('on', +b.dataset.w === pen.w));
      el.querySelector('#er').classList.toggle('on', pen.eraser);
    };
    el.querySelectorAll('.sw').forEach(b => b.onclick = () => { pen.c = b.dataset.c; pen.eraser = false; mark(); });
    el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { pen.w = +b.dataset.w; mark(); });
    el.querySelector('#er').onclick = () => { pen.eraser = !pen.eraser; mark(); };
    el.querySelector('#clr').onclick = () => { wipe(ctx); send('relay', { t: 'x' }); };
    mark();
  }
  const gs = el.querySelector('#gs');
  const go = () => { if (gs.value.trim() && !gs.disabled) { send('move', { type: 'guess', text: gs.value }); gs.value = ''; } };
  el.querySelector('#go').onclick = go; gs.onkeydown = e => { if (e.key === 'Enter') go(); };
  el.querySelector('#leave').onclick = () => send('leave');
  timer = setInterval(() => {
    const t = document.getElementById('tm'); if (!t) return clearInterval(timer);
    t.textContent = cur.endsAt ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) + ' s' : '';
  }, 250);
}

function update(el, s, me) {
  const drawer = me === s.drawer, solved = s.solved.includes(me);
  deadline = Date.now() + s.msLeft;
  el.querySelector('#sc').innerHTML = s.names.map((n, i) => `<div class="chip ${i === s.drawer ? 'turn' : ''}" style="color:var(--${i === s.drawer ? 'o' : 'x'})">
    <b>${s.scores[i]}</b><span>${esc(n)}${i === me ? ' (ty)' : ''}${i === s.drawer ? ' · rysuje' : s.solved.includes(i) ? ' · ✓' : ''}</span></div>`).join('');
  const cat = `<span class="cat">(${esc(s.category)})</span>`;
  el.querySelector('#st').innerHTML = s.phase === 'reveal' ? `Hasło: <b>${esc(s.word)}</b>`
    : drawer ? `Narysuj: <b>${esc(s.word)}</b> ${cat}`
    : `<span class="hint">${esc(s.hint)}</span> ${cat}`;
  const log = el.querySelector('#log');
  log.innerHTML = s.chat.map(m => m.name ? `<p><b>${esc(m.name)}:</b> ${esc(m.text)}</p>` : `<p class="sys">${esc(m.text)}</p>`).join('');
  log.scrollTop = log.scrollHeight;
  const gs = el.querySelector('#gs');
  gs.disabled = el.querySelector('#go').disabled = drawer || solved || s.phase !== 'draw';
  gs.placeholder = drawer ? 'Ty rysujesz' : solved ? 'Odgadnięte!' : 'Wpisz odpowiedź…';
}

window.Games = window.Games || {};
Games.charades = {
  render(el, s, me, send) {
    cur = s;
    const key = s.phase === 'over' ? 'over' : 'seq' + s.seq;
    if (el.dataset.key !== key) { el.dataset.key = key; build(el, s, me, send); }
    if (s.phase !== 'over') update(el, s, me);
  },
  onRelay(d) {
    const c = document.getElementById('cv'); if (!c || !d) return;
    const ctx = c.getContext('2d');
    if (d.t === 'x') return wipe(ctx);
    if (d.t === 's' && Array.isArray(d.a) && d.a.length === 4 && d.a.every(n => typeof n === 'number') &&
        typeof d.w === 'number' && /^#[0-9a-f]{3,6}$/i.test(d.c)) seg(ctx, d);
  }
};
})();
