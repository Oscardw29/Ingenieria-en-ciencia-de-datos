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

  /* ---------- Resultados: uno a la vez con el scroll (tarjeta + imagen 1:1) ---------- */
  const soScroll = document.getElementById("so-scroll");
  if (soScroll) {
    const items = [...soScroll.querySelectorAll(".outcome")];
    const count = soScroll.querySelector(".so-scroll__count");
    const bar = soScroll.querySelector(".so-scroll__bar");
    // Mientras no exista la imagen se deja ver el marco con el código del resultado.
    soScroll.querySelectorAll(".outcome__media img").forEach((img) => {
      const drop = () => img.remove();
      if (img.complete && !img.naturalWidth) drop(); else img.addEventListener("error", drop);
    });
    soScroll.classList.add("so-scroll--ready");
    let current = -1, ticking = false;
    const updateOutcomes = () => {
      ticking = false;
      const r = soScroll.getBoundingClientRect();
      const range = r.height - window.innerHeight;
      const prog = range > 0 ? Math.min(1, Math.max(0, -r.top / range)) : 0;
      bar.style.setProperty("--p", prog.toFixed(3));
      const idx = Math.min(items.length - 1, Math.floor(prog * items.length));
      if (idx === current) return;
      current = idx;
      items.forEach((li, i) => {
        li.classList.toggle("is-active", i === idx);
        li.classList.toggle("is-past", i < idx);
        li.setAttribute("aria-hidden", String(i !== idx));
      });
      count.textContent = `${String(idx + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(updateOutcomes); }
    }, { passive: true });
    window.addEventListener("resize", updateOutcomes);
    updateOutcomes();
  }

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
