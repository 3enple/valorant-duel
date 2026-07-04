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
