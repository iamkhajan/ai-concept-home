import * as THREE from 'three';
import { MAT } from './kitchen.js';

// Oven tower geometry, all in world space.
const X = 2.6;
const FRONT = -2.38;
export const OVEN = {
  x: X,
  front: FRONT,
  displayPos: new THREE.Vector3(X, 1.57, FRONT + 0.03),
  rackPos: new THREE.Vector3(X, 1.0, -2.64),
  insertStart: new THREE.Vector3(X, 1.03, -1.98),
  steamOrigin: new THREE.Vector3(X, 1.45, -2.2),
};

const fmtTimer = (s) => {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export class Oven {
  constructor(scene) {
    const g = (this.group = new THREE.Group());
    scene.add(g);
    const add = (geo, mat, x, y, z, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };

    // Tower cabinet, built around the oven opening so the cavity is visible.
    add(new THREE.BoxGeometry(0.84, 0.88, 0.62), MAT.cabinet, X, 0.44, -2.69);
    add(new THREE.BoxGeometry(0.84, 0.66, 0.62), MAT.cabinet, X, 1.97, -2.69);
    add(new THREE.BoxGeometry(0.04, 0.76, 0.62), MAT.cabinet, X - 0.4, 1.26, -2.69);
    add(new THREE.BoxGeometry(0.04, 0.76, 0.62), MAT.cabinet, X + 0.4, 1.26, -2.69);
    // cabinet doors above / below
    add(new THREE.BoxGeometry(0.8, 0.6, 0.02), MAT.cabinet, X, 1.97, FRONT + 0.01);
    add(new THREE.BoxGeometry(0.8, 0.74, 0.02), MAT.cabinet, X, 0.5, FRONT + 0.01);
    add(new THREE.BoxGeometry(0.3, 0.012, 0.02), MAT.brass, X, 2.2, FRONT + 0.03);
    add(new THREE.BoxGeometry(0.3, 0.012, 0.02), MAT.brass, X, 0.8, FRONT + 0.03);

    // Control strip + display
    add(new THREE.BoxGeometry(0.76, 0.12, 0.03), MAT.blackGlass, X, 1.57, FRONT + 0.005);
    const dc = (this.displayCanvas = document.createElement('canvas'));
    dc.width = 512;
    dc.height = 128;
    this.displayCtx = dc.getContext('2d');
    this.displayTex = new THREE.CanvasTexture(dc);
    this.displayTex.colorSpace = THREE.SRGBColorSpace;
    this.display = add(
      new THREE.PlaneGeometry(0.34, 0.085),
      new THREE.MeshBasicMaterial({ map: this.displayTex, toneMapped: false }),
      X,
      1.57,
      FRONT + 0.021,
      false,
    );
    // touch keys either side of the display
    this.keyMat = new THREE.MeshBasicMaterial({ color: 0x33424a, toneMapped: false });
    for (const dx of [-0.3, -0.25, 0.25, 0.3]) {
      const key = add(new THREE.CircleGeometry(0.011, 20), this.keyMat, X + dx, 1.57, FRONT + 0.021, false);
      key.receiveShadow = false;
    }

    // Cavity: an inside-out box, open where the door covers it.
    this.cavityMat = new THREE.MeshStandardMaterial({
      color: 0x24252b,
      roughness: 0.55,
      side: THREE.BackSide,
      emissive: 0xff5a1a,
      emissiveIntensity: 0,
    });
    const cavity = add(new THREE.BoxGeometry(0.72, 0.58, 0.52), this.cavityMat, X, 1.2, FRONT - 0.27, false);
    cavity.receiveShadow = false;

    // Rack wires
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.3 });
    for (let i = 0; i < 7; i++) {
      const w = add(new THREE.CylinderGeometry(0.004, 0.004, 0.68, 6), wireMat, X, 0.995, -2.86 + i * 0.07, false);
      w.rotation.z = Math.PI / 2;
    }

    // Top heating element
    this.elementMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xff3300, emissiveIntensity: 0 });
    const element = add(new THREE.TorusGeometry(0.2, 0.007, 8, 48), this.elementMat, X, 1.46, -2.64, false);
    element.rotation.x = Math.PI / 2;
    element.scale.set(1.4, 1, 1);
    // Convection fan on the back wall
    const fan = add(new THREE.CircleGeometry(0.09, 32), new THREE.MeshStandardMaterial({ color: 0x4a4c52, metalness: 0.6, roughness: 0.4 }), X, 1.2, -2.905, false);
    this.fan = fan;

    this.light = new THREE.PointLight(0xffb070, 0, 1.8, 1.5);
    this.light.position.set(X, 1.38, -2.55);
    g.add(this.light);

    // Door: pivots on its bottom edge and drops open toward the room.
    const door = (this.door = new THREE.Group());
    door.position.set(X, 0.89, FRONT + 0.015);
    g.add(door);
    const doorPart = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), MAT.blackGlass);
      m.position.set(x, y, 0);
      m.castShadow = true;
      door.add(m);
    };
    doorPart(0.76, 0.1, 0, 0.05);
    doorPart(0.76, 0.13, 0, 0.545);
    doorPart(0.1, 0.38, -0.33, 0.29);
    doorPart(0.1, 0.38, 0.33, 0.29);
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.38),
      new THREE.MeshStandardMaterial({
        color: 0x1a1410,
        transparent: true,
        opacity: 0.38,
        roughness: 0.05,
        metalness: 0.3,
        depthWrite: false,
      }),
    );
    glass.position.set(0, 0.29, 0.005);
    door.add(glass);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 16), MAT.steel);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 0.54, 0.065);
    handle.castShadow = true;
    door.add(handle);
    for (const dx of [-0.26, 0.26]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 8), MAT.steel);
      post.rotation.x = Math.PI / 2;
      post.position.set(dx, 0.54, 0.04);
      door.add(post);
    }

    this.doorAngle = 0;
    this.heat = 0;
    this.lastDisplayKey = '';
  }

  update(dt, s, time) {
    // door
    const targetAngle = s.door * 1.5;
    this.doorAngle += (targetAngle - this.doorAngle) * (1 - Math.exp(-dt * 4));
    this.door.rotation.x = this.doorAngle;

    // heat glow follows cavity temperature
    const heatTarget = THREE.MathUtils.clamp((s.temp - 30) / 170, 0, 1) * (s.heating ? 1 : 0.35);
    this.heat += (heatTarget - this.heat) * (1 - Math.exp(-dt * 2));
    const flicker = 1 + Math.sin(time * 9) * 0.04;
    this.elementMat.emissiveIntensity = this.heat * 2.2 * flicker * (s.heating ? 1 : 0.2);
    this.cavityMat.emissiveIntensity = this.heat * 0.12;
    this.light.intensity = (s.ovenLight ? 0.9 : 0) + this.heat * 1.1;
    this.light.color.setHSL(0.07, 1, 0.55 + (1 - this.heat) * 0.2);
    if (s.heating) this.fan.rotation.z -= dt * 12;

    this.keyMat.color.set(s.display.mode === 'off' ? 0x33424a : 0x46d3f0);
    this.drawDisplay(s.display, s.clock, time);
  }

  drawDisplay(d, clockMin, time) {
    const blink = d.mode === 'done' && Math.floor(time * 2.5) % 2 === 0;
    const key = `${d.mode}|${Math.round(d.temp)}|${Math.ceil(d.timer)}|${clockMin | 0}|${blink}`;
    if (key === this.lastDisplayKey) return;
    this.lastDisplayKey = key;

    const g = this.displayCtx;
    const W = 512,
      H = 128;
    g.fillStyle = '#040507';
    g.fillRect(0, 0, W, H);
    g.textBaseline = 'middle';
    const amber = '#ffb347',
      cyan = '#5fe3ff',
      green = '#6dff9e';

    const small = (txt, x, y, col, align = 'left') => {
      g.font = '600 26px Inter, system-ui, sans-serif';
      g.fillStyle = col;
      g.textAlign = align;
      g.fillText(txt, x, y);
    };
    const big = (txt, x, y, col, align = 'left', size = 66) => {
      g.font = `700 ${size}px Inter, system-ui, sans-serif`;
      g.fillStyle = col;
      g.textAlign = align;
      g.fillText(txt, x, y);
    };

    if (d.mode !== 'off') {
      // wifi glyph = connected
      g.strokeStyle = cyan;
      g.lineWidth = 4;
      for (let i = 1; i <= 3; i++) {
        g.beginPath();
        g.arc(476, 40, i * 9, Math.PI * 1.25, Math.PI * 1.75);
        g.stroke();
      }
    }

    switch (d.mode) {
      case 'off': {
        const h = Math.floor(clockMin / 60) % 12 || 12;
        const m = String(Math.floor(clockMin % 60)).padStart(2, '0');
        big(`${h}:${m}`, W / 2, H / 2, '#5a6a72', 'center', 58);
        break;
      }
      case 'loaded':
        small('RECIPE RECEIVED', 24, 32, cyan);
        big('CONV BAKE', 24, 84, '#ffffff', 'left', 48);
        small('135°C · 45:00', 330, 84, amber);
        break;
      case 'preheat': {
        small('PREHEATING', 24, 30, amber);
        big(`${Math.round(d.temp)}°`, 24, 82, '#ffffff');
        small(`→ 135°C`, 200, 86, amber);
        const p = THREE.MathUtils.clamp((d.temp - 22) / 113, 0, 1);
        g.fillStyle = '#222';
        g.fillRect(24, 112, 464, 8);
        g.fillStyle = amber;
        g.fillRect(24, 112, 464 * p, 8);
        break;
      }
      case 'preheated':
        small('READY · INSERT FOOD', 24, 30, green);
        big('135°C', 24, 84, '#ffffff');
        small('CONV BAKE', 250, 88, amber);
        break;
      case 'cook':
        small('CONV BAKE · 135°C', 24, 30, amber);
        big(fmtTimer(d.timer), 24, 84, '#ffffff');
        small('remaining', 250, 90, '#8a9aa2');
        break;
      case 'done':
        if (blink) big('DONE', W / 2, 60, green, 'center', 72);
        small('Enjoy your meal', W / 2, 108, '#8a9aa2', 'center');
        break;
      case 'warm':
        small('RESTING · OVEN OFF', 24, 30, green);
        big('54°C', 24, 84, '#ffffff');
        small('medium rare', 220, 88, '#8a9aa2');
        break;
    }
    this.displayTex.needsUpdate = true;
  }
}

