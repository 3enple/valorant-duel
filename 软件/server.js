
const PORT = Number(process.env.PORT || 5177);
const ROOT = __dirname;
const MAX_PLAYERS = 2;
const DAMAGE = 34;
const RESPAWN_MS = 1800;
const DAMAGE = 17;
const ROUND_RESET_MS = 900;
const WIN_SCORE = 30;

const rooms = new Map();

    kills: 0,
    deaths: 0,
    alive: true,
    lastShot: 0
    lastShot: 0,
    matchOver: false
  };

  socket.on("data", (chunk) => handleFrame(client, chunk));
  if (!client.room) return;

  if (message.type === "state") {
    client.x = clamp(Number(message.x) || 0, -36, 36);
    client.z = clamp(Number(message.z) || 0, -42, 34);
    client.x = clamp(Number(message.x) || 0, -18, 18);
    client.z = clamp(Number(message.z) || 0, -20, 20);
    client.yaw = Number(message.yaw) || 0;
    client.pitch = clamp(Number(message.pitch) || 0, -1.4, 1.3);
    return;
    target.deaths += 1;
    client.kills += 1;
    send(client, { type: "killed" });
    setTimeout(() => respawn(target), RESPAWN_MS);

    if (client.kills >= WIN_SCORE) {
      broadcast(room, { type: "matchWin", winner: client.team, name: client.name });
      setTimeout(() => resetMatch(room), 3500);
      return;
    }

    setTimeout(() => resetRound(room), ROUND_RESET_MS);
  }
}

function respawn(client) {
  if (!client.room) return;
  client.health = 100;
  client.alive = true;
  Object.assign(client, spawnFor(client.team));
function resetRound(room) {
  for (const player of room.players) {
    player.health = 100;
    player.alive = true;
    Object.assign(player, spawnFor(player.team));
  }
  broadcast(room, { type: "roundReset" });
}

function resetMatch(room) {
  for (const player of room.players) {
    player.kills = 0;
    player.deaths = 0;
  }
  resetRound(room);
}

function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { code, players: new Set() });
  return rooms.get(code);
}

function spawnFor(team) {
  const spread = Math.random() * 8 - 4;
  const spread = Math.random() * 2 - 1;
  return team === "red"
    ? { x: -18 + spread, z: 27 + Math.random() * 3, yaw: -0.75 }
    : { x: 18 + spread, z: -38 + Math.random() * 3, yaw: 2.35 };
    ? { x: -8 + spread, z: 16, yaw: 0 }
    : { x: 8 + spread, z: -16, yaw: Math.PI };
}

function broadcast(room, message) {
