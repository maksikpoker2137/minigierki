(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let sel = null;
window.Games = window.Games || {};
Games.checkers = {
  render(el, s, me, send) {
    const myTurn = s.winner === null && s.turn === me;
    if (!myTurn) sel = null;
    if (myTurn && s.chain) sel = s.chain.from;
    if (sel !== null && !s.legal.some(m => m.from === sel)) sel = null;
    const movable = new Set(myTurn ? s.legal.map(m => m.from) : []);
    const dests = new Set(myTurn && sel !== null ? s.legal.filter(m => m.from === sel).map(m => m.to) : []);
    const mustCapture = myTurn && s.legal.length && s.legal[0].cap !== undefined;

    let status;
    if (s.winner === 'draw') status = 'Remis (40 ruchów samymi damkami bez bicia)';
    else if (s.winner !== null) status = s.winner === me ? '🎉 Wygrywasz partię!' : `${s.names[s.winner]} wygrywa partię`;
    else if (myTurn) status = s.chain ? 'Kontynuuj bicie tym samym pionkiem' : mustCapture ? 'Bicie jest obowiązkowe' : 'Twój ruch';
    else status = `Ruch gracza ${s.names[s.turn]}…`;

    const order = [...Array(64).keys()]; if (me === 1) order.reverse(); // każdy gra "od dołu"
    const cells = order.map(i => {
      if (((i >> 3) + (i & 7)) % 2 === 0) return '<div class="sq light"></div>';
      const v = s.board[i], p = v ? (v - 1) >> 1 : 0, king = v && v % 2 === 0;
      const ghost = s.chain && s.chain.caps.includes(i);
      const cls = ['sq', 'dark', sel === i ? 'sel' : '', dests.has(i) ? 'dest' : '', movable.has(i) ? 'can' : '',
        s.last && (s.last.from === i || s.last.to === i) ? 'last' : ''].join(' ');
      const click = movable.has(i) || dests.has(i);
      return `<button class="${cls}" data-i="${i}" ${click ? '' : 'disabled'} aria-label="Pole ${(i >> 3) + 1}-${(i & 7) + 1}">${v ? `<span class="pc p${p} ${king ? 'king' : ''} ${ghost ? 'ghost' : ''}">${king ? '♛' : ''}</span>` : ''}</button>`;
    }).join('');

    el.innerHTML = `<div class="bar"><div class="score">${[0, 1].map(i => `<div class="chip ${s.winner === null && s.turn === i ? 'turn' : ''}" style="color:var(--${i ? 'o' : 'x'})">
        <b>${s.scores[i]}</b><span>${esc(s.names[i])}${i === me ? ' (ty)' : ''}</span></div>`).join('')}</div></div>
      <div class="status" aria-live="polite">${status}</div>
      <div class="cb">${cells}</div>
      <p class="lead" style="text-align:center;margin:16px auto 0;font-size:.9rem">Pionki biją też do tyłu, a damka porusza się po całej przekątnej.</p>
      <div class="actions">${s.winner !== null ? '<button id="again">Kolejna partia</button>' : ''}<button class="ghost" id="leave">Wyjdź</button></div>`;

    const redraw = () => Games.checkers.render(el, s, me, send);
    el.querySelectorAll('.sq.dark').forEach(b => b.onclick = () => {
      const i = +b.dataset.i;
      if (dests.has(i)) { const from = sel; sel = null; send('move', { from, to: i }); }
      else if (movable.has(i)) { sel = i; redraw(); }
    });
    const again = el.querySelector('#again'); if (again) again.onclick = () => send('rematch');
    el.querySelector('#leave').onclick = () => send('leave');
  }
};
})();
