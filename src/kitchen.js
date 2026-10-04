import * as THREE from 'three';

// Shared materials so the oven module can match the cabinetry.
export const MAT = {
  wall: new THREE.MeshStandardMaterial({ color: 0xf0e9df, roughness: 0.95 }),
  cabinet: new THREE.MeshStandardMaterial({ color: 0x6f8c7a, roughness: 0.6 }),
  cabinetDark: new THREE.MeshStandardMaterial({ color: 0x2f3d4a, roughness: 0.55 }),
  counter: new THREE.MeshStandardMaterial({ color: 0xf5f2ec, roughness: 0.25 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 0.85, roughness: 0.28 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a25c, metalness: 0.9, roughness: 0.3 }),
  blackGlass: new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: 0.2, roughness: 0.08 }),
  toeKick: new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.9 }),
};

function canvasTexture(size, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  tex.anisotropy = 8;
  return tex;
}

function woodTexture() {
  return canvasTexture(
    1024,
    (g, S) => {
      const plankH = 128;
      for (let y = 0; y < S; y += plankH) {
        let x = -Math.random() * 400;
        while (x < S) {
          const w = 380 + Math.random() * 320;
          g.fillStyle = `hsl(${26 + Math.random() * 6}, 40%, ${50 + Math.random() * 9}%)`;
          g.fillRect(x, y, w, plankH);
          g.strokeStyle = 'rgba(90,50,20,0.13)';
          g.lineWidth = 2;
          for (let i = 0; i < 7; i++) {
            const yy = y + Math.random() * plankH;
            g.beginPath();
            g.moveTo(x, yy);
            g.bezierCurveTo(x + w * 0.3, yy + (Math.random() - 0.5) * 12, x + w * 0.6, yy + (Math.random() - 0.5) * 12, x + w, yy);
            g.stroke();
          }
          g.fillStyle = 'rgba(40,20,10,0.35)';
          g.fillRect(x, y, 3, plankH);
          x += w;
        }
        g.fillStyle = 'rgba(40,20,10,0.4)';
        g.fillRect(0, y, S, 3);
      }
    },
    [3, 3],
  );
}

function tileTexture() {
  return canvasTexture(
    512,
    (g, S) => {
      g.fillStyle = '#d9d3c9';
      g.fillRect(0, 0, S, S);
      const tw = 128,
        th = 64;
      for (let r = 0; r < S / th; r++) {
        const off = r % 2 ? tw / 2 : 0;
        for (let c = -1; c < S / tw + 1; c++) {
          const l = 93 + Math.random() * 3;
          g.fillStyle = `hsl(40, 25%, ${l}%)`;
          g.fillRect(c * tw + off + 3, r * th + 3, tw - 6, th - 6);
        }
      }
    },
    [6, 1.2],
  );
}

function skyTexture() {
  return canvasTexture(256, (g, S) => {
    const grad = g.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, '#6b7fb8');
    grad.addColorStop(0.5, '#f0a07a');
    grad.addColorStop(0.8, '#ffd29a');
    grad.addColorStop(1, '#7c8f6a');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    // distant tree line
    g.fillStyle = '#3f5040';
    for (let x = 0; x < S; x += 6) {
      const h = 30 + Math.sin(x * 0.07) * 10 + Math.random() * 8;
      g.fillRect(x, S - h, 7, h);
    }
  });
}

