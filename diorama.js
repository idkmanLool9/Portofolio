/*
  Diorama: a small lit voxel island rendered with Three.js.
  Used as placeholder art in the hero until real work goes in.

  createDiorama(container, options) -> { rebuild(), destroy() } or null when WebGL is unavailable.
*/
import * as THREE from "./assets/vendor/three.min.js";

const rand = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const smooth = (t) => t * t * (3 - 2 * t);

function heightmap(n, maxH, r) {
  const C = 3;
  const g = Array.from({ length: C + 1 }, () => Array.from({ length: C + 1 }, r));
  const out = [];
  for (let x = 0; x < n; x++) {
    out.push([]);
    for (let z = 0; z < n; z++) {
      const u = (x / (n - 1)) * C;
      const v = (z / (n - 1)) * C;
      const i = Math.min(C - 1, Math.floor(u));
      const j = Math.min(C - 1, Math.floor(v));
      const fu = smooth(u - i);
      const fv = smooth(v - j);
      const val =
        g[i][j] * (1 - fu) * (1 - fv) + g[i + 1][j] * fu * (1 - fv) +
        g[i][j + 1] * (1 - fu) * fv + g[i + 1][j + 1] * fu * fv;
      const dx = (x / (n - 1)) * 2 - 1;
      const dz = (z / (n - 1)) * 2 - 1;
      const d = Math.max(Math.hypot(dx, dz), Math.max(Math.abs(dx), Math.abs(dz)) * 1.02);
      const e = val * 0.85 + 0.62 - d * 1.02;
      out[x].push(e < 0.16 ? 0 : Math.max(1, Math.min(maxH, Math.round((e - 0.08) * maxH * 1.45))));
    }
  }
  return out;
}

const easeOutBack = (t) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeInCubic = (t) => t * t * t;

export const PALETTE = {
  land: "#f4f2ec",
  landLow: "#e7e6f1",
  base: "#cfd2f2",
  water: "#3b4ce6",
  leaf: "#2536d6",
  leafDark: "#1b28ad",
  trunk: "#1b2499",
  rock: "#dcdcea",
  shadow: "#0a1160",
};

