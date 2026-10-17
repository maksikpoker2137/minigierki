(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEYS = 'AĄBCĆDEĘFGHIJKLŁMNŃOÓPRSŚTUWYZŹŻ'.split('');
const part = (w, n, svg) => w >= n ? svg : '';

function gallows(w, max) {
  return `<svg viewBox="0 0 200 240" class="gallows" role="img" aria-label="Błędy: ${w} z ${max}">
    <path class="frame" d="M20 225h120M50 225V20h95v35"/>
    <g class="man">${part(w,1,'<circle cx="145" cy="78" r="23"/>')}${part(w,2,'<path d="M145 101v62"/>')}
    ${part(w,3,'<path d="M145 115l-30 32"/>')}${part(w,4,'<path d="M145 115l30 32"/>')}
    ${part(w,5,'<path d="M145 163l-26 42"/>')}${part(w,6,'<path d="M145 163l26 42"/>')}</g></svg>`;
}

window.Games = window.Games || {};
Games.hangman = {
  render(el, s, me, send) {
    const isSetter = me === s.setter, myTurn = s.phase === 'play' && s.turn === me;
    let status;
    if (s.phase === 'setup') status = isSetter ? 'Wymyśl hasło dla reszty' : `${s.names[s.setter]} układa hasło…`;
    else if (s.phase === 'play') status = myTurn ? 'Twoja kolej, wybierz literę' : `${isSetter && !s.random ? 'Obserwujesz. ' : ''}Kolej: ${s.names[s.turn]}`;
    else status = s.result.won ? `${s.names[s.result.by]} odgaduje hasło!` : 'Szubienica wygrała w tej rundzie';

    const chips = s.names.map((n, i) => `<div class="chip ${s.phase === 'play' && s.turn === i ? 'turn' : ''}" style="color:var(--${s.phase === 'setup' || i === s.setter ? 'o' : 'x'})">
      <b>${s.scores[i]}</b><span>${esc(n)}${i === me ? ' (ty)' : ''}${i === s.setter ? ' · hasło' : ''}</span></div>`).join('');

    let main = '';
    if (s.phase === 'setup') {
      main = isSetter ? `<div class="panel hm-setup"><label for="w">Twoje hasło (3–20 liter, bez spacji)</label>
        <input id="w" maxlength="20" autocomplete="off" placeholder="np. KROKODYL"><div class="actions" style="margin-top:14px">
        <button id="set">Zatwierdź hasło</button><button class="ghost" id="rnd">Wylosuj za mnie</button></div>
        <p class="lead" style="margin:12px 0 0;font-size:.95rem">Przy losowaniu zgadujesz razem z resztą.</p></div>`
        : `<p class="lead" style="text-align:center;margin:30px auto">Zaraz zaczynamy. Przygotuj się do zgadywania.</p>`;
    } else {
      const word = s.phase === 'over' ? [...s.word] : s.masked;
      const letters = word.map(c => `<span class="ch ${c === '_' ? '' : 'on'} ${s.phase === 'over' && !s.guessed.includes(c) ? 'miss' : ''}">${c === '_' ? '' : c}</span>`).join('');
      const keys = KEYS.map(k => {
        const used = s.guessed.includes(k), bad = s.wrong.includes(k);
        return `<button class="key ${used ? (bad ? 'bad' : 'good') : ''}" data-k="${k}" ${used || !myTurn ? 'disabled' : ''}>${k}</button>`;
      }).join('');
      main = `<div class="hm"><div>${gallows(s.wrong.length, s.maxWrong)}<p class="lead" style="text-align:center;margin:0">Błędy: ${s.wrong.length}/${s.maxWrong}${s.wrong.length ? ' · ' + s.wrong.join(' ') : ''}</p></div>
        <div><div class="word" aria-label="Hasło">${letters}</div>
        ${s.word && s.phase === 'play' ? `<p class="lead" style="margin:0 0 14px">Twoje hasło: <b>${esc(s.word)}</b></p>` : ''}
        ${s.phase === 'play' ? `<div class="keys">${keys}</div>` : ''}</div></div>`;
    }

    el.innerHTML = `<div class="bar"><div class="score">${chips}</div></div>
      <div class="status" aria-live="polite">${status}</div>${main}
      <div class="actions">${s.phase === 'over' ? '<button id="again">Kolejna runda</button>' : ''}<button class="ghost" id="leave">Wyjdź</button></div>`;

    el.querySelectorAll('.key').forEach(b => b.onclick = () => send('move', { type: 'guess', letter: b.dataset.k }));
    const w = el.querySelector('#w');
    if (w) { w.focus(); const go = () => send('move', { type: 'setWord', word: w.value }); el.querySelector('#set').onclick = go; w.onkeydown = e => e.key === 'Enter' && go(); el.querySelector('#rnd').onclick = () => send('move', { type: 'random' }); }
    const again = el.querySelector('#again'); if (again) again.onclick = () => send('rematch');
    el.querySelector('#leave').onclick = () => send('leave');
  }
};
})();