function box(parent, w, h, d, mat, x, y, z, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

// A row of cabinet doors (slightly proud panels with bar handles) on a +z facing front.
function doorFronts(parent, x0, x1, y0, y1, zFront, mat, { handleTop = true } = {}) {
  const count = Math.max(1, Math.round((x1 - x0) / 0.6));
  const w = (x1 - x0) / count;
  for (let i = 0; i < count; i++) {
    const cx = x0 + w * (i + 0.5);
    box(parent, w - 0.012, y1 - y0 - 0.012, 0.02, mat, cx, (y0 + y1) / 2, zFront + 0.01);
    const hy = handleTop ? y1 - 0.08 : y0 + 0.08;
    const handle = box(parent, 0.012, 0.16, 0.018, MAT.brass, cx + (i % 2 ? -1 : 1) * (w / 2 - 0.06), hy - (handleTop ? 0.06 : -0.06), zFront + 0.035);
    handle.castShadow = false;
  }
}

export function buildKitchen(scene) {
  const k = new THREE.Group();
  scene.add(k);

  // --- room shell ---
  const floorMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.55 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(11, 10), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0.5, 0, 1);
  floor.receiveShadow = true;
  k.add(floor);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 3.2), MAT.wall);
  back.position.set(0.3, 1.6, -3);
  back.receiveShadow = true;
  k.add(back);

  const left = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 3.2), MAT.wall);
  left.rotation.y = Math.PI / 2;
  left.position.set(-4, 1.6, 0.75);
  left.receiveShadow = true;
  k.add(left);

  // window on the left wall (sunset outside)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.2),
    new THREE.MeshBasicMaterial({ map: skyTexture(), toneMapped: false }),
  );
  glass.rotation.y = Math.PI / 2;
  glass.position.set(-3.99, 1.75, 0.6);
  k.add(glass);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.5 });
  box(k, 0.08, 0.06, 1.82, frameMat, -3.97, 2.38, 0.6);
  box(k, 0.14, 0.06, 1.9, frameMat, -3.95, 1.12, 0.6);
  box(k, 0.08, 1.26, 0.06, frameMat, -3.97, 1.75, -0.28);
  box(k, 0.08, 1.26, 0.06, frameMat, -3.97, 1.75, 1.48);
  box(k, 0.06, 1.2, 0.04, frameMat, -3.97, 1.75, 0.6);

  // backsplash
  const splash = new THREE.Mesh(
    new THREE.PlaneGeometry(6.1, 0.66),
    new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.3 }),
  );
  splash.position.set(-0.9, 1.25, -2.99);
  splash.receiveShadow = true;
  k.add(splash);

  // --- back run of base cabinets ---
  const runX0 = -3.95,
    runX1 = 2.15;
  const runW = runX1 - runX0,
    runCx = (runX0 + runX1) / 2;
  box(k, runW, 0.8, 0.58, MAT.cabinet, runCx, 0.48, -2.71);
  box(k, runW, 0.08, 0.52, MAT.toeKick, runCx, 0.04, -2.74);
  doorFronts(k, runX0, runX1, 0.1, 0.87, -2.42, MAT.cabinet);
  box(k, runW + 0.04, 0.04, 0.64, MAT.counter, runCx, 0.9, -2.68);

  // cooktop + hood
  box(k, 0.7, 0.012, 0.5, MAT.blackGlass, -1.5, 0.926, -2.7, { cast: false });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x3a3d44 });
  for (const [dx, dz, r] of [
    [-0.17, -0.1, 0.09],
    [0.17, -0.1, 0.07],
    [-0.17, 0.12, 0.07],
    [0.17, 0.12, 0.09],
  ]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.006, r, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(-1.5 + dx, 0.933, -2.7 + dz);
    k.add(ring);
  }
  box(k, 0.9, 0.12, 0.5, MAT.steel, -1.5, 1.86, -2.75);
  box(k, 0.34, 1.1, 0.3, MAT.steel, -1.5, 2.47, -2.85);

  // upper cabinets
  const upperMat = MAT.cabinet;
  for (const [x0, x1] of [
    [-3.95, -2.0],
    [-1.0, 1.2],
  ]) {
    box(k, x1 - x0, 0.8, 0.34, upperMat, (x0 + x1) / 2, 2.1, -2.83);
    doorFronts(k, x0, x1, 1.71, 2.49, -2.66, upperMat, { handleTop: false });
  }
  // under-cabinet light strip
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xfff1d6, toneMapped: false }),
  );
  strip.rotation.x = Math.PI / 2;
  strip.position.set(0.1, 1.69, -2.8);
  k.add(strip);

  // sink + faucet
  box(k, 0.6, 0.02, 0.42, new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.35 }), 0.45, 0.915, -2.68, { cast: false });
  const faucet = new THREE.Group();
  faucet.position.set(0.45, 0.92, -2.9);
  const fStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.34, 16), MAT.brass);
  fStem.position.y = 0.17;
  const fArc = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.013, 12, 24, Math.PI), MAT.brass);
  fArc.rotation.y = Math.PI / 2;
  fArc.position.set(0, 0.34, 0.09);
  faucet.add(fStem, fArc);
  faucet.traverse((o) => (o.castShadow = true));
  k.add(faucet);

  // plant + utensil crock on the back counter
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.18, 20), new THREE.MeshStandardMaterial({ color: 0xd9825b, roughness: 0.8 }));
  pot.position.set(-3.3, 1.01, -2.75);
  pot.castShadow = true;
  k.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f8a4a, roughness: 0.7 });
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), leafMat);
    const a = (i / 9) * Math.PI * 2;
    leaf.scale.set(0.6, 1.6, 0.35);
    leaf.position.set(-3.3 + Math.cos(a) * 0.07, 1.2 + (i % 3) * 0.05, -2.75 + Math.sin(a) * 0.07);
    leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    leaf.castShadow = true;
    k.add(leaf);
  }
  const crock = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 20), new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.4 }));
  crock.position.set(-0.75, 1.01, -2.8);
  k.add(crock);
  for (let i = 0; i < 3; i++) {
    const u = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
    u.position.set(-0.75 + (i - 1) * 0.025, 1.15, -2.8);
    u.rotation.z = (i - 1) * 0.2;
    k.add(u);
  }

  // --- fridge (right of the oven tower) ---
  box(k, 0.9, 2.1, 0.7, MAT.steel, 3.5, 1.05, -2.65);
  box(k, 0.9, 0.006, 0.01, MAT.toeKick, 3.5, 1.3, -2.295, { cast: false });
  for (const [y, h] of [
    [1.75, 0.6],
    [0.95, 0.4],
  ]) {
    const hnd = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h, 12), MAT.toeKick);
    hnd.position.set(3.12, y, -2.26);
    k.add(hnd);
  }
  box(k, 0.9, 0.2, 0.62, MAT.cabinet, 3.5, 2.2, -2.69);

  // --- island ---
  box(k, 2.2, 0.84, 0.86, MAT.cabinetDark, -0.5, 0.46, -0.45);
  box(k, 2.14, 0.08, 0.8, MAT.toeKick, -0.5, 0.04, -0.45);
  box(k, 2.44, 0.05, 1.12, MAT.counter, -0.5, 0.905, -0.36);
  doorFronts(k, -1.6, 0.6, 0.1, 0.87, -0.02, MAT.cabinetDark);

  // stools
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.6 });
  for (const x of [-1.35, -0.7]) {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 24), seatMat);
    seat.position.set(x, 0.66, 0.5);
    seat.castShadow = true;
    k.add(seat);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.66, 8), MAT.toeKick);
      leg.position.set(x + Math.cos(a) * 0.13, 0.33, 0.5 + Math.sin(a) * 0.13);
      leg.castShadow = true;
      k.add(leg);
    }
  }

  // fruit bowl + herbs on the island
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, side: THREE.DoubleSide }),
  );
  bowl.position.set(-1.3, 1.08, -0.5);
  bowl.castShadow = true;
  k.add(bowl);
  const fruitCols = [0xf4b63d, 0xe0533d, 0x9bc24a, 0xf07d2a];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), new THREE.MeshStandardMaterial({ color: fruitCols[i % 4], roughness: 0.5 }));
    f.position.set(-1.3 + Math.cos(i * 1.3) * 0.07, 1.0, -0.5 + Math.sin(i * 1.3) * 0.07);
    f.castShadow = true;
    k.add(f);
  }
  const board = box(k, 0.42, 0.025, 0.28, new THREE.MeshStandardMaterial({ color: 0xc89a66, roughness: 0.6 }), -0.55, 0.94, -0.55);
  board.rotation.y = 0.2;

  // --- smart speaker on the island ---
  const speaker = new THREE.Group();
  speaker.position.set(0.8, 0.93, -0.45);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.17, 32), new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.95 }));
  body.position.y = 0.085;
  body.castShadow = true;
  const ringMatSpk = new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x33d6ff, emissiveIntensity: 0.3 });
  const spkRing = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.008, 12, 48), ringMatSpk);
  spkRing.rotation.x = Math.PI / 2;
  spkRing.position.y = 0.172;
  speaker.add(body, spkRing);
  k.add(speaker);

  // --- pendant lights over the island ---
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff0cc, toneMapped: false });
  const pendants = [];
  for (const x of [-1.1, 0.1]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.0, 6), MAT.toeKick);
    cord.position.set(x, 2.7, -0.4);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.2, 32, 1, true), shadeMat);
    shade.position.set(x, 2.1, -0.4);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), bulbMat);
    bulb.position.set(x, 2.0, -0.4);
    const light = new THREE.PointLight(0xffd9a0, 2.2, 4, 1.6);
    light.position.set(x, 1.95, -0.4);
    k.add(cord, shade, bulb, light);
    pendants.push(light);
  }

  return { group: k, speaker, speakerRing: ringMatSpk, pendants };
}
