const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 5177);
const ROOT = __dirname;
const MAX_PLAYERS = 2;
const DAMAGE = 34;
const RESPAWN_MS = 1800;

const rooms = new Map();

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = path.resolve(ROOT, `.${urlPath}`);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

server.on("upgrade", (req, socket) => {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    ""
  ].join("\r\n"));

  const client = {
    id: crypto.randomUUID().slice(0, 8),
    socket,
    room: null,
    name: "Player",
    team: "red",
    x: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    health: 100,
    kills: 0,
    deaths: 0,
    alive: true,
    lastShot: 0
  };

  socket.on("data", (chunk) => handleFrame(client, chunk));
  socket.on("close", () => removeClient(client));
  socket.on("error", () => removeClient(client));
});

setInterval(() => {
  for (const room of rooms.values()) {
    const players = [...room.players].map(publicPlayer);
    broadcast(room, { type: "snapshot", players });
  }
}, 50);

if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`AirLab server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = { server, rooms };

function handleMessage(client, message) {
  if (message.type === "join") {
    joinRoom(client, message);
    return;
  }

  if (!client.room) return;

  if (message.type === "state") {
    client.x = clamp(Number(message.x) || 0, -36, 36);
    client.z = clamp(Number(message.z) || 0, -42, 34);
    client.yaw = Number(message.yaw) || 0;
    client.pitch = clamp(Number(message.pitch) || 0, -1.4, 1.3);
    return;
  }

  if (message.type === "shoot") {
    handleShot(client, message);
  }
}

function joinRoom(client, message) {
  const roomCode = clean(message.room || "A123", 12).toUpperCase();
  const name = clean(message.name || "Player", 14);
  const team = message.team === "blue" ? "blue" : "red";
  const room = getRoom(roomCode);

  if (room.players.size >= MAX_PLAYERS) {
    send(client, { type: "reject", reason: "房间已满，单挑房最多 2 人。" });
    return;
  }

  client.room = roomCode;
  client.name = name;
  client.team = team;
  client.health = 100;
  client.alive = true;
  Object.assign(client, spawnFor(team));
  room.players.add(client);
  send(client, { type: "welcome", id: client.id, spawn: { x: client.x, z: client.z, yaw: client.yaw } });
}

function handleShot(client, message) {
  const now = Date.now();
  if (!client.alive || now - client.lastShot < 90) return;
  client.lastShot = now;

  const room = rooms.get(client.room);
  if (!room) return;

  const target = [...room.players].find((player) => player.id === message.targetId);
  if (!target || !target.alive || target.team === client.team) return;

  const origin = message.origin || {};
  const dir = normalize(message.dir || {});
  if (!dir) return;

  const distance = rayDistance(origin, dir, { x: target.x, y: 1.05, z: target.z });
  if (distance > 0.85 || pointDistance(origin, target) > 78) return;

  target.health = Math.max(0, target.health - DAMAGE);
  send(client, { type: "hit", damage: DAMAGE, health: target.health });

  if (target.health === 0) {
    target.alive = false;
    target.deaths += 1;
    client.kills += 1;
    send(client, { type: "killed" });
    setTimeout(() => respawn(target), RESPAWN_MS);
  }
}

function respawn(client) {
  if (!client.room) return;
  client.health = 100;
  client.alive = true;
  Object.assign(client, spawnFor(client.team));
}

function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { code, players: new Set() });
  return rooms.get(code);
}

function removeClient(client) {
  if (!client.room) return;
  const room = rooms.get(client.room);
  if (room) {
    room.players.delete(client);
    if (room.players.size === 0) rooms.delete(client.room);
  }
  client.room = null;
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    team: player.team,
    x: player.x,
    z: player.z,
    yaw: player.yaw,
    pitch: player.pitch,
    health: player.health,
    kills: player.kills,
    deaths: player.deaths,
    alive: player.alive
  };
}

function spawnFor(team) {
  const spread = Math.random() * 8 - 4;
  return team === "red"
    ? { x: -18 + spread, z: 27 + Math.random() * 3, yaw: -0.75 }
    : { x: 18 + spread, z: -38 + Math.random() * 3, yaw: 2.35 };
}

function broadcast(room, message) {
  for (const player of room.players) send(player, message);
}

function send(client, data) {
  if (client.socket.destroyed) return;
  const payload = Buffer.from(JSON.stringify(data));
  const header = payload.length < 126
    ? Buffer.from([0x81, payload.length])
    : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 255]);
  client.socket.write(Buffer.concat([header, payload]));
}

function handleFrame(client, chunk) {
  if (chunk.length < 6) return;
  const opcode = chunk[0] & 0x0f;
  if (opcode === 0x8) {
    client.socket.end();
    return;
  }

  let offset = 2;
  let length = chunk[1] & 0x7f;
  if (length === 126) {
    length = chunk.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    client.socket.destroy();
    return;
  }

  const mask = chunk.subarray(offset, offset + 4);
  offset += 4;
  const data = Buffer.alloc(length);
  for (let i = 0; i < length; i++) data[i] = chunk[offset + i] ^ mask[i % 4];

  try {
    handleMessage(client, JSON.parse(data.toString("utf8")));
  } catch {
    client.socket.destroy();
  }
}

function rayDistance(origin, dir, point) {
  const px = point.x - origin.x;
  const py = point.y - origin.y;
  const pz = point.z - origin.z;
  const t = Math.max(0, px * dir.x + py * dir.y + pz * dir.z);
  const cx = origin.x + dir.x * t;
  const cy = origin.y + dir.y * t;
  const cz = origin.z + dir.z * t;
  return Math.hypot(point.x - cx, point.y - cy, point.z - cz);
}

function pointDistance(origin, target) {
  return Math.hypot((origin.x || 0) - target.x, (origin.z || 0) - target.z);
}

function normalize(dir) {
  const length = Math.hypot(dir.x || 0, dir.y || 0, dir.z || 0);
  if (!Number.isFinite(length) || length === 0) return null;
  return { x: dir.x / length, y: dir.y / length, z: dir.z / length };
}

function clean(value, max) {
  return String(value).replace(/[^\w\u4e00-\u9fa5-]/g, "").slice(0, max) || "Player";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
