/* ------------------------------------------------------------------
   World geometry. One continuous scene, eight zones laid out in space.
   The camera flies between them; zones outside the active window are
   hidden so draw calls stay low on phones.
   ------------------------------------------------------------------ */

import * as THREE from 'three';
import { MILESTONE_TAGS, CERT_TAGS } from './content.js';

export const C = {
  bg: 0x050810,
  blue: 0x2f81f7,
  blueSoft: 0x6ea8ff,
  amber: 0xf5a623,
  amberSoft: 0xffc96b,
  steel: 0x1a2436,
  dark: 0x0a1020,
  warm: 0xffb257
};

/* ---------- shared helpers ---------- */

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

function glow(color, size, opacity = 0.9) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  s.scale.set(size, size, 1);
  return s;
}

const labelCache = new Map();
function label(text, opts = {}) {
  const { color = '#dce6f7', weight = 600, px = 44, pad = 10, sub = false } = opts;
  const key = text + color + weight + px + sub;
  let tex = labelCache.get(key);
  if (!tex) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const font = `${weight} ${px}px "Space Grotesk", system-ui, sans-serif`;
    g.font = font;
    const w = Math.ceil(g.measureText(text).width) + pad * 2;
    const h = px + pad * 2;
    c.width = w; c.height = h;
    const g2 = c.getContext('2d');
    g2.font = font;
    g2.textBaseline = 'middle';
    g2.fillStyle = color;
    g2.shadowColor = color;
    g2.shadowBlur = sub ? 6 : 18;
    g2.fillText(text, pad, h / 2);
    tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    labelCache.set(key, tex);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, depthTest: opts.depthTest !== false
  }));
  const ar = tex.image.width / tex.image.height;
  const hgt = opts.height || 1;
  sp.scale.set(hgt * ar, hgt, 1);
  return sp;
}

export function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* A soft dark pool on the ground. Real shadow maps for this many lights would
   cost more than the scene can afford on a phone, but with no contact shadow
   at all every object reads as floating above its surface. */
function shadowBlob(size, opacity) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

function emissive(color, emiss, intensity = 1, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color, emissive: emiss, emissiveIntensity: intensity,
    roughness: 0.5, metalness: 0.2, ...extra
  });
}

function dust(count, spread, color, size = 0.09) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread.x;
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread.y;
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color, size, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  }));
}

/* ---------- zone 0: hero void ---------- */

function heroZone(q) {
  const g = new THREE.Group();

  const motes = dust(q.particles, { x: 46, y: 26, z: 36 }, C.blueSoft, 0.08);
  g.add(motes);

  // A slowly breathing core: the machine, abstracted.
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.6, 1),
    new THREE.MeshBasicMaterial({ color: C.blue, wireframe: true, transparent: true, opacity: 0.3 })
  );
  core.position.set(0, 0.4, -6);
  g.add(core);

  const inner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.1, 0),
    emissive(0x0b1428, C.blue, 2.4)
  );
  inner.position.copy(core.position);
  g.add(inner);
  const coreGlow = glow(C.blue, 11, 0.4);
  coreGlow.position.copy(core.position);
  g.add(coreGlow);

  // Horizon rings, like a signal spreading out.
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(
      new THREE.RingGeometry(5 + i * 3.4, 5.07 + i * 3.4, 72),
      new THREE.MeshBasicMaterial({ color: C.blue, transparent: true, opacity: 0.16 - i * 0.04, side: THREE.DoubleSide })
    );
    r.rotation.x = -Math.PI / 2;
    r.position.set(0, -4.4, -6);
    rings.push(r);
    g.add(r);
  }

  g.userData.tick = ({ t }) => {
    core.rotation.y = t * 0.12;
    core.rotation.x = Math.sin(t * 0.21) * 0.2;
    inner.rotation.y = -t * 0.3;
    const pulse = 1 + Math.sin(t * 1.4) * 0.07;
    inner.scale.setScalar(pulse);
    coreGlow.scale.setScalar(11 * (1 + Math.sin(t * 1.4) * 0.08));
    motes.rotation.y = t * 0.014;
    // The rings leave the core as a signal rather than sitting around it.
    rings.forEach((r, i) => {
      r.rotation.z = t * (0.05 + i * 0.02) * (i % 2 ? -1 : 1);
      const ph = (t * 0.2 + i / 3) % 1;
      r.scale.setScalar(0.5 + ph * 1.7);
      r.material.opacity = (1 - ph) * (1 - ph) * 0.3;
    });
  };
  return g;
}

/* ---------- zone 1: the motherboard ---------- */

function pcbTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 768;
  const g = c.getContext('2d');
  g.fillStyle = '#060c18';
  g.fillRect(0, 0, 1024, 768);

  // Orthogonal traces, the way a real board routes them.
  g.lineCap = 'square';
  for (let i = 0; i < 150; i++) {
    const bright = Math.random() > 0.72;
    g.strokeStyle = bright ? 'rgba(110,168,255,.85)' : 'rgba(47,129,247,.3)';
    g.lineWidth = bright ? 2.4 : 1.5;
    let x = Math.random() * 1024;
    let y = Math.random() * 768;
    g.beginPath();
    g.moveTo(x, y);
    const legs = 2 + Math.floor(Math.random() * 4);
    for (let j = 0; j < legs; j++) {
      const len = 40 + Math.random() * 190;
      if (j % 2 === 0) x += Math.random() > 0.5 ? len : -len;
      else y += Math.random() > 0.5 ? len : -len;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Solder pads.
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() > 0.8 ? 'rgba(245,166,35,.6)' : 'rgba(90,140,220,.42)';
    g.beginPath();
    g.arc(Math.random() * 1024, Math.random() * 768, 2 + Math.random() * 2.6, 0, 7);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hardwareZone(q) {
  const g = new THREE.Group();
  g.position.set(0, -60, 0);

  const tex = pcbTexture();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(84, 1.1, 62),
    [
      new THREE.MeshStandardMaterial({ color: 0x0a1020, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x0a1020, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.65, metalness: 0.15 }),
      new THREE.MeshStandardMaterial({ color: 0x070c16, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x0a1020, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x0a1020, roughness: 0.8 })
    ]
  );
  g.add(board);

  const chipMat = new THREE.MeshStandardMaterial({ color: 0x2b3850, roughness: 0.34, metalness: 0.72, envMapIntensity: 1.5 });

  // CPU, with the heatsink and a lit die.
  const cpu = new THREE.Group();
  cpu.position.set(-13, 0.6, 7);
  const cpuBody = new THREE.Mesh(new THREE.BoxGeometry(11, 1.4, 11), chipMat);
  cpuBody.position.y = 0.7;
  cpu.add(cpuBody);
  const die = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.5, 6.4), emissive(0x0d1b33, C.blue, 2.8));
  die.position.y = 1.6;
  cpu.add(die);
  // A lit seam around the package, so the chip has an edge at any angle.
  const seam = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.1, 8, 4), emissive(0x0d1b33, C.blueSoft, 2.6));
  seam.rotation.x = Math.PI / 2;
  seam.rotation.z = Math.PI / 4;
  seam.position.y = 0.5;
  cpu.add(seam);
  const dieGlow = glow(C.blue, 17, 0.4);
  dieGlow.position.y = 6.2;
  cpu.add(dieGlow);
  const finGeo = new THREE.BoxGeometry(0.34, 3.2, 9.4);
  const fins = new THREE.InstancedMesh(finGeo, new THREE.MeshStandardMaterial({ color: 0x5a6d8a, metalness: 0.92, roughness: 0.22, envMapIntensity: 1.8 }), 16);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 16; i++) {
    m4.makeTranslation(-4.4 + i * 0.59, 3.5, 0);
    fins.setMatrixAt(i, m4);
  }
  cpu.add(fins);
  g.add(cpu);

  // RAM: four sticks standing in their slots.
  const ram = new THREE.Group();
  ram.position.set(9, 0.6, 4);
  for (let i = 0; i < 4; i++) {
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.2, 15), chipMat);
    stick.position.set(i * 2.1, 2.6, 0);
    ram.add(stick);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.26, 13), emissive(0x16253d, C.blue, 0.9));
    strip.position.set(i * 2.1, 4.6, 0);
    ram.add(strip);
  }
  g.add(ram);

  // GPU card. The fan is the thing the camera lingers on, so it is built like
  // one: a recessed well, a proper hub, support struts across the opening, and
  // blades that taper toward the root and twist along their length. Flat
  // rectangles stuck on a circle read as crumpled foil from any angle but
  // dead on.
  const gpu = new THREE.Group();
  gpu.position.set(16, 0.6, -18);
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(14, 2.6, 22), chipMat);
  shroud.position.y = 1.9;
  gpu.add(shroud);

  const FAN_Y = 3.3;
  const FAN_Z = -5.5;
  const fanMetal = new THREE.MeshStandardMaterial({ color: 0x8a9bb8, roughness: 0.28, metalness: 0.85, envMapIntensity: 1.7 });

  const well = new THREE.Mesh(
    new THREE.CylinderGeometry(5.1, 5.1, 2.2, 36, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x1b2535, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide, envMapIntensity: 1.1 })
  );
  well.position.set(0, FAN_Y - 0.9, FAN_Z);
  gpu.add(well);
  const wellFloor = new THREE.Mesh(new THREE.CircleGeometry(5.1, 36), new THREE.MeshStandardMaterial({ color: 0x0d1420, roughness: 0.85 }));
  wellFloor.rotation.x = -Math.PI / 2;
  wellFloor.position.set(0, FAN_Y - 2, FAN_Z);
  gpu.add(wellFloor);

  const fanHub = new THREE.Group();
  fanHub.position.set(0, FAN_Y, FAN_Z);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.32, 0.9, 20), fanMetal);
  fanHub.add(hub);
  const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 20), emissive(0x101a2c, C.amber, 1.6));
  hubCap.position.y = 0.5;
  fanHub.add(hubCap);

  // One blade geometry, reshaped once: narrowed at the root and twisted so the
  // pitch eases off toward the tip, which is what makes a fan look like it
  // could actually move air.
  const bladeGeo = new THREE.BoxGeometry(3.7, 0.16, 1.9, 6, 1, 1);
  const bp = bladeGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i);
    const y = bp.getY(i);
    const k = (x + 1.85) / 3.7;
    const z = bp.getZ(i) * (0.42 + k * 0.85);
    const a = 0.62 - k * 0.4;
    bp.setY(i, y * Math.cos(a) - z * Math.sin(a));
    bp.setZ(i, y * Math.sin(a) + z * Math.cos(a));
  }
  bladeGeo.computeVertexNormals();

  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x8294b2, roughness: 0.32, metalness: 0.72, envMapIntensity: 1.5, side: THREE.DoubleSide
  });
  for (let i = 0; i < 9; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 9) * Math.PI * 2;
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.x = 3;
    pivot.add(blade);
    fanHub.add(pivot);
  }
  gpu.add(fanHub);

  for (let i = 0; i < 3; i++) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.13, 0.3), fanMetal);
    strut.position.set(0, FAN_Y + 1.15, FAN_Z);
    strut.rotation.y = (i / 3) * Math.PI;
    gpu.add(strut);
  }

  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.16, 8, 44), emissive(0x101a2c, C.amber, 2.4));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, FAN_Y + 1.2, FAN_Z);
  gpu.add(ring);
  g.add(gpu);

  // Capacitors scattered where there is room.
  const caps = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.62, 0.62, 2.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x46587a, metalness: 0.85, roughness: 0.24, envMapIntensity: 1.7 }),
    30
  );
  const spots = [];
  for (let i = 0; i < 30; i++) {
    let x, z, tries = 0;
    do {
      x = (Math.random() - 0.5) * 72;
      z = (Math.random() - 0.5) * 50;
      tries++;
    } while (tries < 12 && Math.abs(x + 13) < 9 && Math.abs(z - 7) < 9);
    spots.push([x, z]);
    m4.makeTranslation(x, 1.7, z);
    caps.setMatrixAt(i, m4);
  }
  g.add(caps);

  // Chip packages for texture at distance.
  const chips = new THREE.InstancedMesh(new THREE.BoxGeometry(4.5, 0.9, 4.5), chipMat, 10);
  for (let i = 0; i < 10; i++) {
    m4.makeTranslation((Math.random() - 0.5) * 68, 1.05, (Math.random() - 0.5) * 48);
    chips.setMatrixAt(i, m4);
  }
  g.add(chips);

  // Contact shadows, so the components sit on the board instead of over it.
  for (const [shx, shz, shs] of [[-13, 7, 26], [12, 4, 24], [16, -18, 32]]) {
    const sh = shadowBlob(shs, 0.55);
    sh.position.set(shx, 0.62, shz);
    g.add(sh);
  }

  // Signal pulses riding the traces, heading for the server room.
  const paths = [
    [[-30, 20], [-30, -4], [-4, -4], [-4, -26], [26, -26]],
    [[34, 18], [6, 18], [6, 0], [-20, 0], [-20, -28]],
    [[-36, -14], [-10, -14], [-10, 14], [22, 14], [22, 30]],
    [[28, -30], [28, 2], [2, 2], [2, 26]]
  ];
  const lineMat = new THREE.LineBasicMaterial({ color: C.blueSoft, transparent: true, opacity: 0.55 });
  const pulses = [];
  paths.forEach((p, idx) => {
    const pts = p.map(([x, z]) => new THREE.Vector3(x, 0.8, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.02);
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(90)), lineMat));
    const dot = glow(idx % 2 ? C.amber : C.blueSoft, 3.4, 0.95);
    g.add(dot);
    pulses.push({ curve, dot, offset: idx * 0.27, speed: 0.11 + idx * 0.015 });
  });

  let fanAngle = 0;
  g.userData.tick = ({ t, flow, boost, p, dt }) => {
    // The fan spools up as you arrive and chases how fast you are scrolling,
    // so the board answers to you instead of looping at one fixed speed.
    fanAngle += dt * (3.5 + smoothstep(0, 0.14, p) * 6 + boost * 34);
    fanHub.rotation.y = fanAngle;
    die.material.emissiveIntensity = 2.3 + Math.sin(t * 2.2) * 0.8;
    dieGlow.material.opacity = 0.34 + Math.sin(t * 2.2) * 0.12;
    ring.material.emissiveIntensity = 2.2 + boost * 2.8;
    pulses.forEach((pu) => {
      const u = (flow * pu.speed + pu.offset) % 1;
      pu.dot.position.copy(pu.curve.getPointAt(u));
      pu.dot.position.y = 1.4;
      pu.dot.material.opacity = (0.3 + Math.sin(u * Math.PI) * 0.7) * (0.72 + boost * 0.45);
      pu.dot.scale.setScalar(3.4 * (1 + boost * 0.8));
    });
  };
  return g;
}

