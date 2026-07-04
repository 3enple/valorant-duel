const canvas = document.querySelector("#scene");
const roomLabel = document.querySelector("#roomLabel");
const teamLabel = document.querySelector("#teamLabel");
const playerCountEl = document.querySelector("#playerCount");
const killsEl = document.querySelector("#kills");
const deathsEl = document.querySelector("#deaths");
const healthEl = document.querySelector("#health");
const ammoEl = document.querySelector("#ammo");
const redScoreEl = document.querySelector("#redScore");
const blueScoreEl = document.querySelector("#blueScore");
const scoreboardEl = document.querySelector("#scoreboard");
const startPanel = document.querySelector("#start");
const joinForm = document.querySelector("#joinForm");
const nameInput = document.querySelector("#nameInput");
const roomInput = document.querySelector("#roomInput");
const leaveButton = document.querySelector("#leaveButton");
const notice = document.querySelector("#notice");
const hitmarker = document.querySelector("#hitmarker");
const damageEl = document.querySelector("#damage");
const settingsButton = document.querySelector("#settingsButton");
const menuSettingsButton = document.querySelector("#menuSettingsButton");
const settingsPanel = document.querySelector("#settingsPanel");
const closeSettings = document.querySelector("#closeSettings");
const crosshairStyleInput = document.querySelector("#crosshairStyle");
const crosshairColorInput = document.querySelector("#crosshairColor");
const crosshairSizeInput = document.querySelector("#crosshairSize");
const weaponSelect = document.querySelector("#weaponSelect");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11161c);
scene.fog = new THREE.Fog(0x11161c, 18, 56);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 100);
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

const weapons = {
  rifle: { label: "步枪", ammo: 30, interval: 105, damage: 17, auto: true, spread: 0.078, recoil: 1.0, reloadMs: 1250 },
  pistol: { label: "手枪", ammo: 12, interval: 210, damage: 25, auto: false, spread: 0.045, recoil: 0.42, reloadMs: 900 },
  sniper: { label: "狙击枪", ammo: 5, interval: 900, damage: 100, auto: false, spread: 0.012, recoil: 1.75, reloadMs: 1600 }
};

const recoilPattern = [
  [0, 0.012], [0.002, 0.014], [-0.002, 0.016], [0.004, 0.018], [-0.005, 0.019],
  [0.007, 0.02], [-0.007, 0.021], [0.009, 0.021], [-0.01, 0.02], [0.011, 0.019],
  [0.012, 0.018], [-0.012, 0.017], [0.013, 0.016], [-0.013, 0.015]
];

const local = {
  id: null,
  name: "",
  room: "",
  team: "red",
  health: 100,
  kills: 0,
  deaths: 0,
  weapon: "rifle",
  ammo: weapons.rifle.ammo,
  alive: true
};

let ws = null;
let yaw = 0;
let pitch = 0;
let recoil = 0;
let bobTime = 0;
let jumpY = 0;
let jumpVelocity = 0;
let grounded = true;
let joined = false;
let reloading = false;
let leavingRoom = false;
let firing = false;
let lastShotTime = 0;
let lastManualShotTime = 0;
let recoilIndex = 0;
let lastNetSend = 0;
let lastStepTime = 0;
let audioContext = null;
let lastServerPlayers = [];

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: 0xb89168, roughness: 0.88 }),
  lane: new THREE.MeshStandardMaterial({ color: 0xd4b184, roughness: 0.82 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x94775a, roughness: 0.9 }),
  wallDark: new THREE.MeshStandardMaterial({ color: 0x5e4c3d, roughness: 0.92 }),
  cover: new THREE.MeshStandardMaterial({ color: 0xb9474c, roughness: 0.65 }),
  red: new THREE.MeshStandardMaterial({ color: 0xff565f, roughness: 0.55 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x62a9ff, roughness: 0.55 }),
  head: new THREE.MeshStandardMaterial({ color: 0xf1c2a3, roughness: 0.72 }),
  gun: new THREE.MeshStandardMaterial({ color: 0x15191f, metalness: 0.25, roughness: 0.52 }),
  gunLight: new THREE.MeshStandardMaterial({ color: 0xd8d0c2, metalness: 0.12, roughness: 0.5 }),
  hand: new THREE.MeshStandardMaterial({ color: 0xc98f70, roughness: 0.72 }),
  tracer: new THREE.LineBasicMaterial({ color: 0xfff0a8, transparent: true, opacity: 0.95 })
};

