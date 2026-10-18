(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLORS = ['#1b1a3a', '#6b7280', '#b8bcc8', '#8b5a2b', '#e63946', '#ff5d8f', '#f4a261', '#ffd166',
  '#ffe14d', '#a7e22e', '#2dc653', '#2a9d8f', '#4cc9f0', '#3a86ff', '#7b5cff', '#c77dff'];
const pen = { c: COLORS[0], w: 6, tool: 'pen', shape: 'rect', fill: true }; // tool: pen | eraser | bucket | shape
let cur = null, deadline = 0, timer = null;

function seg(ctx, d) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.strokeStyle = d.c; ctx.lineWidth = d.w * W / 800; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(d.a[0] * W, d.a[1] * H); ctx.lineTo(d.a[2] * W, d.a[3] * H); ctx.stroke();
}
// ---------- kształty ----------
const SHAPES = [['line', '╱ Linia'], ['rect', '▭ Prostokąt'], ['square', '◻ Kwadrat'], ['ellipse', '⬭ Elipsa'], ['circle', '○ Koło'],
  ['tri', '△ Trójkąt'], ['star', '☆ Gwiazda'], ['heart', '♡ Serce'], ['arrow', '→ Strzałka']];
const SHAPE_IDS = SHAPES.map(x => x[0]);
const r4 = n => Math.round(n * 10000) / 10000; // te same zaokrąglone liczby rysuje rysujący i reszta graczy