/* ---------- zone 2: the server room ---------- */

function networkZone(q) {
  const g = new THREE.Group();
  g.position.set(0, -60, -170);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(44, 0.6, 180),
    new THREE.MeshStandardMaterial({ color: 0x18233a, roughness: 0.42, metalness: 0.55, envMapIntensity: 1.2 })
  );
  floor.position.y = -3.2;
  g.add(floor);

  const rackMat = new THREE.MeshStandardMaterial({ color: 0x3f5070, roughness: 0.38, metalness: 0.7, envMapIntensity: 1.35 });
  const trimMat = emissive(0x1b2435, C.blue, 0.12);

  const ledCount = q.racks * 2 * 14;
  const leds = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.22, 0.1, 0.06),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    ledCount
  );
  leds.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(ledCount * 3), 3);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  const seeds = [];
  let li = 0;

  for (let side = 0; side < 2; side++) {
    const sx = side ? 9.5 : -9.5;
    for (let r = 0; r < q.racks; r++) {
      const z = -78 + r * (156 / (q.racks - 1));
      const rack = new THREE.Mesh(new THREE.BoxGeometry(5.4, 11.5, 4.4), rackMat);
      rack.position.set(sx, 2.6, z);
      g.add(rack);

      const face = new THREE.Mesh(new THREE.BoxGeometry(0.14, 10.2, 3.1), trimMat);
      face.position.set(sx + (side ? -2.5 : 2.5), 2.6, z);
      g.add(face);

      const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 3.6), emissive(0x16253d, C.blueSoft, 1.8));
      bezel.position.set(sx + (side ? -2.72 : 2.72), 8.2, z);
      g.add(bezel);
      const bezel2 = bezel.clone();
      bezel2.position.y = -2.9;
      g.add(bezel2);

      for (let k = 0; k < 14; k++) {
        m4.makeTranslation(sx + (side ? -2.62 : 2.62), -2 + k * 0.72, z + ((k % 3) - 1) * 1.1);
        leds.setMatrixAt(li, m4);
        col.setHex(Math.random() > 0.82 ? 0xff5a4d : (Math.random() > 0.4 ? C.blueSoft : 0x3ddc84));
        leds.setColorAt(li, col);
        seeds.push({ base: col.clone(), phase: Math.random() * 7, rate: 0.6 + Math.random() * 3.4, zn: (78 - z) / 156 });
        li++;
      }
    }
  }
  g.add(leds);

  // Cable runs overhead, the part nobody labels.
  const cableMat1 = new THREE.MeshStandardMaterial({ color: 0x47587a, roughness: 0.8 });
  const cableMat2 = new THREE.MeshStandardMaterial({ color: 0x7a5a2e, roughness: 0.8 });
  for (let i = 0; i < 5; i++) {
    const x = -7 + i * 3.5;
    const pts = [];
    for (let s = 0; s <= 6; s++) {
      pts.push(new THREE.Vector3(x + Math.sin(s * 1.3 + i) * 0.8, 9.6 - Math.cos(s * 0.9 + i) * 0.5, -84 + s * 28));
    }
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.34, 6, false),
      i % 2 ? cableMat2 : cableMat1
    );
    g.add(tube);
  }

  // Ceiling strips.
  for (let i = 0; i < 6; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 11), emissive(0x16263f, C.blueSoft, 1.6));
    strip.position.set(0, 11.4, -76 + i * 30);
    g.add(strip);
    const gl = glow(C.blueSoft, 22, 0.2);
    gl.position.set(0, 10.4, -76 + i * 30);
    g.add(gl);
  }

  // The door at the far end, warm light behind it.
  // Deliberately dull. At high metalness this slab mirrored the warm patch of
  // the environment back as one flat tan panel across the end of the aisle.
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(16, 14, 1), new THREE.MeshStandardMaterial({ color: 0x18222f, metalness: 0.35, roughness: 0.62, envMapIntensity: 0.45 }));
  doorFrame.position.set(0, 3.2, -92);
  g.add(doorFrame);
  const doorLight = new THREE.Mesh(
    new THREE.PlaneGeometry(10.4, 10.6),
    new THREE.MeshBasicMaterial({ color: 0xffe3b8, toneMapped: false })
  );
  doorLight.position.set(0, 3, -91.3);
  g.add(doorLight);
  const doorGlow = glow(C.warm, 24, 0.55);
  doorGlow.position.set(0, 3, -90);
  g.add(doorGlow);
  const doorEdge = new THREE.Mesh(
    new THREE.TorusGeometry(8, 0.16, 8, 4),
    new THREE.MeshBasicMaterial({ color: 0xffe3b8, toneMapped: false })
  );
  doorEdge.rotation.z = Math.PI / 4;
  doorEdge.position.set(0, 3.2, -91.6);
  g.add(doorEdge);
  // A back wall so the helpdesk scene is a reveal, not a distraction.
  // Single sided on purpose. Double sided, the warm lamp behind the doorway
  // lit this wall through its own back face and washed the far end beige.
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 46),
    new THREE.MeshStandardMaterial({ color: 0x0c1322, roughness: 0.95 })
  );
  backWall.position.set(0, 6, -96);
  g.add(backWall);

  const shellMat = new THREE.MeshStandardMaterial({ color: 0x1a2436, roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(44, 186), shellMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 12.4;
  g.add(ceiling);
  for (const sx of [-21, 21]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(186, 18), shellMat);
    wall.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    wall.position.set(sx, 4, 0);
    g.add(wall);
  }

  const haze = dust(Math.round(q.particles * 0.6), { x: 30, y: 14, z: 170 }, 0x6ea8ff, 0.07);
  haze.position.y = 3;
  g.add(haze);

  g.userData.tick = ({ t, p }) => {
    // The racks come up in a wave that runs ahead of the camera down the
    // aisle, so entering the room is an event rather than a fade in.
    const front = p * 1.25;
    for (let i = 0; i < seeds.length; i += 1) {
      const s = seeds[i];
      const on = Math.max(0, Math.min(1, (front - s.zn) * 5));
      const f = (0.2 + Math.abs(Math.sin(t * s.rate + s.phase)) * 0.8) * on;
      col.copy(s.base).multiplyScalar(f);
      leds.setColorAt(i, col);
    }
    leds.instanceColor.needsUpdate = true;
    // The doorway blooms as you close on it.
    const arrive = smoothstep(0.5, 1, p);
    doorGlow.material.opacity = 0.4 + Math.sin(t * 0.9) * 0.07 + arrive * 0.3;
    const gs = 24 * (1 + arrive * 0.35);
    doorGlow.scale.set(gs, gs, 1);
    haze.rotation.z = t * 0.01;
  };
  return g;
}

