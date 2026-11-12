(() => {
  const body = document.body;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* ---------- Split names into letters ---------- */

  document.querySelectorAll("[data-split]").forEach((el) => {
    let i = 0;
    const words = el.textContent.trim().split(/\s+/).map((w) =>
      `<span class="w">${[...w].map((c) => `<span class="ch" style="--i:${i++}">${esc(c)}</span>`).join("")}</span>`,
    );
    el.innerHTML = `<span class="fit-inner">${words.join(" ")}</span>`;
  });

  /* ---------- Fit names edge to edge ---------- */

  const fits = [...document.querySelectorAll("[data-fit]")];

  const fit = (el) => {
    const inner = el.querySelector(".fit-inner") || el;
    const words = [...el.querySelectorAll(".w")];
    el.style.fontSize = "100px";
    // On narrow screens the hero puts each word on its own line: fit the longest.
    const stacked = words.length > 0 && getComputedStyle(words[0]).display === "block";
    const natural = stacked
      ? Math.max(...words.map((w) => w.getBoundingClientRect().width))
      : inner.getBoundingClientRect().width;
    if (natural > 0) el.style.fontSize = `${((100 * el.clientWidth) / natural) * 0.995}px`;
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

  /* ---------- Page colour follows the section in view ---------- */

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const themeIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const t = e.target.dataset.theme;
        if (body.dataset.theme !== t) {
          body.dataset.theme = t;
          themeMeta.setAttribute("content", t === "ink" ? "#1f2fd1" : "#f2f0ea");
        }
      });
    },
    { rootMargin: "-50% 0px -50% 0px" },
  );

  document.querySelectorAll("main [data-theme], footer[data-theme]").forEach((el) => themeIO.observe(el));

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

  /* ---------- Nav, hero parallax, cursor ---------- */

  const nav = document.querySelector(".nav");
  const heroName = document.querySelector(".hero__name");
  const heroArt = document.querySelector(".hero__art");
  const heroHost = heroArt.querySelector(".vox-host");
  const cursor = document.querySelector(".cursor");
  const label = cursor.querySelector(".cursor__label");

  const m = { x: 0, y: 0, tx: 0, ty: 0 }; // hero mouse offset, -0.5..0.5
  const c = { x: -200, y: -200, tx: -200, ty: -200, seen: false };
  let lastY = window.scrollY;
  let raf = 0;

  const frame = () => {
    raf = 0;
    m.x += (m.tx - m.x) * 0.06;
    m.y += (m.ty - m.y) * 0.06;
    c.x += (c.tx - c.x) * 0.2;
    c.y += (c.ty - c.y) * 0.2;

    const y = window.scrollY;
    if (y < innerHeight * 1.2) {
      heroArt.style.transform = `translate3d(${m.x * 22}px, ${y * -0.16 + m.y * 14}px, 0)`;
      heroName.style.transform = `translate3d(0, ${y * 0.1}px, 0)`;
    }
    cursor.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;

    const busy =
      Math.abs(m.tx - m.x) > 0.001 || Math.abs(m.ty - m.y) > 0.001 ||
      Math.abs(c.tx - c.x) > 0.1 || Math.abs(c.ty - c.y) > 0.1;
    if (busy) raf = requestAnimationFrame(frame);
  };

  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  addEventListener("scroll", () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 10);
    if (y > lastY + 6 && y > 160) nav.classList.add("is-hidden");
    else if (y < lastY - 6 || y < 160) nav.classList.remove("is-hidden");
    lastY = y;
    // Content moves under a still mouse: check what the bubble is over now.
    if (c.seen) {
      const under = document.elementFromPoint(c.tx, c.ty);
      const t = under && under.closest("[data-cursor]");
      if (t) label.textContent = t.dataset.cursor;
      cursor.classList.toggle("is-on", !!t);
    }
    if (!reduce) kick();
  }, { passive: true });

  if (fine && !reduce) {
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      c.tx = e.clientX;
      c.ty = e.clientY;
      if (!c.seen) { c.x = c.tx; c.y = c.ty; c.seen = true; }
      const t = e.target.closest("[data-cursor]");
      if (t) {
        label.textContent = t.dataset.cursor;
        cursor.classList.add("is-on");
      } else cursor.classList.remove("is-on");

      if (window.scrollY < innerHeight) {
        m.tx = e.clientX / innerWidth - 0.5;
        m.ty = e.clientY / innerHeight - 0.5;
      }
      kick();
    }, { passive: true });

    document.addEventListener("pointerleave", () => cursor.classList.remove("is-on"));
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

  const ready = () => {
    fits.forEach(fit);
    requestAnimationFrame(() => {
      body.classList.add("is-ready");
      heroHost.classList.add("is-in");
    });
  };

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(ready);
  addEventListener("resize", () => fits.forEach(fit));
})();
