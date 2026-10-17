(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Wordle (wyścig) – wygląd po stronie przeglądarki.
// Układ rundy budujemy raz na fazę; siatkę, klawiaturę i tory rywali odświeżamy przy zmianie stanu lub wciśnięciu klawisza.
const LETTER = /^[A-ZĄĆĘŁŃÓŚŹŻ]$/;
const KB = [['W','E','R','T','Y','U','I','O','P'], ['A','S','D','F','G','H','J','K','L'], ['ENTER','Z','C','B','N','M','DEL'], ['Ą','Ć','Ę','Ł','Ń','Ó','Ś','Ź','Ż']];
let cur = null, me = -1, send = null, root = null, deadline = 0, timer = null;
let typed = [], seenLen = 0, animRow = -1;

const mine = () => (cur && me >= 0 ? cur.guesses[me] : []);
const canType = () => !!cur && cur.phase === 'play' && me >= 0 && !cur.done[me];
const tip = m => { if (typeof toast === 'function') toast(m); };

function tile(ch, st, extra) { return `<div class="wd-t${st ? ' s' + st : ''}${ch && !st ? ' filled' : ''}${extra || ''}">${ch ? esc(ch) : ''}</div>`; }

function drawGrid() {
  const box = root && root.querySelector('#wd-grid'); if (!box) return;
  const g = mine(); let html = '';
  for (let r = 0; r < cur.tries; r++) {
    let row = '';
    for (let c = 0; c < 5; c++) {
      if (r < g.length) row += tile([...g[r].word][c], g[r].pat[c], r === animRow ? ' flip" style="--i:' + c : '');
      else if (r === g.length && canType()) row += tile(typed[c] || '', '');
      else row += tile('', '');
    }
    html += `<div class="wd-row">${row}</div>`;
  }
  box.innerHTML = html;
}

function drawKeys() {
  const box = root && root.querySelector('#wd-keys'); if (!box) return;
  const best = {};
  mine().forEach(x => [...x.word].forEach((ch, i) => { const v = +x.pat[i]; if (best[ch] === undefined || v > best[ch]) best[ch] = v; }));
  const off = !canType();
  box.innerHTML = KB.map(row => `<div class="wd-kr">${row.map(k => {
    const wide = k === 'ENTER' || k === 'DEL';
    return `<button type="button" class="wd-k${wide ? ' wide' : ''}${best[k] !== undefined ? ' k' + best[k] : ''}" data-k="${k}" ${off ? 'disabled' : ''} aria-label="${k === 'DEL' ? 'Usuń' : k === 'ENTER' ? 'Zatwierdź' : k}">${k === 'DEL' ? '⌫' : k === 'ENTER' ? 'OK' : k}</button>`;
  }).join('')}</div>`).join('');
}

function press(k) {
  if (!canType()) return;
  if (k === 'ENTER') {
    if (typed.length !== 5) return tip('Wpisz 5 liter.');
    return send('move', { type: 'guess', word: typed.join(''), n: mine().length }); // n chroni przed podwójnym Enterem
  }
  if (k === 'DEL') typed.pop();
  else if (typed.length < 5) typed.push(k);
  drawGrid();
}

if (!window.__wordleKeys) {
  window.__wordleKeys = true;
  document.addEventListener('keydown', e => {
    if (!root || !document.body.contains(root) || !root.querySelector('#wd-grid')) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.metaKey || (e.ctrlKey && !(e.getModifierState && e.getModifierState('AltGraph')))) return;
    if (e.key === 'Enter') { e.preventDefault(); return press('ENTER'); }
    if (e.key === 'Backspace') { e.preventDefault(); return press('DEL'); }
    const ch = e.key.length === 1 ? e.key.toLocaleUpperCase('pl') : '';
    if (LETTER.test(ch)) press(ch);
  });
}

function mini(s, i) {
  const g = s.guesses[i]; let cells = '';
  for (let r = 0; r < s.tries; r++) for (let c = 0; c < 5; c++) {
    const x = g[r];
    cells += x ? tile(x.word ? [...x.word][c] : '', x.pat[c]) : tile('', '');
  }
  let st;
  if (s.winner === i) st = `🏆 odgadł w ${g.length}. próbie`;
  else if (s.done[i] === 'lost') st = '✗ bez prób';
  else st = `${g.length}/${s.tries} prób`;
  return `<div class="wd-opp ${s.winner === i ? 'win' : ''}"><div class="wd-on">${esc(s.names[i])}</div><div class="wd-mini">${cells}</div><small>${st}</small></div>`;
}

function drawOpps() {
  const box = root && root.querySelector('#wd-opp'); if (!box) return;
  const ids = cur.names.map((_, i) => i).filter(i => i !== me);
  box.innerHTML = ids.map(i => mini(cur, i)).join('');
}

const fmt = ms => (ms / 1000).toFixed(1) + ' s';
const clock = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');