/* ---------- zone 3: the helpdesk ---------- */

function helpdeskZone(q) {
  const g = new THREE.Group();
  g.position.set(0, -60, -300);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(34, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a2d1f, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4;
  g.add(floor);

  const deskMat = new THREE.MeshStandardMaterial({ color: 0x55402b, roughness: 0.75 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5b76ad, roughness: 0.7 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xc9a07a, roughness: 0.8 });
  const screenMat = emissive(0x16233a, 0x5f8fd8, 0.9);
  const people = [];

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const r = q.portrait ? 10.5 : 15;
    const station = new THREE.Group();
    station.position.set(Math.cos(a) * r, -4, Math.sin(a) * r);
    station.rotation.y = -a + Math.PI / 2;

    const top = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 3.4), deskMat);
    top.position.y = 2.6;
    station.add(top);
    for (const lx of [-3.1, 3.1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.28), deskMat);
      leg.position.set(lx, 1.3, 0);
      station.add(leg);
    }
    const mon = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.32, metalness: 0.5, envMapIntensity: 1.1 }));
    mon.position.set(0, 4.2, -1.1);
    station.add(mon);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.2), screenMat);
    scr.position.set(0, 4.2, -0.98);
    station.add(scr);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 1.7, 4, 10), bodyMat);
    body.position.set(0, 2.1, 2.6);
    station.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 12), headMat);
    head.position.set(0, 3.9, 2.6);
    station.add(head);

    // Everyone on this floor wears one. Parented to the head so it turns with
    // it, and built to read from behind, which is the angle the camera has.
    const hsMat = emissive(0x241a0e, C.amber, 1.5);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.77, 0.085, 8, 22, Math.PI), hsMat);
    band.position.y = 0.05;
    head.add(band);
    for (const ex of [-0.78, 0.78]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.18, 14), hsMat);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(ex, 0.02, 0);
      head.add(cup);
    }
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.66, 8), hsMat);
    mic.position.set(-0.56, -0.3, -0.44);
    mic.rotation.set(-0.5, 0, 0.75);
    head.add(mic);

    // Hands on a keyboard. A seated figure with no arms reads as furniture.
    const arms = [];
    for (const ax of [-0.62, 0.62]) {
      const arm = new THREE.Group();
      arm.position.set(ax, 2.95, 2.3);
      const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 1.15, 3, 8), bodyMat);
      limb.rotation.x = Math.PI / 2;
      limb.position.z = -0.68;
      arm.add(limb);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), headMat);
      hand.position.set(0, 0, -1.4);
      arm.add(hand);
      arm.rotation.x = -0.1;
      station.add(arm);
      arms.push(arm);
    }
    const keyboard = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.1, 0.95),
      new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.6, metalness: 0.35 })
    );
    keyboard.position.set(0, 2.78, 0.85);
    station.add(keyboard);

    const spill = glow(0x9fc4ff, 4.5, 0.22);
    spill.position.set(0, 4.2, -1.4);
    station.add(spill);
    const backLight = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 0.08), emissive(0x101722, C.blueSoft, 2.2));
    backLight.position.set(0, 2.95, -1.2);
    station.add(backLight);

    const shade = shadowBlob(10, 0.55);
    shade.position.set(0, 0.06, 0.8);
    station.add(shade);

    people.push({ body, head, arms, phase: i * 1.7 });
    g.add(station);
  }

  // The headset at the centre, the job in one object.
  const headset = new THREE.Group();
  headset.position.set(0, 7.4, 2);
  headset.scale.setScalar(0.78);
  const band = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.32, 10, 36, Math.PI), emissive(0x241a0e, C.amber, 1.9));
  band.rotation.z = 0;
  headset.rotation.x = -0.12;
  headset.add(band);
  for (const sx of [-2.6, 2.6]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.9, 18), emissive(0x241a0e, C.amber, 1.3));
    cup.rotation.z = Math.PI / 2;
    cup.position.set(sx, 0, 0);
    headset.add(cup);
  }
  const boomPts = [new THREE.Vector3(-2.6, -0.4, 0.4), new THREE.Vector3(-2.2, -1.9, 1.5), new THREE.Vector3(-0.9, -2.3, 2.1)];
  const boom = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(boomPts), 20, 0.16, 6, false), emissive(0x241a0e, C.amberSoft, 1.4));
  headset.add(boom);
  headset.add(glow(C.amber, 18, 0.26));
  g.add(headset);

  // Tickets drifting to the resolved bin.
  const binBase = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 1.4, 24), new THREE.MeshStandardMaterial({ color: 0x45586f, metalness: 0.72, roughness: 0.28, envMapIntensity: 1.5 }));
  binBase.position.set(0, -3.1, -11);
  g.add(binBase);
  const binShade = shadowBlob(13, 0.5);
  binShade.position.set(0, -3.92, -11);
  g.add(binShade);
  const binTop = new THREE.Mesh(new THREE.CircleGeometry(3.1, 24), new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.8, toneMapped: false }));
  binTop.rotation.x = -Math.PI / 2;
  binTop.position.set(0, -2.35, -11);
  g.add(binTop);
  const binGlow = glow(0x3ddc84, 15, 0.4);
  binGlow.position.set(0, -1.6, -11);
  g.add(binGlow);
  const resolved = label('RESOLVED', { color: '#6dffb0', px: 38, height: 0.85 });
  resolved.position.set(0, -0.9, -9.4);
  g.add(resolved);

  const ticketMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f8, emissive: 0x5b6a86, emissiveIntensity: 0.5, roughness: 0.8, side: THREE.DoubleSide });
  const tickets = [];
  for (let i = 0; i < q.tickets; i++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.55), ticketMat);
    g.add(t);
    const a = Math.random() * Math.PI * 2;
    tickets.push({
      mesh: t,
      start: new THREE.Vector3(Math.cos(a) * 8.5, 0.5 + Math.random() * 3.5, Math.sin(a) * 8.5 - 3),
      offset: i / q.tickets,
      speed: 0.055 + Math.random() * 0.045,
      spin: (Math.random() - 0.5) * 2
    });
  }
  const binPos = new THREE.Vector3(0, -2, -11);

  g.userData.tick = ({ t, flow, p }) => {
    headset.rotation.y = Math.sin(t * 0.32) * 0.55;
    headset.position.y = 7.4 + Math.sin(t * 0.8) * 0.3;
    people.forEach((pr) => {
      const b = Math.sin(t * 1.1 + pr.phase) * 0.06;
      pr.body.position.y = 2.1 + b;
      pr.head.position.y = 3.9 + b;
      pr.head.rotation.y = Math.sin(t * 0.6 + pr.phase) * 0.4;
      // Typing: the two hands never land together.
      pr.arms[0].rotation.x = -0.1 + Math.sin(t * 8.4 + pr.phase) * 0.055;
      pr.arms[1].rotation.x = -0.1 + Math.sin(t * 8.4 + pr.phase + 2.1) * 0.055;
    });
    // A room of monitors is never perfectly steady.
    screenMat.emissiveIntensity = 0.84 + Math.sin(t * 7.3) * 0.05 + Math.sin(t * 2.1) * 0.07;
    binTop.material.opacity = 0.6 + Math.sin(t * 2) * 0.22;
    binGlow.scale.setScalar(15 * (1 + Math.sin(t * 2) * 0.1));
    // On the way out the queue breaks up, and those pieces are what the
    // skills constellation draws itself from in the next scene.
    const melt = smoothstep(0.52, 0.8, p);
    tickets.forEach((tk) => {
      const u = (flow * tk.speed + tk.offset) % 1;
      const e = u * u * (3 - 2 * u);
      tk.mesh.position.lerpVectors(tk.start, binPos, e);
      tk.mesh.position.y += Math.sin(u * Math.PI) * 3.4 + melt * (6 + tk.offset * 26);
      tk.mesh.rotation.set(
        Math.sin(t + tk.offset * 9) * 0.3 + melt * 5,
        flow * tk.spin * 0.5 + melt * 7,
        Math.cos(t * 0.7 + tk.offset * 6) * 0.25
      );
      tk.mesh.scale.setScalar(Math.max(0.02, (1 - e * 0.75) * (1 - melt)));
    });
  };
  return g;
}