buildMap();
const weapon = buildWeapon();
camera.add(weapon);
applyCrosshairSettings();
updateWeaponModel();
updateHud([]);
frame();

function buildMap() {
  scene.add(new THREE.HemisphereLight(0xf5efe2, 0x3c3f35, 1.55));

  const sun = new THREE.DirectionalLight(0xffffff, 2.25);
  sun.position.set(8, 16, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.25, 38), materials.floor);
  floor.position.set(0, -0.13, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  addGround(0, 0, 8.8, 36);
  addGround(0, 14, 12, 5.4);
  addGround(0, -14, 12, 5.4);

  [
    [-9, 0, 1, 38, 4.8], [9, 0, 1, 38, 4.8], [0, 19, 18, 1, 4.8], [0, -19, 18, 1, 4.8],
    [-4.8, 14, 1, 6, 3.8], [4.8, -14, 1, 6, 3.8],
    [0, 3.2, 3.1, 1.2, 1.6], [0, -3.2, 3.1, 1.2, 1.6],
    [-3.7, 0, 1.3, 4.8, 1.7], [3.7, 0, 1.3, 4.8, 1.7]
  ].forEach(([x, z, w, d, h], index) => addWall(x, z, w, d, index > 5 ? materials.cover : materials.wall, h));
}

function addGround(x, z, w, d) {
  const lane = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), materials.lane);
  lane.position.set(x, 0.03, z);
  lane.receiveShadow = true;
  scene.add(lane);
}

function addWall(x, z, w, d, material, h = 4.2) {
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

  const parts = {
    body: new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.92), materials.gun),
    receiver: new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.62), materials.gunLight),
    barrel: new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 18), materials.gunLight),
    muzzleBrake: new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.16, 18), materials.gun),
    stock: new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.52), materials.gun),
    mag: new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.52, 0.3), materials.gun),
    grip: new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), materials.gun),
    sightRear: new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.08), materials.gun),
    sightFront: new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.04), materials.gun),
    scope: new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 20), materials.gun),
    hand: new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.36), materials.hand),
    muzzle: new THREE.PointLight(0xffd18a, 0, 3)
  };

  parts.receiver.position.set(0, 0.12, -0.08);
  parts.barrel.rotation.x = Math.PI / 2;
  parts.barrel.position.set(0, 0.1, -0.78);
  parts.muzzleBrake.rotation.x = Math.PI / 2;
  parts.muzzleBrake.position.set(0, 0.1, -1.18);
  parts.stock.position.set(0, 0.01, 0.58);
  parts.stock.rotation.x = -0.15;
  parts.mag.position.set(0.02, -0.34, -0.13);
  parts.mag.rotation.x = 0.18;
  parts.grip.position.set(0.04, -0.32, 0.22);
  parts.grip.rotation.x = -0.34;
  parts.sightRear.position.set(0, 0.24, 0.12);
  parts.sightFront.position.set(0, 0.25, -0.72);
  parts.scope.rotation.z = Math.PI / 2;
  parts.scope.position.set(0, 0.27, -0.14);
  parts.hand.position.set(0.08, -0.45, 0.06);
  parts.hand.rotation.x = -0.24;
  parts.muzzle.position.set(0, 0.08, -1.28);

  Object.values(parts).forEach((part) => group.add(part));
  group.userData.parts = parts;
  group.userData.muzzle = parts.muzzle;
  return group;
}

function updateWeaponModel() {
  const p = weapon.userData.parts;
  p.scope.visible = local.weapon === "sniper";
  p.stock.visible = local.weapon !== "pistol";
  p.mag.visible = local.weapon !== "sniper";
  p.barrel.scale.y = local.weapon === "sniper" ? 1.7 : local.weapon === "pistol" ? 0.45 : 1;
  p.body.scale.set(local.weapon === "pistol" ? 0.7 : 1, local.weapon === "pistol" ? 0.85 : 1, local.weapon === "pistol" ? 0.62 : 1);
  p.receiver.scale.set(local.weapon === "pistol" ? 0.7 : 1, 1, local.weapon === "pistol" ? 0.55 : 1);
  p.muzzleBrake.position.z = local.weapon === "sniper" ? -1.55 : local.weapon === "pistol" ? -0.72 : -1.18;
}

