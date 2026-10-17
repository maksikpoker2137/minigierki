(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// to samo "znormalizowanie" co na serwerze: "Łódź" -> "lodz"
const norm = t => String(t).toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ł/g, 'l').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const fits = (a, letter) => { const k = norm(a); return k.length >= 2 && k[0] === letter.toLowerCase(); };

let cur = null, me = -1, send = null, deadline = 0, timer = null, sentFinal = false, draftTimer = null;

const chips = (s, mark) => s.names.map((n, i) => `<div class="chip" style="color:var(--x)">
  <b>${s.scores[i]}</b><span>${esc(n)}${i === me ? ' (ty)' : ''}${mark(i)}</span></div>`).join('');

function collect(el) { return [...el.querySelectorAll('.pm-field input')].map(i => i.value); }
function sendDraft(el) { if (cur && cur.phase === 'play' && !cur.done[me]) send('move', { type: 'draft', answers: collect(el) }); }

function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    const t = document.getElementById('tm'); if (!t) return clearInterval(timer);
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    t.textContent = cur.phase === 'over' ? '' : left + ' s';
    // czas minął: wyślij ostatnie wpisane słowa od razu, bez czekania na pauzę w pisaniu
    if (left === 0 && cur.phase === 'play' && !cur.done[me] && !sentFinal) {
      sentFinal = true; clearTimeout(draftTimer); sendDraft(document.getElementById('game'));
    }
  }, 250);
}

function buildPlay(el, s) {
  sentFinal = false;
  el.innerHTML = `<div class="bar"><div class="score" id="sc"></div></div>
    <div class="pm-top"><div class="pm-letter" id="lt" aria-label="Litera"></div>
      <div class="status" id="st" aria-live="polite"></div><div class="cl-timer" id="tm"></div></div>
    <div class="pm-grid">${s.cats.map((c, i) => `<div class="pm-field"><label for="pm${i}">${esc(c)}</label>
      <input id="pm${i}" data-i="${i}" maxlength="30" autocomplete="off" autocapitalize="words" spellcheck="false"></div>`).join('')}</div>
    <p class="lead pm-help">Gdy ktoś skończy pierwszy, reszta ma jeszcze 10 sekund.</p>
    <div class="actions"><button id="stop">Gotowe!</button><button class="ghost" id="leave">Wyjdź</button></div>`;
  const inputs = [...el.querySelectorAll('.pm-field input')];
  inputs.forEach((inp, i) => {
    inp.oninput = () => {
      inp.classList.toggle('bad', !!inp.value.trim() && norm(inp.value).length > 0 && norm(inp.value)[0] !== cur.letter.toLowerCase());
      clearTimeout(draftTimer); draftTimer = setTimeout(() => sendDraft(el), 400);
    };
    inp.onblur = () => { clearTimeout(draftTimer); sendDraft(el); };
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); (inputs[i + 1] || inp).focus(); if (!inputs[i + 1]) inp.blur(); } };
  });
  el.querySelector('#stop').onclick = () => {
    clearTimeout(draftTimer);
    const bad = inputs.find(x => !fits(x.value, cur.letter));
    if (cur.stoppedBy === null && bad) { bad.focus(); }
    send('move', { type: 'stop', answers: collect(el) });
  };
  el.querySelector('#leave').onclick = () => send('leave');
  inputs[0].focus();
}

function updatePlay(el, s) {
  deadline = Date.now() + s.msLeft;
  el.querySelector('#lt').textContent = s.letter;
  el.querySelector('#sc').innerHTML = chips(s, i => (s.done[i] ? ' · ✓' : ''));
  const done = s.done[me];
  el.querySelector('#st').innerHTML = done ? 'Czekamy na resztę…'
    : s.stoppedBy !== null ? `<b>${esc(s.names[s.stoppedBy])}</b> skończył! Dopisz, co zdążysz.`
    : `Runda ${s.round + 1}/${s.rounds} · wpisz słowa na <b>${s.letter}</b>`;
  el.querySelectorAll('.pm-field input').forEach(i => { i.disabled = done; });
  el.querySelector('#stop').disabled = done;
}

const LABEL = { ok: '', solo: 'jedyna', dup: 'powtórka', rejected: 'odrzucona', bad: 'zła litera', empty: '' };