/* ---------- zone 4: the skills constellation ---------- */

function skillsZone(q) {
  const g = new THREE.Group();
  g.position.set(0, -20, -430);

  /* This used to be a sphere of twenty-one labelled orbs. On a phone the
     labels landed on top of each other and on top of the skills list, which
     made the one section whose whole job is to be read the hardest to read.
     The list in the HTML already carries every fact, so the 3D here is now
     only a backdrop: a slow wireframe shell well behind the text, quiet
     enough that nothing competes with the words in front of it. */
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(17, 2),
    new THREE.MeshBasicMaterial({ color: C.blue, wireframe: true, transparent: true, opacity: 0.075 })
  );
  g.add(shell);

  const inner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(9.4, 1),
    new THREE.MeshBasicMaterial({ color: C.blueSoft, wireframe: true, transparent: true, opacity: 0.1 })
  );
  g.add(inner);

  const motes = dust(Math.round(q.particles * 0.7), { x: 44, y: 32, z: 44 }, C.blueSoft, 0.06);
  g.add(motes);

  g.userData.tick = ({ t, p }) => {
    const settle = smoothstep(0.18, 0.44, p);
    shell.rotation.y = t * 0.035;
    shell.rotation.x = t * 0.016;
    inner.rotation.y = -t * 0.07;
    inner.rotation.z = t * 0.03;
    shell.material.opacity = 0.075 * settle;
    inner.material.opacity = 0.1 * settle;
    const s = 0.8 + settle * 0.2;
    shell.scale.setScalar(s);
    inner.scale.setScalar(s);
    motes.rotation.y = -t * 0.012;
  };
  return g;
}

/* ---------- zone 5: the road ---------- */

function experienceZone(q) {
  const g = new THREE.Group();
  g.position.set(0, -30, 0);

  const z0 = -500, z1 = -720;
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(11, Math.abs(z1 - z0)),
    new THREE.MeshStandardMaterial({ color: 0x0b1222, roughness: 0.4, metalness: 0.6, envMapIntensity: 0.9 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -2, (z0 + z1) / 2);
  g.add(road);

  for (const sx of [-5.5, 5.5]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, Math.abs(z1 - z0)), emissive(0x0d1830, C.blue, 2.8));
    edge.position.set(sx, -1.9, (z0 + z1) / 2);
    g.add(edge);
  }

  // Dashes running down the centre.
  const dashCount = 36;
  const dashes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.4, 0.06, 2.6),
    new THREE.MeshBasicMaterial({ color: C.blueSoft, transparent: true, opacity: 0.5, toneMapped: false }),
    dashCount
  );
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < dashCount; i++) {
    m4.makeTranslation(0, -1.92, z0 - i * (Math.abs(z1 - z0) / dashCount));
    dashes.setMatrixAt(i, m4);
  }
  g.add(dashes);

  const markers = [];
  const zs = [-524, -566, -608, -650, -692];
  MILESTONE_TAGS.forEach((tag, i) => {
    // Close enough to the road that a phone's narrow view still catches them.
    const sx = i % 2 === 0 ? -9.5 : -6.5;
    const holder = new THREE.Group();
    holder.position.set(sx, -2, zs[i]);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 8), emissive(0x0d1830, i % 2 ? C.amber : C.blue, 2.4));
    pillar.position.y = 3.5;
    holder.add(pillar);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.07, 8, 32), emissive(0x0d1830, i % 2 ? C.amber : C.blueSoft, 2.6));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.3;
    holder.add(ring);

    const gl = glow(i % 2 ? C.amber : C.blue, 6, 0.3);
    gl.position.y = 3.5;
    holder.add(gl);

    const lb = label(tag, { color: i % 2 ? '#ffc96b' : '#cfe0ff', px: 42, height: 1.15 });
    lb.position.set(0, 8.2, 0);
    holder.add(lb);

    g.add(holder);
    markers.push({ ring, gl, pillar, z: zs[i], phase: i * 1.3 });
  });

  const haze = dust(Math.round(q.particles * 0.5), { x: 40, y: 10, z: 220 }, C.blueSoft, 0.07);
  haze.position.set(0, 1, (z0 + z1) / 2);
  g.add(haze);

  g.userData.tick = ({ t, flow, cam }) => {
    const span = Math.abs(z1 - z0);
    for (let i = 0; i < dashCount; i++) {
      const z = z0 - ((i * (span / dashCount) + flow * 14) % span);
      m4.makeTranslation(0, -1.92, z);
      dashes.setMatrixAt(i, m4);
    }
    dashes.instanceMatrix.needsUpdate = true;
    // Each marker brightens as the camera closes on it, the way a real light
    // does, instead of the whole row pulsing in step.
    markers.forEach((mk) => {
      const d = Math.abs(cam.z - mk.z);
      const near = Math.max(0.12, Math.min(1, 1 - (d - 16) / 95));
      mk.ring.rotation.z = t * 0.6 + mk.phase;
      mk.ring.scale.setScalar(1 + Math.sin(t * 1.4 + mk.phase) * 0.08);
      mk.gl.material.opacity = 0.12 + Math.sin(t * 1.4 + mk.phase) * 0.05 + near * 0.42;
      mk.pillar.material.emissiveIntensity = 1.1 + near * 2.6;
    });
  };
  return g;
}