function makePlayerMesh(team) {
  const group = new THREE.Group();
  const teamMat = team === "red" ? materials.red : materials.blue;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.64, 1.0, 0.36), teamMat);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.45, 0.42), teamMat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 22, 16), materials.head);
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.46), materials.gun);
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.74, 0.18), teamMat);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.74, 0.18), teamMat);
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 0.22), materials.wallDark);
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 0.22), materials.wallDark);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.92), materials.gun);
  const hpBack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.03), materials.wallDark);
  const hp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.04), teamMat);

  body.position.y = 0.92;
  chest.position.y = 1.22;
  head.position.y = 1.58;
  helmet.position.y = 1.78;
  leftArm.position.set(-0.5, 1.1, -0.04);
  rightArm.position.set(0.5, 1.1, -0.1);
  leftArm.rotation.x = -0.35;
  rightArm.rotation.x = -0.75;
  leftLeg.position.set(-0.18, 0.36, 0);
  rightLeg.position.set(0.18, 0.36, 0);
  gun.position.set(0.38, 1.13, -0.46);
  hpBack.position.set(0, 2.05, 0);
  hp.position.set(0, 2.06, 0.01);
  group.add(body, chest, head, helmet, leftArm, rightArm, leftLeg, rightLeg, gun, hpBack, hp);
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
  local.weapon = weaponSelect.value;
  local.ammo = weapons[local.weapon].ammo;
  roomLabel.textContent = local.room;
  teamLabel.textContent = local.team === "red" ? "红队" : "蓝队";
  enterMap({ id: `local-${Date.now()}`, spawn: localSpawn(local.team) }, true);
  connect();
}

function connect() {
  if (!location.host) {
    showDamageText("需要用服务器链接打开");
    return;
  }
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  if (ws) ws.close();
  leavingRoom = false;
  ws = new WebSocket(`${protocol}//${location.host}`);
  notice.textContent = "正在连接房间服务器...";

  ws.addEventListener("open", () => {
    send({ type: "join", room: local.room, name: local.name, team: local.team });
  });
  ws.addEventListener("message", (event) => handleMessage(JSON.parse(event.data)));
  ws.addEventListener("close", () => {
    if (!leavingRoom && joined) showDamageText("服务器断开");
    leavingRoom = false;
  });
  ws.addEventListener("error", () => showDamageText("连不上服务器"));
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
    firing = false;
    showDamageText("击杀");
    return;
  }
  if (message.type === "died") {
    firing = false;
    local.alive = false;
    showDamageText("你被击杀");
    return;
  }
  if (message.type === "roundReset") {
    const spawn = message.spawns?.[local.id];
    if (spawn) setLocalPosition(spawn);
    local.health = 100;
    local.alive = true;
    firing = false;
    recoilIndex = 0;
    showDamageText("回到出生点");
    return;
  }
  if (message.type === "matchWin") {
    firing = false;
    showDamageText(`${message.name} 获胜`);
  }
}

function updatePlayers(players) {
  lastServerPlayers = players;
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
      mesh.userData.targetPosition = new THREE.Vector3(player.x, 0, player.z);
      peers.set(player.id, mesh);
    }
    mesh.visible = player.alive;
    mesh.userData.targetPosition.set(player.x, 0, player.z);
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

function enterMap(message, lockPointer) {
  local.id = message.id;
  local.health = 100;
  local.kills = 0;
  local.deaths = 0;
  local.ammo = weapons[local.weapon].ammo;
  local.alive = true;
  joined = true;
  startPanel.classList.add("hidden");
  setLocalPosition(message.spawn);
  updateWeaponModel();
  updateHud(lastServerPlayers);
  if (lockPointer) canvas.requestPointerLock();
}

function setLocalPosition(spawn) {
  camera.position.set(spawn.x, 1.7, spawn.z);
  yaw = spawn.yaw;
  pitch = 0;
  jumpY = 0;
  jumpVelocity = 0;
  grounded = true;
}

function localSpawn(team) {
  return team === "red" ? { x: 0, z: 15, yaw: 0 } : { x: 0, z: -15, yaw: Math.PI };
}

function shoot() {
  if (!joined || !local.alive || reloading || document.pointerLockElement !== canvas) return;
  const config = weapons[local.weapon];
  const now = performance.now();
  if (now - lastShotTime < config.interval) return;
  if (local.ammo <= 0) {
    reload();
    return;
  }

  lastShotTime = now;
  lastManualShotTime = now;
  local.ammo -= 1;
  recoil = 1;
  weapon.userData.muzzle.intensity = 9;
  playGunshot();
  updateHud(lastServerPlayers);

  camera.getWorldDirection(shotDirection);
  applyMovementSpread(shotDirection);
  raycaster.set(camera.position, shotDirection);

  const hitboxes = [];
  for (const mesh of peers.values()) {
    if (mesh.visible && mesh.userData.team !== local.team) hitboxes.push(mesh.userData.hitbox);
  }
  const hits = raycaster.intersectObjects(hitboxes, false);
  const tracerEnd = hits[0]?.point || shotDirection.clone().multiplyScalar(local.weapon === "sniper" ? 58 : 38).add(camera.position);
  addTracer(getMuzzleWorldPosition(), tracerEnd);
  applyRecoilKick(config);

  send({
    type: "shoot",
    weapon: local.weapon,
    origin: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    dir: { x: shotDirection.x, y: shotDirection.y, z: shotDirection.z },
    targetId: hits[0]?.object.userData.playerId || null
  });
}