function build(el, s, send2) {
  clearInterval(timer);
  typed = []; seenLen = mine().length; animRow = -1;
  if (s.phase === 'over') {
    const rank = s.names.map((n, i) => ({ n, p: s.scores[i], me: i === me })).sort((a, b) => b.p - a.p);
    const top = rank[0].p;
    el.innerHTML = `<div class="panel" style="max-width:480px;margin:10px auto;text-align:center"><h2>Koniec meczu</h2>
      <ul class="players" style="text-align:left">${rank.map((r, i) => `<li><b>${i + 1}.</b> ${esc(r.n)}${r.me ? ' (ty)' : ''}${top > 0 && r.p === top ? ' 🏆' : ''}<span class="tag" style="font-size:1.1rem;color:var(--text)">${r.p} ${r.p === 1 ? 'runda' : 'rund'}</span></li>`).join('')}</ul>
      <div class="actions"><button id="again">Jeszcze raz</button><button class="ghost" id="leave">Wyjdź</button></div></div>`;
    el.querySelector('#again').onclick = () => send2('rematch');
    el.querySelector('#leave').onclick = () => send2('leave');
    return;
  }
  el.innerHTML = `<div class="bar"><div class="score" id="sc"></div></div>
    <div class="cl-top"><div class="status" id="st" style="margin:0;text-align:left" aria-live="polite"></div><div class="cl-timer" id="tm"></div></div>
    ${s.phase === 'countdown' ? '<div class="tr-count" id="cnt"></div>' : ''}
    <div class="wd">
      ${me >= 0 ? '<div class="wd-main"><div id="wd-grid" class="wd-grid" aria-label="Twoje próby"></div><div id="wd-ans"></div><div id="wd-keys" class="wd-keys"></div></div>' : '<div id="wd-ans" class="wd-main"></div>'}
      <div class="wd-side"><h3 class="wd-h">${me >= 0 ? 'Rywale' : 'Gracze'}</h3><div id="wd-opp" class="wd-opps"></div></div>
    </div>
    <div class="actions"><button class="ghost" id="leave">Wyjdź</button></div>`;
  el.querySelector('#leave').onclick = () => send2('leave');
  const keys = el.querySelector('#wd-keys');
  if (keys) keys.onclick = e => { const b = e.target.closest('.wd-k'); if (b && !b.disabled) press(b.dataset.k); };
  timer = setInterval(() => {
    const t = document.getElementById('tm'); if (!t) return clearInterval(timer);
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (cur.phase === 'countdown') { const c = document.getElementById('cnt'); if (c) c.textContent = left > 0 ? left : 'START!'; t.textContent = ''; }
    else if (cur.phase === 'play') t.textContent = clock(left);
    else { t.textContent = ''; const nx = document.getElementById('nx'); if (nx) nx.textContent = (cur.idx + 1 >= cur.rounds ? 'Wyniki końcowe za ' : 'Następna runda za ') + left + ' s'; }
  }, 200);
}

function update(el, s) {
  deadline = Date.now() + s.msLeft;
  el.querySelector('#sc').innerHTML = s.names.map((n, i) => `<div class="chip ${s.winner === i ? 'turn' : ''}" style="color:var(--${i === me ? 'x' : 'o'})">
    <b>${s.scores[i]}</b><span>${esc(n)}${i === me ? ' (ty)' : ''}${s.wins[i] ? ' · 🏆' + s.wins[i] : ''}</span></div>`).join('');
  const round = `Runda ${s.idx + 1}/${s.rounds}`;
  const st = el.querySelector('#st');
  if (s.phase === 'countdown') st.innerHTML = `${round} · przygotuj się…`;
  else if (s.phase === 'play') {
    st.innerHTML = me < 0 ? `${round} · ścigają się!`
      : s.done[me] === 'lost' ? 'Wykorzystane wszystkie próby. Czekamy na resztę…'
      : `${round} · odgadnij słowo (próba ${mine().length + 1}/${s.tries})`;
  } else {
    const r = s.result;
    st.innerHTML = r ? (s.winner === me ? `🎉 Wygrywasz rundę! ${fmt(r.t)}, ${r.tries}. próba` : `${esc(r.name)} był pierwszy: ${fmt(r.t)}, ${r.tries}. próba`) : 'Nikt nie odgadł słowa';
    const ans = el.querySelector('#wd-ans');
    if (ans) ans.innerHTML = `<p class="lead" style="text-align:center;margin:14px 0 6px">Hasło:</p><div class="wd-row wd-answer">${[...s.answer].map(ch => tile(ch, '2')).join('')}</div><p class="lead" id="nx" style="text-align:center;margin:10px 0 0"></p>`;
  }
  if (s.phase === 'play' || s.phase === 'countdown') { const ans = el.querySelector('#wd-ans'); if (ans) ans.innerHTML = ''; }
  const len = mine().length;
  if (len !== seenLen) { if (len > seenLen) animRow = len - 1; typed = []; seenLen = len; }
  drawGrid(); animRow = -1; drawKeys(); drawOpps();
}

window.Games = window.Games || {};
Games.wordle = {
  render(el, s, who, sendFn) {
    cur = s; me = who; send = sendFn; root = el;
    const key = s.phase === 'over' ? 'over' : `${s.round}-${s.idx}-${s.phase}`;
    if (el.dataset.key !== key) { el.dataset.key = key; build(el, s, sendFn); }
    if (s.phase !== 'over') update(el, s);
  }
};
})();
