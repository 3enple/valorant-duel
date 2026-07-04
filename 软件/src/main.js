const canvas = document.querySelector("#scene");
const roomLabel = document.querySelector("#roomLabel");
const teamLabel = document.querySelector("#teamLabel");
const playerCountEl = document.querySelector("#playerCount");
const killsEl = document.querySelector("#kills");
const deathsEl = document.querySelector("#deaths");
const healthEl = document.querySelector("#health");
const ammoEl = document.querySelector("#ammo");
const scoreboardEl = document.querySelector("#scoreboard");
const startPanel = document.querySelector("#start");
const joinForm = document.querySelector("#joinForm");
const nameInput = document.querySelector("#nameInput");
const roomInput = document.querySelector("#roomInput");
const leaveButton = document.querySelector("#leaveButton");
const notice = document.querySelector("#notice");
const hitmarker = document.querySelector("#hitmarker");
const damageEl = document.querySelector("#damage");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11161c);
scene.fog = new THREE.Fog(0x11161c, 28, 92);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 140);
camera.position.set(-18, 1.7, 18);
camera.rotation.order = "YXZ";
scene.add(camera);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const keys = new Set();
const peers = new Map();
const walls = [];
const tracers = [];
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const shotDirection = new THREE.Vector3();

const local = {
  id: null,
  name: "",
  room: "",
  team: "red",
  health: 100,
  kills: 0,
  deaths: 0,
  ammo: 12,
  alive: true
};

let ws = null;
let yaw = -0.75;
let pitch = 0;
let recoil = 0;
let bobTime = 0;
let joined = false;
let reloading = false;
let lastNetSend = 0;
let leavingRoom = false;
let audioContext = null;
let lastStepTime = 0;

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: 0xb99a72, roughness: 0.88 }),
  lane: new THREE.MeshStandardMaterial({ color: 0xd0b086, roughness: 0.82 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x9b8263, roughness: 0.9 }),
  wallDark: new THREE.MeshStandardMaterial({ color: 0x63513f, roughness: 0.92 }),
  trim: new THREE.MeshStandardMaterial({ color: 0xb9474c, roughness: 0.65 }),
  red: new THREE.MeshStandardMaterial({ color: 0xff565f, roughness: 0.55 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x62a9ff, roughness: 0.55 }),
  enemyHead: new THREE.MeshStandardMaterial({ color: 0xf1c2a3, roughness: 0.72 }),
  gun: new THREE.MeshStandardMaterial({ color: 0x15191f, metalness: 0.22, roughness: 0.55 }),
  gunLight: new THREE.MeshStandardMaterial({ color: 0xe6ded0, metalness: 0.12, roughness: 0.5 }),
  hand: new THREE.MeshStandardMaterial({ color: 0xc98f70, roughness: 0.72 }),
  tracer: new THREE.LineBasicMaterial({ color: 0xfff0a8, transparent: true, opacity: 0.95 })
};

buildMap();
const weapon = buildWeapon();
camera.add(weapon);
updateHud([]);

function buildMap() {
  scene.add(new THREE.HemisphereLight(0xf5efe2, 0x3f4033, 1.55));

  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(10, 18, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(76, 0.25, 70), materials.floor);
  floor.position.set(0, -0.13, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  addGround("A Long", -23, -8, 9, 48);
  addGround("Mid", 0, 0, 13, 58);
  addGround("B Tunnel", 23, 6, 9, 44);
  addGround("A Site", -23, -31, 20, 15);
  addGround("B Site", 24, -29, 20, 15);
  addGround("T Spawn", 0, 28, 28, 12);
  addGround("CT Spawn", 0, -38, 22, 10);

  [
    [-38, 0, 2, 70], [38, 0, 2, 70], [0, 36, 76, 2], [0, -44, 76, 2],
    [-30, 4, 2, 40], [-16, -4, 2, 34], [-24, -26, 20, 2], [-8, -28, 2, 26],
    [30, 3, 2, 42], [16, -4, 2, 34], [24, -25, 20, 2], [8, -28, 2, 26],
    [-8, 15, 14, 2], [8, 15, 14, 2], [-7, -8, 2, 18], [7, -8, 2, 18],
    [-24, 18, 12, 2], [24, 18, 12, 2], [-30, -14, 10, 2], [30, -14, 10, 2],
    [-14, 28, 2, 12], [14, 28, 2, 12], [0, -22, 10, 2]
  ].forEach(([x, z, w, d], index) => addWall(x, z, w, d, index % 3 === 0 ? materials.wallDark : materials.wall));

  [
    [-24, -31, 4, 3], [-18, -35, 5, 2], [24, -31, 4, 3], [18, -35, 5, 2],
    [0, -4, 5, 2], [-23, 5, 3, 3], [23, 5, 3, 3]
  ].forEach(([x, z, w, d]) => addWall(x, z, w, d, materials.trim, 1.4));
}

function addGround(label, x, z, w, d) {
  const lane = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), materials.lane);
  lane.position.set(x, 0.03, z);
  lane.receiveShadow = true;
  lane.userData.label = label;
  scene.add(lane);
}

