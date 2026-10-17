(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Statki – wygląd po stronie przeglądarki.
// Rozstawianie floty to lokalny "szkic" (draft); serwer dostaje go dopiero po kliknięciu "Gotowe".
const N = 10, LENS = [5, 4, 3, 3, 2], COLS = 'ABCDEFGHIJ';
const pos = i => COLS[i % N] + (((i / N) | 0) + 1);
const near = i => {
  const r = (i / N) | 0, c = i % N, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
  }
  return out;
};
const cellsOf = sh => Array.from({ length: sh.len }, (_, k) => (sh.h ? sh.r : sh.r + k) * N + (sh.h ? sh.c + k : sh.c));
// czy statek mieści się na planszy i nie styka się z już postawionymi
function fits(ships, sh) {
  const occ = new Set(); ships.forEach(x => x && cellsOf(x).forEach(i => occ.add(i)));
  for (let k = 0; k < sh.len; k++) {
    const r = sh.h ? sh.r : sh.r + k, c = sh.h ? sh.c + k : sh.c;
    if (r < 0 || r >= N || c < 0 || c >= N || near(r * N + c).some(j => occ.has(j))) return false;
  }
  return true;
}
const rand = n => Math.floor(Math.random() * n);
function randomFleet() {
  for (let t = 0; t < 300; t++) {
    const ships = []; let ok = true;
    for (const len of LENS) {
      let placed = false;
      for (let k = 0; k < 100 && !placed; k++) {
        const sh = { len, h: Math.random() < .5, r: rand(N), c: rand(N) };
        if (fits(ships, sh)) { ships.push(sh); placed = true; }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships;
  }
  return Array(LENS.length).fill(null);
}
const freshDraft = round => ({ round, ships: Array(LENS.length).fill(null), sel: 0, h: true });
// statek zaczepiamy w klikniętym polu, ale tak, żeby nie wystawał poza planszę
const anchored = (k, i, h) => {
  const len = LENS[k]; let r = (i / N) | 0, c = i % N;
  if (h) c = Math.min(c, N - len); else r = Math.min(r, N - len);
  return { len, r, c, h };
};

const grid = (cell, cls) => {
  let h = `<div class="bs-grid ${cls}"><span></span>${[...COLS].map(x => `<span class="bs-lab">${x}</span>`).join('')}`;
  for (let r = 0; r < N; r++) { h += `<span class="bs-lab">${r + 1}</span>`; for (let c = 0; c < N; c++) h += cell(r * N + c); }
  return h + '</div>';
};
const blocks = n => `<span class="bs-blk">${'■'.repeat(n)}</span>`;

let draft = null, ctx = null;
const redraw = () => ctx && Games.battleship.render(ctx.el, ctx.s, ctx.me, ctx.send);

// R obraca statek podczas rozstawiania
document.addEventListener('keydown', e => {
  if ((e.key === 'r' || e.key === 'R') && draft && document.querySelector('.bs-tools') && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { draft.h = !draft.h; redraw(); }
});

function lastMsg(s, me) {
  const l = s.last; if (!l) return '';
  return `${l.by === me ? 'Ty' : esc(s.names[l.by])}: ${pos(l.cell)} – ${l.sunk ? 'zatopiony!' : l.hit ? 'trafiony!' : 'pudło'}`;
}

window.Games = window.Games || {};
Games.battleship = {
  icon: '🚢',
  render(el, s, me, send) {
    ctx = { el, s, me, send };
    const opp = 1 - me, over = s.phase === 'over';
    if (s.phase === 'setup') { if (!draft || draft.round !== s.round) draft = freshDraft(s.round); } else draft = null;
    const setting = s.phase === 'setup' && !s.mine;

    let status;
    if (setting) status = s.ready[opp] ? `${esc(s.names[opp])} już gotowy. Rozstaw swoją flotę` : 'Rozstaw swoją flotę';
    else if (s.phase === 'setup') status = `Czekamy aż ${esc(s.names[opp])} rozstawi flotę…`;
    else if (over) status = s.winner === me ? '🎉 Zatapiasz całą flotę!' : `${esc(s.names[s.winner])} zatopił Twoją flotę`;
    else status = s.turn === me ? (s.last && s.last.by === me && s.last.hit ? 'Trafiony! Strzelasz dalej' : 'Twój strzał') : `Strzela ${esc(s.names[s.turn])}…`;

    const chips = [0, 1].map(i => `<div class="chip ${s.phase === 'play' && s.turn === i ? 'turn' : ''}" style="color:var(--${i ? 'o' : 'x'})">
      <b>${s.scores[i]}</b><span>${esc(s.names[i])}${i === me ? ' (ty)' : ''}</span></div>`).join('');

    let main = '', sub = lastMsg(s, me);

    if (setting) {
      sub = '';
      const at = new Map(); draft.ships.forEach((sh, i) => sh && cellsOf(sh).forEach(c => at.set(c, i)));
      const board = grid(i => `<button class="bs-c ${at.has(i) ? 'ship' : ''}" data-i="${i}" ${at.has(i) ? `data-s="${at.get(i)}"` : ''} aria-label="Pole ${pos(i)}"></button>`, 'bs-set');
      const ok = draft.ships.every(Boolean);
      main = `<div class="bs-wrap"><div class="bs-side"><h3>Twoja plansza</h3>${board}</div>
        <div class="bs-side bs-tools"><h3>Statki</h3>
          ${LENS.map((len, i) => `<button class="bs-ship ${draft.sel === i && !draft.ships[i] ? 'sel' : ''} ${draft.ships[i] ? 'placed' : ''}" data-k="${i}">${blocks(len)}<span>${draft.ships[i] ? 'ustawiony (kliknij, by zmienić)' : `${len}-masztowiec`}</span></button>`).join('')}
          <p class="lead bs-help">Wybierz statek i kliknij pole na planszy. Układ: <b>${draft.h ? 'poziomo' : 'pionowo'}</b>. Statki nie mogą się stykać, nawet rogami.</p>
          <div class="row"><button class="ghost" id="rot">Obróć (R)</button><button class="ghost" id="rnd">Losowo</button><button class="ghost" id="clr">Wyczyść</button></div>
          <button id="go" ${ok ? '' : 'disabled'}>Gotowe</button>
        </div></div>`;
    } else {
      const mineSet = new Set((s.mine || []).flat()), oppShot = new Set(s.oppShots);
      const myBoard = grid(i => {
        const ship = mineSet.has(i), shot = oppShot.has(i);
        const cls = ['bs-c', ship ? 'ship' : '', shot ? (ship ? 'hit' : 'miss') : '', s.last && s.last.by !== me && s.last.cell === i ? 'last' : ''].join(' ');
        return `<span class="${cls}" aria-label="Twoje pole ${pos(i)}">${shot ? (ship ? '✕' : '•') : ''}</span>`;
      }, 'bs-mine');
      if (s.phase === 'setup') main = `<div class="bs-wrap"><div class="bs-side"><h3>Twoja flota</h3>${myBoard}</div></div>`;
      else {
        const sm = new Map(s.myShots.map(x => [x.c, x.hit])), sunk = new Set(s.oppSunk.flat());
        const reveal = new Set((s.oppFleet || []).flat());
        const canFire = s.phase === 'play' && s.turn === me;
        const enemy = grid(i => {
          const shot = sm.has(i), hit = sm.get(i);
          const cls = ['bs-c', shot ? (hit ? (sunk.has(i) ? 'sunk' : 'hit') : 'miss') : (reveal.has(i) ? 'reveal' : ''), s.last && s.last.by === me && s.last.cell === i ? 'last' : ''].join(' ');
          return `<button class="${cls}" data-i="${i}" ${!canFire || shot ? 'disabled' : ''} aria-label="Strzał w ${pos(i)}">${shot ? (hit ? '✕' : '•') : ''}</button>`;
        }, `bs-fire ${canFire ? 'live' : ''}`);
        const left = [...LENS]; s.oppSunk.forEach(f => { const k = left.indexOf(f.length); if (k > -1) left.splice(k, 1); });
        const strip = `<div class="bs-fleet" aria-label="Flota przeciwnika">${left.map(n => `<span class="bs-mini">${blocks(n)}</span>`).join('')}${s.oppSunk.map(f => `<span class="bs-mini dead">${blocks(f.length)}</span>`).join('')}</div>`;
        main = `<div class="bs-wrap"><div class="bs-side"><h3>Flota: ${esc(s.names[opp])}</h3>${enemy}${strip}</div>
          <div class="bs-side"><h3>Twoja flota</h3>${myBoard}</div></div>`;
      }
    }

    el.innerHTML = `<div class="bar"><div class="score">${chips}</div></div>
      <div class="status" aria-live="polite">${status}${sub ? `<div class="bs-sub">${sub}</div>` : ''}</div>${main}
      <div class="actions">${over ? '<button id="again">Kolejna runda</button>' : ''}<button class="ghost" id="leave">Wyjdź</button></div>`;

    if (setting) {
      const board = el.querySelector('.bs-set');
      const clearPv = () => el.querySelectorAll('.pv-ok,.pv-bad').forEach(x => x.classList.remove('pv-ok', 'pv-bad'));
      const target = () => draft.ships[draft.sel] ? draft.ships.findIndex(x => !x) : draft.sel;
      board.onmouseover = e => {
        clearPv(); const b = e.target.closest('.bs-c'), k = target(); if (!b || k < 0) return;
        const sh = anchored(k, +b.dataset.i, draft.h), good = fits(draft.ships, sh);
        cellsOf(sh).forEach(i => { const c = board.querySelector(`[data-i="${i}"]`); if (c) c.classList.add(good ? 'pv-ok' : 'pv-bad'); });
      };
      board.onmouseleave = clearPv;
      board.querySelectorAll('.bs-c').forEach(b => b.onclick = () => {
        if (b.dataset.s !== undefined) { const k = +b.dataset.s; draft.ships[k] = null; draft.sel = k; return redraw(); } // zdjęcie statku z planszy
        const k = target(); if (k < 0) return;
        const sh = anchored(k, +b.dataset.i, draft.h);
        if (!fits(draft.ships, sh)) return;
        draft.ships[k] = sh;
        const next = draft.ships.findIndex(x => !x); draft.sel = next < 0 ? k : next;
        redraw();
      });
      el.querySelectorAll('.bs-ship').forEach(b => b.onclick = () => { const k = +b.dataset.k; draft.ships[k] = null; draft.sel = k; redraw(); });
      el.querySelector('#rot').onclick = () => { draft.h = !draft.h; redraw(); };
      el.querySelector('#rnd').onclick = () => { draft.ships = randomFleet(); draft.sel = Math.max(0, draft.ships.findIndex(x => !x)); redraw(); };
      el.querySelector('#clr').onclick = () => { draft = freshDraft(s.round); redraw(); };
      el.querySelector('#go').onclick = () => send('move', { type: 'ready', ships: draft.ships });
    }
    el.querySelectorAll('.bs-fire .bs-c').forEach(b => b.onclick = () => send('move', { type: 'fire', cell: +b.dataset.i }));
    const again = el.querySelector('#again'); if (again) again.onclick = () => send('rematch');
    el.querySelector('#leave').onclick = () => { draft = null; send('leave'); };
  }
};
})();