/* ---------- zone 5b: the bench ---------- */

function projectsZone(q) {
  const g = new THREE.Group();
  g.position.set(6.5, -34, -745);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 0.78, metalness: 0.08 });
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x242a33, roughness: 0.38, metalness: 0.72, envMapIntensity: 1.5 });
  const partMat = new THREE.MeshStandardMaterial({ color: 0x2c3540, roughness: 0.44, metalness: 0.55, envMapIntensity: 1.4 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0x9fb0c8, roughness: 0.2, metalness: 0.95, envMapIntensity: 2 });

  // A hard circle edge read as an ellipse drawn across the frame. The same
  // radial texture the shadows use, as an alpha map, gives a pool of floor
  // that simply fades out instead.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 36),
    new THREE.MeshStandardMaterial({
      color: 0x191d25, roughness: 0.95,
      alphaMap: glowTexture(), transparent: true, depthWrite: false
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -7.2;
  g.add(ground);

  // ---- the bench ----
  const bench = new THREE.Mesh(new THREE.BoxGeometry(24, 0.55, 10), woodMat);
  g.add(bench);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(24, 0.5, 0.4), woodMat);
  lip.position.set(0, -0.3, 5.05);
  g.add(lip);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 8), woodMat);
  shelf.position.y = -4.2;
  g.add(shelf);
  for (const bx of [-10.8, 10.8]) {
    for (const bz of [-4.2, 4.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 7, 0.45), partMat);
      leg.position.set(bx, -3.7, bz);
      g.add(leg);
    }
  }

  // ---- the build, side panel toward you ----
  const tower = new THREE.Group();
  tower.position.set(-5.6, 0.28, -0.3);
  tower.rotation.y = -0.44;
  for (const [w, h, d, x, y, z] of [
    [5, 0.3, 10, 0, 0.15, 0],
    [5, 0.3, 10, 0, 8.85, 0],
    [5, 9, 0.3, 0, 4.5, -4.85],
    [0.3, 9, 10, -2.35, 4.5, 0],
    [0.3, 9, 0.5, 2.35, 4.5, 4.75],
    [0.3, 9, 0.5, 2.35, 4.5, -4.75]
  ]) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), caseMat);
    part.position.set(x, y, z);
    tower.add(part);
  }

  const boardTex = pcbTexture();
  boardTex.wrapS = boardTex.wrapT = THREE.RepeatWrapping;
  boardTex.repeat.set(0.5, 0.45);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.22, 6.6, 7.4), new THREE.MeshStandardMaterial({
    map: boardTex, emissiveMap: boardTex, emissive: 0xffffff, emissiveIntensity: 0.26,
    roughness: 0.72, metalness: 0.12
  }));
  board.position.set(-2.05, 5, -0.3);
  tower.add(board);

  // A tower cooler, because a build with an empty middle looks unfinished.
  const cooler = new THREE.Group();
  cooler.position.set(-0.85, 6, 0.1);
  const finGeo = new THREE.BoxGeometry(1.9, 2.5, 0.1);
  const fins = new THREE.InstancedMesh(finGeo, chrome, 15);
  const fm = new THREE.Matrix4();
  for (let i = 0; i < 15; i++) {
    fm.makeTranslation(0, 0, -1.1 + i * 0.157);
    fins.setMatrixAt(i, fm);
  }
  cooler.add(fins);
  // The ring sits in the XY plane, so the blades have to as well. Built on
  // pivots like the GPU fan: an outer group for orientation, an inner one that
  // actually turns.
  const coolerFan = new THREE.Group();
  coolerFan.position.set(1.2, 0, 0);
  coolerFan.rotation.y = Math.PI / 2;
  const cfRing = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.1, 8, 26), emissive(0x101a2c, C.blueSoft, 2.2));
  coolerFan.add(cfRing);
  const cfSpin = new THREE.Group();
  coolerFan.add(cfSpin);
  const cfHub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 12), chrome);
  cfHub.rotation.x = Math.PI / 2;
  cfSpin.add(cfHub);
  for (let i = 0; i < 7; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.z = (i / 7) * Math.PI * 2;
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.52, 0.06), chrome);
    bl.position.x = 0.76;
    bl.rotation.x = 0.55;
    pivot.add(bl);
    cfSpin.add(pivot);
  }
  cooler.add(coolerFan);
  tower.add(cooler);

  for (let i = 0; i < 4; i++) {
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.3, 0.16), partMat);
    stick.position.set(-1.35, 6.9, -3.1 + i * 0.42);
    tower.add(stick);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.2), emissive(0x16253d, C.blueSoft, 2.4));
    cap.position.set(-1.35, 8.1, -3.1 + i * 0.42);
    tower.add(cap);
  }

  const gpu = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.05, 6.6), partMat);
  gpu.position.set(-0.5, 3.5, 0.2);
  tower.add(gpu);
  const gpuStrip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 5.6), emissive(0x241a0e, C.amber, 2.6));
  gpuStrip.position.set(1.25, 3.5, 0.2);
  tower.add(gpuStrip);

  const psu = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.9, 9.4), caseMat);
  psu.position.set(-0.1, 1.4, 0);
  tower.add(psu);

  // Cable runs from the supply up to the board, tidied but visible.
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x11151b, roughness: 0.85 });
  for (let i = 0; i < 3; i++) {
    const pts = [
      new THREE.Vector3(-0.6 + i * 0.3, 2.4, 2.8 - i * 0.6),
      new THREE.Vector3(-1.5, 4.2, 2.4 - i * 0.5),
      new THREE.Vector3(-1.75, 6.4 - i * 1.3, 1.4 - i * 0.7),
      new THREE.Vector3(-1.9, 6.8 - i * 1.4, 0.4 - i * 0.9)
    ];
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.14, 6, false), cableMat);
    tower.add(tube);
  }

  // Interior lighting, the signature of every build anyone shows off.
  const rgbTop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 8.8), emissive(0x16253d, C.blueSoft, 3));
  rgbTop.position.set(-2.1, 8.5, 0);
  tower.add(rgbTop);
  const rgbFloor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 8.8), emissive(0x16253d, 0x58e5ff, 2.4));
  rgbFloor.position.set(-2.1, 2.5, 0);
  tower.add(rgbFloor);
  const innerGlow = glow(C.blue, 15, 0.42);
  innerGlow.position.set(-0.5, 5, 0);
  tower.add(innerGlow);

  // The glass side panel: cheap transparency, not a transmission pass.
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 8.5, 9.5),
    new THREE.MeshStandardMaterial({
      color: 0xa8c8f2, transparent: true, opacity: 0.08, roughness: 0.12,
      metalness: 0.05, envMapIntensity: 0.7, depthWrite: false, side: THREE.DoubleSide
    })
  );
  glass.position.set(2.33, 4.5, 0);
  tower.add(glass);
  for (const [gy, gz, gw, gd] of [[8.78, 0, 0.16, 9.5], [0.22, 0, 0.16, 9.5]]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.14, gw, gd), chrome);
    edge.position.set(2.33, gy, gz);
    tower.add(edge);
  }
  g.add(tower);

  // ---- the lab box, as a small two unit rack ----
  const lab = new THREE.Group();
  lab.position.set(5.6, 0.28, 0.8);
  lab.rotation.y = 0.26;
  const rackFrame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4.8, 6), caseMat);
  rackFrame.position.y = 2.4;
  lab.add(rackFrame);
  const labLeds = [];
  for (let u = 0; u < 2; u++) {
    const unit = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.8, 0.2), partMat);
    unit.position.set(0, 1.3 + u * 2.1, 3.05);
    lab.add(unit);
    for (let v = 0; v < 5; v++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.08), new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.9 }));
      slot.position.set(-0.3, 0.75 + u * 2.1 + v * 0.26, 3.17);
      lab.add(slot);
    }
    for (let k = 0; k < 3; k++) {
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.08),
        new THREE.MeshBasicMaterial({ color: (u === 1 && k === 0) ? 0x3ddc84 : C.blueSoft, toneMapped: false })
      );
      led.position.set(1.5, 1.05 + u * 2.1 + k * 0.42, 3.18);
      lab.add(led);
      labLeds.push({ led, phase: Math.random() * 7, rate: 0.9 + Math.random() * 3 });
    }
  }
  for (const fx of [-1.9, 1.9]) {
    for (const fz of [-2.5, 2.5]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.3, 10), partMat);
      foot.position.set(fx, 0.15, fz);
      lab.add(foot);
    }
  }
  g.add(lab);

  // ---- the lamp: the scene needed a light source you can see ----
  const lamp = new THREE.Group();
  lamp.position.set(10.4, 0.28, -1.2);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.32, 20), chrome);
  lamp.add(lampBase);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 8, 12), chrome);
  post.position.y = 4;
  lamp.add(post);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.6, 12), chrome);
  arm.position.set(-2.7, 7.9, 0);
  arm.rotation.z = Math.PI / 2;
  lamp.add(arm);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 1.8, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x323b4a, roughness: 0.38, metalness: 0.65, side: THREE.DoubleSide, envMapIntensity: 1.5 })
  );
  shade.position.set(-5.4, 7.1, 0);
  lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe6bd, toneMapped: false }));
  bulb.position.set(-5.4, 6.5, 0);
  lamp.add(bulb);
  const lampGlow = glow(0xffc987, 17, 0.4);
  lampGlow.position.set(-5.4, 6.4, 0);
  lamp.add(lampGlow);
  // The pool of light it throws on the bench, so the lamp reads as lighting
  // something rather than just glowing.
  const pool = glow(0xffb870, 13, 0.2);
  pool.position.set(-5.4, 0.42, 0);
  pool.scale.set(13, 13, 1);
  lamp.add(pool);
  g.add(lamp);

  // ---- the clutter that makes a bench a bench ----
  const tray = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 1.8), partMat);
  tray.position.set(1.4, 0.5, 3.1);
  tray.rotation.y = 0.2;
  g.add(tray);
  const screws = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 7), chrome, 9);
  const sm = new THREE.Matrix4();
  for (let i = 0; i < 9; i++) {
    sm.makeTranslation(0.6 + Math.random() * 1.6, 0.74, 2.5 + Math.random() * 1.2);
    screws.setMatrixAt(i, sm);
  }
  g.add(screws);
  const driver = new THREE.Group();
  driver.position.set(-1.4, 0.42, 3.6);
  driver.rotation.y = -0.5;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 1.5, 12), emissive(0x241a0e, C.amber, 0.5));
  grip.rotation.z = Math.PI / 2;
  driver.add(grip);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.9, 8), chrome);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = 1.6;
  driver.add(shaft);
  g.add(driver);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.16, 8, 26), new THREE.MeshStandardMaterial({ color: 0x11151b, roughness: 0.85 }));
  coil.rotation.x = -Math.PI / 2;
  coil.position.set(-9.4, 0.44, 2.4);
  g.add(coil);

  for (const [bx, bz, bw, bh] of [[-6.5, 0.6, 3.4, 1.6], [-2.4, -0.8, 2.6, 2.2], [3.4, 0.4, 4, 1.3]]) {
    const spare = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 2.6), partMat);
    spare.position.set(bx, -3.25 + bh / 2, bz);
    spare.rotation.y = (Math.random() - 0.5) * 0.3;
    g.add(spare);
  }

  for (const [sx, sz, size] of [[-5.6, -0.3, 20], [5.6, 0.8, 15], [10.4, -1.2, 9]]) {
    const sh = shadowBlob(size, 0.5);
    sh.position.set(sx, 0.33, sz);
    g.add(sh);
  }

  const motes = dust(Math.round(q.particles * 0.3), { x: 32, y: 16, z: 22 }, 0xffd9a0, 0.055);
  motes.position.y = 5;
  g.add(motes);

  let spin = 0;
  g.userData.tick = ({ t, dt, p, boost }) => {
    spin += dt * (3 + smoothstep(0, 0.2, p) * 4 + boost * 18);
    cfSpin.rotation.z = spin;
    board.material.emissiveIntensity = 0.24 + Math.sin(t * 1.5) * 0.06;
    rgbTop.material.emissiveIntensity = 2.6 + Math.sin(t * 0.9) * 0.5;
    innerGlow.material.opacity = 0.26 + Math.sin(t * 0.9) * 0.05;
    lampGlow.material.opacity = 0.32 + Math.sin(t * 2.3) * 0.015;
    labLeds.forEach((l) => {
      l.led.scale.setScalar(0.65 + Math.abs(Math.sin(t * l.rate + l.phase)) * 0.75);
    });
  };
  return g;
}

