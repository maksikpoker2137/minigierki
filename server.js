const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

// ➜ Nowa gra = nowy plik w /games + jedna linijka tutaj.
const games = { tictactoe: require('./games/tictactoe'), hangman: require('./games/hangman'), charades: require('./games/charades'), checkers: require('./games/checkers'), panstwa: require('./games/panstwa'), battleship: require('./games/battleship'), memory: require('./games/memory'), typing: require('./games/typing'), pong: require('./games/pong'), wordle: require('./games/wordle'), uno: require('./games/uno'), chess: require('./games/chess'), arena: require('./games/arena'), packs: require('./games/packs') };

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));
app.get('/api/games', (_, res) => res.json(Object.values(games).map(g => g.meta)));

// ---- ranking zwycięstw (zapisywany w data/wins.json, klucz = nick bez względu na wielkość liter) ----
const WINS_FILE = path.join(__dirname, 'data', 'wins.json');
let wins = {};
try { wins = JSON.parse(fs.readFileSync(WINS_FILE, 'utf8')) || {}; } catch (e) { wins = {}; }
let saveT = null;
const saveWins = () => { // zapis z opóźnieniem, żeby nie męczyć dysku po każdej wygranej
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { fs.mkdirSync(path.dirname(WINS_FILE), { recursive: true }); fs.writeFileSync(WINS_FILE, JSON.stringify(wins)); } catch (e) { console.error('Nie zapisano rankingu:', e.message); } }, 1500);
};
const board = () => Object.values(wins).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)).slice(0, 10).map(w => ({ name: w.name, total: w.total }));
const recordWin = (name, n) => {
  const k = name.toLowerCase(); if (!wins[k]) wins[k] = { name, total: 0 };
  wins[k].total += n; saveWins(); io.emit('board', board());
};
// wykrywa nowe zwycięstwa: gry z tablicą wins (Arena, Pong, Pamięć…) po wzroście licznika, pozostałe po ustawieniu state.winner
const trackWins = r => {
  const s = r.state;
  if (!s) { r.prevWins = null; r.won = false; return; }
  if (Array.isArray(s.wins)) {
    if (r.prevWins && r.prevWins.length === s.wins.length) s.wins.forEach((w, i) => { if (w > r.prevWins[i] && r.players[i]) recordWin(r.players[i].name, w - r.prevWins[i]); });
    r.prevWins = s.wins.slice();
  } else if (Number.isInteger(s.winner) && s.winner >= 0 && s.winner < r.players.length) {
    if (!r.won) { r.won = true; recordWin(r.players[s.winner].name, 1); }
  } else r.won = false;
};

const rooms = new Map(); // kod -> { code, gameId, players:[{id,name}], spectators:[{id,name}], hostId, state }

const makeCode = () => {
  const abc = 'ABCDEFGHJKLMNPRSTUWXYZ23456789';
  let c; do { c = Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''); } while (rooms.has(c));
  return c;
};
const clean = s => String(s || '').trim().slice(0, 16);
// opcje pokoju (mapa, tryb…) – gra opisuje je w meta.options, domyślne wartości trafiają do pokoju
const defaultOptions = g => Object.fromEntries((g.meta.options || []).map(o => [o.id, o.def]));

// każdy gracz dostaje własny "widok" stanu (np. bez ukrytego hasła)
const viewFor = (r, id) => {
  if (!r.state) return null;
  const g = games[r.gameId];
  return g.view ? g.view(r.state, r.players.findIndex(p => p.id === id)) : r.state;
};
const publicRoom = (r, id) => ({
  code: r.code, gameId: r.gameId, hostId: r.hostId, state: viewFor(r, id),
  options: r.options, startError: games[r.gameId].canStart ? games[r.gameId].canStart(r.players, r.options) : null,
  players: r.players.map(p => ({ id: p.id, name: p.name })),
  spectating: !r.players.some(p => p.id === id), watchers: r.spectators.length,
  min: games[r.gameId].meta.min, max: games[r.gameId].meta.max
});

// lista pokoi widoczna w menu głównym: czekające (można dołączyć) i trwające (można oglądać)
const roomList = () => [...rooms.values()].map(r => {
  const m = games[r.gameId].meta;
  return {
    code: r.code, gameId: r.gameId, started: !!r.state,
    players: r.players.map(p => p.name), max: m.max, watchers: r.spectators.length,
    full: r.players.length >= m.max
  };
});
const broadcastRooms = () => io.emit('rooms', roomList());
// gry z czasomierzem (state.endsAt) dostają wywołanie tick() po upływie czasu
const schedule = r => {
  clearTimeout(r.timer);
  const g = games[r.gameId];
  if (!r.state || !r.state.endsAt || !g.tick) return;
  r.timer = setTimeout(() => {
    if (!rooms.has(r.code) || !r.state) return;
    r.state = g.tick(r.state); push(r);
  }, Math.max(0, r.state.endsAt - Date.now()) + 50);
};
const emitRoom = r => {
  r.players.forEach(p => io.to(p.id).emit('room', publicRoom(r, p.id)));
  r.spectators.forEach(p => io.to(p.id).emit('room', publicRoom(r, p.id)));
};
// gry na żywo (np. Pong) mają step(state, dt) – serwer woła je ok. 30 razy na sekundę i wysyła zmiany graczom i widzom
const ensureLoop = r => {
  const g = games[r.gameId];
  if (!g.step || !r.state || r.loop) return;
  r.last = Date.now();
  r.loop = setInterval(() => {
    const now = Date.now(), dt = Math.min((now - r.last) / 1000, 0.1); r.last = now;
    if (!rooms.has(r.code) || !r.state) { clearInterval(r.loop); r.loop = null; return; }
    try {
      if (g.step(r.state, dt)) { emitRoom(r); trackWins(r); }
    } catch (e) { // błąd w jednej grze nie może wywrócić całego serwera
      console.error('Błąd w pętli gry', r.gameId, e);
      if (r.state && r.state.boss) { r.state.boss = null; r.state.banner = null; } // najczęściej winny jest boss – usuwamy go i gramy dalej
    }
  }, 33);
};
const push = r => { trackWins(r); emitRoom(r); schedule(r); ensureLoop(r); broadcastRooms(); };

