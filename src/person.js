import * as THREE from 'three';

const std = (color, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });

// Arm poses: upper-arm pitch, inward roll, forearm pitch. Negative pitch raises the arm forward.
const POSES = {
  idle: { R: [0.05, -0.08, -0.2], L: [0.05, -0.08, -0.2] },
  phone: { R: [-0.4, 0.35, -1.3], L: [-0.25, 0.15, -0.9] },
  carry: { R: [-0.45, 0.12, -1.05], L: [-0.45, 0.12, -1.05] },
};

const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const dampAngle = (a, b, lambda, dt) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
};

// A stylized character built from primitives; faces +z in local space.
export class Person {
  constructor() {
    const g = (this.group = new THREE.Group());
    const m = {
      skin: std(0xc98f6b, 0.6),
      shirt: std(0xe07a5f, 0.85),
      pants: std(0x2f3a4a, 0.9),
      shoe: std(0xf2f2f2, 0.6),
      hair: std(0x2b1d16, 0.9),
      eye: std(0x1a1a1a, 0.3),
    };
    const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(geo, mat);
      o.position.set(x, y, z);
      o.castShadow = true;
      parent.add(o);
      return o;
    };

    const body = (this.body = new THREE.Group());
    g.add(body);

    mesh(new THREE.CapsuleGeometry(0.15, 0.06, 6, 16), m.pants, body, 0, 0.96).scale.set(1.05, 0.8, 0.75);

    this.legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.09, 0.93, 0);
      body.add(hip);
      mesh(new THREE.CapsuleGeometry(0.068, 0.66, 6, 12), m.pants, hip, 0, -0.43);
      mesh(new THREE.BoxGeometry(0.11, 0.07, 0.22), m.shoe, hip, 0, -0.885, 0.035);
      return hip;
    });

    mesh(new THREE.CapsuleGeometry(0.17, 0.36, 8, 16), m.shirt, body, 0, 1.3).scale.set(1.1, 1, 0.72);
    mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 12), m.skin, body, 0, 1.68);
    const head = (this.head = mesh(new THREE.SphereGeometry(0.12, 24, 18), m.skin, body, 0, 1.82));
    head.scale.set(0.95, 1.08, 1);
    const hair = mesh(new THREE.SphereGeometry(0.128, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), m.hair, body, 0, 1.83, -0.01);
    hair.rotation.x = -0.35;
    mesh(new THREE.SphereGeometry(0.06, 16, 12), m.hair, body, 0, 1.9, -0.11);
    for (const side of [-1, 1]) mesh(new THREE.SphereGeometry(0.013, 8, 8), m.eye, body, side * 0.042, 1.84, 0.108);

    this.arms = {};
    for (const [key, side] of [
      ['R', -1],
      ['L', 1],
    ]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.235, 1.56, 0);
      body.add(shoulder);
      mesh(new THREE.CapsuleGeometry(0.052, 0.2, 6, 12), m.shirt, shoulder, 0, -0.14);
      const elbow = new THREE.Group();
      elbow.position.y = -0.28;
      shoulder.add(elbow);
      mesh(new THREE.CapsuleGeometry(0.043, 0.2, 6, 12), m.skin, elbow, 0, -0.13);
      mesh(new THREE.SphereGeometry(0.05, 12, 10), m.skin, elbow, 0, -0.29);
      this.arms[key] = { shoulder, elbow, side, cur: [...POSES.idle[key]] };
    }

    // Phone held in the right hand (screen faces the person when raised).
    const phone = (this.phone = new THREE.Group());
    phone.position.set(0.02, -0.31, 0.01);
    phone.rotation.x = 0.25;
    this.arms.R.elbow.add(phone);
    mesh(new THREE.BoxGeometry(0.075, 0.01, 0.15), std(0x15171a, 0.3), phone);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.138), new THREE.MeshBasicMaterial({ color: 0xffb27a, toneMapped: false }));
    screen.rotation.x = -Math.PI / 2;
    screen.position.y = 0.0055;
    phone.add(screen);

    this.trayAnchor = new THREE.Object3D();
    this.trayAnchor.position.set(0, 1.21, 0.46);
    g.add(this.trayAnchor);

    this.speed = 1.35;
    this.walk = 0;
    this.phase = 0;
    this.arrived = true;
  }

  update(dt, target, face, pose) {
    const pos = this.group.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const moving = dist > 0.04;
    let yaw;
    if (moving) {
      const step = Math.min(dist, this.speed * dt);
      pos.x += (dx / dist) * step;
      pos.z += (dz / dist) * step;
      yaw = Math.atan2(dx, dz);
    } else {
      yaw = Math.atan2(face.x - pos.x, face.z - pos.z);
    }
    this.group.rotation.y = dampAngle(this.group.rotation.y, yaw, moving ? 10 : 5, dt);
    this.arrived = !moving;

    this.walk = damp(this.walk, moving ? 1 : 0, 8, dt);
    this.phase += dt * 9.5 * this.walk;
    const swing = Math.sin(this.phase) * this.walk;
    this.legs[0].rotation.x = swing * 0.5;
    this.legs[1].rotation.x = -swing * 0.5;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.022 * this.walk;

    const p = POSES[pose] || POSES.idle;
    for (const key of ['R', 'L']) {
      const arm = this.arms[key];
      const t = p[key];
      const armSwing = pose === 'idle' ? (key === 'R' ? swing : -swing) * 0.4 : 0;
      arm.cur[0] = damp(arm.cur[0], t[0] + armSwing, 7, dt);
      arm.cur[1] = damp(arm.cur[1], t[1], 7, dt);
      arm.cur[2] = damp(arm.cur[2], t[2], 7, dt);
      arm.shoulder.rotation.x = arm.cur[0];
      arm.shoulder.rotation.z = -arm.side * arm.cur[1];
      arm.elbow.rotation.x = arm.cur[2];
    }
    this.phone.visible = pose === 'phone';
  }

  headWorld(out) {
    return this.head.getWorldPosition(out);
  }
}
