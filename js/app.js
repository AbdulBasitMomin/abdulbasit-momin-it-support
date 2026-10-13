/* ------------------------------------------------------------------
   Scroll engine, camera rig and page wiring.
   Native scroll drives everything. Nothing is hijacked or locked.
   ------------------------------------------------------------------ */

import * as THREE from 'three';
import { buildWorld, C, smoothstep } from './scene.js';
import { SKILL_GROUPS, ORBS } from './content.js';

const body = document.body;
const loader = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderPct = document.getElementById('loader-pct');
const progressFill = document.getElementById('progress-fill');
const chapterLabel = document.getElementById('chapter-label');
const orbTip = document.getElementById('orb-tip');
const motionBtn = document.getElementById('motion-toggle');

const CHAPTERS = {
  hero: 'Intro', hardware: 'Hardware', network: 'Network', helpdesk: 'Helpdesk',
  skills: 'Toolkit', experience: 'Experience', projects: 'Projects',
  certifications: 'Certifications', contact: 'Contact'
};

/* ---------- 1. fill the skills lists from one source ---------- */

for (const group of SKILL_GROUPS) {
  const ul = document.getElementById(group.slot);
  if (!ul) continue;
  ul.innerHTML = group.items.map((s) => `<li data-skill="${s.toLowerCase()}">${s}</li>`).join('');
}

/* ---------- 2. reveal on scroll ---------- */

const revealables = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -18% 0px', threshold: 0.15 });
  revealables.forEach((el) => io.observe(el));
} else {
  revealables.forEach((el) => el.classList.add('is-in'));
}

/* ---------- 3. decide whether we can run the 3D at all ---------- */

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (err) { return false; }
}

function readStoredMotion() {
  try { return localStorage.getItem('am-motion'); } catch (err) { return null; }
}
function storeMotion(v) {
  try { localStorage.setItem('am-motion', v); } catch (err) { /* private mode, no harm */ }
}

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const stored = readStoredMotion();
let motionOff = stored ? stored === 'off' : prefersReduced;

function paintMotionButton() {
  motionBtn.setAttribute('aria-pressed', String(motionOff));
  motionBtn.querySelector('.mt-label').textContent = motionOff ? 'Motion off' : 'Motion on';
}
paintMotionButton();

function finishLoading() {
  loader.classList.add('done');
  body.classList.remove('is-loading');
  setTimeout(() => { loader.style.display = 'none'; }, 800);
}

if (!webglAvailable() || motionOff) {
  body.classList.add('static-mode');
  if (!webglAvailable()) body.classList.add('no-webgl');
  revealables.forEach((el) => el.classList.add('is-in'));
  finishLoading();
  motionBtn.addEventListener('click', () => {
    motionOff = !motionOff;
    storeMotion(motionOff ? 'off' : 'on');
    location.reload();
  });
} else {
  body.classList.add('is-loading');
  start();
}

/* ---------- 4. the 3D journey ---------- */

