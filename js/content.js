/* ==========================================================================
   Contenido: revelado al hacer scroll, contador de créditos, gráfico de
   duración y navegación activa.
   ========================================================================== */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.remove("no-js");

  /* ---------- Revelado escalonado ---------- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries
      .filter((e) => e.isIntersecting)
      .forEach((entry, i) => {
        entry.target.style.setProperty("--d", `${i * 90}ms`);
        entry.target.classList.add("is-in");
        revealObserver.unobserve(entry.target);
      });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  document.querySelectorAll("[data-reveal]").forEach((el) => revealObserver.observe(el));

  document.querySelectorAll(".pipeline li").forEach((li, i) => li.style.setProperty("--i", i));

  /* ---------- Contador rápido hasta 140 ---------- */
  function countUp(el) {
    const to = Number(el.dataset.countTo);
    if (reduceMotion) { el.textContent = to; return; }
    const duration = 1400;
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(2, -10 * t); // easeOutExpo: arranca muy rápido
      el.textContent = Math.round(to * (t === 1 ? 1 : eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      countUp(entry.target);
      countObserver.unobserve(entry.target);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count-to]").forEach((el) => countObserver.observe(el));

  /* ---------- Gráfico: barras que se llenan a distinta velocidad ---------- */
  const race = document.getElementById("race");
  new IntersectionObserver((entries, obs) => {
    if (!entries[0].isIntersecting) return;
    race.classList.add("is-in");
    obs.disconnect();
  }, { threshold: 0.55 }).observe(race);

  /* ---------- Pilares: cartas que giran al tocarlas y se inclinan con el mouse ---------- */
  document.querySelectorAll(".pillar").forEach((card) => {
    const button = card.querySelector(".pillar__flip");
    let flipping = 0;
    button.addEventListener("click", () => {
      const flipped = card.classList.toggle("is-flipped");
      button.setAttribute("aria-pressed", String(flipped));
      // Durante el giro se usa la transición lenta, aunque el mouse siga encima.
      card.classList.remove("is-tilting");
      clearTimeout(flipping);
      flipping = setTimeout(() => { flipping = 0; }, 900);
    });
    if (reduceMotion) return;
    card.addEventListener("pointermove", (ev) => {
      if (ev.pointerType !== "mouse" || flipping) return;
      const r = card.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5;
      const y = (ev.clientY - r.top) / r.height - 0.5;
      card.classList.add("is-tilting");
      card.style.setProperty("--ry", (x * 14).toFixed(2) + "deg");
      card.style.setProperty("--rx", (-y * 12).toFixed(2) + "deg");
    });
    card.addEventListener("pointerleave", () => {
      card.classList.remove("is-tilting");
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--rx", "0deg");
    });
  });

  /* ---------- Sección activa en la navegación ---------- */
  const links = [...document.querySelectorAll(".site-nav a, .panel__tabs a")];
  const sections = [...new Set(links.map((a) => a.getAttribute("href")))]
    .map((href) => document.querySelector(href))
    .filter(Boolean);
  const setActive = (id) => {
    links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${id}`));
  };
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) setActive(entry.target.id); });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => spy.observe(s));
  setActive("programa");
})();