function addWall(x, z, w, d, material, h = 4.6) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  wall.position.set(x, h / 2, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
  walls.push({ x, z, w, d });
}

function buildWeapon() {
  const group = new THREE.Group();
  group.position.set(0.47, -0.38, -0.78);
  group.rotation.set(-0.04, -0.14, 0.02);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.85), materials.gun);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.13, 0.62), materials.gunLight);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 18), materials.gunLight);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.52, 0.25), materials.gun);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.36), materials.hand);
  const muzzle = new THREE.PointLight(0xffd18a, 0, 3);

  slide.position.set(0, 0.12, -0.07);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.1, -0.62);
  grip.position.set(0.04, -0.32, 0.18);
  grip.rotation.x = -0.34;
  hand.position.set(0.08, -0.45, 0.06);
  hand.rotation.x = -0.24;
  muzzle.position.set(0, 0.08, -0.95);

  group.add(body, slide, barrel, grip, hand, muzzle);
  group.userData.muzzle = muzzle;
  return group;
}

function makePlayerMesh(team) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.25, 0.42), team === "red" ? materials.red : materials.blue);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), materials.enemyHead);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.85), materials.gun);
  const hpBack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.03), materials.wallDark);
  const hp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.04), team === "red" ? materials.red : materials.blue);

  body.position.y = 0.78;
  head.position.y = 1.58;
  gun.position.set(0.38, 1.12, -0.38);
  hpBack.position.set(0, 2.05, 0);
  hp.position.set(0, 2.06, 0.01);
  group.add(body, head, gun, hpBack, hp);
  group.userData.hitbox = body;
  group.userData.hp = hp;
  group.visible = false;
  scene.add(group);
  return group;
}

function joinRoom(event) {
  event.preventDefault();
  unlockAudio();
  local.name = (nameInput.value || "Player").trim().slice(0, 14);
  local.room = (roomInput.value || "A123").trim().toUpperCase().slice(0, 12);
  local.team = new FormData(joinForm).get("team") || "red";
  roomLabel.textContent = local.room;
  teamLabel.textContent = local.team === "red" ? "红队" : "蓝队";
  enterMap({ id: `local-${Date.now()}`, spawn: localSpawn(local.team) }, true);
  connect();
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  if (!location.host) {
    showDamageText("需要用服务器链接打开");
    return;
  }

  if (ws) ws.close();
  leavingRoom = false;
  ws = new WebSocket(`${protocol}//${location.host}`);
  notice.textContent = "正在连接房间服务器...";

  ws.addEventListener("open", () => {
    send({ type: "join", room: local.room, name: local.name, team: local.team });
  });

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    handleMessage(message);
  });

  ws.addEventListener("close", () => {
    if (!leavingRoom && joined) showDamageText("服务器断开");
    leavingRoom = false;
  });

  ws.addEventListener("error", () => {
    showDamageText("连不上服务器");
  });
}

function handleMessage(message) {
  if (message.type === "reject") {
    notice.textContent = message.reason || "无法加入房间。";
    joined = false;
    startPanel.classList.remove("hidden");
    ws.close();
    return;
  }

  if (message.type === "welcome") {
    enterMap(message, false);
    return;
  }

  if (message.type === "snapshot") {
    updatePlayers(message.players);
    return;
  }

  if (message.type === "hit") {
    showHit(message.damage);
    return;
  }

  if (message.type === "killed") {
    showDamageText("击杀");
    return;
  }
}