function applyMovementSpread(dir) {
  const config = weapons[local.weapon];
  const movingPenalty = isMoving() ? config.spread : 0;
  const jumpPenalty = grounded ? 0 : config.spread * 1.2;
  const spread = movingPenalty + jumpPenalty;
  if (!spread) return;
  dir.x += THREE.MathUtils.randFloatSpread(spread);
  dir.y += THREE.MathUtils.randFloatSpread(spread);
  dir.z += THREE.MathUtils.randFloatSpread(spread);
  dir.normalize();
}

function applyRecoilKick(config) {
  const [horizontal, vertical] = recoilPattern[Math.min(recoilIndex, recoilPattern.length - 1)];
  yaw -= horizontal * config.recoil;
  pitch = THREE.MathUtils.clamp(pitch + vertical * config.recoil, -1.35, 1.25);
  recoilIndex += 1;
}

function addTracer(start, end) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
  const line = new THREE.Line(geometry, materials.tracer.clone());
  line.userData.life = 0.08;
  tracers.push(line);
  scene.add(line);
}

function getMuzzleWorldPosition() {
  const z = local.weapon === "sniper" ? -1.55 : local.weapon === "pistol" ? -0.72 : -1.28;
  return weapon.localToWorld(new THREE.Vector3(0, 0.08, z));
}

function reload() {
  const config = weapons[local.weapon];
  if (reloading || local.ammo === config.ammo) return;
  firing = false;
  reloading = true;
  ammoEl.textContent = "...";
  window.setTimeout(() => {
    local.ammo = config.ammo;
    reloading = false;
    updateHud(lastServerPlayers);
  }, config.reloadMs);
}

function updateHud(players = []) {
  healthEl.textContent = Math.max(0, local.health);
  ammoEl.textContent = reloading ? "..." : local.ammo;
  killsEl.textContent = local.kills;
  deathsEl.textContent = local.deaths;
  playerCountEl.textContent = `${players.length || 1}/2`;

  const redScore = players.filter((player) => player.team === "red").reduce((sum, player) => sum + player.kills, 0);
  const blueScore = players.filter((player) => player.team === "blue").reduce((sum, player) => sum + player.kills, 0);
  redScoreEl.textContent = redScore;
  blueScoreEl.textContent = blueScore;

  scoreboardEl.innerHTML = players
    .slice()
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    .map((player) => `<div class="score-row ${player.team}"><span>${escapeHtml(player.name)} ${player.id === local.id ? "(你)" : ""}</span><b>${player.kills}/${player.deaths}</b></div>`)
    .join("");
}

function updateMovement(delta) {
  if (!joined || !local.alive) return;

  const walking = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const speed = walking ? 3.1 : 5.8;
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

  jumpVelocity -= 18 * delta;
  jumpY += jumpVelocity * delta;
  if (jumpY <= 0) {
    jumpY = 0;
    jumpVelocity = 0;
    grounded = true;
  }

  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -7.7, 7.7);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -17.6, 17.6);
  camera.position.y = 1.7 + jumpY + Math.sin(bobTime * 7) * 0.02 * direction.length();
}

function jump() {
  if (!joined || !local.alive || !grounded) return;
  grounded = false;
  jumpVelocity = 6.2;
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
  const radius = 0.42;
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
  if (now - lastNetSend < 66) return;
  lastNetSend = now;
  send({ type: "state", x: camera.position.x, z: camera.position.z, yaw, pitch });
}

function send(message) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function updateFiring() {
  if (firing && weapons[local.weapon].auto) shoot();
  if (!firing && performance.now() - lastManualShotTime > 260) {
    recoilIndex = Math.max(0, recoilIndex - 1);
  }
}