/* ---------- zone 6: certification pedestals ---------- */

function certsZone(q) {
  const g = new THREE.Group();
  g.position.set(0, -30, -790);

  const badges = [];
  CERT_TAGS.forEach((name, i) => {
    const x = (i - 1) * 9;
    const holder = new THREE.Group();
    holder.position.set(x, -2, 0);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 3, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x3d4c68, metalness: 0.8, roughness: 0.24, envMapIntensity: 1.7 })
    );
    base.position.y = 0.8;
    holder.add(base);

    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0x33415c, metalness: 0.74, roughness: 0.3, envMapIntensity: 1.5 }));
    column.position.y = 3.1;
    holder.add(column);

    // An open ring, because none of these are closed out yet.
    const badge = new THREE.Mesh(
      new THREE.TorusGeometry(1.9, 0.17, 10, 44, Math.PI * 1.45),
      emissive(0x241a0e, C.amber, 2.4)
    );
    badge.position.y = 7;
    holder.add(badge);

    const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), emissive(0x241a0e, C.amberSoft, 2.2));
    inner.position.y = 7;
    holder.add(inner);

    const gl = glow(C.amber, 11, 0.32);
    gl.position.y = 7;
    holder.add(gl);

    const lb = label(name, { color: '#ffc96b', px: 38, height: 0.95 });
    lb.position.set(0, 10.4, 0);
    holder.add(lb);

    const sub = label('IN PROGRESS', { color: '#9aa7bd', px: 28, height: 0.6, sub: true });
    sub.position.set(0, 9.4, 0);
    holder.add(sub);

    g.add(holder);
    badges.push({ holder, badge, inner, gl, phase: i * 1.1, order: i });
  });

  g.userData.tick = ({ t, p }) => {
    badges.forEach((b) => {
      // They rise into place one after another as the section arrives.
      const rise = smoothstep(0.15 + b.order * 0.07, 0.45 + b.order * 0.07, p);
      b.holder.position.y = -2 - (1 - rise) * 9;
      b.badge.rotation.y = t * 0.5 + b.phase + (1 - rise) * 4.5;
      b.badge.rotation.z = Math.sin(t * 0.4 + b.phase) * 0.12;
      b.inner.rotation.x = t * 0.8;
      b.inner.rotation.y = t * 0.55;
      b.gl.material.opacity = (0.26 + Math.sin(t * 1.6 + b.phase) * 0.09) * rise;
    });
  };
  return g;
}

