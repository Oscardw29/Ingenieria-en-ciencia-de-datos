/* ==========================================================================
   Hero: una nube de 0 y 1 que, con el scroll, vuela y forma el logo.
   ========================================================================== */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const hero = document.querySelector(".hero");
  const canvas = document.getElementById("particles");
  const logo = document.getElementById("hero-logo");
  const copy = document.getElementById("hero-copy");
  const hint = document.getElementById("scroll-hint");
  const panelWrap = document.querySelector(".panel-wrap");
  const header = document.getElementById("site-header");
  const ctx = canvas.getContext("2d");

  /* ---------- Título: dividir en palabras para el efecto blur ---------- */
  const title = document.querySelector("[data-blur-words]");
  const ACCENT = new Set(["datos", "decisiones"]);
  const words = title.textContent.trim().split(/\s+/);
  title.textContent = "";
  words.forEach((word, i) => {
    const span = document.createElement("span");
    span.className = "w" + (ACCENT.has(word.toLowerCase()) ? " w--accent" : "");
    span.style.setProperty("--i", i);
    span.textContent = word;
    title.append(span, i < words.length - 1 ? " " : "");
  });

  /* ---------- Paleta de partículas (categorías generadas en logo-points.js) ---------- */
  const COLORS = [
    { color: "#ffffff", alpha: 1.0 },  // 0 letras blancas
    { color: "#4f86ff", alpha: 0.9 },  // 1 bordes del anillo
    { color: "#2c55a8", alpha: 0.6 },  // 2 fondo azul marino del anillo
    { color: "#c9cdff", alpha: 0.55 }, // 3 disco lavanda
    { color: "#8f66ff", alpha: 0.95 }, // 4 engranaje y ola
    { color: "#8eaaff", alpha: 1.0 },  // 5 barras claras / dígitos
    { color: "#7a62ff", alpha: 1.0 },  // 6 barra violeta
    { color: "#b06bff", alpha: 1.0 },  // 7 barra violeta profunda
    { color: "#5ee0ff", alpha: 0.9 },  // 8 cian (solo ambiente)
  ];
  const AMBIENT_COLORS = [8, 5, 1, 0, 8, 5];

  /* Sprites pre-renderizados de "0" y "1" con brillo, uno por color. */
  const GLYPH_PX = 32;
  const SPRITE_PX = 64;
  let sprites = [];
  function buildSprites() {
    sprites = COLORS.map(({ color }) =>
      ["0", "1"].map((glyph) => {
        const c = document.createElement("canvas");
        c.width = c.height = SPRITE_PX;
        const g = c.getContext("2d");
        g.font = `700 ${GLYPH_PX}px "JetBrains Mono", ui-monospace, monospace`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = color;
        g.shadowColor = color;
        g.shadowBlur = 12;
        g.fillText(glyph, SPRITE_PX / 2, SPRITE_PX / 2 + 1);
        g.shadowBlur = 0;
        g.fillText(glyph, SPRITE_PX / 2, SPRITE_PX / 2 + 1);
        return c;
      })
    );
  }
  buildSprites();
  if (document.fonts) document.fonts.load('700 32px "JetBrains Mono"').then(buildSprites, () => {});

  /* ---------- Partículas ---------- */
  const raw = window.LOGO_POINTS || [];
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || window.innerWidth < 760;
  const keepRatio = small ? 0.38 : 1;
  const ambientCount = small ? 260 : 650;

  const particles = [];
  const total = raw.length / 3;
  for (let i = 0; i < total; i++) {
    const cat = raw[i * 3 + 2];
    // En pantallas pequeñas se conserva todo el texto y una muestra del resto.
    if (i / total > keepRatio && cat !== 0) continue;
    if (small && cat === 0 && Math.random() > 0.7) continue;
    particles.push(makeParticle(raw[i * 3] / 1000, raw[i * 3 + 1] / 1000, cat));
  }
  const logoCount = particles.length;
  for (let i = 0; i < ambientCount; i++) {
    particles.push(makeParticle(null, null, AMBIENT_COLORS[i % AMBIENT_COLORS.length]));
  }

  function makeParticle(tx, ty, cat) {
    const z = Math.random() ** 1.6; // más partículas al fondo
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 1.15;
    // Los puntos lejanos del centro del logo llegan un poco después.
    const dist = tx === null ? 0 : Math.hypot(tx, ty);
    return {
      tx, ty, cat, z,
      cx: Math.cos(angle) * radius,
      cy: Math.sin(angle) * radius * 0.9,
      delay: 0.02 + dist * 0.08 + Math.random() * 0.11,
      phase: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.55,
      swirl: (Math.random() - 0.5) * 0.9,
      glyph: Math.random() < 0.5 ? 0 : 1,
      flips: Math.random() < 0.18,
    };
  }

  /* ---------- Estado ---------- */
  let W = 0, H = 0, dpr = 1, logoPx = 0;
  let pTarget = 0, p = 0;
  let mx = 0, my = 0, mxS = 0, myS = 0;
  let running = false, visible = true;
  let titleOn = false, uiOn = false;
  const start = performance.now();

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    logoPx = logo.offsetWidth;
    readScroll();
  }

  function readScroll() {
    const range = hero.offsetHeight - window.innerHeight;
    pTarget = range > 0 ? clamp(-hero.getBoundingClientRect().top / range) : 1;
  }

  /* ---------- Línea de tiempo según el progreso del scroll ---------- */
  function applyTimeline() {
    const logoIn = smooth(0.46, 0.56, p);
    const recede = smooth(0.56, 0.7, p);

    logo.style.setProperty("--logo-o", (logoIn * (1 - recede * 0.78)).toFixed(3));
    logo.style.setProperty("--logo-s", (0.96 + logoIn * 0.04 + recede * 0.22).toFixed(4));
    logo.style.setProperty("--logo-blur", (recede * 1.5).toFixed(2) + "px");
    hint.style.setProperty("--hint-o", (1 - smooth(0, 0.05, pTarget)).toFixed(3));

    // Título con histéresis para que no parpadee en el umbral.
    if (!titleOn && pTarget > 0.6) { titleOn = true; root.classList.add("is-title"); }
    else if (titleOn && pTarget < 0.55) { titleOn = false; root.classList.remove("is-title"); }

    const showUi = pTarget > 0.72 || hero.getBoundingClientRect().bottom < window.innerHeight;
    if (showUi !== uiOn) { uiOn = showUi; root.classList.toggle("is-ui", uiOn); }

    // El contenedor que sube empuja el título hacia arriba en lugar de taparlo.
    // Posiciones relativas al bloque sticky (que se suelta al final del hero).
    const stickyTop = Math.min(0, hero.getBoundingClientRect().bottom - H);
    const panelTop = panelWrap.getBoundingClientRect().top - stickyTop;
    const half = copy.offsetHeight / 2;
    let shift = Math.min(0, panelTop - 32 - (H / 2 + half));
    shift = Math.max(shift, header.offsetHeight + 20 - (H / 2 - half));
    copy.style.setProperty("--copy-y", shift.toFixed(1) + "px");

    return { logoIn, recede };
  }

  /* ---------- Render ---------- */
  function draw(now) {
    const t = (now - start) / 1000;
    const intro = smooth(0, 1.4, t);
    p += (pTarget - p) * 0.085;
    if (Math.abs(pTarget - p) < 0.0005) p = pTarget;
    mxS += (mx - mxS) * 0.05;
    myS += (my - myS) * 0.05;

    const { logoIn, recede } = applyTimeline();
    const logoScale = 0.96 + logoIn * 0.04 + recede * 0.22;
    const R = (logoPx / 2) * logoScale;
    const ox = W / 2, oy = H / 2;
    const spreadX = Math.max(W, H * 0.8) * 0.62;
    const spreadY = Math.max(H, W * 0.5) * 0.62;
    const targetSize = Math.max(4.2, logoPx / 82);
    const zoom = 1 + p * 0.35; // el ambiente se abre como si avanzáramos

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < particles.length; i++) {
      const q = particles[i];
      const tw = 0.65 + 0.35 * Math.sin(t * (1.2 + q.speed * 2) + q.phase); // titileo
      const driftX = Math.sin(t * q.speed + q.phase) * (10 + q.z * 22);
      const driftY = Math.cos(t * q.speed * 0.8 + q.phase * 1.3) * (8 + q.z * 18);
      const px0 = ox + q.cx * spreadX * (i >= logoCount ? zoom : 1) + driftX + mxS * q.z * 30;
      const py0 = oy + q.cy * spreadY * (i >= logoCount ? zoom : 1) + driftY + myS * q.z * 22;
      const cloudSize = 8 + q.z * 15;
      const cloudAlpha = (0.1 + q.z * 0.62) * tw;

      let x = px0, y = py0, size = cloudSize, alpha = cloudAlpha;

      if (i < logoCount) {
        const e = easeInOut(clamp((p - q.delay) / 0.3));
        if (e > 0) {
          const X1 = ox + q.tx * R + Math.sin(t * 0.9 + q.phase) * 0.6;
          const Y1 = oy + q.ty * R + Math.cos(t * 0.8 + q.phase) * 0.6;
          const dx = X1 - px0, dy = Y1 - py0;
          const arc = Math.sin(Math.PI * e) * q.swirl; // trayectoria curva
          x = px0 + dx * e - dy * arc;
          y = py0 + dy * e + dx * arc;
          size = cloudSize + (targetSize - cloudSize) * e;
          const formedAlpha = COLORS[q.cat].alpha * (0.85 + 0.15 * tw);
          alpha = cloudAlpha + (formedAlpha - cloudAlpha) * e;
          alpha *= 1 - logoIn * 0.86 * e;
        }
      } else {
        alpha *= 1 - logoIn * 0.35;
      }

      alpha *= intro;
      if (alpha < 0.02 || x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;

      const glyph = q.flips ? (q.glyph + Math.floor(t * q.speed * 1.5 + q.phase)) % 2 : q.glyph;
      const d = size * (SPRITE_PX / GLYPH_PX);
      ctx.globalAlpha = alpha > 1 ? 1 : alpha;
      ctx.drawImage(sprites[q.cat][glyph], x - d / 2, y - d / 2, d, d);
    }
    ctx.globalAlpha = 1;

    if (running) requestAnimationFrame(draw);
  }

  function play() {
    if (running || reduceMotion || !visible) return;
    running = true;
    requestAnimationFrame(draw);
  }

  /* ---------- Eventos ---------- */
  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (ev) => {
    mx = (ev.clientX / window.innerWidth) * 2 - 1;
    my = (ev.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) play(); else running = false;
  }).observe(hero);

  resize();

  if (reduceMotion) {
    // Sin animación: logo visible, título y navegación desde el inicio.
    root.classList.add("is-title", "is-ui");
    p = pTarget = 1;
    logo.style.setProperty("--logo-o", "0.22");
    requestAnimationFrame((now) => draw(now + 2000));
  } else {
    play();
  }
})();
