(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Memory – wygląd po stronie przeglądarki.
// Każdy gracz ma swój kolor: kolor chipa = kolor ramki zebranych przez niego par.
const COLORS = ['var(--x)', 'var(--o)', 'var(--accent)', 'var(--ok)'];

// które karty były odkryte przy poprzednim rysowaniu – animujemy tylko nowo odkryte
let prevUp = new Set(), prevRound = -1;

window.Games = window.Games || {};
Games.memory = {
  icon: '🃏',
  render(el, s, me, send) {
    const over = s.phase === 'over', myTurn = s.phase === 'play' && s.turn === me;
    const up = new Set(s.cards.map((c, i) => c !== null ? i : -1).filter(i => i >= 0));
    if (s.round !== prevRound) { prevUp = new Set(); prevRound = s.round; }

    let status;
    if (over) {
      const best = Math.max(...s.scores), win = s.names.filter((_, i) => s.scores[i] === best);
      status = win.length > 1 ? `Remis: ${win.map(esc).join(' i ')}`
        : s.scores.indexOf(best) === me ? '🎉 Wygrywasz! Masz świetną pamięć' : `${esc(win[0])} wygrywa tę rundę`;
    } else if (myTurn) status = s.pending ? 'Nie pasują… zapamiętaj je' : s.flipped.length === 1 ? 'Wybierz drugą kartę' : 'Twój ruch, odkryj kartę';
    else status = s.pending ? `${esc(s.names[s.turn])}: nie pasują…` : `Ruch: ${esc(s.names[s.turn])}`;

    const sub = s.last && s.last.hit && !over ? `${s.last.by === me ? 'Masz' : esc(s.names[s.last.by]) + ' ma'} parę ${s.last.symbol}` : '';

    const chips = s.names.map((n, i) => `<div class="chip ${s.phase === 'play' && s.turn === i ? 'turn' : ''}" style="color:${COLORS[i]}">
      <b>${s.scores[i]}</b><span>${esc(n)}${i === me ? ' (ty)' : ''}${s.wins[i] ? ' · 🏆' + s.wins[i] : ''}</span></div>`).join('');

    const cards = s.cards.map((c, i) => {
      const isUp = c !== null, owner = s.owner[i];
      const cls = ['mm-card', isUp ? 'up' : '', owner !== null ? 'got' : '', isUp && !prevUp.has(i) ? 'flip' : ''].join(' ');
      const style = owner !== null && owner >= 0 ? ` style="--own:${COLORS[owner]}"` : '';
      return `<button class="${cls}"${style} data-i="${i}" ${!myTurn || s.pending || isUp ? 'disabled' : ''}
        aria-label="${isUp ? `Karta ${i + 1}: ${c}` : `Karta ${i + 1}, zakryta`}">${isUp ? c : ''}</button>`;
    }).join('');

    el.innerHTML = `<div class="bar"><div class="score">${chips}</div></div>
      <div class="status" aria-live="polite">${status}${sub ? `<div class="mm-sub">${sub}</div>` : ''}</div>
      <div class="mm-board" style="--cols:${s.cols}">${cards}</div>
      <div class="actions">${over ? '<button id="again">Kolejna runda</button>' : ''}<button class="ghost" id="leave">Wyjdź</button></div>`;

    prevUp = up;
    el.querySelectorAll('.mm-card').forEach(b => b.onclick = () => send('move', { type: 'flip', i: +b.dataset.i }));
    const again = el.querySelector('#again'); if (again) again.onclick = () => send('rematch');
    el.querySelector('#leave').onclick = () => send('leave');
  }
};
})();