function buildReview(el, s) {
  const keep = el.querySelector('.pm-wrap'); const left = keep ? keep.scrollLeft : 0;
  const mine = new Set(s.myFlags), iAmReady = s.ready.includes(me);
  const head = s.names.map((n, i) => `<th scope="col">${esc(n)}${i === me ? ' (ty)' : ''}</th>`).join('');
  const rows = s.cats.map((c, ci) => `<tr><th scope="row">${esc(c)}</th>${s.table[ci].map((x, p) => {
    const canFlag = p !== me && x.st !== 'empty' && x.st !== 'bad';
    return `<td class="${x.st}"><span class="a">${x.a ? esc(x.a) : '–'}</span>
      <span class="p">${x.pts ? '+' + x.pts : '0'}${LABEL[x.st] ? ' · ' + LABEL[x.st] : ''}</span>
      ${canFlag ? `<button class="fl ${mine.has(ci + ':' + p) ? 'on' : ''}" data-c="${ci}" data-p="${p}" aria-pressed="${mine.has(ci + ':' + p)}" title="Odrzuć tę odpowiedź">🚩${x.flags || ''}</button>` : ''}</td>`;
  }).join('')}</tr>`).join('');
  el.innerHTML = `<div class="bar"><div class="score">${chips(s, i => ` · +${s.roundPts[i]}`)}</div></div>
    <div class="pm-top"><div class="pm-letter">${s.letter}</div>
      <div class="status" aria-live="polite">Runda ${s.round + 1}/${s.rounds} · sprawdźcie odpowiedzi</div><div class="cl-timer" id="tm"></div></div>
    <div class="pm-wrap"><table class="pm-tbl"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}
      <tr class="sum"><th scope="row">Runda</th>${s.roundPts.map(p => `<td>+${p}</td>`).join('')}</tr>
      <tr class="sum"><th scope="row">Razem</th>${s.roundPts.map((p, i) => `<td>${s.scores[i] + p}</td>`).join('')}</tr></tbody></table></div>
    <p class="lead pm-help">Unikalna odpowiedź 10 pkt, taka sama jak u kogoś 5 pkt, jako jedyna 15 pkt. Kliknij 🚩 przy odpowiedzi, która nie pasuje do kategorii. Gdy odrzuci ją większość pozostałych graczy, nie dostaje punktów.</p>
    <div class="actions"><button id="ready" ${iAmReady ? 'disabled' : ''}>${iAmReady ? `Czekamy na resztę (${s.ready.length}/${s.names.length})` : s.round + 1 >= s.rounds ? 'Pokaż wynik' : 'Następna runda'}</button>
      <button class="ghost" id="leave">Wyjdź</button></div>`;
  el.querySelector('.pm-wrap').scrollLeft = left;
  el.querySelectorAll('.fl').forEach(b => b.onclick = () => send('move', { type: 'flag', cat: +b.dataset.c, target: +b.dataset.p }));
  el.querySelector('#ready').onclick = () => send('move', { type: 'ready' });
  el.querySelector('#leave').onclick = () => send('leave');
}

function buildOver(el, s) {
  const rank = s.names.map((n, i) => ({ n, p: s.scores[i], me: i === me })).sort((a, b) => b.p - a.p);
  el.innerHTML = `<div class="panel" style="max-width:480px;margin:10px auto;text-align:center"><h2>Koniec gry</h2>
    <ul class="players" style="text-align:left">${rank.map((r, i) => `<li><b>${i + 1}.</b> ${esc(r.n)}${r.me ? ' (ty)' : ''}<span class="tag" style="font-size:1.1rem;color:var(--text)">${r.p} pkt</span></li>`).join('')}</ul>
    <div class="actions"><button id="again">Zagraj jeszcze raz</button><button class="ghost" id="leave">Wyjdź</button></div></div>`;
  el.querySelector('#again').onclick = () => send('rematch');
  el.querySelector('#leave').onclick = () => send('leave');
}

window.Games = window.Games || {};
Games.panstwa = {
  render(el, s, who, sendFn) {
    cur = s; me = who; send = sendFn;
    if (s.phase === 'play') {
      const key = 'p' + s.round; // pola budujemy raz na rundę, żeby nie tracić wpisywanego tekstu
      if (el.dataset.key !== key) { el.dataset.key = key; buildPlay(el, s); }
      updatePlay(el, s);
    } else {
      el.dataset.key = s.phase;
      deadline = Date.now() + s.msLeft;
      if (s.phase === 'review') buildReview(el, s); else buildOver(el, s);
    }
    startTimer();
  }
};
})();