function updateRemotePlayers(delta) {
  for (const mesh of peers.values()) {
    if (!mesh.visible || !mesh.userData.targetPosition) continue;
    mesh.position.lerp(mesh.userData.targetPosition, Math.min(1, delta * 12));
  }
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
    tracer.material.opacity = Math.max(0, tracer.userData.life / 0.08);
    if (tracer.userData.life <= 0) {
      scene.remove(tracer);
      tracer.geometry.dispose();
      tracer.material.dispose();
      tracers.splice(i, 1);
    }
  }
}

function showHit(damage) {
  playHitSound();
  hitmarker.classList.add("show");
  showDamageText(`-${damage}`);
  window.setTimeout(() => hitmarker.classList.remove("show"), 90);
}

function showDamageText(text) {
  damageEl.textContent = text;
  damageEl.classList.add("show");
  window.setTimeout(() => damageEl.classList.remove("show"), 380);
}

function unlockAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
}

function playGunshot() {
  unlockAudio();
  const now = audioContext.currentTime;
  const noise = audioContext.createBufferSource();
  const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.11, audioContext.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
  const highpass = audioContext.createBiquadFilter();
  const noiseGain = audioContext.createGain();
  const osc = audioContext.createOscillator();
  const boomGain = audioContext.createGain();

  noise.buffer = buffer;
  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(local.weapon === "sniper" ? 620 : 850, now);
  noiseGain.gain.setValueAtTime(local.weapon === "pistol" ? 0.18 : 0.34, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  noise.connect(highpass).connect(noiseGain).connect(audioContext.destination);
  noise.start(now);
  noise.stop(now + 0.11);

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(local.weapon === "sniper" ? 82 : 115, now);
  osc.frequency.exponentialRampToValueAtTime(42, now + 0.1);
  boomGain.gain.setValueAtTime(local.weapon === "pistol" ? 0.16 : 0.28, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(boomGain).connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

function playFootstep(walking) {
  if (walking) return;
  unlockAudio();
  const now = audioContext.currentTime;
  if (now - lastStepTime < 0.33) return;
  lastStepTime = now;
  const noise = audioContext.createBufferSource();
  const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.08, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  noise.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(260, now);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  noise.connect(filter).connect(gain).connect(audioContext.destination);
  noise.start(now);
  noise.stop(now + 0.09);
}

function playHitSound() {
  unlockAudio();
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(780, now);
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.08);
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.11);
}

function applyCrosshairSettings() {
  const root = document.documentElement;
  root.style.setProperty("--crosshair-color", crosshairColorInput.value);
  root.style.setProperty("--crosshair-size", `${crosshairSizeInput.value}px`);
  document.body.dataset.crosshair = crosshairStyleInput.value;
}

function toggleSettings(open) {
  settingsPanel.classList.toggle("hidden", !open);
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
  updateFiring();
  updateMovement(delta);
  updateRemotePlayers(delta);
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
  if (event.code === "Space") {
    event.preventDefault();
    jump();
  }
  if (event.code === "KeyR") reload();
  if (event.code === "Escape") {
    firing = false;
    toggleSettings(false);
  }
});

window.addEventListener("keyup", (event) => keys.delete(event.code));

window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= event.movementX * 0.0021;
  pitch -= event.movementY * 0.0021;
  pitch = THREE.MathUtils.clamp(pitch, -1.35, 1.25);
});

window.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  firing = true;
  shoot();
});

window.addEventListener("mouseup", (event) => {
  if (event.button === 0) firing = false;
});

window.addEventListener("blur", () => {
  firing = false;
});

canvas.addEventListener("click", () => {
  if (joined && document.pointerLockElement !== canvas) canvas.requestPointerLock();
});

leaveButton.addEventListener("click", () => {
  leavingRoom = true;
  firing = false;
  if (ws) ws.close();
  joined = false;
  startPanel.classList.remove("hidden");
});

settingsButton.addEventListener("click", () => toggleSettings(true));
menuSettingsButton.addEventListener("click", () => toggleSettings(true));
closeSettings.addEventListener("click", () => toggleSettings(false));
crosshairStyleInput.addEventListener("change", applyCrosshairSettings);
crosshairColorInput.addEventListener("input", applyCrosshairSettings);
crosshairSizeInput.addEventListener("input", applyCrosshairSettings);
weaponSelect.addEventListener("change", () => {
  local.weapon = weaponSelect.value;
  local.ammo = weapons[local.weapon].ammo;
  reloading = false;
  firing = false;
  updateWeaponModel();
  updateHud(lastServerPlayers);
});
joinForm.addEventListener("submit", joinRoom);
roomInput.value = new URLSearchParams(location.search).get("room") || "";