io.on('connection', socket => {
  socket.emit('rooms', roomList()); socket.emit('board', board());
  const myRoom = () => rooms.get(socket.data.code);

  socket.on('create', ({ name, gameId }, cb) => {
    name = clean(name);
    if (!name || !games[gameId]) return cb({ error: 'Wpisz nick i wybierz grę.' });
    const room = { code: makeCode(), gameId, players: [{ id: socket.id, name }], spectators: [], hostId: socket.id, state: null, options: defaultOptions(games[gameId]) };
    rooms.set(room.code, room);
    socket.join(room.code); socket.data.code = room.code;
    cb({ ok: true }); push(room);
  });

  socket.on('join', ({ name, code }, cb) => {
    name = clean(name); code = String(code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!name) return cb({ error: 'Wpisz nick.' });
    if (!room) return cb({ error: 'Nie ma takiego pokoju.' });
    if (room.state) return cb({ error: 'Gra już trwa.' });
    if (room.players.length >= games[room.gameId].meta.max) return cb({ error: 'Pokój jest pełny.' });
    room.players.push({ id: socket.id, name });
    socket.join(code); socket.data.code = code;
    cb({ ok: true }); push(room);
  });

  // oglądanie trwającej gry (bez prawa ruchu)
  socket.on('watch', ({ name, code }, cb) => {
    name = clean(name) || 'Widz'; code = String(code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return cb({ error: 'Nie ma takiego pokoju.' });
    if (!room.state) return cb({ error: 'Gra jeszcze nie ruszyła.' });
    room.spectators.push({ id: socket.id, name });
    socket.join(code); socket.data.code = code;
    cb({ ok: true }); push(room);
  });

  // gospodarz zmienia opcje pokoju w poczekalni (tylko wartości z listy gry)
  socket.on('setopt', ({ id, value } = {}) => {
    const r = myRoom(); if (!r || r.hostId !== socket.id || r.state) return;
    const o = (games[r.gameId].meta.options || []).find(x => x.id === id);
    if (!o || !o.values.some(v => v[0] === value)) return;
    r.options[id] = value; push(r);
  });

  socket.on('start', (_, cb) => {
    const r = myRoom(); if (!r || r.hostId !== socket.id || r.state) return;
    const g = games[r.gameId];
    if (r.players.length < g.meta.min) return;
    const err = g.canStart && g.canStart(r.players, r.options);
    if (err) return cb && cb({ error: err });
    r.state = g.init(r.players, r.options); push(r);
  });

  socket.on('move', (data, cb) => {
    const r = myRoom(); if (!r || !r.state) return;
    const idx = r.players.findIndex(p => p.id === socket.id);
    if (idx < 0) return cb && cb({ error: 'Oglądasz tę grę.' });
    const res = games[r.gameId].move(r.state, idx, data || {});
    if (res.error) return cb && cb(res);
    r.state = res;
    if (games[r.gameId].step) ensureLoop(r); else push(r); // gra na żywo wysyła stan sama, w pętli
  });

  // szybki kanał dla gier (np. rysunek w kalamburach) – bez zapisu w stanie
  socket.on('relay', d => {
    const r = myRoom(); if (!r || !r.state) return;
    const g = games[r.gameId];
    if (!r.players.some(p => p.id === socket.id)) return;
    if (!g.canRelay || !g.canRelay(r.state, r.players.findIndex(p => p.id === socket.id))) return;
    if (JSON.stringify(d || null).length > 300) return;
    socket.to(r.code).emit('relay', d);
  });

  socket.on('rematch', () => {
    const r = myRoom(); if (!r || !r.state || !r.players.some(p => p.id === socket.id)) return;
    const g = games[r.gameId];
    if (g.rematch) { r.state = g.rematch(r.state); push(r); }
  });

  const leave = () => {
    const r = myRoom(); if (!r) return;
    const idx = r.players.findIndex(p => p.id === socket.id);
    socket.leave(r.code); socket.data.code = null;
    if (idx < 0) { // widz wychodzi
      r.spectators = r.spectators.filter(p => p.id !== socket.id);
      return push(r);
    }
    r.players = r.players.filter(p => p.id !== socket.id);
    if (!r.players.length) { // pokój znika, widzów odsyłamy do menu
      clearTimeout(r.timer); clearInterval(r.loop); rooms.delete(r.code);
      r.spectators.forEach(p => {
        io.to(p.id).emit('closed');
        const sk = io.sockets.sockets.get(p.id); if (sk) { sk.leave(r.code); sk.data.code = null; }
      });
      return broadcastRooms();
    }
    if (r.hostId === socket.id) r.hostId = r.players[0].id;
    if (r.state) { // ktoś wyszedł w trakcie gry
      const g = games[r.gameId];
      r.state = g.onLeave ? g.onLeave(r.state, idx) : null; // brak obsługi albo za mało graczy = poczekalnia
    }
    push(r);
  };
  socket.on('leave', leave);
  socket.on('disconnect', leave);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Działa: http://localhost:${PORT}`));
