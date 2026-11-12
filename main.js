(() => {
  const root = document.documentElement;
  const body = document.body;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const EASE = "cubic-bezier(0.19, 1, 0.22, 1)";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Mobile menu ---------- */

  const menuBtn = document.querySelector(".menu-btn");
  const menu = document.getElementById("menu");
  const setMenu = (open) => {
    menuBtn.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("is-open", open);
  };
  menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("is-open")) {
      setMenu(false);
      menuBtn.focus();
    }
  });

  /* ---------- Local time ---------- */

  const clock = document.querySelector("[data-clock]");
  if (clock) {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Amsterdam", // change to your own zone
    });
    const tick = () => { clock.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 15000);
  }

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

  /* ---------- Hero cover + nav ---------- */

  const nav = document.querySelector(".nav");
  const hero = document.querySelector(".hero");
  const heroInner = hero.querySelector(".hero__inner");
  const themed = [...document.querySelectorAll("main section[data-theme], footer[data-theme]")];
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  let lastY = window.scrollY;
  let raf = 0;

  const setSticky = () => {
    // Pin the hero only when it fits the screen; a taller hero just scrolls.
    hero.classList.toggle("is-sticky", heroInner.offsetHeight <= innerHeight + 2);
  };

  const navTheme = () => {
    const probe = nav.offsetHeight / 2;
    let theme = "paper";
    for (const s of themed) {
      const r = s.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) theme = s.dataset.theme; // later sections sit on top
    }
    if (nav.dataset.theme !== theme) {
      nav.dataset.theme = theme;
      themeMeta.setAttribute("content", theme === "ink" ? "#1c25b0" : "#f2f0ea");
    }
  };

  const frame = () => {
    raf = 0;
    const y = window.scrollY;
    const h = hero.offsetHeight;
    if (!reduce && hero.classList.contains("is-sticky") && y < h * 1.1) {
      const p = clamp(y / h, 0, 1);
      heroInner.style.transform = `translate3d(0, ${-p * 5}vh, 0) scale(${1 - p * 0.04})`;
    }
    navTheme();
  };

  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  addEventListener("scroll", () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 10);
    if (y > lastY + 6 && y > 160 && !menu.classList.contains("is-open")) nav.classList.add("is-hidden");
    else if (y < lastY - 6 || y < 160) nav.classList.remove("is-hidden");
    lastY = y;
    kick();
    cursorRefresh();
  }, { passive: true });

  /* ---------- Cursor ---------- */

  const cursor = document.querySelector(".cursor");
  const tag = cursor.querySelector(".cursor__tag");
  const pos = { x: -100, y: -100, on: false };

  function cursorRefresh() {
    if (!pos.on) return;
    const el = document.elementFromPoint(pos.x, pos.y);
    if (!el) return;
    const sec = el.closest("[data-theme]");
    const ink = sec && sec.dataset.theme === "ink";
    cursor.style.setProperty("--c", ink ? "#f2f0ea" : "#1c25b0");
    cursor.style.setProperty("--c2", ink ? "#1c25b0" : "#f2f0ea");

    const t = el.closest("[data-cursor]");
    if (t) tag.textContent = t.dataset.cursor;
    cursor.classList.toggle("is-tag", !!t);
    cursor.classList.toggle("is-link", !t && !!el.closest("a, button, [role='button']"));
  }

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

  /* ---------- Go ---------- */

  const layout = () => {
    setSticky();
    kick();
  };

  let started = false;
  const ready = () => {
    if (started) return;
    started = true;
    layout();
    requestAnimationFrame(() => body.classList.add("is-ready"));
  };

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(ready);
  setTimeout(ready, 1200);
  addEventListener("resize", layout);
})();
