const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// ➜ Nowa gra = nowy plik w /games + jedna linijka tutaj.
const games = { tictactoe: require('./games/tictactoe'), hangman: require('./games/hangman'), charades: require('./games/charades'), checkers: require('./games/checkers'), panstwa: require('./games/panstwa'), battleship: require('./games/battleship'), memory: require('./games/memory') };

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));
app.get('/api/games', (_, res) => res.json(Object.values(games).map(g => g.meta)));

const rooms = new Map(); // kod -> { code, gameId, players:[{id,name}], hostId, state }

const makeCode = () => {
  const abc = 'ABCDEFGHJKLMNPRSTUWXYZ23456789';
  let c; do { c = Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''); } while (rooms.has(c));
  return c;
};
const clean = s => String(s || '').trim().slice(0, 16);

// każdy gracz dostaje własny "widok" stanu (np. bez ukrytego hasła)
const viewFor = (r, id) => {
  if (!r.state) return null;
  const g = games[r.gameId];
  return g.view ? g.view(r.state, r.players.findIndex(p => p.id === id)) : r.state;
};
const publicRoom = (r, id) => ({
  code: r.code, gameId: r.gameId, hostId: r.hostId, state: viewFor(r, id),
  players: r.players.map(p => ({ id: p.id, name: p.name })),
  min: games[r.gameId].meta.min, max: games[r.gameId].meta.max
});
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
const push = r => { r.players.forEach(p => io.to(p.id).emit('room', publicRoom(r, p.id))); schedule(r); };

io.on('connection', socket => {
  const myRoom = () => rooms.get(socket.data.code);

  socket.on('create', ({ name, gameId }, cb) => {
    name = clean(name);
    if (!name || !games[gameId]) return cb({ error: 'Wpisz nick i wybierz grę.' });
    const room = { code: makeCode(), gameId, players: [{ id: socket.id, name }], hostId: socket.id, state: null };
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

  socket.on('start', () => {
    const r = myRoom(); if (!r || r.hostId !== socket.id || r.state) return;
    if (r.players.length < games[r.gameId].meta.min) return;
    r.state = games[r.gameId].init(r.players); push(r);
  });

  socket.on('move', (data, cb) => {
    const r = myRoom(); if (!r || !r.state) return;
    const idx = r.players.findIndex(p => p.id === socket.id);
    const res = games[r.gameId].move(r.state, idx, data || {});
    if (res.error) return cb && cb(res);
    r.state = res; push(r);
  });

  // szybki kanał dla gier (np. rysunek w kalamburach) – bez zapisu w stanie
  socket.on('relay', d => {
    const r = myRoom(); if (!r || !r.state) return;
    const g = games[r.gameId];
    if (!g.canRelay || !g.canRelay(r.state, r.players.findIndex(p => p.id === socket.id))) return;
    if (JSON.stringify(d || null).length > 300) return;
    socket.to(r.code).emit('relay', d);
  });

  socket.on('rematch', () => {
    const r = myRoom(); if (!r || !r.state) return;
    const g = games[r.gameId];
    if (g.rematch) { r.state = g.rematch(r.state); push(r); }
  });

  const leave = () => {
    const r = myRoom(); if (!r) return;
    const idx = r.players.findIndex(p => p.id === socket.id);
    r.players = r.players.filter(p => p.id !== socket.id);
    socket.leave(r.code); socket.data.code = null;
    if (!r.players.length) { clearTimeout(r.timer); return rooms.delete(r.code); }
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