function updatePlayers(players) {
  const seen = new Set();

  for (const player of players) {
    seen.add(player.id);
    if (player.id === local.id) {
      local.health = player.health;
      local.kills = player.kills;
      local.deaths = player.deaths;
      local.alive = player.alive;
      updateHud(players);
      continue;
    }

    let mesh = peers.get(player.id);
    if (!mesh) {
      mesh = makePlayerMesh(player.team);
      peers.set(player.id, mesh);
    }

    mesh.visible = player.alive;
    mesh.position.set(player.x, 0, player.z);
    mesh.rotation.y = player.yaw;
    mesh.userData.team = player.team;
    mesh.userData.name = player.name;
    mesh.userData.hitbox.userData.playerId = player.id;
    mesh.userData.hp.scale.x = Math.max(0.04, player.health / 100);
    mesh.userData.hp.position.x = -0.45 + mesh.userData.hp.scale.x * 0.45;
    mesh.lookAt(camera.position.x, mesh.position.y, camera.position.z);
  }

  for (const [id, mesh] of peers) {
    if (!seen.has(id)) {
      scene.remove(mesh);
      peers.delete(id);
    }
  }

  updateHud(players);
}

function setLocalPosition(spawn) {
  camera.position.set(spawn.x, 1.7, spawn.z);
  yaw = spawn.yaw;
  pitch = 0;
}

function enterMap(message, lockPointer) {
  local.id = message.id;
  local.health = 100;
  local.kills = 0;
  local.deaths = 0;
  local.ammo = 12;
  local.alive = true;
  joined = true;
  startPanel.classList.add("hidden");
  setLocalPosition(message.spawn);
  updateHud([]);
  if (lockPointer) canvas.requestPointerLock();
}

function localSpawn(team) {
  return team === "red"
    ? { x: -18, z: 28, yaw: -0.75 }
    : { x: 18, z: -38, yaw: 2.35 };
}

function shoot() {
  if (!joined || !local.alive || reloading || document.pointerLockElement !== canvas) return;
  if (local.ammo <= 0) {
    reload();
    return;
  }

  local.ammo -= 1;
  recoil = 1;
  weapon.userData.muzzle.intensity = 9;
  playGunshot();
  updateHud();

  camera.getWorldDirection(shotDirection);
  applyMovementSpread(shotDirection);
  raycaster.set(camera.position, shotDirection);

  const hitboxes = [];
  for (const mesh of peers.values()) {
    if (mesh.visible && mesh.userData.team !== local.team) hitboxes.push(mesh.userData.hitbox);
  }
  const hits = raycaster.intersectObjects(hitboxes, false);
  const tracerEnd = hits[0]?.point || shotDirection.clone().multiplyScalar(42).add(camera.position);
  addTracer(camera.position, tracerEnd);

  send({
    type: "shoot",
    origin: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    dir: { x: shotDirection.x, y: shotDirection.y, z: shotDirection.z },
    targetId: hits[0]?.object.userData.playerId || null
  });
}

function applyMovementSpread(dir) {
  if (!isMoving()) return;
  const spread = 0.075;
  dir.x += THREE.MathUtils.randFloatSpread(spread);
  dir.y += THREE.MathUtils.randFloatSpread(spread);
  dir.z += THREE.MathUtils.randFloatSpread(spread);
  dir.normalize();
}

function addTracer(start, end) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    start.clone(),
    end.clone()
  ]);
  const line = new THREE.Line(geometry, materials.tracer.clone());
  line.userData.life = 0.07;
  tracers.push(line);
  scene.add(line);
}

function reload() {
  if (reloading || local.ammo === 12) return;
  reloading = true;
  ammoEl.textContent = "...";
  window.setTimeout(() => {
    local.ammo = 12;
    reloading = false;
    updateHud();
  }, 1050);
}

function updateHud(players = []) {
  healthEl.textContent = Math.max(0, local.health);
  ammoEl.textContent = reloading ? "..." : local.ammo;
  killsEl.textContent = local.kills;
  deathsEl.textContent = local.deaths;
  playerCountEl.textContent = `${players.length || 1}/2`;

  scoreboardEl.innerHTML = players
    .slice()
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    .map((player) => `<div class="score-row ${player.team}"><span>${escapeHtml(player.name)} ${player.id === local.id ? "(你)" : ""}</span><b>${player.kills}/${player.deaths}</b></div>`)
    .join("");
}