export function createDiorama(container, opts = {}) {
  const {
    n = 13,
    maxH = 6,
    seed: seed0 = 7,
    focus = () => ({ x: 0.5, y: 0.5, scale: 1 }),
    reduceMotion = false,
    angle: angle0 = -0.35,
    float = true,
  } = opts;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  camera.position.set(60, 52, 60);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3243d8, 1.45));
  const sun = new THREE.DirectionalLight(0xfff3e4, 2.3);
  sun.position.set(-16, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 7;
  sun.shadow.blurSamples = 16;
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.ShadowMaterial({ color: PALETTE.shadow, opacity: 0.26 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -5.2;
  floor.receiveShadow = true;
  scene.add(floor);

  const world = new THREE.Group();
  scene.add(world);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const mats = {
    land: new THREE.MeshLambertMaterial({ color: 0xffffff }),
    water: new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.28, metalness: 0, transparent: true, opacity: 0.94 }),
    leaf: new THREE.MeshLambertMaterial({ color: 0xffffff }),
    trunk: new THREE.MeshLambertMaterial({ color: PALETTE.trunk }),
  };

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  let meshes = [];
  let items = [];
  let buildStart = 0;
  let building = false;
  let leaving = null;
  let seed = seed0;

  function build(s) {
    const r = rand(s * 9973 + 17);
    const H = heightmap(n, maxH, r);
    const half = (n - 1) / 2;
    const groups = { land: [], water: [], leaf: [], trunk: [] };
    const push = (kind, x, y, z, sx, sy, sz, color, d) => groups[kind].push({ x, y, z, sx, sy, sz, color, d });

    for (let x = 0; x < n; x++) {
      for (let z = 0; z < n; z++) {
        const h = H[x][z];
        const px = x - half;
        const pz = z - half;
        const dist = Math.hypot(px, pz);
        const d = dist * 55 + r() * 120;
        const jitter = () => (r() - 0.5) * 0.035;

        // Two layers of base under every cell, like a cut-out chunk of ground.
        for (let y = -2; y <= -1; y++) {
          tmpColor.set(PALETTE.base).offsetHSL(0, 0, jitter());
          push("land", px, y, pz, 0.97, 0.97, 0.97, tmpColor.getHex(), d * 0.6);
        }

        if (h === 0) {
          push("water", px, -0.22, pz, 1, 0.56, 1, null, d * 0.7 + 80);
          continue;
        }

        for (let y = 0; y < h; y++) {
          const top = y === h - 1;
          tmpColor.set(top ? PALETTE.land : PALETTE.landLow).offsetHSL(0, 0, jitter());
          push("land", px, y, pz, 0.97, 0.97, 0.97, tmpColor.getHex(), d + y * 45);
        }

        const surface = h - 0.5;
        if (h >= 2 && r() < 0.15) {
          const tall = 0.7 + r() * 0.5;
          const td = d + h * 45 + 160;
          push("trunk", px, surface + tall / 2, pz, 0.18, tall, 0.18, null, td);
          const s1 = 0.72 + r() * 0.12;
          tmpColor.set(r() < 0.5 ? PALETTE.leaf : PALETTE.leafDark);
          push("leaf", px, surface + tall + s1 / 2 - 0.05, pz, s1, s1, s1, tmpColor.getHex(), td + 80);
          if (r() < 0.6) {
            const s2 = s1 * 0.55;
            push("leaf", px, surface + tall + s1 + s2 / 2 - 0.08, pz, s2, s2, s2, tmpColor.getHex(), td + 140);
          }
        } else if (r() < 0.05) {
          const s3 = 0.3 + r() * 0.15;
          tmpColor.set(PALETTE.rock);
          push("land", px + (r() - 0.5) * 0.4, surface + s3 / 2, pz + (r() - 0.5) * 0.4, s3, s3 * 0.8, s3, tmpColor.getHex(), d + h * 45 + 200);
        }
      }
    }

    const next = [];
    const nextItems = [];
    for (const [kind, list] of Object.entries(groups)) {
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(box, mats[kind], list.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = kind !== "water";
      mesh.receiveShadow = true;
      list.forEach((it, i) => {
        if (it.color != null) mesh.setColorAt(i, tmpColor.set(it.color));
        it.mesh = mesh;
        it.i = i;
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      next.push(mesh);
      nextItems.push(...list);
    }
    return { meshes: next, items: nextItems };
  }

  const DROP = 9;
  const DUR = 900;

  function place(it, p) {
    // p: 0 = above and invisible, 1 = settled
    const e = p <= 0 ? 0 : p >= 1 ? 1 : easeOutBack(p);
    const s = p <= 0 ? 0.0001 : 1;
    dummy.position.set(it.x, it.y + (1 - e) * DROP, it.z);
    dummy.scale.set(it.sx * s, it.sy * s, it.sz * s);
    dummy.updateMatrix();
    it.mesh.setMatrixAt(it.i, dummy.matrix);
  }

  function lift(it, p) {
    // leaving: sink and shrink
    const e = easeInCubic(Math.min(1, Math.max(0, p)));
    const s = Math.max(0.0001, 1 - e);
    dummy.position.set(it.x, it.y - e * 3, it.z);
    dummy.scale.set(it.sx * s, it.sy * s, it.sz * s);
    dummy.updateMatrix();
    it.mesh.setMatrixAt(it.i, dummy.matrix);
  }

  function show(s, animate) {
    const built = build(s);
    meshes = built.meshes;
    items = built.items;
    meshes.forEach((m) => world.add(m));
    items.forEach((it) => place(it, animate ? 0 : 1));
    meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    building = animate;
    buildStart = performance.now() + 120;
  }

  // ----- framing -----

  let width = 1;
  let height = 1;

  function resize() {
    const rect = container.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    frame();
  }

  function frame() {
    const f = focus(width, height);
    const aspect = width / height;
    // Fit the island: its screen footprint is roughly n * 1.45 units wide.
    const viewH = (n * 1.45) / (f.scale * Math.min(aspect, 1.0) * 0.98);
    const viewW = viewH * aspect;
    camera.left = -f.x * viewW;
    camera.right = (1 - f.x) * viewW;
    camera.top = f.y * viewH;
    camera.bottom = f.y * viewH - viewH;
    camera.updateProjectionMatrix();
  }

  // ----- interaction + loop -----

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let angle = angle0;
  let last = performance.now();
  let running = false;
  let visible = true;
  let raf = 0;

  function tick(now) {
    raf = 0;
    const dt = Math.min(64, now - last);
    last = now;

    if (!reduceMotion) angle += dt * 0.00006;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    world.rotation.y = angle + pointer.x * 0.35;
    world.rotation.x = pointer.y * 0.06;
    world.position.y = reduceMotion || !float ? 0 : Math.sin(now * 0.0009) * 0.25;

    if (building) {
      const t = now - buildStart;
      let done = true;
      for (const it of items) {
        const p = (t - it.d) / DUR;
        if (p < 1) done = false;
        place(it, p);
      }
      meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
      if (done) building = false;
    }

    if (leaving) {
      const t = now - leaving.start;
      let done = true;
      for (const it of leaving.items) {
        const p = (t - it.d * 0.25) / 420;
        if (p < 1) done = false;
        lift(it, p);
      }
      leaving.meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
      if (done) {
        leaving.meshes.forEach((m) => { world.remove(m); m.dispose(); });
        leaving = null;
      }
    }

    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    visible ? start() : stop();
  });
  io.observe(container);

  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVis);

  const onMove = (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  const ro = new ResizeObserver(resize);
  ro.observe(container);

  show(seed, !reduceMotion);
  resize();
  start();

  return {
    rebuild() {
      seed += 1 + Math.floor(Math.random() * 97);
      if (reduceMotion) {
        meshes.forEach((m) => { world.remove(m); m.dispose(); });
        show(seed, false);
        renderer.render(scene, camera);
        return;
      }
      if (leaving) leaving.meshes.forEach((m) => { world.remove(m); m.dispose(); });
      leaving = { meshes, items, start: performance.now() };
      show(seed, true);
      buildStart = performance.now() + 260;
      start();
    },
    destroy() {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      renderer.dispose();
    },
  };
}
