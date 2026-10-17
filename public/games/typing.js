(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Wyścig pisania – wygląd po stronie przeglądarki.
// Pole tekstowe i podkolorowane zdanie budujemy raz na fazę (żeby nie gubić wpisywanego tekstu),
// a tory graczy odświeżamy przy każdej zmianie stanu.
const LANE = ['var(--x)', 'var(--o)', 'var(--accent)', 'var(--ok)', '#c77dff', '#ff9f43', '#2dc653', '#4cc9f0'];
let cur = null, me = -1, send = null, deadline = 0, timer = null, typed = '';

const fmt = ms => (ms / 1000).toFixed(1) + ' s';
const place = (s, i) => { const k = s.order.indexOf(i); return k < 0 ? null : k + 1; };

// zdanie z kolorami: zielone = dobrze, czerwone = błąd, kursor na pierwszym nieprzepisanym znaku
function paint(el) {
  const s = cur, box = el.querySelector('#txt'); if (!box || !s.text) return;
  let ok = 0; while (ok < typed.length && ok < s.text.length && typed[ok] === s.text[ok]) ok++;
  box.innerHTML = [...s.text].map((c, i) => {
    const cls = i < ok ? 'good' : i < typed.length ? 'bad' : i === typed.length ? 'next' : '';
    return `<span class="${cls}">${c === ' ' ? '&nbsp;' : esc(c)}</span>`;
  }).join('');
}

function lanes(el) {
  const s = cur;
  el.querySelector('#sc').innerHTML = s.names.map((n, i) => `<div class="chip" style="color:${LANE[i % LANE.length]}">
    <b>${s.scores[i]}</b><span>${esc(n)}${i === me ? ' (ty)' : ''}${s.wins[i] ? ' · 🏆' + s.wins[i] : ''}</span></div>`).join('');
  el.querySelector('#lanes').innerHTML = s.names.map((n, i) => {
    const f = s.finished[i], pct = f ? 100 : Math.round(100 * s.progress[i] / s.len), p = place(s, i);
    return `<div class="tr-lane ${i === me ? 'me' : ''}"><span class="tr-name">${esc(n)}${i === me ? ' (ty)' : ''}</span>
      <div class="tr-track"><div class="tr-bar" style="width:${pct}%;background:${LANE[i % LANE.length]}"></div></div>
      <span class="tr-info">${f ? `${p}. · ${fmt(f.t)} · ${f.wpm} WPM` : pct + '%'}</span></div>`;
  }).join('');
}

function build(el, s, send2) {
  clearInterval(timer);
  typed = '';
  if (s.phase === 'over') {
    const rank = s.names.map((n, i) => ({ n, p: s.scores[i], me: i === me })).sort((a, b) => b.p - a.p);
    el.innerHTML = `<div class="panel" style="max-width:480px;margin:10px auto;text-align:center"><h2>Koniec wyścigu</h2>
      <ul class="players" style="text-align:left">${rank.map((r, i) => `<li><b>${i + 1}.</b> ${esc(r.n)}${r.me ? ' (ty)' : ''}<span class="tag" style="font-size:1.1rem;color:var(--text)">${r.p} pkt</span></li>`).join('')}</ul>
      <div class="actions"><button id="again">Jeszcze raz</button><button class="ghost" id="leave">Wyjdź</button></div></div>`;
    el.querySelector('#again').onclick = () => send2('rematch');
    el.querySelector('#leave').onclick = () => send2('leave');
    return;
  }
  const racing = s.phase === 'race' && me >= 0;
  el.innerHTML = `<div class="bar"><div class="score" id="sc"></div></div>
    <div class="cl-top"><div class="status" id="st" style="margin:0;text-align:left" aria-live="polite"></div><div class="cl-timer" id="tm"></div></div>
    ${s.phase === 'countdown' ? '<div class="tr-count" id="cnt"></div>' : ''}
    ${s.phase === 'race' ? `<div class="tr-text" id="txt" aria-label="Zdanie do przepisania"></div>
      ${me >= 0 ? '<input id="inp" class="tr-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Zacznij pisać…">' : ''}` : ''}
    ${s.phase === 'results' ? `<div class="tr-text done" id="txt"></div><p class="lead" id="nx" style="text-align:center;margin:0 0 12px"></p>` : ''}
    <div class="tr-lanes" id="lanes"></div>
    <div class="actions"><button class="ghost" id="leave">Wyjdź</button></div>`;
  el.querySelector('#leave').onclick = () => send2('leave');
  const inp = el.querySelector('#inp');
  if (inp) {
    inp.onpaste = inp.ondrop = e => e.preventDefault(); // wklejanie to oszustwo
    inp.oninput = () => { typed = inp.value; paint(el); send2('move', { type: 'progress', text: typed }); };
    inp.focus();
  }
  timer = setInterval(() => {
    const t = document.getElementById('tm'); if (!t) return clearInterval(timer);
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (cur.phase === 'countdown') { const c = document.getElementById('cnt'); if (c) c.textContent = left > 0 ? left : 'START!'; t.textContent = ''; }
    else if (cur.phase === 'race') t.textContent = left + ' s';
    else { t.textContent = ''; const nx = document.getElementById('nx'); if (nx) nx.textContent = (cur.idx + 1 >= cur.rounds ? 'Wyniki końcowe za ' : 'Następna runda za ') + left + ' s'; }
  }, 200);
}

function update(el, s) {
  deadline = Date.now() + s.msLeft;
  lanes(el);
  const round = `Runda ${s.idx + 1}/${s.rounds}`;
  const st = el.querySelector('#st'), f = me >= 0 ? s.finished[me] : null;
  if (s.phase === 'countdown') st.innerHTML = `${round} · przygotuj się…`;
  else if (s.phase === 'race') {
    st.innerHTML = me < 0 ? `${round} · ścigają się!` : f ? `Gotowe! ${place(s, me)}. miejsce · ${f.wpm} WPM` : `${round} · przepisz zdanie dokładnie`;
    const inp = el.querySelector('#inp'); if (inp && f) { inp.disabled = true; inp.value = ''; }
    paint(el);
  } else {
    st.innerHTML = `${round} · wyniki${me >= 0 && s.pts[me] ? ` · <b>+${s.pts[me]} pkt</b>` : ''}`;
    const box = el.querySelector('#txt'); if (box) box.innerHTML = [...s.text].map(c => `<span class="good">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
  }
}

window.Games = window.Games || {};
Games.typing = {
  render(el, s, who, sendFn) {
    cur = s; me = who; send = sendFn;
    const key = s.phase === 'over' ? 'over' : `${s.round}-${s.idx}-${s.phase}`;
    if (el.dataset.key !== key) { el.dataset.key = key; build(el, s, sendFn); }
    if (s.phase !== 'over') update(el, s);
  }
};
})();
