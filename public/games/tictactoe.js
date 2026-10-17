(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Kółko i krzyżyk – wygląd po stronie przeglądarki.
// Każda gra rejestruje się w Games[id] i dostaje: kontener, stan, indeks gracza, send().
window.Games = window.Games || {};
Games.tictactoe = {
  icon: '❌⭕',
  render(el, s, me, send) {
    const myMark = me === 0 ? 'X' : 'O';
    const over = s.winner !== null || s.draw;
    let status;
    if (s.winner !== null) status = s.winner === me ? '🎉 Wygrywasz tę rundę!' : `${s.names[s.winner]} wygrywa rundę`;
    else if (s.draw) status = 'Remis. Jeszcze raz?';
    else status = s.turn === me ? `Twój ruch (${myMark})` : `Ruch gracza ${s.names[s.turn]}…`;

    el.innerHTML = `
      <div class="bar">
        <div class="score">
          ${[0, 1].map(i => `<div class="chip ${!over && s.turn === i ? 'turn' : ''}" style="color:var(--${i ? 'o' : 'x'})">
            <b>${s.scores[i]}</b><span>${esc(s.names[i])}${i === me ? ' (ty)' : ''}</span></div>`).join('')}
        </div>
      </div>
      <div class="status" aria-live="polite">${status}</div>
      <div class="board">
        ${s.board.map((v, i) => `<button class="cell ${v || ''} ${s.line && s.line.includes(i) ? 'win' : ''}"
          data-i="${i}" ${v || over || s.turn !== me ? 'disabled' : ''} aria-label="Pole ${i + 1}">${v || ''}</button>`).join('')}
      </div>
      <div class="actions">${over ? '<button id="again">Kolejna runda</button>' : ''}<button class="ghost" id="leave">Wyjdź</button></div>`;

    el.querySelectorAll('.cell').forEach(b => b.onclick = () => send('move', { cell: +b.dataset.i }));
    const again = el.querySelector('#again'); if (again) again.onclick = () => send('rematch');
    el.querySelector('#leave').onclick = () => send('leave');
  }
};
})();