// Roasting tray with two ribeyes + vegetables; sear colour follows doneness.
export function buildTray() {
  const tray = new THREE.Group();
  const pan = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.6, roughness: 0.4 }));
  pan.position.y = 0.018;
  pan.castShadow = true;
  tray.add(pan);

  const steakMat = new THREE.MeshStandardMaterial({ color: 0xb8443c, roughness: 0.55 });
  const fatMat = new THREE.MeshStandardMaterial({ color: 0xf2dcc8, roughness: 0.6 });
  for (const side of [-1, 1]) {
    const steak = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.028, 28), steakMat);
    steak.scale.set(1.25, 1, 0.85);
    steak.position.set(side * 0.06, 0.05, side * -0.015);
    steak.rotation.y = side * 0.35;
    steak.castShadow = true;
    tray.add(steak);
    const fat = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.026, 12), fatMat);
    fat.position.set(0.05, 0, 0.02);
    steak.add(fat);
  }
  const vegCols = [0xf08a24, 0xe6c35c, 0x6fa84a, 0xb33f3a];
  for (let i = 0; i < 12; i++) {
    const v = new THREE.Mesh(new THREE.SphereGeometry(0.022 + (i % 3) * 0.004, 10, 8), new THREE.MeshStandardMaterial({ color: vegCols[i % 4], roughness: 0.6 }));
    const a = (i / 12) * Math.PI * 2;
    v.position.set(Math.cos(a) * 0.17, 0.05, Math.sin(a) * 0.11);
    v.scale.set(1, 0.8, 1.3);
    tray.add(v);
  }
  const raw = new THREE.Color(0xb8443c);
  const done = new THREE.Color(0x6e3520);
  tray.userData.setDoneness = (t) => {
    steakMat.color.copy(raw).lerp(done, t);
    steakMat.roughness = 0.55 - t * 0.25;
  };
  return tray;
}
