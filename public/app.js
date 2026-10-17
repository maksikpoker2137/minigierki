const app = document.getElementById('app');
function fail(title, text) {
  app.innerHTML = `<div class="panel" style="max-width:560px;margin:30px auto"><h2>${title}</h2><p class="lead" style="margin-bottom:0">${text}</p></div>`;
}
if (typeof io === 'undefined') {
  fail('Brak połączenia z serwerem',
    'Strona nie może być otwarta jako zwykły plik. W folderze projektu uruchom <b>npm install</b>, potem <b>npm start</b> i wejdź na <b>http://localhost:3000</b>.');
  throw new Error('socket.io niedostępne – uruchom serwer (npm start)');
}
const socket = io();
const who = document.getElementById('who');
let catalog = [], picked = null, room = null;
let nick = localStorage.getItem('nick') || '';

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400); }
const send = (ev, data) => socket.emit(ev, data, r => r && r.error && toast(r.error));
const getNick = () => { nick = document.getElementById('nick').value.trim(); localStorage.setItem('nick', nick); return nick; };

document.getElementById('logo').onclick = e => { e.preventDefault(); if (room) socket.emit('leave'); room = null; home(); };

async function home() {
  who.textContent = '';
  try { if (!catalog.length) catalog = await (await fetch('/api/games')).json(); }
  catch (e) { return fail('Nie udało się wczytać gier', 'Sprawdź, czy serwer działa (npm start) i odśwież stronę.'); }
  if (!catalog.length) return fail('Brak gier', 'Serwer nie zwrócił żadnej gry. Sprawdź plik server.js.');
  picked = picked || catalog[0].id;
  app.innerHTML = `
    <h1>Zagrajmy razem.</h1>
    <p class="lead">Wybierz grę, utwórz pokój i wyślij znajomym czteroznakowy kod.</p>
    <div class="panel" style="margin-bottom:24px">
      <label for="nick">Twój nick</label>
      <input id="nick" maxlength="16" placeholder="np. Kuba" value="${esc(nick)}" autocomplete="off">
    </div>
    <h2 style="margin-bottom:12px">Gry</h2>
    <div class="games">
      ${catalog.map(g => `<button class="game" data-id="${g.id}" aria-pressed="${g.id === picked}">
        <span class="ic">${g.icon}</span><b>${g.name}</b><small>${g.desc}<br>${g.min === g.max ? g.min : g.min + '–' + g.max} graczy</small></button>`).join('')}
      <div class="game soon"><span class="ic">🧩</span><b>Kolejne gry</b><small>Wisielec, kalambury, quiz…</small></div>
    </div>
    <div class="panel" style="margin-bottom:16px">
      <h2>Nowy pokój</h2>
      <p class="lead" style="margin:4px 0 14px">Ty wybierasz grę, reszta dołącza kodem lub linkiem.</p>
      <button id="create" type="button">Utwórz pokój</button>
    </div>
    <div class="panel">
      <h2>Mam kod od znajomego</h2>
      <label for="code" style="margin-top:10px">Kod pokoju (4 znaki)</label>
      <div class="row">
        <input class="code-in" id="code" type="text" maxlength="4" placeholder="ABCD" autocomplete="off" autocapitalize="characters" spellcheck="false" style="flex:1;min-width:160px;max-width:none">
        <button class="ghost" id="join" type="button">Dołącz</button>
      </div>
    </div>
    </div>`;
  app.querySelectorAll('.game[data-id]').forEach(b => b.onclick = () => { picked = b.dataset.id; app.querySelectorAll('.game[data-id]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  const fromLink = new URLSearchParams(location.search).get('kod');
  if (fromLink) { document.getElementById('code').value = fromLink.slice(0, 4).toUpperCase(); document.getElementById(nick ? 'code' : 'nick').focus(); }
  document.getElementById('create').onclick = () => send('create', { name: getNick(), gameId: picked });
  const join = () => send('join', { name: getNick(), code: document.getElementById('code').value });
  document.getElementById('join').onclick = join;
  document.getElementById('code').onkeydown = e => { if (e.key === 'Enter') join(); };
}

function lobby(r) {
  const isHost = r.hostId === socket.id;
  const g = catalog.find(x => x.id === r.gameId);
  const enough = r.players.length >= r.min;
  app.innerHTML = `
    <div class="panel" style="text-align:center;max-width:520px;margin:20px auto">
      <p style="color:var(--muted)">${g.icon} ${g.name} · kod pokoju</p>
      <div class="big-code">${r.code}</div>
      <p class="lead" style="margin:0 auto 6px">Wyślij znajomym ten kod.</p>
      <button class="ghost" id="copy" type="button">Kopiuj link do pokoju</button>
      <ul class="players" style="text-align:left">
        ${r.players.map(p => `<li><span class="dot"></span>${esc(p.name)}${p.id === socket.id ? ' (ty)' : ''}<span class="tag">${p.id === r.hostId ? 'gospodarz' : ''}</span></li>`).join('')}
      </ul>
      <div class="actions">
        ${isHost ? `<button id="start" ${enough ? '' : 'disabled'}>${enough ? 'Zaczynamy' : `Czekamy na graczy (${r.players.length}/${r.min})`}</button>` : '<p class="lead" style="margin:0">Czekamy aż gospodarz zacznie grę…</p>'}
        <button class="ghost" id="leave">Wyjdź</button>
      </div>
    </div>`;
  document.getElementById('copy').onclick = () => { const url = `${location.origin}/?kod=${r.code}`; (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Link skopiowany'), () => prompt('Skopiuj link:', url)); };
  const st = document.getElementById('start'); if (st) st.onclick = () => send('start');
  document.getElementById('leave').onclick = () => { socket.emit('leave'); room = null; home(); };
}

socket.on('room', r => {
  room = r;
  who.textContent = `${nick} · pokój ${r.code}`;
  if (!r.state) return lobby(r);
  const me = r.players.findIndex(p => p.id === socket.id);
  let box = document.getElementById('game');
  if (!box) { app.innerHTML = '<div id="game"></div>'; box = document.getElementById('game'); }
  Games[r.gameId].render(box, r.state, me, (ev, d) => { if (ev === 'leave') { socket.emit('leave'); room = null; home(); } else send(ev, d); });
});
socket.on('relay', d => { if (room && Games[room.gameId] && Games[room.gameId].onRelay) Games[room.gameId].onRelay(d); });
socket.on('disconnect', () => toast('Utracono połączenie…'));

home();
