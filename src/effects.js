import * as THREE from 'three';

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Wi-Fi "data packets" travelling along an arc, arrival ripples, and oven steam.
export class Effects {
  constructor(scene, camera) {
    this.camera = camera;
    this.bursts = [];
    const dot = softDot();

    this.particles = [];
    for (let i = 0; i < 90; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0x5fe3ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
      s.visible = false;
      scene.add(s);
      this.particles.push(s);
    }

    this.rings = [];
    for (let i = 0; i < 8; i++) {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(0.05, 0.062, 48),
        new THREE.MeshBasicMaterial({ color: 0x5fe3ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      );
      r.visible = false;
      r.userData.life = 0;
      scene.add(r);
      this.rings.push(r);
    }

    this.steam = [];
    for (let i = 0; i < 36; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 }));
      s.userData.life = Math.random();
      s.visible = false;
      scene.add(s);
      this.steam.push(s);
    }

    this.curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
    this.tmp = new THREE.Vector3();
  }

  signal(from, to, color = 0x5fe3ff) {
    const mid = from.clone().lerp(to, 0.5);
    mid.y += 0.6 + from.distanceTo(to) * 0.2;
    this.bursts.push({ from: from.clone(), mid, to: to.clone(), t: 0, dur: 1.1, count: 14, color: new THREE.Color(color), rang: false });
  }

  ripple(pos, color) {
    const r = this.rings.find((x) => x.userData.life <= 0);
    if (!r) return;
    r.position.copy(pos);
    r.material.color.copy(color);
    r.userData.life = 1;
    r.visible = true;
  }

  update(dt, steamOn, steamOrigin) {
    // packets
    let pi = 0;
    for (const b of this.bursts) {
      b.t += dt;
      this.curve.v0.copy(b.from);
      this.curve.v1.copy(b.mid);
      this.curve.v2.copy(b.to);
      for (let i = 0; i < b.count && pi < this.particles.length; i++) {
        const p = (b.t - i * 0.05) / b.dur;
        if (p < 0 || p > 1) continue;
        const s = this.particles[pi++];
        this.curve.getPoint(p, s.position);
        const size = (i === 0 ? 0.09 : 0.06) * Math.sin(p * Math.PI) + 0.02;
        s.scale.setScalar(size);
        s.material.color.copy(b.color);
        s.material.opacity = 1 - i / b.count;
        s.visible = true;
      }
      if (!b.rang && b.t >= b.dur) {
        b.rang = true;
        this.ripple(b.to, b.color);
      }
    }
    for (; pi < this.particles.length; pi++) this.particles[pi].visible = false;
    this.bursts = this.bursts.filter((b) => b.t < b.dur + b.count * 0.05);

    // arrival ripples
    for (const r of this.rings) {
      if (r.userData.life <= 0) continue;
      r.userData.life -= dt * 1.2;
      const k = 1 - r.userData.life;
      r.scale.setScalar(1 + k * 3);
      r.material.opacity = Math.max(0, r.userData.life);
      r.lookAt(this.camera.position);
      if (r.userData.life <= 0) r.visible = false;
    }

    // steam
    for (const s of this.steam) {
      const d = s.userData;
      d.life += dt * 0.45;
      if (d.life >= 1) {
        d.life = 0;
        d.active = steamOn;
        s.position.set(steamOrigin.x + (Math.random() - 0.5) * 0.5, steamOrigin.y, steamOrigin.z + Math.random() * 0.3);
        d.vx = (Math.random() - 0.5) * 0.08;
      }
      s.visible = !!d.active;
      if (!d.active) continue;
      s.position.y += dt * 0.3;
      s.position.x += d.vx * dt;
      s.position.z += dt * 0.08;
      s.scale.setScalar(0.12 + d.life * 0.4);
      s.material.opacity = Math.sin(d.life * Math.PI) * 0.22;
    }
  }
}
