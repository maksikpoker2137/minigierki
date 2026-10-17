(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// UNO – wygląd po stronie przeglądarki. Ręka jest sortowana tylko do wyświetlania; do serwera idzie oryginalny indeks karty.
const SYM = { S: '⊘', V: '⇄', '+2': '+2', W: '★', '+4': '+4' };
const CNAME = { R: 'czerwony', Y: 'żółty', G: 'zielony', B: 'niebieski' };
const ORDER = ['R', 'Y', 'G', 'B', 'W'], VORDER = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'S', 'V', '+2', 'W', '+4'];
let cur = null, me = -1, send = null, root = null, pick = null, deadline = 0, timer = null;

const label = c => SYM[c.v] || c.v;
const aria = c => c.c === 'W' ? (c.v === '+4' ? 'dzika karta +4' : 'dzika karta') : `${CNAME[c.c]} ${label(c)}`;

function draw(el) {
  const s = cur, myTurn = s.phase === 'play' && s.turn === me, left = me >= 0 ? s.hand.length : 0;
  if (!myTurn) pick = null;
  const chips = s.names.map((n, i) => `<div class="chip ${s.phase === 'play' && s.turn === i ? 'turn' : ''}" style="color:var(--${i === me ? 'x' : 'o'})">
    <b>${s.counts[i]}</b><span>${esc(n)}${i === me ? ' (ty)' : ''}${s.scores[i] ? ' · 🏆' + s.scores[i] : ''}${s.counts[i] <= 2 && s.called[i] ? ' · UNO!' : ''}</span></div>`).join('');

  let status;
  if (s.phase === 'over') status = s.winner === me ? '🎉 Wygrywasz rundę!' : s.winner !== null ? `${esc(s.names[s.winner])} wygrywa rundę` : 'Koniec rundy';
  else if (myTurn) status = s.hasDrawn ? 'Dobrana karta pasuje: zagraj ją albo pasuj' : 'Twoja tura: zagraj kartę lub dobierz';
  else status = `Tura: ${esc(s.names[s.turn])}`;

  const hand = s.hand.map((c, i) => ({ c, i })).sort((a, b) => ORDER.indexOf(a.c.c) - ORDER.indexOf(b.c.c) || VORDER.indexOf(a.c.v) - VORDER.indexOf(b.c.v));
  const cards = hand.map(({ c, i }) => {
    const ok = myTurn && s.can[i] && (!s.hasDrawn || i === s.hand.length - 1);
    return `<button type="button" class="uc ${c.c} ${myTurn && !ok ? 'no' : ''} ${s.hasDrawn && i === s.hand.length - 1 ? 'new' : ''}" data-i="${i}" ${ok ? '' : 'disabled'} aria-label="${aria(c)}"><span>${label(c)}</span></button>`;
  }).join('');

  const showUno = me >= 0 && s.phase === 'play' && left <= 2 && !s.called[me];
  const showCatch = me >= 0 && s.phase === 'play' && s.vuln !== null && s.vuln !== me;
  const topStyle = s.top.c === 'W' ? ` style="box-shadow:0 0 0 5px var(--c${s.color})"` : '';

  el.innerHTML = `<div class="bar"><div class="score">${chips}</div></div>
    <div class="cl-top"><div class="status" style="margin:0;text-align:left" aria-live="polite">${status}</div><div class="cl-timer" id="uno-tm"></div></div>
    <div class="uno-table">
      <button type="button" class="uc back" id="uno-draw" ${myTurn && !s.hasDrawn ? '' : 'disabled'} aria-label="Dobierz kartę"><span>UNO</span><small>${s.deckLeft}</small></button>
      <div class="uc ${s.top.c}"${topStyle}><span>${label(s.top)}</span></div>
      <div class="uno-info"><div class="uno-dir" title="Kierunek gry">${s.dir === 1 ? '↻' : '↺'}</div>
        <div class="uno-col" style="background:var(--c${s.color})"></div><small>${CNAME[s.color]}</small></div>
    </div>
    <div class="uno-log">${s.log.slice(-3).map(l => `<p>${esc(l)}</p>`).join('')}</div>
    ${pick !== null ? `<div class="panel uno-pick"><p class="lead" style="margin:0 0 10px">Wybierz kolor:</p><div class="row" style="justify-content:center">
      ${['R', 'Y', 'G', 'B'].map(c => `<button type="button" class="uc ${c} mini" data-col="${c}" aria-label="${CNAME[c]}"><span></span></button>`).join('')}
      <button type="button" class="ghost" id="uno-cancel">Anuluj</button></div></div>` : ''}
    <div class="actions" style="margin:14px 0">
      ${showUno ? '<button type="button" id="uno-uno">UNO!</button>' : ''}
      ${showCatch ? `<button type="button" id="uno-catch">Złap ${esc(s.names[s.vuln])}!</button>` : ''}
      ${myTurn && s.hasDrawn ? '<button type="button" class="ghost" id="uno-pass">Pas</button>' : ''}
    </div>
    ${me >= 0 ? `<div class="uno-hand" aria-label="Twoje karty">${cards}</div>` : ''}
    <div class="actions">${s.phase === 'over' ? '<button id="again">Kolejna runda</button>' : ''}<button class="ghost" id="leave">Wyjdź</button></div>`;

  const on = (sel, fn) => { const b = el.querySelector(sel); if (b) b.onclick = fn; };
  on('#uno-draw', () => send('move', { type: 'draw' }));
  on('#uno-uno', () => send('move', { type: 'uno' }));
  on('#uno-catch', () => send('move', { type: 'catch' }));
  on('#uno-pass', () => send('move', { type: 'pass' }));
  on('#uno-cancel', () => { pick = null; draw(el); });
  on('#again', () => send('rematch'));
  on('#leave', () => send('leave'));
  el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
    const i = +b.dataset.i, c = s.hand[i];
    if (c.c === 'W') { pick = i; draw(el); } else send('move', { type: 'play', i });
  });
  el.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { const i = pick; pick = null; send('move', { type: 'play', i, color: b.dataset.col }); });
}

function clock() {
  const t = document.getElementById('uno-tm');
  if (!t || !cur) { clearInterval(timer); timer = null; return; }
  t.textContent = cur.phase === 'play' ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) + ' s' : '';
}

window.Games = window.Games || {};
Games.uno = {
  render(el, s, who, sendFn) {
    if (root !== el || (cur && s.round !== cur.round)) pick = null;
    cur = s; me = who; send = sendFn; root = el;
    deadline = Date.now() + s.msLeft;
    draw(el);
    if (!timer) timer = setInterval(clock, 250);
    clock();
  }
};
})();
