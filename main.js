(() => {
  const root = document.documentElement;
  const body = document.body;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const EASE = "cubic-bezier(0.19, 1, 0.22, 1)";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Name: split into letters, fit edge to edge ---------- */

  const nameEl = document.querySelector("[data-split]");
  {
    let i = 0;
    const words = nameEl.textContent.trim().split(/\s+/).map((w) =>
      `<span class="w">${[...w].map((c) => `<span class="ch" style="--i:${i++}">${esc(c)}</span>`).join("")}</span>`,
    );
    nameEl.innerHTML = `<span class="fit-inner">${words.join(" ")}</span>`;
  }

  const fitName = () => {
    const inner = nameEl.querySelector(".fit-inner");
    const words = [...nameEl.querySelectorAll(".w")];
    nameEl.style.fontSize = "100px";
    // On phones each word sits on its own line, so fit the longest word.
    const stacked = getComputedStyle(words[0]).display === "block";
    const natural = stacked
      ? Math.max(...words.map((w) => w.getBoundingClientRect().width))
      : inner.getBoundingClientRect().width;
    if (natural > 0) nameEl.style.fontSize = `${((100 * nameEl.clientWidth) / natural) * 0.995}px`;
  };

  /* ---------- Voxel art ---------- */

  const draw = (host, seed) => {
    host.innerHTML = window.Voxel.render({
      n: Number(host.dataset.n) || 10,
      maxH: Number(host.dataset.h) || 5,
      seed,
      pal: window.Voxel.PALETTES[host.dataset.vox],
    });
  };

  document.querySelectorAll("[data-vox]").forEach((host) => draw(host, Number(host.dataset.seed)));

  /* ---------- Odometers ---------- */

  document.querySelectorAll(".odo").forEach((el) => {
    const value = el.dataset.value;
    el.setAttribute("aria-label", value);
    el.innerHTML = [...value].map((c, i) => {
      if (!/\d/.test(c)) return `<span class="odo__d" aria-hidden="true">${esc(c)}</span>`;
      const strip = Array.from({ length: 30 }, (_, k) => `<span>${k % 10}</span>`).join("");
      return `<span class="odo__d" aria-hidden="true"><span class="odo__s" data-target="${20 + Number(c)}" style="--od:${i * 110}ms">${strip}</span></span>`;
    }).join("");
    el.querySelectorAll(".odo__s").forEach((s) => {
      s.style.transition = "none";
      s.style.transform = `translateY(-${Math.floor(Math.random() * 10)}em)`;
    });
  });

  const roll = (el) => {
    el.querySelectorAll(".odo__s").forEach((s) => {
      void s.offsetHeight;
      s.style.transition = "";
      s.style.transform = `translateY(-${s.dataset.target}em)`;
    });
  };

  /* ---------- Scroll reveals ---------- */

  const reveal = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        e.target.querySelectorAll(".odo").forEach(roll);
        reveal.unobserve(e.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
  );

  document.querySelectorAll("[data-reveal]").forEach((el) => reveal.observe(el));

  /* ---------- Clock ---------- */

  const clock = document.querySelector("[data-clock]");
  const fmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Amsterdam", // change to your own zone
  });
  const tick = () => { clock.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 1000);

  /* ---------- Work filters ---------- */

  const cards = [...document.querySelectorAll(".card")];
  const buttons = [...document.querySelectorAll("[data-filter]")];
  const tagsOf = (c) => c.dataset.tags.split(/\s+/);
  const pad2 = (n) => String(n).padStart(2, "0");

  document.querySelectorAll("[data-count]").forEach((sup) => {
    const f = sup.dataset.count;
    sup.textContent = pad2(f === "all" ? cards.length : cards.filter((c) => tagsOf(c).includes(f)).length);
  });

  let current = "all";
  let busy = false;

  const applyFilter = (f) => {
    if (f === current || busy) return;
    current = f;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === f)));

    const match = (c) => f === "all" || tagsOf(c).includes(f);
    const visible = cards.filter((c) => !c.classList.contains("is-hidden"));
    const leaving = visible.filter((c) => !match(c));
    const first = new Map(visible.map((c) => [c, c.getBoundingClientRect()]));

    const run = () => {
      cards.forEach((c) => {
        c.classList.remove("is-out");
        c.classList.toggle("is-hidden", !match(c));
      });
      cards.filter(match).forEach((c, i) => {
        const before = first.get(c);
        if (!c.classList.contains("is-in")) {
          c.style.setProperty("--delay", `${i * 60}ms`);
          c.classList.add("is-in");
          return;
        }
        if (reduce) return;
        if (before && !c.classList.contains("was-hidden")) {
          const now = c.getBoundingClientRect();
          const dx = before.left - now.left;
          const dy = before.top - now.top;
          if (dx || dy) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 650, easing: EASE });
        } else {
          c.animate([{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { duration: 550, easing: EASE, delay: i * 50, fill: "backwards" });
        }
      });
      cards.forEach((c) => c.classList.toggle("was-hidden", !match(c)));
      busy = false;
    };

    if (leaving.length && !reduce) {
      busy = true;
      leaving.forEach((c) => c.classList.add("is-out"));
      setTimeout(run, 190);
    } else run();
  };

  buttons.forEach((b) => b.addEventListener("click", () => applyFilter(b.dataset.filter)));

  // Clicking a discipline jumps to the work, filtered.
  document.querySelectorAll("[data-show]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      applyFilter(a.dataset.show);
      document.getElementById("work").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }),
  );

  /* ---------- Hero cover, nav colour, parallax ---------- */

  const nav = document.querySelector(".nav");
  const hero = document.querySelector(".hero");
  const heroInner = hero.querySelector(".hero__inner");
  const shade = hero.querySelector(".hero__shade");
  const heroArt = hero.querySelector(".hero__art");
  const heroHost = heroArt.querySelector(".vox-host");
  const themed = [...document.querySelectorAll("main [data-theme]")];
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  const m = { x: 0, y: 0, tx: 0, ty: 0 };
  let lastY = window.scrollY;
  let raf = 0;

  const setSticky = () => {
    // Only pin the hero when it fits the screen; a taller hero just scrolls.
    hero.classList.toggle("is-sticky", heroInner.offsetHeight <= innerHeight + 2);
  };

  const navTheme = () => {
    const probe = nav.offsetHeight / 2;
    let theme = "ink";
    for (const s of themed) {
      const r = s.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) theme = s.dataset.theme; // later sections sit on top
    }
    if (nav.dataset.theme !== theme) {
      nav.dataset.theme = theme;
      themeMeta.setAttribute("content", theme === "ink" ? "#1f2fd1" : "#f2f0ea");
    }
  };

  const frame = () => {
    raf = 0;
    const y = window.scrollY;
    const h = hero.offsetHeight;

    if (!reduce && y < h * 1.1) {
      const p = clamp(y / h, 0, 1);
      if (hero.classList.contains("is-sticky")) {
        heroInner.style.transform = `translate3d(0, ${-p * 7}vh, 0) scale(${1 - p * 0.05})`;
        shade.style.opacity = String(p * 0.6);
      }
      m.x += (m.tx - m.x) * 0.06;
      m.y += (m.ty - m.y) * 0.06;
      heroArt.style.transform = `translate3d(${m.x * 22}px, ${m.y * 14}px, 0)`;
    }

    navTheme();

    if (Math.abs(m.tx - m.x) > 0.001 || Math.abs(m.ty - m.y) > 0.001) raf = requestAnimationFrame(frame);
  };

  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  addEventListener("scroll", () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 10);
    if (y > lastY + 6 && y > 160) nav.classList.add("is-hidden");
    else if (y < lastY - 6 || y < 160) nav.classList.remove("is-hidden");
    lastY = y;
    kick();
    cursorRefresh();
  }, { passive: true });

  /* ---------- Cursor ---------- */

  const cursor = document.querySelector(".cursor");
  const tag = cursor.querySelector(".cursor__tag");
  const pos = { x: -100, y: -100, on: false };

  const cursorRefresh = () => {
    if (!pos.on) return;
    const el = document.elementFromPoint(pos.x, pos.y);
    if (!el) return;
    const sec = el.closest("[data-theme]");
    const ink = !sec || sec.dataset.theme === "ink";
    cursor.style.setProperty("--c", ink ? "#f2f0ea" : "#1f2fd1");
    cursor.style.setProperty("--c2", ink ? "#1f2fd1" : "#f2f0ea");

    const t = el.closest("[data-cursor]");
    if (t) tag.textContent = t.dataset.cursor;
    cursor.classList.toggle("is-tag", !!t);
    cursor.classList.toggle("is-link", !t && !!el.closest("a, button, [role='button']"));
  };

  if (fine) {
    let pending = false;
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!pos.on) {
        pos.on = true;
        root.classList.add("has-cursor");
        cursor.classList.add("is-visible");
      }
      if (window.scrollY < hero.offsetHeight) {
        m.tx = e.clientX / innerWidth - 0.5;
        m.ty = e.clientY / innerHeight - 0.5;
        if (!reduce) kick();
      }
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        cursor.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        cursorRefresh();
      });
    }, { passive: true });

    addEventListener("pointerdown", () => cursor.classList.add("is-down"));
    addEventListener("pointerup", () => cursor.classList.remove("is-down"));
    document.addEventListener("mouseleave", () => cursor.classList.remove("is-visible"));
    document.addEventListener("mouseenter", () => { if (pos.on) cursor.classList.add("is-visible"); });
  }

  /* ---------- Rebuild the hero island ---------- */

  let seed = Number(heroHost.dataset.seed);
  heroArt.setAttribute("role", "button");
  heroArt.setAttribute("tabindex", "0");
  heroArt.setAttribute("aria-label", "Rebuild the illustration");

  const rebuild = () => {
    seed += 1 + Math.floor(Math.random() * 97);
    if (reduce) return draw(heroHost, seed);
    heroHost.classList.add("is-leaving");
    setTimeout(() => {
      heroHost.classList.remove("is-in");
      heroHost.style.setProperty("--vox-delay", "0ms");
      draw(heroHost, seed);
      heroHost.classList.remove("is-leaving");
      void heroHost.offsetWidth;
      requestAnimationFrame(() => heroHost.classList.add("is-in"));
    }, 260);
  };

  heroArt.addEventListener("click", rebuild);
  heroArt.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      rebuild();
    }
  });

  /* ---------- Go ---------- */

  const layout = () => {
    fitName();
    setSticky();
    kick();
  };

  const ready = () => {
    layout();
    requestAnimationFrame(() => {
      body.classList.add("is-ready");
      heroHost.classList.add("is-in");
    });
  };

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(ready);
  addEventListener("resize", layout);
})();
