import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildKitchen } from './kitchen.js';
import { Oven, OVEN, buildTray } from './oven.js';
import { Person } from './person.js';
import { Effects } from './effects.js';
import { Story, STEPS, SPOTS } from './story.js';
import { PhoneUI } from './phone.js';
import { APP_URL } from './config.js';

// ---------- renderer / scene ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe7ded1);
scene.fog = new THREE.Fog(0xe7ded1, 12, 22);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 60);

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0xfff4e6, 0x6b5a4a, 0.9));
const sun = new THREE.DirectionalLight(0xffc98f, 2.4);
sun.position.set(-7, 4.5, 1.5);
sun.target.position.set(0, 0.5, -1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -6;
sun.shadow.camera.right = 6;
sun.shadow.camera.top = 5;
sun.shadow.camera.bottom = -3;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.6);
fill.position.set(5, 5, 6);
scene.add(fill);

// ---------- world ----------
const kitchen = buildKitchen(scene);
const oven = new Oven(scene);
const person = new Person();
person.group.position.copy(SPOTS.island.pos);
scene.add(person.group);
const tray = buildTray();
scene.add(tray);
const effects = new Effects(scene, camera);

const TRAY_SPOTS = {
  counter: new THREE.Vector3(1.35, 0.92, -2.65),
  oven: OVEN.rackPos,
  island: new THREE.Vector3(0.35, 0.93, -0.12),
};
tray.position.copy(TRAY_SPOTS.counter);

// ---------- story wiring ----------
const tmp = new THREE.Vector3();
const endpoints = {
  phone: () => (person.phone.visible ? person.phone.getWorldPosition(new THREE.Vector3()) : person.headWorld(new THREE.Vector3())),
  oven: () => OVEN.displayPos.clone(),
  speaker: () => kitchen.speaker.localToWorld(new THREE.Vector3(0, 0.18, 0)),
};
const story = new Story({
  signal: (from, to, color) => effects.signal(endpoints[from](), endpoints[to](), color),
});

const phoneUI = new PhoneUI(document.getElementById('phone'));
const clockEl = document.getElementById('clock');
const clockChip = document.getElementById('clock-chip');
const bubbleUser = document.getElementById('bubble-user');
const bubbleSpeaker = document.getElementById('bubble-speaker');

// ---------- scroll-driven steps ----------
const sections = [...document.querySelectorAll('.step')];
const dotsEl = document.getElementById('dots');
const dots = sections.map((sec, i) => {
  const b = document.createElement('button');
  b.setAttribute('aria-label', `Step ${i}`);
  b.addEventListener('click', () => sec.scrollIntoView({ behavior: 'smooth' }));
  dotsEl.appendChild(b);
  return b;
});

function activate(i) {
  story.setStep(i);
  sections.forEach((s, j) => s.classList.toggle('active', j === i));
  dots.forEach((d, j) => d.classList.toggle('active', j === i));
}
const observer = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) activate(Number(e.target.dataset.step));
  },
  { rootMargin: '-45% 0px -45% 0px' },
);
sections.forEach((s) => observer.observe(s));
activate(0);

document.querySelectorAll('[data-app-link]').forEach((a) => (a.href = APP_URL));
document.getElementById('replay').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
window.addEventListener('keydown', (e) => {
  if (e.key === 'r') story.restart();
});

// ---------- camera ----------
const camPos = STEPS[0].cam[0].clone();
const camTarget = STEPS[0].cam[1].clone();
const pointer = new THREE.Vector2();
window.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
});

function updateCamera(dt) {
  const [pos, target] = STEPS[story.index].cam;
  const k = 1 - Math.exp(-dt * 1.8);
  // pull back on portrait screens so the subject still fits
  const portrait = camera.aspect < 1 ? 1.55 : 1;
  tmp.copy(pos).sub(target).multiplyScalar(portrait).add(target);
  camPos.lerp(tmp, k);
  camTarget.lerp(target, k);
  camera.position.copy(camPos);
  camera.position.x += pointer.x * 0.15;
  camera.position.y -= pointer.y * 0.08;
  camera.lookAt(camTarget);
}

// ---------- speech bubbles ----------
function placeBubble(el, text, world) {
  if (text) {
    if (el.textContent !== text) el.textContent = text;
    world.project(camera);
    el.style.left = `${(world.x * 0.5 + 0.5) * window.innerWidth}px`;
    el.style.top = `${(-world.y * 0.5 + 0.5) * window.innerHeight}px`;
  }
  el.classList.toggle('show', !!text && world.z < 1);
}

const fmtClock = (min) => {
  const h24 = Math.floor(min / 60);
  const h = h24 % 12 || 12;
  return `${h}:${String(Math.floor(min % 60)).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`;
};

// ---------- loop ----------
const clock = new THREE.Clock();
let doneness = 0;
let firstFrame = true;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  const s = story.update(dt, { personArrived: person.arrived });

  person.update(dt, s.spot.pos, s.spot.face, s.pose);
  oven.update(dt, s, time);

  // tray placement
  let trayTarget;
  if (s.tray === 'hands') trayTarget = person.trayAnchor.getWorldPosition(tmp);
  else if (s.tray === 'insert') trayTarget = tmp.copy(OVEN.insertStart).lerp(OVEN.rackPos, s.trayInsert);
  else trayTarget = TRAY_SPOTS[s.tray];
  if (tray.position.distanceTo(trayTarget) > 1.8 && s.tray !== 'hands') tray.position.copy(trayTarget);
  else tray.position.lerp(trayTarget, 1 - Math.exp(-dt * (s.tray === 'hands' ? 20 : 10)));
  tray.rotation.y = s.tray === 'hands' ? person.group.rotation.y : 0;
  doneness += (s.doneness - doneness) * (1 - Math.exp(-dt * 1.5));
  tray.userData.setDoneness(doneness);

  // smart speaker ring pulses while talking
  kitchen.speakerRing.emissiveIntensity = s.speakerSay ? 1.6 + Math.sin(time * 12) * 0.9 : 0.3;

  effects.update(dt, s.steam, OVEN.steamOrigin);
  updateCamera(dt);

  placeBubble(bubbleUser, s.userSay, person.headWorld(new THREE.Vector3()).add(new THREE.Vector3(0, 0.22, 0)));
  placeBubble(bubbleSpeaker, s.speakerSay, endpoints.speaker().add(new THREE.Vector3(0, 0.12, 0)));

  phoneUI.update(s.phone, s.phoneVisible, s.clock);
  const clockText = fmtClock(s.clock);
  if (clockEl.textContent !== clockText) clockEl.textContent = clockText;
  clockChip.classList.toggle('lapsing', s.timelapse);

  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    document.getElementById('loader').classList.add('hidden');
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
camera.aspect = window.innerWidth / window.innerHeight;
camera.updateProjectionMatrix();
