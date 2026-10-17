(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Szachy – wygląd po stronie przeglądarki. Ruch: kliknij swoją figurę, potem pole docelowe. Ruchy legalne podaje serwer.
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟\uFE0E' }; // \uFE0E: pionek jako tekst, nie emoji
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const REASON = {
  stalemate: 'Pat – remis', repetition: 'Remis przez trzykrotne powtórzenie pozycji',
  fifty: 'Remis (50 ruchów bez bicia i ruchu pionem)', material: 'Remis (za mało materiału na mata)', agreement: 'Remis za zgodą graczy'
};
let sel = null, promo = null;
const isW = p => p === p.toUpperCase();
const piece = p => `<span class="xp ${isW(p) ? 'w' : 'b'}">${GLYPH[p.toLowerCase()]}</span>`;

window.Games = window.Games || {};
Games.chess = {
  render(el, s, me, send) {
    const mine = s.seat.indexOf(me), flip = mine === 1;
    const myTurn = s.winner === null && mine === s.turn;
    const moves = new Map(); // z -> [{to, promo}]
    s.legal.forEach(([f, t, pr]) => { if (!moves.has(f)) moves.set(f, []); moves.get(f).push({ to: t, promo: !!pr }); });
    if (!myTurn) { sel = null; promo = null; }
    if (sel !== null && !moves.has(sel)) sel = null;
    const dests = new Map((sel !== null ? moves.get(sel) : []).map(m => [m.to, m]));

    let status;
    if (s.winner === 'draw') status = REASON[s.reason] || 'Remis';
    else if (s.winner !== null) {
      const w = s.winner, loser = s.names[1 - w];
      status = s.reason === 'resign' ? (w === me ? `🎉 ${esc(loser)} poddaje partię. Wygrywasz!` : `${esc(loser)} poddaje partię`)
        : (w === me ? '🎉 Szach mat! Wygrywasz!' : `Szach mat! ${esc(s.names[w])} wygrywa`);
    } else if (myTurn) status = s.check >= 0 ? 'Szach! Twój ruch' : 'Twój ruch';
    else status = `${s.check >= 0 ? 'Szach! ' : ''}Ruch: ${esc(s.names[s.seat[s.turn]])}`;

    const lastSet = s.last ? [s.last.from, s.last.to] : [];
    const cells = [];
    for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) {
      const i = flip ? (7 - dr) * 8 + (7 - dc) : dr * 8 + dc, r = i >> 3, c = i & 7, p = s.board[i];
      const click = myTurn && (moves.has(i) || dests.has(i));
      const cls = ['xs', (r + c) % 2 === 0 ? 'l' : 'd', sel === i ? 'sel' : '', lastSet.includes(i) ? 'last' : '', s.check === i ? 'chk' : '',
        dests.has(i) ? (p ? 'cap' : 'dest') : ''].join(' ');
      const coord = (dc === 0 ? `<span class="xc" style="left:3px;top:2px">${8 - r}</span>` : '') + (dr === 7 ? `<span class="xc" style="right:3px;bottom:1px">${'abcdefgh'[c]}</span>` : '');
      cells.push(`<button type="button" class="${cls}" data-i="${i}" ${click ? '' : 'disabled'} aria-label="${'abcdefgh'[c]}${8 - r}${p ? ' ' + p : ''}">${coord}${p ? piece(p) : ''}</button>`);
    }

    // zbite figury: s.cap[kolor] = figury zbite przez ten kolor
    const side = col => {
      const adv = s.cap[col].reduce((a, p) => a + VAL[p.toLowerCase()], 0) - s.cap[1 - col].reduce((a, p) => a + VAL[p.toLowerCase()], 0);
      const caps = [...s.cap[col]].sort((a, b) => VAL[b.toLowerCase()] - VAL[a.toLowerCase()]).map(p => piece(p)).join('');
      const pl = s.seat[col];
      return `<div class="xcap"><b>${esc(s.names[pl])}${pl === me ? ' (ty)' : ''}</b><span class="xcol">${col === 0 ? 'białe' : 'czarne'}</span><span class="xtake">${caps}</span>${adv > 0 ? `<small>+${adv}</small>` : ''}</div>`;
    };
    const bottom = flip ? 1 : 0;

    const pairs = [];
    for (let k = 0; k < s.moves.length; k += 2) pairs.push(`<span><i>${k / 2 + 1}.</i> ${esc(s.moves[k])} ${esc(s.moves[k + 1] || '')}</span>`);

    const offered = s.drawOffer !== null, theyOffered = offered && s.drawOffer !== me && mine >= 0;
    const live = s.winner === null && mine >= 0;
    el.innerHTML = `<div class="bar"><div class="score">${[0, 1].map(i => `<div class="chip ${s.winner === null && s.seat[s.turn] === i ? 'turn' : ''}" style="color:var(--${i ? 'o' : 'x'})">
        <b>${s.scores[i]}</b><span>${esc(s.names[i])}${i === me ? ' (ty)' : ''}</span></div>`).join('')}</div></div>
      <div class="status" aria-live="polite">${status}</div>
      ${side(1 - bottom)}
      <div class="xb">${cells.join('')}</div>
      ${side(bottom)}
      ${promo ? `<div class="panel uno-pick" style="margin:12px auto"><p class="lead" style="margin:0 0 8px">Na kogo promujesz pionka?</p><div class="row" style="justify-content:center">
        ${['q', 'r', 'b', 'n'].map(x => `<button type="button" class="xpromo" data-p="${x}" aria-label="${x}">${piece(mine === 0 ? x.toUpperCase() : x)}</button>`).join('')}
        <button type="button" class="ghost" id="xcancel">Anuluj</button></div></div>` : ''}
      ${theyOffered ? `<div class="panel" style="max-width:420px;margin:14px auto 0;text-align:center"><p style="margin:0 0 10px">Przeciwnik proponuje remis.</p>
        <div class="actions" style="margin:0"><button type="button" id="xacc">Przyjmij</button><button type="button" class="ghost" id="xdec">Odrzuć</button></div></div>` : ''}
      <div class="actions">
        ${live ? `<button type="button" class="ghost" id="xdraw" ${s.drawOffer === me ? 'disabled' : ''}>${s.drawOffer === me ? 'Remis zaproponowany…' : 'Zaproponuj remis'}</button><button type="button" class="ghost" id="xres">Poddaj się</button>` : ''}
        ${s.winner !== null ? '<button id="again">Kolejna partia (zamiana kolorów)</button>' : ''}<button class="ghost" id="leave">Wyjdź</button>
      </div>
      <div class="xmoves" aria-label="Zapis partii">${pairs.join('') || '<small>Zapis partii pojawi się po pierwszym ruchu.</small>'}</div>`;

    const redraw = () => Games.chess.render(el, s, me, send);
    el.querySelectorAll('.xs').forEach(b => b.onclick = () => {
      const i = +b.dataset.i;
      if (dests.has(i)) {
        if (dests.get(i).promo) { promo = { from: sel, to: i }; return redraw(); }
        const from = sel; sel = null; send('move', { type: 'move', from, to: i });
      } else if (moves.has(i)) { sel = sel === i ? null : i; redraw(); }
    });
    el.querySelectorAll('.xpromo').forEach(b => b.onclick = () => {
      const m = promo; promo = null; sel = null; send('move', { type: 'move', from: m.from, to: m.to, promo: b.dataset.p });
    });
    const on = (id, fn) => { const b = el.querySelector(id); if (b) b.onclick = fn; };
    on('#xcancel', () => { promo = null; redraw(); });
    on('#xdraw', () => send('move', { type: 'draw' }));
    on('#xacc', () => send('move', { type: 'draw' }));
    on('#xdec', () => send('move', { type: 'decline' }));
    on('#xres', () => { if (confirm('Na pewno chcesz się poddać?')) send('move', { type: 'resign' }); });
    on('#again', () => send('rematch'));
    on('#leave', () => send('leave'));
    const log = el.querySelector('.xmoves'); if (log) log.scrollTop = log.scrollHeight;
  }
};
})();