function start() {
  const isMobile = window.matchMedia('(max-width: 820px)').matches || navigator.maxTouchPoints > 1;
  const q = {
    particles: isMobile ? 260 : 780,
    racks: isMobile ? 5 : 7,
    tickets: isMobile ? 7 : 12,
    dpr: Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2),
    portrait: window.innerWidth / window.innerHeight < 0.8
  };

  const canvas = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(q.dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(C.bg, 0.0085);

  /* Metal is only metal because of what it reflects. With no environment at
     all, MeshStandardMaterial renders metal as near black, which is why the
     first pass had to dial metalness down to almost nothing and everything
     came out looking like matte plastic. This is a tiny procedural sky: dark
     overall, with a cool key on one side and a warm bounce on the other, so
     edges catch light the way real hardware does. */
  (function buildEnvironment() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 64);
    sky.addColorStop(0, '#1b2b4a');
    sky.addColorStop(0.45, '#0a1322');
    sky.addColorStop(1, '#04070e');
    g.fillStyle = sky;
    g.fillRect(0, 0, 128, 64);
    const key = g.createRadialGradient(30, 18, 0, 30, 18, 34);
    key.addColorStop(0, 'rgba(150,195,255,.95)');
    key.addColorStop(1, 'rgba(150,195,255,0)');
    g.fillStyle = key;
    g.fillRect(0, 0, 128, 64);
    const warm = g.createRadialGradient(100, 40, 0, 100, 40, 28);
    warm.addColorStop(0, 'rgba(255,196,120,.62)');
    warm.addColorStop(1, 'rgba(255,196,120,0)');
    g.fillStyle = warm;
    g.fillRect(0, 0, 128, 64);

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
  })();

  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 600);
  camera.position.set(-6, 1.5, 15);

  /* Three keeps the vertical field fixed, so a portrait phone ends up with a
     very narrow horizontal one and the scenes get cropped down the middle.
     Opening the vertical field back up on tall screens keeps roughly the same
     width in view. */
  const PORTRAIT_BELOW = 0.8;
  let portrait = false;

  function applyLens() {
    const a = window.innerWidth / window.innerHeight;
    portrait = a < PORTRAIT_BELOW;
    camera.aspect = a;
    camera.fov = Math.max(52, 2 * Math.atan(0.36 / a) * 180 / Math.PI);
    camera.updateProjectionMatrix();
  }
  applyLens();

  /* A fixed light rig. Positions and colours move per zone, the count
     never changes, so no shader recompiles mid flight. */
  const ambient = new THREE.AmbientLight(0x4f648c, 0.6);
  const hemi = new THREE.HemisphereLight(0x7c97cc, 0x12182a, 0.7);
  const key = new THREE.DirectionalLight(0xcfe0ff, 0.85);
  key.position.set(8, 20, 12);
  scene.add(ambient, hemi, key);
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const p = new THREE.PointLight(0xffffff, 0, 90, 2);
    scene.add(p);
    pts.push(p);
  }
  const headLight = new THREE.PointLight(0xcfe0ff, 0, 50, 2);
  scene.add(headLight);

  /* Streaks that only appear when you are moving fast. They live in the
     camera's own space, so they always read as speed past the lens. */
  const STREAKS = isMobile ? 26 : 60;
  const streakPos = new Float32Array(STREAKS * 6);
  const streakSeed = [];
  for (let i = 0; i < STREAKS; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.4 + Math.random() * 9;
    streakSeed.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z: -Math.random() * 70, len: 2 + Math.random() * 6 });
  }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  const streaks = new THREE.LineSegments(streakGeo, new THREE.LineBasicMaterial({
    color: 0xcfe0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  streaks.frustumCulled = false;
  streaks.visible = false;
  camera.add(streaks);
  scene.add(camera);

  /* ---------- camera choreography ---------- */
  const W = (px, py, pz, lx, ly, lz) => ({ p: new THREE.Vector3(px, py, pz), l: new THREE.Vector3(lx, ly, lz) });

  const SECTIONS = [
    {
      id: 'hero',
      way: [W(-7, 1.6, 15, 0, 0.4, -6), W(5.5, 2.4, 13.5, 0, 0.4, -6), W(3, 7, 11, 0, -5, -9)],
      pm: { lat: 0.42, dx: 0, back: 1.0, lift: 3.4 },
      head: [0x9fc4ff, 3, 42],
      mood: { fog: 0.0085, fogC: 0x050810, amb: 0.7, lights: [[0, 2, -4, C.blue, 3.2, 60], [-14, 6, 6, C.blue, 1.4, 50], [12, -4, 2, C.amber, 0.9, 45], [0, 10, -20, C.blueSoft, 1, 70]] }
    },
    {
      // Dive to the board, then track left to right across CPU, RAM, GPU.
      // The camera stays high enough that components never clip the lens.
      id: 'hardware',
      way: [
        W(3, 7, 11, 0, -5, -9),
        W(7, -26, 26, -4, -56, 10),
        W(1, -45, 21, -13, -58, 7),
        W(21, -45, 23, 8, -58, 4),
        W(27, -44, 6, 16, -58.5, -17),
        W(11, -50, -22, -2, -59, -56)
      ],
      pm: { lat: 0.3, dx: 0, back: 1.12, lift: 3.2 },
      head: [0xcfe0ff, 30, 50],
      mood: { fog: 0.0062, fogC: 0x060c18, amb: 0.5, lights: [[-13, -48, 10, C.blue, 70, 54], [16, -48, -18, C.amber, 48, 48], [9, -49, 4, C.blueSoft, 44, 44], [2, -40, -26, C.blue, 30, 70]] }
    },
    {
      // Straight down the aisle. Symmetry is the whole point of a server room.
      id: 'network',
      way: [
        W(11, -50, -22, -2, -59, -56),
        W(0, -57.5, -100, 0, -57.5, -142),
        W(-1.6, -57.4, -142, 0, -57.6, -184),
        W(1.6, -57.4, -186, 0, -57.6, -226),
        W(0, -57.4, -234, 0, -57.8, -276)
      ],
      pm: { lat: 0.5, dx: 0, back: 1.0, lift: 2.6 },
      head: [0xbcd4ff, 34, 44],
      mood: { fog: 0.0055, fogC: 0x0a1222, amb: 0.5, lights: [[-9, -53, -200, 0xff6a5d, 34, 42], [9, -53, -158, C.blue, 46, 46], [0, -50, -118, C.blueSoft, 40, 58], [0, -57, -268, C.warm, 55, 26]] }
    },
    {
      // Hold outside the ring of desks. Inside it the tickets fill the lens.
      id: 'helpdesk',
      way: [
        W(0, -57.4, -234, 0, -57.8, -276),
        W(0, -50, -272, 0, -56, -299),
        W(-21, -48, -280, 0, -56, -300),
        W(19, -47, -282, 0, -56, -301),
        W(0, -42, -296, 0, -34, -352)
      ],
      pm: { lat: 0.42, dx: 0, back: 1.22, lift: 2.4 },
      head: [0xffd2a0, 26, 50],
      mood: { fog: 0.0085, fogC: 0x1d1408, amb: 0.8, lights: [[0, -52, -300, C.warm, 90, 60], [-14, -52, -288, C.amber, 44, 42], [14, -52, -312, 0xffd9a0, 40, 42], [0, -58, -313, 0x3ddc84, 26, 28]] }
    },
    {
      // Camera sits left of the constellation, so the orbs read on the right
      // half of the screen and the skill lists own the left.
      id: 'skills',
      way: [
        W(0, -42, -296, 0, -34, -352),
        W(-9.6, -20, -390, -9.6, -20, -430),
        W(-11, -14, -394, -9.2, -18, -434),
        W(-9, -24, -389, -8, -22, -430),
        W(-10.5, -25, -406, -9, -25, -440),
        W(-15, -26, -444, -9, -29, -494)
      ],
      pm: { lat: 1, dx: 9.4, back: 1.18, lift: 0 },
      head: [0x9fc4ff, 12, 40],
      mood: { fog: 0.0075, fogC: 0x050a16, amb: 0.6, lights: [[0, -20, -430, C.blue, 44, 64], [14, -12, -420, C.blueSoft, 22, 54], [-12, -26, -440, C.amber, 18, 54], [0, -20, -398, C.blue, 14, 44]] }
    },
    {
      // Offset right of the road so the milestone cards have a dark backdrop
      // and the markers pass down the left side.
      id: 'experience',
      way: [
        W(-15, -26, -444, -9, -29, -494),
        W(6, -26, -506, 6, -30, -536),
        W(10.5, -26, -560, 6, -30, -598),
        W(8, -26, -622, 6, -30, -660),
        W(9, -25.5, -694, 4, -30, -748)
      ],
      pm: { lat: 0.4, dx: -6, back: 1.0, lift: 1.4 },
      head: [0xcfe0ff, 18, 46],
      mood: { fog: 0.0092, fogC: 0x060b17, amb: 0.5, lights: [[-11, -26, -560, C.blue, 44, 50], [-11, -26, -648, C.amber, 40, 50], [0, -22, -516, C.blueSoft, 28, 56], [0, -22, -700, C.blue, 28, 56]] }
    },
    {
      // The bench sits just past the end of the road, so the camera slows,
      // drops to bench height and looks across it before carrying on.
      id: 'projects',
      way: [
        W(9, -25.5, -694, 4, -30, -748),
        W(14, -26.5, -721, 8.5, -30.5, -744),
        W(13, -27.5, -730, 8, -31, -745),
        W(11.2, -28, -731, 7.5, -31, -746)
      ],
      pm: { lat: 0.5, dx: -1.8, back: 1.5, lift: -0.4 },
      head: [0xffd9a0, 22, 44],
      mood: { fog: 0.0082, fogC: 0x0b0c10, amb: 0.6, lights: [[11.5, -27.2, -746, 0xffc987, 58, 26], [0.9, -28.8, -745, 0x8fbcff, 48, 11], [8, -25, -730, 0xcfe0ff, 16, 28], [6, -32, -742, 0xffb87a, 16, 20]] }
    },
    {
      id: 'certifications',
      way: [
        W(11.2, -28, -731, 7.5, -31, -746),
        W(0, -25, -760, 0, -28.5, -790),
        W(0, -21, -752, 0, -28, -788)
      ],
      pm: { lat: 1, dx: 0, back: 1.08, lift: 1.6 },
      head: [0xffd9a0, 20, 42],
      mood: { fog: 0.0082, fogC: 0x0d0b0a, amb: 0.62, lights: [[0, -21, -784, C.amber, 64, 48], [-9, -24, -786, C.amberSoft, 32, 38], [9, -24, -786, C.amberSoft, 32, 38], [0, -26, -758, C.blue, 20, 44]] }
    },
    {
      // Pull back and look down, so the whole journey sits as a model
      // in the lower third of the frame.
      id: 'contact',
      way: [
        W(0, -21, -752, 0, -28, -788),
        W(0, -10, -772, 0, -21, -830),
        W(0, 0.4, -776, 0, -8.4, -846)
      ],
      pm: { lat: 1, dx: 0, back: 0.98, lift: -8 },
      head: [0xcfe0ff, 26, 64],
      mood: { fog: 0.0045, fogC: 0x050810, amb: 0.66, lights: [[0, -22, -846, C.blue, 90, 70], [-13, -28, -842, C.amber, 46, 44], [13, -28, -842, C.blueSoft, 46, 44], [0, -10, -820, C.blueSoft, 30, 70]] }
    }
  ];

  /* ---------- build the world, reporting honest progress ---------- */
  const zones = {};
  const order = SECTIONS.map((s) => s.id);

  function setProgress(v) {
    const n = Math.round(v * 100);
    loaderFill.style.width = n + '%';
    loaderPct.textContent = n;
  }

  /* buildWorld constructs every zone in one pass; the loader reports
     each group as it lands in the scene. */
  function buildAll() {
    const world = buildWorld(q);
    order.forEach((id, i) => {
      zones[id] = world[id];
      zones[id].visible = false;
      scene.add(zones[id]);
      setProgress((i + 1) / order.length);
    });
    requestAnimationFrame(afterBuild);
  }

  /* ---------- scroll bookkeeping ---------- */
  let bounds = [];
  let maxScroll = 1;

  function measure() {
    const docH = document.documentElement.scrollHeight;
    maxScroll = Math.max(1, docH - window.innerHeight);
    bounds = SECTIONS.map((s) => {
      const el = document.getElementById(s.id);
      return el ? el.offsetTop : 0;
    });
    bounds.push(maxScroll);
    // The final section ends at the bottom of the document.
    bounds[bounds.length - 1] = maxScroll;
  }

  const camPos = camera.position.clone();
  const camLook = new THREE.Vector3(0, 0.4, -6);
  const tPos = new THREE.Vector3();
  const tLook = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const moodFogC = new THREE.Color(C.bg);
  const tmpC = new THREE.Color();

  let activeIndex = 0;
  let lastChapter = '';

  /* How fast the page is moving, smoothed. Everything that should feel like
     speed reads from this: the streaks, the fan, the trace pulses, the road.
     A scene that ignores the scroll reads as a video playing behind glass. */
  let scrollSpeed = 0;
  let lastY = window.scrollY || 0;
  let boost = 0;
  let flow = 0;

  // Banking. A camera on a curve leans into it; one that stays level reads
  // like a rail, not a flight.
  const fwd = new THREE.Vector3();
  let prevYaw = null;
  let roll = 0;

  const tickCtx = { t: 0, dt: 0, flow: 0, boost: 0, p: 0, cam: camera.position };

  /* On a phone the pinned chapter title and the cards share the middle of the
     screen. The title hands over once the first card arrives, instead of
     ghosting behind it for the rest of the section. */
  const flashEl = document.getElementById('flash');
  let lastWash = -1;

  const fadingTitles = {};
  ['hardware', 'network', 'helpdesk', 'experience', 'projects'].forEach((id) => {
    const el = document.querySelector('#' + id + ' .chapter');
    if (el) fadingTitles[id] = el;
  });
  let fadedId = null;

  function handOverTitle(sec, p) {
    const el = fadingTitles[sec.id];
    if (fadedId && fadedId !== sec.id && fadingTitles[fadedId]) {
      fadingTitles[fadedId].style.opacity = '';
      fadedId = null;
    }
    if (!el) return;
    if (!portrait) { if (el.style.opacity) el.style.opacity = ''; return; }
    const k = Math.min(1, Math.max(0, (p - 0.17) / 0.2));
    el.style.opacity = (1 - k * 0.9).toFixed(3);
    fadedId = sec.id;
  }

  /* Every waypoint in the site becomes one continuous centripetal
     Catmull-Rom spline, for position and for the look-at target. Lerping
     between waypoints pair by pair made the camera slow to a stop at each
     one; on a spline the speed stays even all the way through, which is
     what makes the flight feel smooth rather than stepped. Sections share
     their boundary waypoint, so the seams are invisible. */
  const path = (() => {
    const pos = [], look = [], ranges = [];
    SECTIONS.forEach((sec) => {
      const start = Math.max(0, pos.length - 1);
      sec.way.forEach((pt, j) => {
        if (j === 0 && pos.length > 0) return;
        pos.push(pt.p);
        look.push(pt.l);
      });
      ranges.push([start, pos.length - 1]);
    });
    return {
      pos: new THREE.CatmullRomCurve3(pos, false, 'centripetal'),
      look: new THREE.CatmullRomCurve3(look, false, 'centripetal'),
      ranges,
      last: pos.length - 1
    };
  })();

  function sampleSection(idx, p) {
    const r = path.ranges[idx];
    const u = (r[0] + Math.max(0, Math.min(1, p)) * (r[1] - r[0])) / path.last;
    path.pos.getPoint(u, tPos);
    path.look.getPoint(u, tLook);
  }

  /* A phone sees a much narrower slice of the world than a laptop, so a shot
     framed for a wide screen arrives half cropped and sitting under the text.
     Each section carries four numbers that re-frame it for a tall screen:
     how much of the sideways swing to keep, how far to shift the aim back
     onto the subject, how far to pull back, and how far to drop the subject
     down the frame so the copy above it stays clear. */
  const PM_DEFAULT = { lat: 0.35, dx: 0, back: 1.1, lift: 0 };

  function framePortrait(sec) {
    const pm = sec.pm || PM_DEFAULT;
    tPos.x = tLook.x + (tPos.x - tLook.x) * pm.lat;
    tmpV.subVectors(tPos, tLook).multiplyScalar(pm.back);
    tPos.copy(tLook).add(tmpV);
    tPos.x += pm.dx;
    tLook.x += pm.dx;
    tLook.y += pm.lift;
  }

  function applyMood(sec, k) {
    const mood = sec.mood;
    tmpC.setHex(sec.head[0]);
    headLight.color.lerp(tmpC, k);
    headLight.intensity += (sec.head[1] - headLight.intensity) * k;
    headLight.distance = sec.head[2];
    ambient.intensity += (mood.amb - ambient.intensity) * k;
    scene.fog.density += (mood.fog - scene.fog.density) * k;
    tmpC.setHex(mood.fogC);
    moodFogC.lerp(tmpC, k);
    scene.fog.color.copy(moodFogC);
    mood.lights.forEach((L, i) => {
      const p = pts[i];
      p.position.x += (L[0] - p.position.x) * k;
      p.position.y += (L[1] - p.position.y) * k;
      p.position.z += (L[2] - p.position.z) * k;
      tmpC.setHex(L[3]);
      p.color.lerp(tmpC, k);
      p.intensity += (L[4] - p.intensity) * k;
      p.distance = L[5];
    });
  }

  /* ---------- orb interaction ---------- */
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-5, -5);
  let hovered = -1;
  let pointerLive = false;

  // The overlay sits above the canvas, so pointer events are read from the
  // window rather than from the canvas itself.
  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    pointerLive = true;
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    pointerLive = true;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointerLive = false; });

  function clearHover() {
    if (hovered !== -1) {
      orbTip.classList.remove('on');
      document.querySelectorAll('.skill-group li.lit').forEach((li) => li.classList.remove('lit'));
      hovered = -1;
    }
  }

  function normalize(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function setHover(index, screenX, screenY) {
    if (index === hovered) {
      orbTip.style.left = screenX + 'px';
      orbTip.style.top = screenY + 'px';
      return;
    }
    clearHover();
    hovered = index;
    const o = ORBS[index];
    orbTip.querySelector('strong').textContent = o.label;
    orbTip.querySelector('span').textContent = o.note;
    orbTip.style.left = screenX + 'px';
    orbTip.style.top = screenY + 'px';
    orbTip.classList.add('on');
    const want = normalize(o.label);
    document.querySelectorAll('.skill-group li').forEach((li) => {
      if (normalize(li.textContent) === want) li.classList.add('lit');
    });
  }

  const projected = new THREE.Vector3();

  function pickOrbs() {
    const sk = zones.skills;
    if (!sk || !sk.visible || !pointerLive || SECTIONS[activeIndex].id !== 'skills') { clearHover(); return; }
    ray.setFromCamera(pointer, camera);
    const meshes = sk.userData.orbs.map((o) => o.hit);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) { clearHover(); return; }
    const idx = hit.object.userData.orbIndex;
    hit.object.getWorldPosition(projected);
    projected.project(camera);
    setHover(idx,
      (projected.x * 0.5 + 0.5) * window.innerWidth,
      (-projected.y * 0.5 + 0.5) * window.innerHeight);
  }

  /* ---------- the loop ---------- */
  let running = false;
  let last = performance.now();

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    const y = window.scrollY || window.pageYOffset || 0;

    const rawSpeed = Math.abs(y - lastY) / Math.max(dt, 0.004);
    lastY = y;
    scrollSpeed += (rawSpeed - scrollSpeed) * (1 - Math.exp(-7 * dt));
    boost = Math.min(1, scrollSpeed / 2400);
    flow += dt * (1 + boost * 2.6);

    let idx = 0;
    for (let i = 0; i < SECTIONS.length; i++) {
      if (y >= bounds[i] - 1) idx = i;
    }
    activeIndex = idx;
    const span = Math.max(1, bounds[idx + 1] - bounds[idx]);
    const p = Math.max(0, Math.min(1, (y - bounds[idx]) / span));

    const sec = SECTIONS[idx];
    sampleSection(idx, p);
    if (portrait) framePortrait(sec);

    // Exponential smoothing: frame rate independent, and it keeps the
    // camera from snapping when someone flings the scrollbar.
    const k = 1 - Math.exp(-4.6 * dt);
    camPos.lerp(tPos, k);
    camLook.lerp(tLook, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // Lean into the turn, by how fast the aim is swinging.
    fwd.subVectors(camLook, camPos).normalize();
    const yaw = Math.atan2(fwd.x, fwd.z);
    if (prevYaw === null) prevYaw = yaw;
    let dYaw = yaw - prevYaw;
    if (dYaw > Math.PI) dYaw -= Math.PI * 2;
    else if (dYaw < -Math.PI) dYaw += Math.PI * 2;
    prevYaw = yaw;
    const bank = Math.max(-0.1, Math.min(0.1, (dYaw / Math.max(dt, 0.004)) * 0.42));
    roll += (bank - roll) * (1 - Math.exp(-3.2 * dt));

    // A hand on the camera, scaled to how far away the subject is so it reads
    // the same whether the shot is close on a chip or wide on a server room.
    const reach = camPos.distanceTo(camLook);
    const sway = 0.0032 * reach;
    camera.translateX((Math.sin(t * 0.37) * 0.6 + Math.sin(t * 0.73) * 0.3) * sway);
    camera.translateY((Math.cos(t * 0.43) * 0.6 + Math.sin(t * 0.87) * 0.25) * sway);
    camera.rotateZ(roll + Math.sin(t * 0.29) * 0.004);
    headLight.position.copy(camera.position);

    applyMood(sec, 1 - Math.exp(-2.4 * dt));

    tickCtx.t = t;
    tickCtx.dt = dt;
    tickCtx.flow = flow;
    tickCtx.boost = boost;
    for (let i = 0; i < order.length; i++) {
      const vis = i === idx || (i === idx - 1 && p < 0.22) || (i === idx + 1 && p > 0.78);
      const z = zones[order[i]];
      if (z.visible !== vis) z.visible = vis;
      if (vis && z.userData.tick) {
        // A scene you have left is fully arrived; one ahead has not started.
        tickCtx.p = i === idx ? p : (i < idx ? 1 : 0);
        z.userData.tick(tickCtx);
      }
    }

    // Speed streaks, and a doorway that blows out as you pass through it.
    const wantStreak = Math.min(0.42, Math.max(0, boost - 0.2) * 0.85);
    streaks.material.opacity += (wantStreak - streaks.material.opacity) * (1 - Math.exp(-6 * dt));
    streaks.visible = streaks.material.opacity > 0.012;
    if (streaks.visible) {
      for (let i = 0; i < STREAKS; i++) {
        const sd = streakSeed[i];
        sd.z += dt * (34 + boost * 280);
        if (sd.z > 3) { sd.z = -74 - Math.random() * 24; }
        const len = sd.len * (0.45 + boost * 2.4);
        const o = i * 6;
        streakPos[o] = sd.x; streakPos[o + 1] = sd.y; streakPos[o + 2] = sd.z;
        streakPos[o + 3] = sd.x; streakPos[o + 4] = sd.y; streakPos[o + 5] = sd.z - len;
      }
      streakGeo.attributes.position.needsUpdate = true;
    }
    renderer.toneMappingExposure = 1.18 + boost * 0.1;

    let wash = 0;
    if (sec.id === 'network') wash = smoothstep(0.9, 1, p);
    else if (sec.id === 'helpdesk') wash = 1 - smoothstep(0, 0.1, p);
    if (wash !== lastWash) {
      flashEl.style.opacity = (wash * 0.6).toFixed(3);
      lastWash = wash;
    }

    handOverTitle(sec, p);
    pickOrbs();

    progressFill.style.width = (y / maxScroll * 100).toFixed(2) + '%';
    const ch = CHAPTERS[sec.id];
    if (ch !== lastChapter) { chapterLabel.textContent = ch; lastChapter = ch; }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function afterBuild() {
    measure();
    sampleSection(0, 0);
    if (portrait) framePortrait(SECTIONS[0]);
    camPos.copy(tPos);
    camLook.copy(tLook);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
    setTimeout(finishLoading, 320);
  }

  /* ---------- resize ---------- */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    applyLens();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 160);
  });

  // Sections grow as fonts land and reveals fire, so re-measure then too.
  window.addEventListener('load', () => setTimeout(measure, 120));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(measure, 60));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; }
    else if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  });

  motionBtn.addEventListener('click', () => {
    motionOff = true;
    storeMotion('off');
    location.reload();
  });

  setProgress(0.06);
  requestAnimationFrame(buildAll);
}
