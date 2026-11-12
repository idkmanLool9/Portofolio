(() => {
  const ready = () => requestAnimationFrame(() => document.body.classList.add("is-ready"));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(ready);

  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
  );

  items.forEach((el) => io.observe(el));
})();
