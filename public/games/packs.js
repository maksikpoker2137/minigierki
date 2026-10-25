(function () {
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Paczki kart Pokémon – wygląd po stronie przeglądarki. Dane kart: public/games/pokemon-data.js (PokeData).
const P = window.PokeData;
const COLORS = ['var(--x)', 'var(--o)', 'var(--accent)', 'var(--ok)', '#b86bff', '#ff9f43'];
const SOUND = { c: 'cflip', u: 'cflip', r: 'crare', e: 'cepic', l: 'clegend' };

// które karty były odkryte przy poprzednim rysowaniu – animujemy tylko nowo odkryte
let prevUp = {}, prevKey = '';

const art = c => `<img class="pk-art" src="${P.artUrl(c)}" alt="" loading="lazy" draggable="false" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'pk-fallback',textContent:'${P.TYPES[c.types[0]].icon}'}))">`;

// pojedyncza karta: zakryta (rewers) albo odkryta; size = 'big' | 'mini'
function card(c, o) {
  o = o || {};
  const cls = ['pk', o.size || '', o.flip ? 'flip' : ''];
  if (!c || c.up === false) {
    return `<div class="${cls.join(' ')} back" ${o.attrs || ''}><div class="pk-back"><i></i></div></div>`;
  }
  const d = P.CARDS[c.id], r = P.RARITY[d.rarity], t0 = P.TYPES[d.types[0]], t1 = P.TYPES[d.types[d.types.length - 1]];
  cls.push('face', 'r-' + d.rarity, c.holo ? 'holo' : '');
  return `<div class="${cls.join(' ')}" style="--rc:${r.color};--t0:${t0.color};--t1:${t1.color}" ${o.attrs || ''}>
    <div class="pk-in">
      <div class="pk-top"><b>${esc(d.name)}</b><span>#${String(d.dex).padStart(3, '0')}</span></div>
      <div class="pk-img">${art(d)}</div>
      <div class="pk-types">${d.types.map(t => `<span title="${P.TYPES[t].name}">${P.TYPES[t].icon}</span>`).join('')}<em>Poz. ${d.lvl}</em></div>
      <div class="pk-bot"><span class="pk-stars">${'★'.repeat(r.stars)}</span><span class="pk-rn">${r.name}${c.holo ? ' ✨' : ''}</span><b>${r.pts * (c.holo ? 2 : 1)} pkt</b></div>
    </div></div>`;
}

const statsHtml = c => { const t = P.stats(P.CARDS[c.id], c.holo); return `<div class="pk-st"><span title="Życie">❤ ${t.hp}</span><span title="Atak">⚔ ${t.atk}</span><span title="Obrona">🛡 ${t.def}</span><span title="Szybkość">⚡ ${t.spd}</span></div>`; };

// ---- odtwarzanie walki (cały przebieg liczy serwer, tu tylko go pokazujemy) ----
let sel = [], selKey = '';                 // wybór drużyny (indeksy w kolekcji)
const pb = { key: '', d: 0, step: 0, timer: null, shown: false, call: null }; // shown = czy pokazać już wyniki turnieju (bez spoilerów)  // d = numer pojedynku, step = ile zdarzeń już pokazano
const STEP_MS = 950;

// stan walki po `step` zdarzeniach: kto jest na polu i ile mają życia
function stateAt(duel, step) {
  const hp = { a: duel.start.a.map(u => u.max), b: duel.start.b.map(u => u.max) }, act = { a: 0, b: 0 };
  let last = null;
  duel.log.slice(0, step).forEach(e => {
    if (e.k === 'send') act[e.side] = e.i;
    else if (e.k === 'atk') { hp[e.side === 'a' ? 'b' : 'a'][e.to] = e.hp; last = e; }
    else if (e.k === 'end') last = e;
  });
  return { hp, act, last, ended: step >= duel.log.length };
}
const dname = id => P.CARDS[id].name;
function logText(duel, st) {
  const e = st.last; if (!e) return 'Pojedynek się zaczyna…';
  if (e.k === 'end') return `🏆 Wygrywa ${esc(e.winner === 'a' ? duel.an : duel.bn)}!`;
  const A = e.side === 'a' ? duel.start.a : duel.start.b, D = e.side === 'a' ? duel.start.b : duel.start.a;
  const T = P.TYPES[e.move].icon;
  const note = e.struggle ? ' (Szamotanina…)' : e.eff >= 2 ? ' Bardzo skuteczny!' : e.eff > 0 && e.eff < 1 ? ' Mało skuteczny…' : '';
  return `${esc(dname(A[e.from].id))} ${T} → ${esc(dname(D[e.to].id))} <b>−${e.dmg}</b>${e.crit ? ' 💥 Krytyk!' : ''}${note}${e.ko ? ` · ${esc(dname(D[e.to].id))} pokonany!` : ''}`;
}
function fighter(duel, st, side) {
  const team = duel.start[side], i = st.act[side], u = team[i], d = P.CARDS[u.id], hp = st.hp[side][i], pct = Math.max(0, hp / u.max * 100);
  const col = pct > 50 ? 'var(--ok)' : pct > 20 ? 'var(--x)' : 'var(--accent)';
  const pips = team.map((m, k) => `<i class="${st.hp[side][k] <= 0 ? 'ko' : k === i ? 'on' : ''}"></i>`).join('');
  const hit = st.last && st.last.k === 'atk' && st.last.side !== side && st.last.to === i;
  return `<div class="pk-fight ${side} ${hit ? 'hit' : ''} ${hp <= 0 ? 'ko' : ''}" style="--rc:${P.RARITY[d.rarity].color}">
    <div class="pk-fn">${esc(side === 'a' ? duel.an : duel.bn)}</div>
    <div class="pk-fimg ${u.holo ? 'holo' : ''}">${art(d)}</div>
    <div class="pk-fname">${esc(d.name)} ${d.types.map(t => P.TYPES[t].icon).join('')}${u.holo ? ' ✨' : ''}</div>
    <div class="pk-hp"><span style="width:${pct}%;background:${col}"></span></div><small>${Math.max(0, hp)}/${u.max}</small>
    <div class="pk-pips">${pips}</div></div>`;
}
function stopPlayback() { if (pb.timer) { clearInterval(pb.timer); pb.timer = null; } }
function startPlayback(box, s, me) {
  stopPlayback();
  const duels = s.results.duels, key = s.game + ':' + s.round;
  if (pb.key !== key) {
    pb.key = key; pb.step = 0; pb.shown = false;
    const mine = duels.findIndex(d => d.an === s.names[me] || d.bn === s.names[me]);
    pb.d = mine >= 0 ? mine : 0;
  }
  const draw = () => {
    if (!document.body.contains(box)) return stopPlayback();
    const duel = duels[pb.d], st = stateAt(duel, pb.step);
    box.querySelector('.pk-arena').innerHTML = `${fighter(duel, st, 'a')}<div class="pk-vs">VS</div>${fighter(duel, st, 'b')}`;
    box.querySelector('.pk-log').innerHTML = logText(duel, st);
    box.querySelectorAll('[data-d]').forEach(b => b.classList.toggle('on', +b.dataset.d === pb.d));
    box.querySelector('#nextd').disabled = pb.d >= duels.length - 1;
  };
  const tick = () => {
    const duel = duels[pb.d];
    if (pb.step >= duel.log.length) return stopPlayback();
    const e = duel.log[pb.step++];
    draw();
    if (pb.step >= duel.log.length && pb.d === duels.length - 1) setTimeout(reveal, 1200);
    if (window.Sfx && e.k === 'atk') Sfx.play(e.ko ? 'death' : 'hit', { vol: e.eff >= 2 || e.crit ? 1 : 0.6 });
    if (window.Sfx && e.k === 'end') { const w = e.winner === 'a' ? duel.an : duel.bn; if (w === s.names[me]) Sfx.play('win'); }
  };
  const reveal = () => { if (pb.shown || !pb.call || pb.key !== key) return; pb.shown = true; const c = pb.call; Games.packs.render(c.el, c.s, c.me, c.send); };
  const bShow = box.querySelector('#showres'); if (bShow) bShow.onclick = reveal;
  const go = d => { pb.d = d; pb.step = 0; draw(); stopPlayback(); pb.timer = setInterval(tick, STEP_MS); };
  box.querySelectorAll('[data-d]').forEach(b => b.onclick = () => go(+b.dataset.d));
  box.querySelector('#nextd').onclick = () => go(Math.min(duels.length - 1, pb.d + 1));
  box.querySelector('#skip').onclick = () => { stopPlayback(); pb.step = duels[pb.d].log.length; draw(); if (pb.d === duels.length - 1) reveal(); };
  box.querySelector('#replay').onclick = () => go(pb.d);
  draw();
  if (pb.step < duels[pb.d].log.length) pb.timer = setInterval(tick, STEP_MS);
}

window.Games = window.Games || {};
Games.packs = {
  icon: '🎴',
  render(el, s, me, send) {
    const kindName = i => { const k = P.pack(s.kinds[i]); return k.icon + ' ' + k.name; };
    const key = s.game + ':' + s.round;
    if (key !== prevKey) { prevUp = {}; prevKey = key; }
    const open = s.phase === 'open', pick = s.phase === 'pick', over = s.phase === 'over', team = s.phase === 'team';
    pb.call = { el, s, me, send };
    const battleOver = over && s.battle, hideRes = battleOver && !(pb.shown && pb.key === s.game + ':' + s.round), showHand = !pick && !team && !battleOver;
    if (!team) stopPlayback();
    if (team && selKey !== s.game + ':team') { selKey = s.game + ':team'; sel = []; }
    const myTeam = Array.isArray(s.team[me]) ? s.team[me] : null;
    const mine = s.packs[me] || [];
    const myLeft = mine.filter(c => !c.up).length;
    const prevDex = el.querySelector('.pk-dex'), dexOpen = prevDex ? prevDex.open : over; // kolekcja nie zwija się przy odświeżeniu
    const flipsNow = []; // [gracz, indeks karty, karta] – nowo odkryte od ostatniego rysowania

    const packsHtml = s.packs.map((pack, p) => pack.map((c, i) => {
      const k = p + '_' + i, fresh = c.up && !prevUp[k];
      if (fresh) flipsNow.push([p, c]);
      return { k, fresh, c, p, i };
    }));

    // --- nagłówek: wyniki graczy ---
    const chips = s.names.map((n, i) => {
      const done = pick ? s.kinds[i] === true : s.packs[i].length > 0 && s.packs[i].every(c => c.up);
      const cnt = s.dex[i].length;
      const big = !s.battle ? s.scores[i] : battleOver ? (hideRes ? '?' : s.results.table.find(r => r.name === n).wins) : s.collN[i];
      const tdone = team && !!s.team[i];
      return `<div class="chip ${((open || pick) && !done) || (team && !tdone) ? 'turn' : ''}" style="color:${COLORS[i % COLORS.length]}">
        <b>${s.battle && !battleOver ? '🎴' + big : battleOver ? '⚔' + big : big}</b><span>${esc(n)}${i === me ? ' (ty)' : ''}${s.wins[i] ? ' · 🏆' + s.wins[i] : ''}</span>
        <span class="pk-dexc">📕 ${cnt}/${s.total}${open || pick ? (done ? ' · ✔' : ' · …') : team ? (tdone ? ' · ✔' : ' · …') : ''}</span></div>`;
    }).join('');

    // --- status ---
    let status;
    if (hideRes) status = '⚔️ Walki trwają… oglądaj pojedynki';
    else if (battleOver) {
      const key = r => r.wins * 100000 + r.hp, best = Math.max(...s.results.table.map(key)), win = s.results.table.filter(r => key(r) === best).map(r => r.name);
      status = win.length > 1 ? `Remis: ${win.map(esc).join(' i ')}` : win[0] === s.names[me] ? '🎉 Twoja drużyna wygrywa turniej!' : `${esc(win[0])} wygrywa turniej`;
    } else if (team) status = myTeam ? 'Drużyna gotowa. Czekamy na resztę…' : `Ułóż drużynę: wybierz ${s.teamSize} karty (kolejność = kolejność wchodzenia do walki)`;
    else if (over) {
      const best = Math.max(...s.scores), win = s.names.filter((_, i) => s.scores[i] === best);
      status = win.length > 1 ? `Remis: ${win.map(esc).join(' i ')}` : s.scores.indexOf(best) === me ? '🎉 Wygrywasz! Masz szczęście do kart' : `${esc(win[0])} wygrywa całą grę`;
    } else if (pick) status = s.kinds[me] ? 'Czekamy aż reszta wybierze paczkę…' : `Paczka ${s.round + 1}/${s.rounds}: wybierz rodzaj paczki`;
    else if (open) status = myLeft ? `Paczka ${s.round + 1}/${s.rounds}: odkryj swoje karty (${myLeft} zakryte)` : 'Czekamy aż reszta odkryje karty…';
    else status = `Paczka ${s.round + 1}/${s.rounds} zakończona`;

    // --- moje karty (duże) ---
    const myCards = packsHtml[me] ? packsHtml[me].map(x => card(x.c, { size: 'big', flip: x.fresh, attrs: `data-i="${x.i}" ${open && !x.c.up ? 'role="button" tabindex="0"' : ''}` })).join('') : '';

    // --- cudze paczki (małe) ---
    const others = !showHand ? '' : s.names.map((n, p) => p === me ? '' : `<div class="pk-row"><span class="pk-who" style="color:${COLORS[p % COLORS.length]}">${esc(n)}${pick ? '' : `<small class="pk-k">${kindName(p)}</small>`}${open || !s.gained[p] ? '' : ` <b>+${s.gained[p]}</b>`}</span>
      <div class="pk-mini">${packsHtml[p].map(x => card(x.c, { size: 'mini', flip: x.fresh })).join('')}</div></div>`).join('');

    // --- tabela po rundzie ---
    const table = !(s.phase === 'between' || (over && !s.battle)) ? '' : `<div class="pk-sum">${s.names.map((n, i) => ({ n, i, g: s.gained[i] })).sort((a, b) => b.g - a.g).map(r =>
      `<div class="pk-sr" style="color:${COLORS[r.i % COLORS.length]}"><span>${esc(r.n)}${r.i === me ? ' (ty)' : ''}</span><b>+${r.g}</b><small>razem ${s.scores[r.i]}</small></div>`).join('')}</div>`;

    // --- moja kolekcja (Pokédex) ---
    const have = new Set(s.dex[me] || []);
    const dex = `<details class="pk-dex" ${dexOpen ? 'open' : ''}><summary>📕 Twoja kolekcja: ${have.size}/${s.total}</summary>
      <div class="pk-grid">${P.CARDS.map(d => {
        const r = P.RARITY[d.rarity];
        return have.has(d.id) ? `<div class="pk-tile on" style="--rc:${r.color}" title="${esc(d.name)} · ${r.name}">${art(d)}<small>${esc(d.name)}</small></div>`
          : `<div class="pk-tile" title="Jeszcze nie masz tej karty"><span class="pk-q">?</span><small>#${String(d.dex).padStart(3, '0')}</small></div>`;
      }).join('')}</div></details>`;

    // --- wybór rodzaju paczki (każdy widzi, ile kart z danej paczki już ma) ---
    const have0 = new Set(s.dex[me] || []);
    const pickHtml = !pick ? '' : `<div class="pk-pick">${P.PACKS.map(k => {
      const got = k.ids.filter(id => have0.has(id)).length;
      return `<button type="button" class="pk-opt ${got === k.ids.length ? 'full' : ''}" data-kind="${k.id}" ${s.kinds[me] ? 'disabled' : ''}>
        <span class="ic">${k.icon}</span><b>${k.id === 'mixed' ? 'Mieszana' : esc(k.name)}</b><small>masz ${got}/${k.ids.length}</small></button>`;
    }).join('')}</div>`;

    // --- tryb walki: układanie drużyny z własnej kolekcji ---
    const order = (s.coll[me] || []).map((c, i) => ({ c, i })).sort((a, b) => P.POWER_ORDER(b.c) - P.POWER_ORDER(a.c));
    const teamHtml = !team ? '' : `<p class="pk-help">Wybierz ${s.teamSize} karty z ${order.length}, które otworzyłeś. Walczą po kolei: pierwsza wybrana wchodzi pierwsza. Zwróć uwagę na typy (🔥 bije 🌿, 💧 bije 🔥, ⚡ bije 💧…).</p>
      ${myTeam ? `<div class="pk-hand">${myTeam.map(k => `<div class="pk-pc">${card(s.coll[me][k], { size: 'big' })}${statsHtml(s.coll[me][k])}</div>`).join('')}</div>`
      : `<div class="pk-coll">${order.map(({ c, i }) => { const n = sel.indexOf(i);
        return `<div class="pk-pc ${n >= 0 ? 'sel' : ''}" data-c="${i}" role="button" tabindex="0">${n >= 0 ? `<em class="pk-no">${n + 1}</em>` : ''}${card(c, { size: 'big' })}${statsHtml(c)}</div>`; }).join('')}</div>`}`;

    // --- tryb walki: wyniki i odtwarzacz pojedynków ---
    const battleHtml = !battleOver ? '' : `${hideRes ? '' : '<div class="pk-sum">'}${hideRes ? '' : [...s.results.table].map((r, i) => ({ ...r, i })).sort((a, b) => b.wins - a.wins || b.hp - a.hp).map(r =>
        `<div class="pk-sr" style="color:${COLORS[r.i % COLORS.length]}"><span>${esc(r.name)}${r.name === s.names[me] ? ' (ty)' : ''}</span><b>${r.wins} ${r.wins === 1 ? 'wygrana' : 'wygrane'}</b><small>zostało ${r.hp} ❤</small></div>`).join('') + '</div>'}
      <div class="pk-player"><div class="pk-duels">${s.results.duels.map((d, i) => `<button type="button" class="ghost tl" data-d="${i}">${esc(d.an)} vs ${esc(d.bn)}</button>`).join('')}</div>
        <div class="pk-arena"></div><div class="pk-log" aria-live="polite"></div>
        <div class="actions" style="margin-top:12px"><button type="button" class="ghost" id="replay">↺ Od nowa</button><button type="button" class="ghost" id="skip">⏭ Pomiń</button><button type="button" id="nextd">Następny pojedynek ▶</button>${hideRes ? '<button type="button" class="ghost" id="showres">🏁 Pokaż wyniki</button>' : ''}</div></div>`;

    el.innerHTML = `<div class="bar"><div class="score">${chips}</div></div>
      <div class="status" aria-live="polite">${status}</div>
      ${pickHtml}
      ${showHand ? `<div class="pk-kind">${kindName(me)}</div><div class="pk-hand">${myCards}</div>` : ''}
      ${teamHtml}
      ${battleHtml}
      <div class="actions">
        ${open && myLeft ? `<button id="all" type="button">Odkryj wszystkie</button>` : ''}
        ${s.phase === 'between' ? '<button id="next" type="button">Następna paczka</button>' : ''}
        ${team && !myTeam ? `<button id="ready" type="button" ${sel.length === s.teamSize ? '' : 'disabled'}>Walczymy! (${sel.length}/${s.teamSize})</button>` : ''}
        ${over ? '<button id="again" type="button">Zagraj jeszcze raz</button>' : ''}
        <button class="ghost" id="leave" type="button">Wyjdź</button>
      </div>
      ${table}
      <div class="pk-others">${others}</div>
      ${dex}`;

    // dźwięki nowo odkrytych kart (swoje głośno, cudze ciszej)
    flipsNow.forEach(([p, c], n) => {
      const r = P.CARDS[c.id].rarity;
      if (window.Sfx) setTimeout(() => Sfx.play(SOUND[r], { vol: p === me ? 1 : 0.35 }), n * 90);
    });
    if (window.Sfx && prevKey && over && !s.battle && !prevUp._over) { prevUp._over = 1; if (s.scores.indexOf(Math.max(...s.scores)) === me) Sfx.play('win'); }

    const up = {}; packsHtml.forEach(row => row.forEach(x => { if (x.c.up) up[x.p + '_' + x.i] = 1; })); if (prevUp._over) up._over = 1; prevUp = up;

    el.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => send('move', { type: 'pick', kind: b.dataset.kind }));
    el.querySelectorAll('.pk-hand .pk.back').forEach(b => {
      const go = () => send('move', { type: 'flip', i: +b.dataset.i });
      b.onclick = go; b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    });
    const bind = (id, fn) => { const b = el.querySelector('#' + id); if (b) b.onclick = fn; };
    el.querySelectorAll('[data-c]').forEach(b => {
      const tog = () => { const i = +b.dataset.c, k = sel.indexOf(i); if (k >= 0) sel.splice(k, 1); else if (sel.length < s.teamSize) sel.push(i); Games.packs.render(el, s, me, send); };
      b.onclick = tog; b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } };
    });
    bind('ready', () => send('move', { type: 'team', idx: sel }));
    if (battleOver) startPlayback(el, s, me);
    bind('all', () => send('move', { type: 'flipall' }));
    bind('next', () => send('move', { type: 'next' }));
    bind('again', () => send('rematch'));
    bind('leave', () => send('leave'));
  }
};
})();