/* ---------- zone 7: the diorama ---------- */

function finaleZone(q) {
  const g = new THREE.Group();
  g.position.set(0, -34, -846);

  const deck = new THREE.Group();
  g.add(deck);

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(13, 11, 1.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x2c3e58, metalness: 0.68, roughness: 0.3, envMapIntensity: 1.5 })
  );
  deck.add(plate);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(13, 0.26, 8, 6), emissive(0x0d1830, C.blue, 2.8));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.6;
  deck.add(rim);

  const underGlow = glow(C.blue, 44, 0.26);
  underGlow.position.y = -1.2;
  deck.add(underGlow);

  const mini = new THREE.Group();
  mini.position.y = 0.6;
  mini.scale.setScalar(1.45);
  deck.add(mini);

  const miniDark = new THREE.MeshStandardMaterial({ color: 0x6b7f9e, metalness: 0.7, roughness: 0.26, envMapIntensity: 1.6 });

  // Each chapter, shrunk down and set on the deck.
  const board = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.2, 3.4), emissive(0x14263f, C.blue, 1.5));
  board.position.set(-6, 0.1, 2.4);
  mini.add(board);
  for (let i = 0; i < 3; i++) {
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.7), miniDark);
    chip.position.set(-7 + i * 1.1, 0.3, 2.4);
    mini.add(chip);
  }

  for (let i = 0; i < 6; i++) {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.6), miniDark);
    rack.position.set(-1.4 + (i % 3) * 0.95, 0.9, Math.floor(i / 3) * 1.5 + 2);
    mini.add(rack);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.04), new THREE.MeshBasicMaterial({ color: C.blueSoft, toneMapped: false }));
    led.position.set(rack.position.x + 0.37, 0.9, rack.position.z);
    mini.add(led);
  }

  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3, 0.16, 1.2), new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.8 }));
  deskTop.position.set(5.2, 0.6, 1.6);
  mini.add(deskTop);
  for (let i = 0; i < 2; i++) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc9a07a, roughness: 0.8 }));
    head.position.set(4.5 + i * 1.3, 1.1, 2.4);
    mini.add(head);
  }
  const warmGlow = glow(C.warm, 6, 0.4);
  warmGlow.position.set(5.2, 1.2, 1.6);
  mini.add(warmGlow);

  const orbCluster = [];
  for (let i = 0; i < 7; i++) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), emissive(0x0d1830, i % 3 === 2 ? C.amber : C.blue, 2.6));
    mini.add(o);
    orbCluster.push({ mesh: o, a: (i / 7) * Math.PI * 2, r: 1.5 + (i % 3) * 0.4, y: 2.6 + (i % 2) * 0.5 });
  }

  const path = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 7), emissive(0x16253d, C.blueSoft, 2.4));
  path.position.set(0, 0.1, -2.6);
  mini.add(path);

  for (let i = 0; i < 3; i++) {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.5, 6), miniDark);
    ped.position.set(-2 + i * 2, 0.35, -5.6);
    mini.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 20, Math.PI * 1.45), emissive(0x241a0e, C.amber, 2.2));
    ring.position.set(-2 + i * 2, 1.1, -5.6);
    mini.add(ring);
  }

  const motes = dust(Math.round(q.particles * 0.5), { x: 40, y: 26, z: 40 }, C.blueSoft, 0.06);
  g.add(motes);

  deck.rotation.x = -0.1;

  g.userData.tick = ({ t, p }) => {
    deck.rotation.y = t * 0.09;
    // The whole journey assembles on the deck as the last section arrives.
    const built = smoothstep(0.12, 0.5, p);
    mini.scale.setScalar(1.45 * Math.max(0.001, built));
    rim.material.emissiveIntensity = 1 + built * 1.9;
    underGlow.material.opacity = 0.26 * built;
    orbCluster.forEach((o) => {
      const a = o.a + t * 0.35;
      const r = o.r * (0.15 + built * 0.85);
      o.mesh.position.set(Math.cos(a) * r, (o.y + Math.sin(a * 2) * 0.2) * built, Math.sin(a) * r - 0.4);
    });
    motes.rotation.y = t * 0.01;
  };
  return g;
}

/* ---------- assembly ---------- */

export function buildWorld(q) {
  const zones = {
    hero: heroZone(q),
    hardware: hardwareZone(q),
    network: networkZone(q),
    helpdesk: helpdeskZone(q),
    skills: skillsZone(q),
    experience: experienceZone(q),
    projects: projectsZone(q),
    certifications: certsZone(q),
    contact: finaleZone(q)
  };
  for (const id in zones) {
    zones[id].traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (!m) return;
      if (o.isSprite || o.isPoints || o.isLine) return;
      if (m.transparent && m.opacity < 0.85) return;
      if (m.blending === THREE.AdditiveBlending) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });
  }
  return zones;
}