function shape(ctx, d) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const x0 = d.a[0] * W, y0 = d.a[1] * H, x1 = d.a[2] * W, y1 = d.a[3] * H;
  const l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), b = Math.max(y0, y1);
  const w = r - l, h = b - t, cx = (l + r) / 2, lw = d.w * W / 800;
  let closed = true;
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = d.c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (d.k === 'line') { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); closed = false; }
  else if (d.k === 'arrow') {
    const a = Math.atan2(y1 - y0, x1 - x0), hl = Math.max(16, lw * 3.5); closed = false;
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.moveTo(x1 - hl * Math.cos(a - 0.45), y1 - hl * Math.sin(a - 0.45)); ctx.lineTo(x1, y1); ctx.lineTo(x1 - hl * Math.cos(a + 0.45), y1 - hl * Math.sin(a + 0.45));
  }
  else if (d.k === 'rect' || d.k === 'square') ctx.rect(l, t, w, h);
  else if (d.k === 'ellipse' || d.k === 'circle') ctx.ellipse(cx, (t + b) / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (d.k === 'tri') { ctx.moveTo(cx, t); ctx.lineTo(r, b); ctx.lineTo(l, b); ctx.closePath(); }
  else if (d.k === 'star') {
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 0.4 : 1;
      const px = cx + Math.cos(ang) * rad / 0.951 * w / 2, py = t + (Math.sin(ang) * rad + 1) / 1.809 * h;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  else if (d.k === 'heart') {
    ctx.moveTo(cx, t + h * 0.28);
    ctx.bezierCurveTo(cx, t, l, t, l, t + h * 0.32);
    ctx.bezierCurveTo(l, t + h * 0.62, cx, t + h * 0.8, cx, b);
    ctx.bezierCurveTo(cx, t + h * 0.8, r, t + h * 0.62, r, t + h * 0.32);
    ctx.bezierCurveTo(r, t, cx, t, cx, t + h * 0.28);
    ctx.closePath();
  }
  if (closed && d.f) ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---------- wiaderko (wypełnianie jak w Paincie) ----------
function parseHex(h) {
  let m = /^#([0-9a-f]{6})$/i.exec(h); if (m) { const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  m = /^#([0-9a-f]{3})$/i.exec(h); return m ? [...m[1]].map(x => parseInt(x + x, 16)) : null;
}
function floodFill(ctx, nx, ny, hex) {
  const col = parseHex(hex); if (!col) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const sx = Math.min(W - 1, Math.max(0, Math.floor(nx * W))), sy = Math.min(H - 1, Math.max(0, Math.floor(ny * H)));
  const img = ctx.getImageData(0, 0, W, H), d = img.data, i0 = (sy * W + sx) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
  if (Math.abs(tr - col[0]) + Math.abs(tg - col[1]) + Math.abs(tb - col[2]) < 12) return; // już w tym kolorze
  const dist = p => Math.abs(d[p * 4] - tr) + Math.abs(d[p * 4 + 1] - tg) + Math.abs(d[p * 4 + 2] - tb);
  const vis = new Uint8Array(W * H), ok = (x, y) => !vis[y * W + x] && dist(y * W + x) <= 150; // tolerancja na wygładzone brzegi linii
  const stack = [sx, sy];
  while (stack.length) {
    const y = stack.pop(); let x = stack.pop();
    while (x >= 0 && ok(x, y)) x--;
    x++;
    let up = false, down = false;
    for (; x < W && ok(x, y); x++) {
      vis[y * W + x] = 1;
      if (y > 0) { const o = ok(x, y - 1); if (o && !up) stack.push(x, y - 1); up = o; }
      if (y < H - 1) { const o = ok(x, y + 1); if (o && !down) stack.push(x, y + 1); down = o; }
    }
  }
  const grow = []; // 1 px dookoła, żeby nie zostawał jasny obrys przy kreskach
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x; if (vis[p]) continue;
    if (((x > 0 && vis[p - 1]) || (x < W - 1 && vis[p + 1]) || (y > 0 && vis[p - W]) || (y < H - 1 && vis[p + W])) && dist(p) <= 380) grow.push(p);
  }
  const put = p => { d[p * 4] = col[0]; d[p * 4 + 1] = col[1]; d[p * 4 + 2] = col[2]; d[p * 4 + 3] = 255; };
  for (let p = 0; p < W * H; p++) if (vis[p]) put(p);
  grow.forEach(put);
  ctx.putImageData(img, 0, 0);
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
      <div class="cvw"><canvas id="cv" width="1400" height="900" aria-label="Tablica do rysowania"></canvas>${drawer ? '<canvas id="ov" class="ov" width="1400" height="900" aria-hidden="true"></canvas>' : ''}</div>
      ${drawer ? `<div class="tools"><div class="colors">${COLORS.map((c, i) => `<button class="sw" data-c="${c}" style="background:${c}" aria-label="Kolor ${i + 1}"></button>`).join('')}</div>
        <div class="rgb"><input type="color" id="cp" value="#1b1a3a" aria-label="Wybierz kolor">
          <label>R<input type="range" id="cr" min="0" max="255" value="27"><output id="vr">27</output></label>
          <label>G<input type="range" id="cg" min="0" max="255" value="26"><output id="vg">26</output></label>
          <label>B<input type="range" id="cb" min="0" max="255" value="58"><output id="vb">58</output></label></div>
        <div class="tool-row"><button class="ghost tl" data-tool="pen">✏️ Pędzel</button><button class="ghost tl" data-tool="bucket">🪣 Wiaderko</button><button class="ghost tl" data-tool="eraser">🧽 Gumka</button><button class="ghost tl" id="clr">Wyczyść</button></div>
        <div class="tool-row"><button class="ghost tl" data-w="3">Cienki</button><button class="ghost tl" data-w="7">Średni</button><button class="ghost tl" data-w="16">Gruby</button></div>
        <div class="tool-row">${SHAPES.map(([id, n]) => `<button class="ghost tl" data-sh="${id}">${n}</button>`).join('')}<button class="ghost tl" id="shf" type="button"></button></div></div>` : ''}
    </div>
    <div class="chat"><div class="log" id="log"></div>
      <div class="row" style="flex-wrap:nowrap"><input id="gs" maxlength="60" autocomplete="off" placeholder="Wpisz odpowiedź…"><button id="go">Wyślij</button></div></div></div>
    <div class="actions"><button class="ghost" id="leave">Wyjdź</button></div>`;
  const c = el.querySelector('#cv'), ctx = c.getContext('2d'); wipe(ctx);
  if (drawer) {
    let last = null, sh = null; // last: ostatni punkt pędzla, sh: kształt w trakcie rysowania
    const ov = el.querySelector('#ov'), og = ov.getContext('2d'), clearOv = () => og.clearRect(0, 0, ov.width, ov.height);
    const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    const draw = a => { const er = pen.tool === 'eraser'; const d = { c: er ? '#fff' : pen.c, w: er ? pen.w * 2.5 : pen.w, a }; seg(ctx, d); send('relay', { t: 's', ...d }); };
    const shapeData = (p0, p1) => {
      let [x0, y0] = p0, [x1, y1] = p1;
      if (pen.shape === 'square' || pen.shape === 'circle') { // równe boki liczone w pikselach, nie w ułamkach planszy
        const dx = (x1 - x0) * c.width, dy = (y1 - y0) * c.height, side = Math.max(Math.abs(dx), Math.abs(dy));
        x1 = x0 + (dx < 0 ? -1 : 1) * side / c.width; y1 = y0 + (dy < 0 ? -1 : 1) * side / c.height;
      }
      return { k: pen.shape, a: [x0, y0, x1, y1].map(r4), c: pen.c, w: pen.w, f: pen.fill ? 1 : 0 };
    };
    c.onpointerdown = e => {
      if (cur.phase !== 'draw') return;
      c.setPointerCapture(e.pointerId);
      const p = pos(e);
      if (pen.tool === 'bucket') { const f = { t: 'f', x: r4(p[0]), y: r4(p[1]), c: pen.c }; floodFill(ctx, f.x, f.y, f.c); send('relay', f); return; }
      if (pen.tool === 'shape') { sh = { start: p, end: p }; return; }
      last = p; draw([p[0], p[1], p[0] + 0.0002, p[1]]);
    };
    c.onpointermove = e => {
      if (cur.phase !== 'draw') return;
      if (sh) { sh.end = pos(e); clearOv(); shape(og, shapeData(sh.start, sh.end)); return; }
      if (!last) return; const p = pos(e); draw([last[0], last[1], p[0], p[1]]); last = p;
    };
    const finish = e => {
      last = null; if (!sh) return;
      const s0 = sh; sh = null; clearOv();
      if (e.type === 'pointercancel' || cur.phase !== 'draw') return;
      s0.end = pos(e);
      const d = shapeData(s0.start, s0.end);
      if (Math.hypot((d.a[2] - d.a[0]) * c.width, (d.a[3] - d.a[1]) * c.height) < 4) return; // samo kliknięcie to nie kształt
      shape(ctx, d); send('relay', { t: 'h', ...d });
    };
    c.onpointerup = c.onpointercancel = finish;
    const mark = () => {
      el.querySelectorAll('.sw').forEach(b => b.classList.toggle('on', pen.tool !== 'eraser' && b.dataset.c === pen.c));
      el.querySelectorAll('[data-w]').forEach(b => b.classList.toggle('on', +b.dataset.w === pen.w));
      el.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', pen.tool === b.dataset.tool));
      el.querySelectorAll('[data-sh]').forEach(b => b.classList.toggle('on', pen.tool === 'shape' && pen.shape === b.dataset.sh));
      const f = el.querySelector('#shf'); f.textContent = pen.fill ? '■ Wypełnione' : '□ Sam kontur'; f.classList.toggle('on', pen.fill);
      c.style.cursor = pen.tool === 'bucket' ? 'cell' : 'crosshair';
    };
    el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { pen.w = +b.dataset.w; mark(); });
    el.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { pen.tool = b.dataset.tool; mark(); });
    el.querySelectorAll('[data-sh]').forEach(b => b.onclick = () => { pen.tool = 'shape'; pen.shape = b.dataset.sh; mark(); });
    el.querySelector('#shf').onclick = () => { pen.fill = !pen.fill; mark(); };
    el.querySelector('#clr').onclick = () => { wipe(ctx); send('relay', { t: 'x' }); };
    const hex = n => n.toString(16).padStart(2, '0');
    const cp = el.querySelector('#cp'), sl = ['r', 'g', 'b'].map(k => el.querySelector('#c' + k));
    const syncRgb = () => {
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(pen.c); if (!m) return;
      cp.value = pen.c; sl.forEach((r, i) => { r.value = parseInt(m[i + 1], 16); el.querySelector('#v' + 'rgb'[i]).textContent = r.value; });
    };
    const setColor = col => { pen.c = col.toLowerCase(); if (pen.tool === 'eraser') pen.tool = 'pen'; mark(); syncRgb(); };
    cp.oninput = () => setColor(cp.value);
    sl.forEach(r => r.oninput = () => setColor('#' + sl.map(x => hex(+x.value)).join('')));
    el.querySelectorAll('.sw').forEach(b => b.onclick = () => setColor(b.dataset.c));
    syncRgb();
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
  gs.disabled = el.querySelector('#go').disabled = me < 0 || drawer || solved || s.phase !== 'draw';
  gs.placeholder = me < 0 ? 'Oglądasz' : drawer ? 'Ty rysujesz' : solved ? 'Odgadnięte!' : 'Wpisz odpowiedź…';
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
    if (d.t === 'f') { if (Number.isFinite(d.x) && Number.isFinite(d.y) && d.x >= 0 && d.x <= 1 && d.y >= 0 && d.y <= 1 && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(d.c)) floodFill(ctx, d.x, d.y, d.c); return; }
    if (d.t === 'h') {
      if (SHAPE_IDS.includes(d.k) && Array.isArray(d.a) && d.a.length === 4 && d.a.every(n => Number.isFinite(n) && Math.abs(n) < 5) &&
          typeof d.w === 'number' && d.w > 0 && d.w <= 60 && /^#[0-9a-f]{6}$/i.test(d.c)) shape(ctx, d);
      return;
    }
    if (d.t === 's' && Array.isArray(d.a) && d.a.length === 4 && d.a.every(n => typeof n === 'number') &&
        typeof d.w === 'number' && /^#[0-9a-f]{3,6}$/i.test(d.c)) seg(ctx, d);
  }
};
})();
