
const deathsEl = document.querySelector("#deaths");
const healthEl = document.querySelector("#health");
const ammoEl = document.querySelector("#ammo");
const redScoreEl = document.querySelector("#redScore");
const blueScoreEl = document.querySelector("#blueScore");
const scoreboardEl = document.querySelector("#scoreboard");
const startPanel = document.querySelector("#start");
const joinForm = document.querySelector("#joinForm");
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(76, 0.25, 70), materials.floor);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(42, 0.25, 46), materials.floor);
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
  addGround("Red Spawn", -8, 16, 16, 7);
  addGround("Blue Spawn", 8, -16, 16, 7);
  addGround("Main Lane", 0, 0, 10, 33);
  addGround("Left Lane", -13, 0, 7, 28);
  addGround("Right Lane", 13, 0, 7, 28);
  addGround("Mid Box", 0, 0, 20, 11);

  [
    [-38, 0, 2, 70], [38, 0, 2, 70], [0, 36, 76, 2], [0, -44, 76, 2],
    [-30, 4, 2, 40], [-16, -4, 2, 34], [-24, -26, 20, 2], [-8, -28, 2, 26],
    [30, 3, 2, 42], [16, -4, 2, 34], [24, -25, 20, 2], [8, -28, 2, 26],
    [-8, 15, 14, 2], [8, 15, 14, 2], [-7, -8, 2, 18], [7, -8, 2, 18],
    [-24, 18, 12, 2], [24, 18, 12, 2], [-30, -14, 10, 2], [30, -14, 10, 2],
    [-14, 28, 2, 12], [14, 28, 2, 12], [0, -22, 10, 2]
    [-21, 0, 2, 46], [21, 0, 2, 46], [0, 23, 42, 2], [0, -23, 42, 2],
    [-4, 15, 2, 8], [4, -15, 2, 8],
    [-13, 10, 8, 2], [13, -10, 8, 2],
    [-13, -10, 8, 2], [13, 10, 8, 2],
    [-7, 0, 2, 12], [7, 0, 2, 12],
    [0, 6, 7, 2], [0, -6, 7, 2],
    [-17, 0, 2, 12], [17, 0, 2, 12]
  ].forEach(([x, z, w, d], index) => addWall(x, z, w, d, index % 3 === 0 ? materials.wallDark : materials.wall));

  [
    [-24, -31, 4, 3], [-18, -35, 5, 2], [24, -31, 4, 3], [18, -35, 5, 2],
    [0, -4, 5, 2], [-23, 5, 3, 3], [23, 5, 3, 3]
    [-8, 13, 5, 2], [8, -13, 5, 2],
    [-2.8, 0, 2.4, 3], [2.8, 0, 2.4, 3],
    [0, 0, 2.2, 5],
    [-13, 4, 3, 3], [13, -4, 3, 3]
  ].forEach(([x, z, w, d]) => addWall(x, z, w, d, materials.trim, 1.4));
}

  group.position.set(0.47, -0.38, -0.78);
  group.rotation.set(-0.04, -0.14, 0.02);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.85), materials.gun);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.13, 0.62), materials.gunLight);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 18), materials.gunLight);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.52, 0.25), materials.gun);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.92), materials.gun);
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.62), materials.gunLight);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 18), materials.gunLight);
  const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.16, 18), materials.gun);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.52), materials.gun);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.52, 0.3), materials.gun);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), materials.gun);
  const sightRear = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.08), materials.gun);
  const sightFront = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.04), materials.gun);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.36), materials.hand);
  const muzzle = new THREE.PointLight(0xffd18a, 0, 3);

  slide.position.set(0, 0.12, -0.07);
  receiver.position.set(0, 0.12, -0.08);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.1, -0.62);
  grip.position.set(0.04, -0.32, 0.18);
  barrel.position.set(0, 0.1, -0.78);
  muzzleBrake.rotation.x = Math.PI / 2;
  muzzleBrake.position.set(0, 0.1, -1.18);
  stock.position.set(0, 0.01, 0.58);
  stock.rotation.x = -0.15;
  mag.position.set(0.02, -0.34, -0.13);
  mag.rotation.x = 0.18;
  grip.position.set(0.04, -0.32, 0.22);
  grip.rotation.x = -0.34;
  sightRear.position.set(0, 0.24, 0.12);
  sightFront.position.set(0, 0.25, -0.72);
  hand.position.set(0.08, -0.45, 0.06);
  hand.rotation.x = -0.24;
  muzzle.position.set(0, 0.08, -0.95);
  muzzle.position.set(0, 0.08, -1.28);

  group.add(body, slide, barrel, grip, hand, muzzle);
  group.add(body, receiver, barrel, muzzleBrake, stock, mag, grip, sightRear, sightFront, hand, muzzle);
  group.userData.muzzle = muzzle;
