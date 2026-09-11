// Keep Clash — online match relay server
// Plain Node + ws, no external game logic: it just pairs two sockets into a
// "room" by code and relays messages between them. All the actual game
// simulation still runs in each player's browser.

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// rooms: code -> { p1: ws|null, p2: ws|null }
const rooms = new Map();

function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { p1: null, p2: null });
  return rooms.get(code);
}

function otherRole(role) {
  return role === 'p1' ? 'p2' : 'p1';
}

function send(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function cleanupSocket(ws) {
  if (!ws.roomCode) return;
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  if (room[ws.role] === ws) room[ws.role] = null;
  const opponent = room[otherRole(ws.role)];
  if (opponent) send(opponent, { type: 'opponent_left' });
  if (!room.p1 && !room.p2) rooms.delete(ws.roomCode);
}

// Simple health-check HTTP server (Render needs an HTTP response on the port)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Keep Clash relay server is running.\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // expected path: /room/<CODE>  (case-insensitive)
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean); // ['room', 'CODE']
  const code = (parts[1] || parts[0] || 'lobby').toLowerCase();

  const room = getRoom(code);

  let role;
  if (!room.p1) role = 'p1';
  else if (!room.p2) role = 'p2';
  else {
    send(ws, { type: 'full' });
    ws.close();
    return;
  }

  room[role] = ws;
  ws.roomCode = code;
  ws.role = role;

  send(ws, { type: 'assign', role });

  if (room.p1 && room.p2) {
    send(room.p1, { type: 'start' });
    send(room.p2, { type: 'start' });
  }

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }
    if (msg.type === 'play') {
      const opponent = room[otherRole(ws.role)];
      send(opponent, msg);
    }
  });

  ws.on('close', () => cleanupSocket(ws));
  ws.on('error', () => cleanupSocket(ws));
});

server.listen(PORT, () => {
  console.log(`Keep Clash relay listening on port ${PORT}`);
});
