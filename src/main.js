// Bootstrap: renderer, camera orbit, game loop, input, HUD, multiplayer wiring.
import * as THREE from 'three';
import { buildWorld, updateRotors } from './world.js';
import { Player } from './player.js';
import { loadProtos, createRig, updateRig, makeNametag } from './rig.js';
import { GameAudio } from './audio.js';
import { Net } from './net.js';

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9aa3ad);
scene.fog = new THREE.Fog(0x9aa3ad, 60, 220);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(40, 70, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 220;
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.75));

const world = buildWorld(scene);
const audio = new GameAudio();
const net = new Net();

const input = { x: 0, z: 0, space: false };
const keys = {};
let camYaw = 0.0, camPitch = 0.42, camDist = 9;

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyR' && player) { player.crash(); }
  if (e.code === 'KeyM') { const on = audio.toggleMusic(); toast(on ? 'music on' : 'music off'); }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

let dragging = false, lastMX = 0, lastMY = 0;
renderer.domElement.addEventListener('mousedown', (e) => { dragging = true; lastMX = e.clientX; lastMY = e.clientY; });
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (!dragging && !locked) return;
  const dx = locked ? e.movementX : e.clientX - lastMX;
  const dy = locked ? e.movementY : e.clientY - lastMY;
  lastMX = e.clientX; lastMY = e.clientY;
  camYaw -= dx * 0.004;
  camPitch = Math.max(-0.2, Math.min(1.2, camPitch + dy * 0.004));
});
window.addEventListener('wheel', (e) => { camDist = Math.max(5, Math.min(16, camDist + e.deltaY * 0.01)); });

let player = null, playerRig = null;
const remoteRigs = new Map();
const playersEl = document.getElementById('players');
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.opacity = 0; }, 2200);
}

function updatePlayerCount() {
  playersEl.textContent = `players: ${1 + net.remotes.size}`;
}

net.on('join', (r) => {
  const rig = createRig(scene);
  rig.tag = makeNametag(r.name);
  rig.group.add(rig.tag);
  remoteRigs.set(r.pid, rig);
  updatePlayerCount();
  toast(`${r.name} joined`);
});
net.on('leave', (r) => {
  const rig = remoteRigs.get(r.pid);
  if (rig) {
    scene.remove(rig.group);
    scene.remove(rig.shadow);
    remoteRigs.delete(r.pid);
  }
  updatePlayerCount();
  toast(`${r.name} left`);
});

const skyCur = new THREE.Color();
const fogCur = new THREE.Color();
function blendSky(pos) {
  let wsum = 0;
  skyCur.setRGB(0, 0, 0);
  fogCur.setRGB(0, 0, 0);
  for (const z of world.zones) {
    const d = Math.hypot(pos.x - z.center.x, pos.z - z.center.z);
    const w = 1 / Math.max(400, d * d);
    wsum += w;
    skyCur.r += z.sky.r * w; skyCur.g += z.sky.g * w; skyCur.b += z.sky.b * w;
    fogCur.r += z.fog.r * w; fogCur.g += z.fog.g * w; fogCur.b += z.fog.b * w;
  }
  skyCur.multiplyScalar(1 / wsum);
  fogCur.multiplyScalar(1 / wsum);
  scene.background.lerp(skyCur, 0.04);
  scene.fog.color.lerp(fogCur, 0.04);
}

function groundYUnder(pos) {
  let best = 0;
  for (const c of world.colliders) {
    if (c.type === 'box') {
      if (pos.x >= c.min.x && pos.x <= c.max.x && pos.z >= c.min.z && pos.z <= c.max.z && c.max.y <= pos.y + 0.1 && c.max.y > best) best = c.max.y;
    } else {
      if (Math.hypot(pos.x - c.cx, pos.z - c.cz) <= c.r && c.top <= pos.y + 0.1 && c.top > best) best = c.top;
    }
  }
  return best;
}

const clock = new THREE.Clock();
let lastFrame = performance.now();
setInterval(() => {
  if (performance.now() - lastFrame > 50) loop(true);
}, 33);
function loop(forced) {
  if (!forced) requestAnimationFrame(() => loop(false));
  lastFrame = performance.now();
  const dt = Math.min(0.05, clock.getDelta());

  updateRotors(world.rotors, dt);

  if (player && playerRig) {
    input.x = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    input.z = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
    input.space = !!keys.Space;
    player.update(dt, input, camYaw);

    const gy = groundYUnder(player.pos);
    updateRig(playerRig, player.pos, player.yaw, player.vel, player.spring, player.ragdoll, player.ragSpin, dt, gy);

    const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.6, player.pos.z);
    const off = new THREE.Vector3(
      Math.sin(camYaw) * Math.cos(camPitch),
      Math.sin(camPitch),
      Math.cos(camYaw) * Math.cos(camPitch)
    ).multiplyScalar(camDist);
    camera.position.copy(target).add(off);
    camera.lookAt(target);

    sun.position.set(player.pos.x + 40, 70, player.pos.z + 30);
    sun.target.position.copy(player.pos);
    sun.target.updateMatrixWorld();

    blendSky(player.pos);
    const speed = Math.hypot(player.vel.x, player.vel.z, player.vel.y);
    audio.setWind(Math.max(0, (speed - 8) / 14));
    net.publish(player);
  }

  net.tick(dt);
  for (const [pid, r] of net.remotes) {
    const rig = remoteRigs.get(pid);
    if (!rig) continue;
    const p = new THREE.Vector3(r.cur.x, r.cur.y, r.cur.z);
    updateRig(rig, p, r.cur.yaw, { x: 0, z: 0 }, r.spring, r.rag, null, dt, groundYUnder(p));
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('beforeunload', () => net.disconnect());

const overlay = document.getElementById('nameOverlay');
const nameInput = document.getElementById('nameInput');
nameInput.value = localStorage.getItem('pw_name') || '';

async function start() {
  const name = (nameInput.value.trim() || 'skeleton').slice(0, 14);
  localStorage.setItem('pw_name', name);
  overlay.style.display = 'none';
  audio.init();
  await loadProtos();
  player = new Player(world, audio);
  playerRig = createRig(scene);
  window.__dbg = { player, playerRig, camera, scene, audio, net };
  renderer.domElement.requestPointerLock?.();
  net.connect(name).then(updatePlayerCount).catch((e) => {
    console.warn('multiplayer offline', e);
    toast('offline mode (no multiplayer)');
  });
}

document.getElementById('playBtn').addEventListener('click', start);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
renderer.domElement.addEventListener('click', () => {
  if (player) renderer.domElement.requestPointerLock?.();
});

loop();
