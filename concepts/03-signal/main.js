(() => {
  // Scale the name so it always runs edge to edge, whatever name goes in.
  const el = document.querySelector("[data-fit]");
  const inner = el.firstElementChild;

  const words = [...el.querySelectorAll(".w")];

  const fit = () => {
    el.style.fontSize = "100px";
    // On narrow screens each word gets its own line, so fit the longest word.
    const stacked = getComputedStyle(words[0]).display === "block";
    const natural = stacked
      ? Math.max(...words.map((w) => w.getBoundingClientRect().width))
      : inner.getBoundingClientRect().width;
    const target = el.clientWidth;
    if (natural > 0) el.style.fontSize = `${(100 * target) / natural * 0.995}px`;
  };

  const ready = () => {
    fit();
    requestAnimationFrame(() => document.body.classList.add("is-ready"));
  };

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(ready);
  addEventListener("resize", fit);
})();
