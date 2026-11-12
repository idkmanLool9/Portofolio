/*
  world.js: the live voxel landscape in the hero frame.
  A slow camera glides over a looping world, rendered with WebGL2 and
  shaded through one ramp from deep ink to paper. It stands in for a
  showreel until real footage exists. Falls back to voxel.js art without
  WebGL2. Pauses when hidden, off screen, or when the visitor presses Pause.
*/
(() => {
  "use strict";

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const frame = document.querySelector(".frame");
  const canvas = frame.querySelector("canvas");
  const playBtn = document.querySelector(".play");
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: false, depth: true, powerPreference: "high-performance" });

  function fallback() {
    canvas.remove();
    const d = document.createElement("div");
    d.className = "fallback";
    // A cropped, treeless stretch of terrain, so it reads as land rather than an island.
    if (window.Voxel) d.innerHTML = window.Voxel.render({ n: 24, seed: 7, maxH: 7, trees: 0, pal: window.Voxel.PALETTES.ink });
    frame.appendChild(d);
    document.querySelector("[data-live]").hidden = true;
  }
  if (!gl) { fallback(); return; }

  // ---------- World ----------

  const NX = 128;  // tile width in cells, periodic along x (the camera travels along x)
  const NZ = 208;  // tile depth in cells
  const CH = 16;   // chunk size for culling
  const HS = 4;    // heightmap samples per cell
  const SS = 8;    // shadow texels per cell

  const smooth = (t) => t * t * (3 - 2 * t);
  const sstep = (a, b, x) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));
  const hash = (x, z, s) => {
    let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(s, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const wrap = (a, p) => ((a % p) + p) % p;
  function vnoise(u, v, P, s) {
    const iu = Math.floor(u), iv = Math.floor(v);
    const fu = smooth(u - iu), fv = smooth(v - iv);
    const a = hash(wrap(iu, P), iv, s), b = hash(wrap(iu + 1, P), iv, s);
    const c = hash(wrap(iu, P), iv + 1, s), d = hash(wrap(iu + 1, P), iv + 1, s);
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
  }
  // Periodic in x only.
  function fbm(x, z, s, oct = 5, base = 4) {
    let v = 0, amp = 0.5, tot = 0;
    for (let o = 0; o < oct; o++) {
      const P = base << o;
      v += amp * vnoise((x / NX) * P, (z / NX) * P, P, s + o * 31);
      tot += amp;
      amp *= 0.5;
    }
    return v / tot;
  }
  const riverZ = (x) => {
    const a = (x / NX) * Math.PI * 2;
    return 84 + Math.sin(a * 2 + 0.7) * 8 + Math.sin(a * 3 + 2.2) * 4;
  };

  const top = new Float32Array(NX * NZ);
  const water = new Uint8Array(NX * NZ);
  const tree = new Float32Array(NX * NZ);
  const tcx = new Float32Array(NX * NZ), tcz = new Float32Array(NX * NZ);
  const I = (x, z) => z * NX + wrap(x, NX);

  for (let z = 0; z < NZ; z++) {
    for (let x = 0; x < NX; x++) {
      // Composed in depth: a low bank in front, the river across the lower
      // third, meadows and forest rising behind it, then hills, then a range
      // far back in the haze.
      // Lowlands on three flat levels, so they read as calm planes.
      const b = fbm(x, z, 11, 3);
      let h = b > 0.6 ? 2 : b < 0.38 ? 0 : 1;
      h += Math.max(0, fbm(x, z, 23, 4) - 0.53) * 30;
      h += sstep(104, 140, z) * Math.max(0, fbm(x, z, 29, 4) - 0.4) * 26;
      const r = 1 - Math.abs(fbm(x, z, 41, 4, 2) * 2 - 1);
      h += sstep(140, 190, z) * (r * r * 12 + 3);
      const d = Math.abs(z + 0.5 - riverZ(x + 0.5));
      // Flat banks, so the water meets the land with one low step.
      h = d < 2.4 ? -1 : Math.min(h, 1 + Math.max(0, (d - 5) * 0.4));
      const hi = Math.round(h);
      const i = z * NX + x;
      if (hi < 0) { water[i] = 1; top[i] = -0.3; }
      else top[i] = Math.min(30, hi);
    }
  }

  // Pines, clustered into forests, plus a few loners.
  for (let z = 2; z < NZ - 1; z++) {
    for (let x = 0; x < NX; x++) {
      const i = z * NX + x;
      if (water[i] || top[i] > 12) continue;
      if (water[I(x + 1, z)] || water[I(x - 1, z)] || water[I(x, z + 1)] || water[I(x, z - 1)]) continue;
      const f = fbm(x + 40, z, 57, 3);
      const r = hash(x, z, 99);
      if (f > 0.58 && r < 0.6) {
        tree[i] = 1.6 + hash(x, z, 5) * 2.0;
        tcx[i] = x + 0.5 + (hash(x, z, 6) - 0.5) * 0.22;
        tcz[i] = z + 0.5 + (hash(x, z, 7) - 0.5) * 0.22;
      }
    }
  }

  // A few built things: bridges over the river and some cabins.
  const solids = [];
  const solid = (x0, z0, x1, z1, y0, y1, m) => solids.push({ x0, z0, x1, z1, y0, y1, m });
  const clearTrees = (x0, z0, x1, z1) => {
    for (let z = Math.max(0, z0); z <= Math.min(NZ - 1, z1); z++) for (let x = x0; x <= x1; x++) tree[I(x, z)] = 0;
  };
  for (const bx of [14, 58, 101]) {
    let zA = -1, zB = -1;
    for (let z = 40; z < 120; z++) if (water[I(bx, z)] || water[I(bx + 1, z)]) { if (zA < 0) zA = z; zB = z; }
    if (zA < 0) continue;
    const a = zA - 1, b = zB + 1;
    const y = Math.max(top[I(bx, a)], top[I(bx + 1, a)], top[I(bx, b)], top[I(bx + 1, b)]) + 0.3;
    const x0 = bx + 0.15, x1 = bx + 1.85;
    solid(x0, a + 0.3, x1, b + 0.7, y - 0.22, y, 5);
    solid(x0, a + 0.3, x0 + 0.1, b + 0.7, y, y + 0.42, 5);
    solid(x1 - 0.1, a + 0.3, x1, b + 0.7, y, y + 0.42, 5);
    for (let z = zA; z <= zB; z += 2) {
      solid(x0 + 0.05, z + 0.4, x0 + 0.25, z + 0.6, -0.8, y - 0.22, 5);
      solid(x1 - 0.25, z + 0.4, x1 - 0.05, z + 0.6, -0.8, y - 0.22, 5);
    }
    clearTrees(bx - 1, a - 2, bx + 2, b + 2);
  }
  const cabins = [];
  for (let z = 56; z < 112 && cabins.length < 8; z++) {
    for (let x = 0; x < NX - 3; x++) {
      if (hash(x, z, 313) > 0.02) continue;
      const h = top[I(x, z)];
      if (h > 9) continue;
      let ok = true;
      for (let dz = -1; dz <= 2 && ok; dz++) for (let dx = -1; dx <= 2 && ok; dx++) {
        const j = I(x + dx, z + dz);
        if (water[j] || top[j] !== h) ok = false;
      }
      if (!ok || cabins.some((c) => Math.abs(c[0] - x) < 12 && Math.abs(c[1] - z) < 12)) continue;
      cabins.push([x, z]);
      // Paper walls, an ink roof with its stepped gable facing the camera, a door.
      const y = h;
      solid(x + 0.3, z + 0.35, x + 1.7, z + 1.75, y, y + 0.95, 4);
      solid(x + 0.15, z + 0.2, x + 1.85, z + 1.9, y + 0.95, y + 1.17, 6);
      solid(x + 0.45, z + 0.2, x + 1.55, z + 1.9, y + 1.17, y + 1.39, 6);
      solid(x + 0.75, z + 0.2, x + 1.25, z + 1.9, y + 1.39, y + 1.61, 6);
      solid(x + 1.32, z + 1.2, x + 1.52, z + 1.4, y + 1.1, y + 1.8, 4);
      solid(x + 0.86, z + 0.31, x + 1.14, z + 0.35, y, y + 0.55, 6);
      clearTrees(x - 1, z - 1, x + 2, z + 2);
    }
  }

  // ---------- Mesh, built in chunks for culling ----------

  const P = [], A = [], B = [], E = [];
  let vc = 0;
  function quad(a, b, c, d, n, m, ao, base) {
    const vs = [a, b, c, d];
    for (let k = 0; k < 4; k++) {
      P.push(vs[k][0], vs[k][1], vs[k][2]);
      A.push(n, m, ao ? ao[k] : 255, 0);
      B.push(base);
    }
    if (ao && ao[0] + ao[2] < ao[1] + ao[3]) E.push(vc + 1, vc + 2, vc + 3, vc + 1, vc + 3, vc);
    else E.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
    vc += 4;
  }
  const topAt = (x, z) => (z < 0 || z >= NZ ? -4 : top[I(x, z)]);
  const AO = [130, 175, 215, 255];
  const aoc = (h, s1, s2, c) => {
    const a = s1 > h ? 1 : 0, b = s2 > h ? 1 : 0, cc = c > h ? 1 : 0;
    return AO[a && b ? 0 : 3 - (a + b + cc)];
  };
  function box(cx, cz, y0, y1, hw, m) {
    const x0 = cx - hw, x1 = cx + hw, z0 = cz - hw, z1 = cz + hw;
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], 0, m, null, y0);
    quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], 1, m, null, y0);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], 2, m, null, y0);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 3, m, null, y0);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], 4, m, null, y0);
  }

  function cell(x, z) {
    const i = z * NX + x;
    const h = top[i];
    const m = water[i] ? 1 : 0;
    let lo = h, hi = h;
    if (m === 1) {
      quad([x, h, z], [x + 1, h, z], [x + 1, h, z + 1], [x, h, z + 1], 0, 1, null, h);
    } else {
      const t = (dx, dz) => topAt(x + dx, z + dz);
      quad([x, h, z], [x + 1, h, z], [x + 1, h, z + 1], [x, h, z + 1], 0, 0, [
        aoc(h, t(-1, 0), t(0, -1), t(-1, -1)),
        aoc(h, t(1, 0), t(0, -1), t(1, -1)),
        aoc(h, t(1, 0), t(0, 1), t(1, 1)),
        aoc(h, t(-1, 0), t(0, 1), t(-1, 1)),
      ], h);
    }
    let n;
    if ((n = topAt(x + 1, z)) < h) { quad([x + 1, n, z], [x + 1, n, z + 1], [x + 1, h, z + 1], [x + 1, h, z], 1, m, null, n); lo = Math.min(lo, n); }
    if ((n = topAt(x - 1, z)) < h) { quad([x, n, z], [x, n, z + 1], [x, h, z + 1], [x, h, z], 2, m, null, n); lo = Math.min(lo, n); }
    if ((n = topAt(x, z + 1)) < h) { quad([x, n, z + 1], [x + 1, n, z + 1], [x + 1, h, z + 1], [x, h, z + 1], 3, m, null, n); lo = Math.min(lo, n); }
    if ((n = topAt(x, z - 1)) < h) { quad([x, n, z], [x + 1, n, z], [x + 1, h, z], [x, h, z], 4, m, null, n); lo = Math.min(lo, n); }

    const T = tree[i];
    if (T) {
      const cx = tcx[i], cz = tcz[i], s = T / 3;
      box(cx, cz, h, h + 0.7, 0.09, 3);
      box(cx, cz, h + 0.45, h + 0.45 + 1.0 * s, 0.42, 2);
      box(cx, cz, h + 0.45 + 0.85 * s, h + 0.45 + 1.75 * s, 0.30, 2);
      box(cx, cz, h + 0.45 + 1.6 * s, h + 0.45 + 2.35 * s, 0.17, 2);
      tree[i] = h + 0.45 + 2.35 * s;
      hi = tree[i];
    }
    return [lo, hi];
  }

  function cuboid(x0, z0, x1, z1, y0, y1, m) {
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], 0, m, null, y0);
    quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], 1, m, null, y0);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], 2, m, null, y0);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 3, m, null, y0);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], 4, m, null, y0);
  }

  const chunks = [];
  for (let cz = 0; cz < NZ; cz += CH) {
    for (let cx = 0; cx < NX; cx += CH) {
      const start = E.length;
      let lo = 99, hi = -99;
      for (let z = cz; z < Math.min(NZ, cz + CH); z++) {
        for (let x = cx; x < cx + CH; x++) {
          const r = cell(x, z);
          lo = Math.min(lo, r[0]);
          hi = Math.max(hi, r[1]);
        }
      }
      chunks.push({ x0: cx, x1: cx + CH, z0: cz, z1: Math.min(NZ, cz + CH), y0: Math.max(-4, lo), y1: hi, start, count: E.length - start });
    }
  }
  for (const b of solids) {
    const start = E.length;
    cuboid(b.x0, b.z0, b.x1, b.z1, b.y0, b.y1, b.m);
    chunks.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: b.y0, y1: b.y1, start, count: E.length - start });
  }

  // Heightmap: R = ground top, G = occluder top (trees as cones).
  const HX = NX * HS, HZ = NZ * HS;
  const hm = new Float32Array(HX * HZ * 2);
  for (let j = 0; j < HZ; j++) {
    for (let k = 0; k < HX; k++) {
      const wx = (k + 0.5) / HS, wz = (j + 0.5) / HS;
      const i = Math.floor(wz) * NX + Math.floor(wx);
      const g = top[i];
      let o = g;
      if (tree[i]) {
        const d = Math.max(Math.abs(wx - tcx[i]), Math.abs(wz - tcz[i]));
        if (d < 0.42) o = Math.max(g, g + 0.45 + (tree[i] - g - 0.45) * (1 - d / 0.46));
      }
      const p = (j * HX + k) * 2;
      hm[p] = g;
      hm[p + 1] = o;
    }
  }
  for (const b of solids) {
    for (let j = Math.floor(b.z0 * HS); j < Math.ceil(b.z1 * HS); j++) {
      for (let k = Math.floor(b.x0 * HS); k < Math.ceil(b.x1 * HS); k++) {
        const p = (j * HX + wrap(k, HX)) * 2 + 1;
        hm[p] = Math.max(hm[p], b.y1);
      }
    }
  }

  // ---------- GL ----------

  function sh(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function prog(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace("[0]", "")] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  // Sky and fog share one function, so terrain melts into the sky without a seam.
  const SKY = `
  uniform vec3 u_skyLo;
  uniform vec3 u_skyHi;
  uniform float u_hz;
  uniform float u_H;
  uniform float u_W;
  uniform vec3 u_deep;
  vec3 vignette(vec3 c, vec2 fc) {
    vec2 q = fc / vec2(u_W, u_H) - 0.5;
    float v = smoothstep(0.32, 0.78, length(q * vec2(0.82, 1.18)));
    return mix(c, u_deep, v * 0.26);
  }
  vec3 sky(float y) {
    float k = smoothstep(u_hz - 0.04 * u_H, u_hz + 0.55 * u_H, y);
    return mix(u_skyLo, u_skyHi, k);
  }
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`;

  const VS = `#version 300 es
  layout(location=0) in vec3 a_pos;
  layout(location=1) in vec4 a_info;
  layout(location=2) in float a_base;
  uniform mat4 u_vp;
  uniform float u_off;
  out vec3 v_p;
  out float v_ao;
  flat out int v_n;
  flat out int v_m;
  flat out float v_base;
  void main() {
    vec3 p = a_pos + vec3(u_off, 0.0, 0.0);
    v_p = p;
    v_n = int(a_info.x + 0.5);
    v_m = int(a_info.y + 0.5);
    v_ao = a_info.z / 255.0;
    v_base = a_base;
    gl_Position = u_vp * vec4(p, 1.0);
  }`;

  const FS = `#version 300 es
  precision highp float;
  in vec3 v_p;
  in float v_ao;
  flat in int v_n;
  flat in int v_m;
  flat in float v_base;
  uniform sampler2D u_shadow;
  uniform sampler2D u_hm;
  uniform vec3 u_cam;
  uniform vec3 u_sun;
  uniform float u_time;
  uniform vec2 u_size;
  uniform vec2 u_fogr;
  uniform vec3 u_ramp[5];
  out vec4 o;
  ${SKY}
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0) * 4.0;
    float i = min(floor(t), 3.0);
    int k = int(i);
    return mix(u_ramp[k], u_ramp[k + 1], t - i);
  }
  float landAt(vec2 p) { return step(-0.1, texture(u_hm, p / u_size).r); }

  void main() {
    vec3 n = v_n == 0 ? vec3(0, 1, 0) : v_n == 1 ? vec3(1, 0, 0) : v_n == 2 ? vec3(-1, 0, 0) : v_n == 3 ? vec3(0, 0, 1) : vec3(0, 0, -1);
    float dist = length(v_p - u_cam);

    float alb = v_m == 0 ? 1.0 : v_m == 2 ? 0.4 : v_m == 3 ? 0.32 : v_m == 4 ? 1.0 : v_m == 5 ? 0.62 : 0.4;

    float sh = 1.0;
    if (v_m < 2) sh = texture(u_shadow, (v_p.xz - n.xz * 0.04) / u_size).r;

    vec2 cp = v_p.xz * 0.022 + vec2(u_time * 0.009, u_time * 0.003);
    float cl = vn(cp) * 0.62 + vn(cp * 2.3 + 3.7) * 0.38;
    float cloud = 1.0 - 0.45 * smoothstep(0.58, 0.76, cl);

    // Same logic as the site's voxel art: paper tops, periwinkle sides,
    // ink kept for water and forest. Shadows on paper stay pale, like ink wash.
    float ndl = max(dot(n, u_sun), 0.0) / u_sun.y;
    float ao = v_n == 0 ? v_ao : mix(0.6, 1.0, smoothstep(0.0, 1.4, v_p.y - v_base));
    float amb = v_n == 0 ? 0.7 : 0.56;
    float fg = mix(0.86, 1.0, smoothstep(76.0, 96.0, dist));
    float L = (amb + 0.3 * ndl * sh * cloud) * mix(0.78, 1.0, ao) * fg;
    float t = L * alb;

    if (v_m == 4) t = max(t, 0.86);

    if (v_m == 0) {
      vec2 uv = v_n == 0 ? v_p.xz : (v_n <= 2 ? v_p.zy : v_p.xy);
      vec2 w = fwidth(uv);
      vec2 g = abs(fract(uv + 0.5) - 0.5) / max(w, vec2(1e-4));
      float l = 1.0 - clamp(min(g.x, g.y), 0.0, 1.0);
      float fade = 1.0 - smoothstep(0.05, 0.16, max(w.x, w.y));
      t -= l * fade * (v_n == 0 ? 0.045 : 0.07);
    }

    if (v_m == 1) {
      t = 0.2 + 0.08 * sh * cloud;
      vec2 wp = v_p.xz * vec2(0.45, 5.0) + vec2(u_time * 0.12, 0.0);
      float s = smoothstep(0.82, 0.9, vn(wp)) * sh;
      t += s * 0.34;
      float r = 0.3;
      float land = max(max(landAt(v_p.xz + vec2(r, 0)), landAt(v_p.xz - vec2(r, 0))), max(landAt(v_p.xz + vec2(0, r)), landAt(v_p.xz - vec2(0, r))));
      t = mix(t, 0.62, land * 0.8);
    }

    vec3 c = ramp(t);
    float f = pow(smoothstep(u_fogr.x, u_fogr.x + 46.0, dist), 1.15);
    f = max(f, smoothstep(u_fogr.y - 46.0, u_fogr.y, dist));
    c = mix(c, sky(gl_FragCoord.y), f);
    c = vignette(c, gl_FragCoord.xy);
    c += (h21(gl_FragCoord.xy + fract(u_time)) - 0.5) / 255.0;
    o = vec4(c, 1.0);
  }`;

  const QVS = `#version 300 es
  void main() {
    vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
    gl_Position = vec4(p, 0.0, 1.0);
  }`;

  const SKYFS = `#version 300 es
  precision highp float;
  out vec4 o;
  ${SKY}
  void main() {
    o = vec4(vignette(sky(gl_FragCoord.y), gl_FragCoord.xy) + (h21(gl_FragCoord.xy) - 0.5) / 255.0, 1.0);
  }`;

  const SFS = `#version 300 es
  precision highp float;
  uniform sampler2D u_hm;
  uniform vec3 u_sun;
  uniform vec2 u_size;
  uniform float u_ss;
  out vec4 o;
  void main() {
    vec2 w = gl_FragCoord.xy / u_ss;
    float y0 = texture(u_hm, w / u_size).r;
    vec2 dir = normalize(u_sun.xz);
    float tanE = u_sun.y / length(u_sun.xz);
    float lit = 1.0;
    float st = 0.12;
    float t = st;
    for (int i = 0; i < 420; i++) {
      float y = y0 + t * tanE;
      if (y > 32.0) break;
      float occ = texture(u_hm, (w + dir * t) / u_size).g;
      if (occ > y + 0.02) { lit = 0.0; break; }
      t += st;
    }
    o = vec4(lit, 0.0, 0.0, 1.0);
  }`;

  let main, skyProg, shadowProg;
  try {
    main = prog(VS, FS);
    skyProg = prog(QVS, SKYFS);
    shadowProg = prog(QVS, SFS);
  } catch (err) {
    console.warn(err);
    fallback();
    return;
  }

  // Geometry
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = (data, loc, size, type) => {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, type, false, 0, 0);
  };
  buf(new Float32Array(P), 0, 3, gl.FLOAT);
  buf(new Uint8Array(A), 1, 4, gl.UNSIGNED_BYTE);
  buf(new Float32Array(B), 2, 1, gl.FLOAT);
  const eb = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(E), gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  const tex = (w, h, ifmt, fmt, type, data, filter) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const hmTex = tex(HX, HZ, gl.RG32F, gl.RG, gl.FLOAT, hm, gl.NEAREST);

  // Low sun from the back left: long shadows fall towards the camera.
  const sun = (() => { const v = [-0.6, 0.6, 0.55]; const l = Math.hypot(...v); return v.map((c) => c / l); })();

  // Bake cast shadows once, on the GPU.
  const SX = NX * SS, SZ = NZ * SS;
  const shTex = tex(SX, SZ, gl.R8, gl.RED, gl.UNSIGNED_BYTE, null, gl.LINEAR);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shTex, 0);
  gl.viewport(0, 0, SX, SZ);
  gl.useProgram(shadowProg.p);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, hmTex);
  gl.uniform1i(shadowProg.u.u_hm, 0);
  gl.uniform3fv(shadowProg.u.u_sun, sun);
  gl.uniform2f(shadowProg.u.u_size, NX, NZ);
  gl.uniform1f(shadowProg.u.u_ss, SS);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb);

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  // Deep ink, ink, then ink thinned with paper, then paper: like ink wash.
  const RAMP = ["#080b44", "#1a23a6", "#5961c6", "#b2b5e2", "#f4f2ec"].flatMap(hex);
  const SKY_LO = hex("#2a34b4");
  const SKY_HI = hex("#141b86");

  gl.useProgram(main.p);
  gl.uniform1i(main.u.u_shadow, 0);
  gl.uniform1i(main.u.u_hm, 1);
  gl.uniform3fv(main.u.u_sun, sun);
  gl.uniform2f(main.u.u_size, NX, NZ);
  gl.uniform3fv(main.u.u_ramp, RAMP);
  gl.uniform3fv(main.u.u_skyLo, SKY_LO);
  gl.uniform3fv(main.u.u_skyHi, SKY_HI);
  gl.uniform2f(main.u.u_fogr, 96, 206);
  const DEEP = hex("#0b1062");
  gl.uniform3fv(main.u.u_deep, DEEP);
  gl.useProgram(skyProg.p);
  gl.uniform3fv(skyProg.u.u_deep, DEEP);
  gl.uniform3fv(skyProg.u.u_skyLo, SKY_LO);
  gl.uniform3fv(skyProg.u.u_skyHi, SKY_HI);

  // ---------- Camera ----------

  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  function perspective(fovy, asp, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function lookDir(e, d) {
    const z = norm([-d[0], -d[1], -d[2]]);
    const x = norm(cross([0, 1, 0], z));
    const y = cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
  }
  function mul(a, b) {
    const o = new Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      o[i * 4 + j] = s;
    }
    return o;
  }
  function planes(m) {
    const r = (i) => [m[i], m[4 + i], m[8 + i], m[12 + i]];
    const r0 = r(0), r1 = r(1), r2 = r(2), r3 = r(3);
    const f = (a, s) => [r3[0] + s * a[0], r3[1] + s * a[1], r3[2] + s * a[2], r3[3] + s * a[3]];
    return [f(r0, 1), f(r0, -1), f(r1, 1), f(r1, -1), f(r2, 1), f(r2, -1)];
  }
  const inside = (pl, x0, y0, z0, x1, y1, z1) => {
    for (const p of pl) {
      if (p[0] * (p[0] > 0 ? x1 : x0) + p[1] * (p[1] > 0 ? y1 : y0) + p[2] * (p[2] > 0 ? z1 : z0) + p[3] < 0) return false;
    }
    return true;
  };

  const X0 = 4;          // starting point along the tile
  const SPEED = 0.6;      // cells per second
  const INTRO = 6;        // seconds of the opening crane move
  let simT = reduce ? 8 : 0;   // reduced motion: one calm still, after the opening move
  let px = 0, py = 0, tx = 0, ty = 0;

  function draw() {
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;
    const asp = w / h;
    const hfov = (46 * Math.PI) / 180;
    const vfov = Math.min(2 * Math.atan(Math.tan(hfov / 2) / asp), (40 * Math.PI) / 180);

    const k = Math.min(1, simT / INTRO);
    const ease = 1 - Math.pow(1 - k, 3);
    const camX = wrap(X0 + simT * SPEED, NX);
    const camY = 58 + Math.sin(simT * 0.05) * 0.8 + (1 - ease) * 14;
    const camZ = 0;
    const yaw = 0.07 + Math.sin(simT * 0.021) * 0.035 + px * 0.04;
    // Aerial: look down at the band around the river; taller frames see further, into the haze.
    const pitch = -0.62 - (1 - ease) * 0.12 + Math.sin(simT * 0.033) * 0.01 - py * 0.022;
    const eye = [camX, camY, camZ];
    const dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    const vp = mul(perspective(vfov, asp, 0.5, 320), lookDir(eye, dir));

    // Where the horizon sits on screen, for the sky gradient.
    const hd = [Math.sin(yaw), 0, Math.cos(yaw)];
    const cy = vp[1] * hd[0] + vp[9] * hd[2], cw = vp[3] * hd[0] + vp[11] * hd[2];
    const hz = (cy / cw * 0.5 + 0.5) * h;

    gl.viewport(0, 0, w, h);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(skyProg.p);
    gl.uniform1f(skyProg.u.u_hz, hz);
    gl.uniform1f(skyProg.u.u_H, h);
    gl.uniform1f(skyProg.u.u_W, w);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(main.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, shTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, hmTex);
    gl.uniformMatrix4fv(main.u.u_vp, false, vp);
    gl.uniform3fv(main.u.u_cam, eye);
    gl.uniform1f(main.u.u_time, simT);
    gl.uniform1f(main.u.u_hz, hz);
    gl.uniform1f(main.u.u_H, h);
    gl.uniform1f(main.u.u_W, w);
    gl.bindVertexArray(vao);
    const pl = planes(vp);
    for (let c = -1; c <= 1; c++) {
      const off = c * NX;
      let bound = false;
      for (const ch of chunks) {
        if (!ch.count) continue;
        const x0 = ch.x0 + off, x1 = ch.x1 + off;
        const dx = Math.max(x0 - camX, 0, camX - x1), dz = Math.max(ch.z0 - camZ, 0, camZ - ch.z1);
        if (dx * dx + dz * dz > 215 * 215) continue;
        if (!inside(pl, x0, ch.y0, ch.z0, x1, ch.y1, ch.z1)) continue;
        if (!bound) { gl.uniform1f(main.u.u_off, off); bound = true; }
        gl.drawElements(gl.TRIANGLES, ch.count, gl.UNSIGNED_INT, ch.start * 4);
      }
    }
    gl.bindVertexArray(null);
  }
  // ---------- Size ----------

  function resize() {
    const r = frame.getBoundingClientRect();
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (r.width * r.height * dpr * dpr > 3.4e6) dpr = Math.sqrt(3.4e6 / (r.width * r.height));
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      if (!running) draw();
    }
  }
  new ResizeObserver(resize).observe(frame);

  // ---------- Loop ----------

  let running = false, raf = 0, last = 0;
  let wantPlay = !reduce, visible = true;

  function frameStep(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    simT += dt;
    px += (tx - px) * Math.min(1, dt * 2.2);
    py += (ty - py) * Math.min(1, dt * 2.2);
    draw();
    raf = requestAnimationFrame(frameStep);
  }
  function update() {
    const should = wantPlay && visible && !document.hidden;
    if (should && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frameStep);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }
  function setPlay(on) {
    wantPlay = on;
    playBtn.setAttribute("aria-pressed", String(!on));
    playBtn.querySelector("span").textContent = on ? "Pause" : "Play";
    update();
  }
  playBtn.addEventListener("click", () => setPlay(!wantPlay));
  document.addEventListener("visibilitychange", update);
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; update(); }).observe(frame);

  if (!reduce && matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", (e) => {
      tx = e.clientX / innerWidth - 0.5;
      ty = e.clientY / innerHeight - 0.5;
    }, { passive: true });
  }

  resize();
  draw();
  setPlay(!reduce);

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    wantPlay = false;
    update();
    fallback();
  });
})();