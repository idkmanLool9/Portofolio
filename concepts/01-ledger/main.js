(() => {
  const doc = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Reveal headline once fonts are in, so the lines never jump.
  const ready = () => requestAnimationFrame(() => document.body.classList.add("is-ready"));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(ready);

  // Local time. Change the zone to wherever you are.
  const clock = document.querySelector("[data-clock]");
  const fmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });
  const tick = () => { clock.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 10_000);

  // Hairline under the bar once the page moves.
  const top = document.querySelector(".top");
  const onScroll = () => top.classList.toggle("is-scrolled", window.scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Cursor-following preview for the index.
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const preview = document.querySelector(".preview");
  const label = preview.querySelector(".preview__n");
  if (!finePointer) return;

  let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
  const w = () => preview.offsetWidth;
  const h = () => preview.offsetHeight;

  const loop = () => {
    const k = reduce ? 1 : 0.18;
    x += (tx - x) * k;
    y += (ty - y) * k;
    preview.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1) raf = requestAnimationFrame(loop);
    else raf = 0;
  };

  const place = (e) => {
    // Sit to the right of the cursor, flip when near the edge.
    const flip = e.clientX + w() + 40 > innerWidth;
    tx = flip ? e.clientX - w() - 24 : e.clientX + 24;
    ty = Math.min(Math.max(e.clientY - h() / 2, 12), innerHeight - h() - 12);
    if (!raf) raf = requestAnimationFrame(loop);
  };

  document.querySelectorAll(".index__row[data-n]").forEach((row) => {
    row.addEventListener("pointerenter", (e) => {
      label.textContent = row.dataset.n;
      if (!preview.classList.contains("is-on")) {
        // Jump straight to the cursor on first entry instead of sliding in from afar.
        place(e);
        x = tx; y = ty;
        preview.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      preview.classList.add("is-on");
    });
    row.addEventListener("pointermove", place);
    row.addEventListener("pointerleave", () => preview.classList.remove("is-on"));
    row.addEventListener("click", (e) => e.preventDefault());
  });
})();
