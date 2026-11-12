/*
  Small isometric voxel diorama generator, used as placeholder art until
  real screenshots go in. Deterministic per seed. Returns an SVG string.
*/
window.Voxel = (() => {
  const rand = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const smooth = (t) => t * t * (3 - 2 * t);

  function heights(n, maxH, r) {
    const C = 3;
    const g = Array.from({ length: C + 1 }, () => Array.from({ length: C + 1 }, r));
    const out = [];
    for (let x = 0; x < n; x++) {
      out.push([]);
      for (let y = 0; y < n; y++) {
        const u = (x / (n - 1)) * C;
        const v = (y / (n - 1)) * C;
        const i = Math.min(C - 1, Math.floor(u));
        const j = Math.min(C - 1, Math.floor(v));
        const fu = smooth(u - i);
        const fv = smooth(v - j);
        const val =
          g[i][j] * (1 - fu) * (1 - fv) + g[i + 1][j] * fu * (1 - fv) +
          g[i][j + 1] * (1 - fu) * fv + g[i + 1][j + 1] * fu * fv;
        const dx = (x / (n - 1)) * 2 - 1;
        const dy = (y / (n - 1)) * 2 - 1;
        const d = Math.max(Math.hypot(dx, dy), Math.max(Math.abs(dx), Math.abs(dy)) * 1.02);
        const e = val * 0.85 + 0.62 - d * 1.02;
        out[x].push(e < 0.16 ? 0 : Math.max(1, Math.min(maxH, Math.round((e - 0.08) * maxH * 1.45))));
      }
    }
    return out;
  }

  const pts = (a) => a.map((v) => Math.round(v * 10) / 10).join(" ");
  const poly = (p, fill) => `<polygon points="${pts(p)}" fill="${fill}" stroke="${fill}" stroke-width=".6" stroke-linejoin="round"/>`;

  // A box sitting on the point (cx, by) with half width w and height h.
  function box(cx, by, w, h, c) {
    const ty = by - h;
    return (
      poly([cx - w, ty, cx, ty + w / 2, cx, by + w / 2, cx - w, by], c.left) +
      poly([cx, ty + w / 2, cx + w, ty, cx + w, by, cx, by + w / 2], c.right) +
      poly([cx, ty - w / 2, cx + w, ty, cx, ty + w / 2, cx - w, ty], c.top)
    );
  }

  function render({ n = 10, seed = 1, maxH = 5, base = 2, pal, trees = 0.14 }) {
    const r = rand(seed * 9973 + 17);
    const H = heights(n, maxH, r);
    const a = 20;          // half tile width
    const u = 17;          // one block of height
    const pad = 6;
    const top0 = (maxH + 2.6) * u + pad;
    const W = 2 * n * a + pad * 2;
    const Ht = top0 + n * a + base * u + pad;

    let out = `<svg class="vox" viewBox="0 0 ${W} ${Math.round(Ht)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">`;

    for (let s = 0; s <= 2 * (n - 1); s++) {
      for (let x = 0; x < n; x++) {
        const y = s - x;
        if (y < 0 || y >= n) continue;

        const t = H[x][y];
        const water = t === 0;
        const lvl = water ? -0.3 : t;
        const cx = pad + n * a + (x - y) * a;
        const cy = top0 + (x + y) * (a / 2);
        const ty = cy - lvl * u;
        const by = cy + base * u;

        let g =
          poly([cx - a, ty, cx, ty + a / 2, cx, by + a / 2, cx - a, by], pal.left) +
          poly([cx, ty + a / 2, cx + a, ty, cx + a, by, cx, by + a / 2], pal.right) +
          poly([cx, ty - a / 2, cx + a, ty, cx, ty + a / 2, cx - a, ty], water ? pal.water : pal.top);

        // Block seams on the side faces.
        let seams = "";
        for (let k = Math.ceil(lvl) - 1; k > -base; k--) {
          const yk = cy - k * u;
          seams += `M${cx - a} ${yk}L${cx} ${yk + a / 2}L${cx + a} ${yk}`;
        }
        if (seams) g += `<path d="${seams}" fill="none" stroke="${pal.line}" stroke-width="1"/>`;

        if (water && r() < 0.3) {
          g += `<path d="M${cx - a * 0.45} ${ty + 1}h${a * 0.5}" stroke="${pal.ripple}" stroke-width="1.4" stroke-linecap="round"/>`;
        }

        if (!water && t >= 2 && r() < trees) {
          const tall = 0.8 + r() * 0.9;
          g += box(cx, ty, a * 0.16, u * tall, pal.trunk);
          g += box(cx, ty - u * tall, a * (0.42 + r() * 0.16), u * (0.9 + r() * 0.5), pal.leaf);
        } else if (!water && r() < 0.05) {
          g += box(cx + a * 0.15, ty, a * 0.3, u * 0.55, pal.rock);
        }

        const d = Math.round(s * 26 + r() * 90);
        out += `<g class="col" style="--d:${d}ms">${g}</g>`;
      }
    }
    return out + "</svg>";
  }

  const PALETTES = {
    // On the light tint used for image slots.
    card: {
      top: "#f6f5fb",
      left: "#b3b8f0",
      right: "#7680e6",
      water: "#c9ccf3",
      ripple: "#eef0ff",
      line: "rgba(31, 47, 209, 0.16)",
      leaf: { top: "#4553dd", left: "#2d3bd0", right: "#1d29a8" },
      trunk: { top: "#7680e6", left: "#5a65d9", right: "#3d49c4" },
      rock: { top: "#dfe1f8", left: "#a5abed", right: "#7680e6" },
    },
    // On the ink background.
    ink: {
      top: "#f2f0ea",
      left: "#b9bdec",
      right: "#8189e4",
      water: "#4352e2",
      ripple: "#7b86ef",
      line: "rgba(31, 47, 209, 0.22)",
      leaf: { top: "#2e3cdb", left: "#1a27b3", right: "#121c87" },
      trunk: { top: "#8189e4", left: "#6670dd", right: "#4c57cf" },
      rock: { top: "#dcdcf2", left: "#9da3e8", right: "#6d77df" },
    },
  };

  return { render, PALETTES };
})();
