// Keep Clash — online match relay server
// Auto-matchmaking via /match queue, plus legacy /room/<code>.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const HTML_PATH = path.join(__dirname, 'index.html');
let htmlContent = null;
try { htmlContent = fs.readFileSync(HTML_PATH); } catch (e) {}

const rooms = new Map();
const queue = [];

function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { p1: null, p2: null });
  return rooms.get(code);
}
function otherRole(role) { return role === 'p1' ? 'p2' : 'p1'; }
function send(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}
function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s.toLowerCase();
}
function cleanupSocket(ws) {
  const qi = queue.indexOf(ws);
  if (qi >= 0) queue.splice(qi, 1);
  if (!ws.roomCode) return;
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  if (room[ws.role] === ws) room[ws.role] = null;
  const opponent = room[otherRole(ws.role)];
  if (opponent) send(opponent, { type: 'opponent_left' });
  if (!room.p1 && !room.p2) rooms.delete(ws.roomCode);
}
function pairFromQueue() {
  while (queue.length && queue[0].readyState !== queue[0].OPEN) queue.shift();
  while (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();
    if (!a || a.readyState !== a.OPEN) { if (b) queue.unshift(b); continue; }
    if (!b || b.readyState !== b.OPEN) { queue.unshift(a); continue; }
    const code = randomCode();
    const room = getRoom(code);
    room.p1 = a; room.p2 = b;
    a.roomCode = code; a.role = 'p1';
    b.roomCode = code; b.role = 'p2';
    send(a, { type: 'assign', role: 'p1' });
    send(b, { type: 'assign', role: 'p2' });
    send(a, { type: 'matched', room: code, opponentName: b.playerName || 'Opponent' });
    send(b, { type: 'matched', room: code, opponentName: a.playerName || 'Opponent' });
    if (a.playerName) send(b, { type: 'name', name: a.playerName, owner: 'p1' });
    if (b.playerName) send(a, { type: 'name', name: b.playerName, owner: 'p2' });
    send(a, { type: 'start' });
    send(b, { type: 'start' });
  }
}

const server = http.createServer((req, res) => {
  if (htmlContent) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(htmlContent);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Keep Clash relay server is running.\n');
  }
});

const wss = new WebSocketServer({ server });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean);

  if (parts[0] === 'match') {
    ws.playerName = 'Player';
    send(ws, { type: 'queue_ok' });
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch (e) { return; }
      if (msg.type === 'name') ws.playerName = String(msg.name || 'Player').slice(0, 16);
      else if (msg.type === 'queue') {
        if (!queue.includes(ws) && !ws.roomCode) {
          queue.push(ws);
          send(ws, { type: 'queue_ok' });
          pairFromQueue();
        }
      } else if (msg.type === 'play' || msg.type === 'emote' || msg.type === 'name') {
        if (!ws.roomCode) return;
        const room = rooms.get(ws.roomCode);
        if (!room) return;
        msg.owner = ws.role;
        send(room[otherRole(ws.role)], msg);
      }
    });
    ws.on('close', () => cleanupSocket(ws));
    ws.on('error', () => cleanupSocket(ws));
    return;
  }

  const code = (parts[1] || parts[0] || 'lobby').toLowerCase();
  const room = getRoom(code);
  let role;
  if (!room.p1) role = 'p1';
  else if (!room.p2) role = 'p2';
  else { send(ws, { type: 'full' }); ws.close(); return; }
  room[role] = ws;
  ws.roomCode = code; ws.role = role;
  send(ws, { type: 'assign', role });
  if (room.p1 && room.p2) {
    send(room.p1, { type: 'start' });
    send(room.p2, { type: 'start' });
  }
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }
    if (msg.type === 'play' || msg.type === 'emote' || msg.type === 'name') {
      msg.owner = ws.role;
      send(room[otherRole(ws.role)], msg);
    }
  });
  ws.on('close', () => cleanupSocket(ws));
  ws.on('error', () => cleanupSocket(ws));
});

server.listen(PORT, () => {
  console.log(`Keep Clash relay listening on port ${PORT}`);
});