function updateMovement(delta) {
  if (!joined || !local.alive) return;

  const walking = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const speed = walking ? 3.4 : 6.2;
  direction.set(0, 0, 0);
  if (keys.has("KeyW")) direction.z += 1;
  if (keys.has("KeyS")) direction.z -= 1;
  if (keys.has("KeyA")) direction.x -= 1;
  if (keys.has("KeyD")) direction.x += 1;
  direction.normalize();

  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  velocity.copy(forward).multiplyScalar(-direction.z);
  velocity.addScaledVector(right, direction.x);
  velocity.normalize().multiplyScalar(speed * delta);

  if (direction.lengthSq() > 0) {
    moveAxis(velocity.x, 0);
    moveAxis(0, velocity.z);
    bobTime += delta * speed;
    playFootstep(walking);
  }

  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -35.5, 35.5);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -41.5, 33.5);
  camera.position.y = 1.7 + Math.sin(bobTime * 7) * 0.025 * direction.length();
}

function isMoving() {
  return keys.has("KeyW") || keys.has("KeyS") || keys.has("KeyA") || keys.has("KeyD");
}

function moveAxis(dx, dz) {
  const nextX = camera.position.x + dx;
  const nextZ = camera.position.z + dz;
  if (!collides(nextX, nextZ)) {
    camera.position.x = nextX;
    camera.position.z = nextZ;
  }
}

function collides(x, z) {
  const radius = 0.45;
  return walls.some((wall) =>
    x > wall.x - wall.w / 2 - radius &&
    x < wall.x + wall.w / 2 + radius &&
    z > wall.z - wall.d / 2 - radius &&
    z < wall.z + wall.d / 2 + radius
  );
}

function sendState() {
  if (!joined || !ws || ws.readyState !== WebSocket.OPEN) return;
  const now = performance.now();
  if (now - lastNetSend < 50) return;
  lastNetSend = now;
  send({
    type: "state",
    x: camera.position.x,
    z: camera.position.z,
    yaw,
    pitch
  });
}

function send(message) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function showHit(damage) {
  hitmarker.classList.add("show");
  showDamageText(`-${damage}`);
  window.setTimeout(() => hitmarker.classList.remove("show"), 90);
}

function showDamageText(text) {
  damageEl.textContent = text;
  damageEl.classList.add("show");
  window.setTimeout(() => damageEl.classList.remove("show"), 240);
}

function updateWeapon(delta) {
  recoil = Math.max(0, recoil - delta * 9);
  weapon.position.y = -0.38 - recoil * 0.035 + Math.sin(bobTime * 7) * 0.012;
  weapon.position.z = -0.78 + recoil * 0.07;
  weapon.rotation.x = -0.04 - recoil * 0.12;
  weapon.userData.muzzle.intensity = Math.max(0, weapon.userData.muzzle.intensity - delta * 70);
}

function updateTracers(delta) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tracer = tracers[i];
    tracer.userData.life -= delta;
    tracer.material.opacity = Math.max(0, tracer.userData.life / 0.07);
    if (tracer.userData.life <= 0) {
      scene.remove(tracer);
      tracer.geometry.dispose();
      tracer.material.dispose();
      tracers.splice(i, 1);
    }
  }
}

function unlockAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
}

function playGunshot() {
  unlockAudio();
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

function playFootstep(walking) {
  if (walking) return;
  unlockAudio();
  const now = audioContext.currentTime;
  if (now - lastStepTime < 0.32) return;
  lastStepTime = now;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(82, now);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.09);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function frame() {
  const delta = Math.min(clock.getDelta(), 0.04);
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  updateMovement(delta);
  updateWeapon(delta);
  updateTracers(delta);
  sendState();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "KeyR") reload();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= event.movementX * 0.0021;
  pitch -= event.movementY * 0.0021;
  pitch = THREE.MathUtils.clamp(pitch, -1.35, 1.25);
});

window.addEventListener("mousedown", (event) => {
  if (event.button === 0) shoot();
});

canvas.addEventListener("click", () => {
  if (joined && document.pointerLockElement !== canvas) canvas.requestPointerLock();
});

leaveButton.addEventListener("click", () => {
  leavingRoom = true;
  if (ws) ws.close();
  joined = false;
  startPanel.classList.remove("hidden");
});

joinForm.addEventListener("submit", joinRoom);
roomInput.value = new URLSearchParams(location.search).get("room") || "";
frame();
