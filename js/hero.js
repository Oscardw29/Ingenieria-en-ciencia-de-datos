/* ==========================================================================
   Hero: una nube de 0 y 1 que, con el scroll, vuela y forma el logo.
   La nube vive en 3D: cámara con perspectiva que avanza con el scroll,
   inclinación con el mouse o el giroscopio, repulsión del cursor y
   profundidad de campo.
   ========================================================================== */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const hero = document.querySelector(".hero");
  const heroBg = document.querySelector(".hero__bg");
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

  /* Capa de profundidad de cada categoría al formar el logo (en radios del logo,
     positivo = más al fondo): al inclinar la escena el logo se ve por capas. */
  const LAYER_Z = [-0.14, 0.1, 0.16, 0.05, 0, -0.06, -0.08, -0.08, 0];

  /* Atlas de sprites "0" y "1" con brillo: una fila por color y una columna por
     dígito y nivel de desenfoque (profundidad de campo). Un solo lienzo de origen
     hace cada drawImage varias veces más barato que usar un lienzo por sprite.
     El desenfoque usa la sombra del texto desplazada fuera de la celda, que
     funciona en todos los navegadores. */
  const GLYPH_PX = 32;
  const SPRITE_PX = 80;
  const BLUR_LEVELS = [0, 5, 13];
  const atlas = document.createElement("canvas");
  atlas.width = SPRITE_PX * 2 * BLUR_LEVELS.length;
  atlas.height = SPRITE_PX * COLORS.length;
  function buildSprites() {
    const g = atlas.getContext("2d");
    g.clearRect(0, 0, atlas.width, atlas.height);
    g.font = `700 ${GLYPH_PX}px "JetBrains Mono", ui-monospace, monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    COLORS.forEach(({ color }, row) => {
      g.fillStyle = color;
      g.shadowColor = color;
      ["0", "1"].forEach((glyph, gi) => {
        BLUR_LEVELS.forEach((blur, lv) => {
          const cx = (gi * BLUR_LEVELS.length + lv + 0.5) * SPRITE_PX;
          const cy = (row + 0.5) * SPRITE_PX + 1;
          g.save();
          g.beginPath();
          g.rect(cx - SPRITE_PX / 2, cy - 1 - SPRITE_PX / 2, SPRITE_PX, SPRITE_PX);
          g.clip();
          if (blur === 0) {
            g.shadowBlur = 12;
            g.fillText(glyph, cx, cy);
            g.shadowBlur = 0;
            g.fillText(glyph, cx, cy);
          } else {
            const off = atlas.width + SPRITE_PX;
            g.shadowBlur = blur;
            g.shadowOffsetX = off;
            for (let k = 0; k < 3; k++) g.fillText(glyph, cx - off, cy);
          }
          g.restore();
        });
      });
    });
  }
  buildSprites();
  if (document.fonts) document.fonts.load('700 32px "JetBrains Mono"').then(buildSprites, () => {});

  /* ---------- Partículas ---------- */
  const raw = window.LOGO_POINTS || [];
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || window.innerWidth < 760;
  const keepRatio = small ? 0.32 : 1;
  const ambientCount = small ? 220 : 650;

  /* Profundidades en unidades de la distancia focal: 0 es el plano del logo. */
  const Z_NEAR = -0.33, Z_FAR = 1.35;   // rango inicial de la nube
  const Z_MIN = -0.85, Z_MAX = 1.6;     // el ambiente se recicla dentro de este rango
  const DOLLY = 0.75;                   // cuánto avanza la cámara en todo el scroll

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
    const near = Math.random() ** 1.6; // más partículas al fondo
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 1.15;
    // Los puntos lejanos del centro del logo llegan un poco después.
    const dist = tx === null ? 0 : Math.hypot(tx, ty);
    return {
      tx, ty, cat,
      zn: Z_FAR - near * (Z_FAR - Z_NEAR),
      cx: Math.cos(angle) * radius,
      cy: Math.sin(angle) * radius * 0.9,
      delay: 0.02 + dist * 0.08 + Math.random() * 0.11,
      phase: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.55,
      swirl: (Math.random() - 0.5) * 0.9,
      glyph: Math.random() < 0.5 ? 0 : 1,
      flips: Math.random() < 0.18,
      ox: 0, oy: 0, // desplazamiento por la repulsión del cursor
    };
  }

  /* ---------- Estado ---------- */
  let W = 0, H = 0, dpr = 1, logoPx = 0, F = 900;
  let pTarget = 0, p = 0;
  let tiltX = 0, tiltY = 0, tiltXS = 0, tiltYS = 0; // entrada de inclinación en -1..1
  let gyroOn = false, gyroBase = null;
  let pointerX = 0, pointerY = 0, pointerOn = false, pointerUntil = 0, push = 0;
  let running = false, visible = true;
  let titleOn = false, uiOn = false;
  const start = performance.now();

  /* Medidas de layout en caché: el render no lee el layout en cada cuadro,
     solo se recalculan al cambiar el tamaño o al terminar de cargar. */
  let heroTop = 0, heroH = 0, scrollRange = 1, panelTopPage = 0, headerH = 0, copyHalf = 0;

  /* Calidad adaptable: si los cuadros tardan demasiado se baja la resolución
     del lienzo y, como último paso, se dibuja una de cada dos partículas
     (salvo las letras). Cada nivel es [densidad de píxeles máxima, salto]. */
  let quality = 0, frameAvg = 16, lastNow = 0, framesAtQuality = 0;
  const LEVELS = small
    ? [[1.5, 1], [1.25, 1], [1, 1], [1, 2]]
    : [[2, 1], [1.5, 1], [1.25, 1], [1.25, 2]];

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  // Escribe una variable CSS solo si cambió, para no invalidar estilos de más.
  const written = new WeakMap();
  function setVar(el, name, value) {
    let vars = written.get(el);
    if (!vars) written.set(el, (vars = {}));
    if (vars[name] === value) return;
    vars[name] = value;
    el.style.setProperty(name, value);
  }

  function measure() {
    const y = window.scrollY;
    heroTop = hero.getBoundingClientRect().top + y;
    heroH = hero.offsetHeight;
    scrollRange = heroH - window.innerHeight;
    panelTopPage = panelWrap.getBoundingClientRect().top + y;
    headerH = header.offsetHeight;
    copyHalf = copy.offsetHeight / 2;
    logoPx = logo.offsetWidth;
  }

  function resize() {
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    const nextDpr = Math.min(window.devicePixelRatio || 1, LEVELS[quality][0]);
    // En móvil la barra del navegador dispara "resize" al hacer scroll; si el
    // lienzo no cambió de tamaño no se reasigna (eso lo borraría y es costoso).
    if (cssW !== W || cssH !== H || nextDpr !== dpr) {
      W = cssW;
      H = cssH;
      dpr = nextDpr;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    F = Math.max(W, H) * 0.9;
    setVar(logo, "--persp", F.toFixed(0) + "px");
    measure();
    readScroll();
  }

  function readScroll() {
    pTarget = scrollRange > 0 ? clamp((window.scrollY - heroTop) / scrollRange) : 1;
  }

  /* ---------- Línea de tiempo según el progreso del scroll ---------- */
  function applyTimeline() {
    const logoIn = smooth(0.46, 0.56, p);
    const recede = smooth(0.56, 0.7, p);
    const scrollY = window.scrollY;

    setVar(logo, "--logo-o", (logoIn * (1 - recede * 0.78)).toFixed(3));
    setVar(logo, "--logo-s", (0.96 + logoIn * 0.04 + recede * 0.22).toFixed(4));
    setVar(logo, "--logo-blur", (recede * 1.5).toFixed(2) + "px");
    setVar(hint, "--hint-o", (1 - smooth(0, 0.05, pTarget)).toFixed(3));

    // Título con histéresis para que no parpadee en el umbral.
    if (!titleOn && pTarget > 0.6) { titleOn = true; root.classList.add("is-title"); }
    else if (titleOn && pTarget < 0.55) { titleOn = false; root.classList.remove("is-title"); }

    const heroBottom = heroTop + heroH - scrollY;
    const showUi = pTarget > 0.72 || heroBottom < window.innerHeight;
    if (showUi !== uiOn) { uiOn = showUi; root.classList.toggle("is-ui", uiOn); }

    // El contenedor que sube empuja el título hacia arriba en lugar de taparlo.
    // Posiciones relativas al bloque sticky (que se suelta al final del hero).
    const stickyTop = Math.min(0, heroBottom - H);
    const panelTop = panelTopPage - scrollY - stickyTop;
    let shift = Math.min(0, panelTop - 32 - (H / 2 + copyHalf));
    shift = Math.max(shift, headerH + 20 - (H / 2 - copyHalf));
    setVar(copy, "--copy-y", shift.toFixed(1) + "px");

    return { logoIn, recede, stickyTop };
  }

  /* ---------- Render ---------- */
  function adaptQuality(now) {
    const dt = lastNow ? Math.min(100, now - lastNow) : 16;
    lastNow = now;
    frameAvg += (dt - frameAvg) * 0.05;
    framesAtQuality++;
    // Se mide después del arranque y con margen para no reaccionar a picos.
    if (framesAtQuality > 90 && frameAvg > 24 && quality < LEVELS.length - 1) {
      // Salta los niveles que no cambiarían nada (p. ej. pantallas de densidad 1).
      const effective = (q) => Math.min(window.devicePixelRatio || 1, LEVELS[q][0]) + "/" + LEVELS[q][1];
      const current = effective(quality);
      do quality++; while (quality < LEVELS.length - 1 && effective(quality) === current);
      framesAtQuality = 0;
      frameAvg = 16;
      resize();
    }
  }

  function draw(now) {
    adaptQuality(now);
    const t = (now - start) / 1000;
    const intro = smooth(0, 1.4, t);
    p += (pTarget - p) * 0.085;
    if (Math.abs(pTarget - p) < 0.0005) p = pTarget;
    tiltXS += (tiltX - tiltXS) * 0.06;
    tiltYS += (tiltY - tiltYS) * 0.06;
    const pointerActive = pointerOn || now < pointerUntil;
    push += ((pointerActive ? 1 : 0) - push) * 0.08;

    const { logoIn, recede, stickyTop } = applyTimeline();

    // Inclinación de la cámara: entrada del usuario más un vaivén suave.
    const ry = reduceMotion ? 0 : -tiltXS * 0.13 + Math.sin(t * 0.23) * 0.035;
    const rx = reduceMotion ? 0 : tiltYS * 0.09 + Math.sin(t * 0.17 + 1) * 0.02;
    const cY = Math.cos(ry), sY = Math.sin(ry), cX = Math.cos(rx), sX = Math.sin(rx);
    if (logoIn > 0) {
      setVar(logo, "--logo-ry", (-ry).toFixed(3) + "rad");
      setVar(logo, "--logo-rx", (-rx).toFixed(3) + "rad");
    }
    setVar(heroBg, "--tilt-x", (ry / 0.13).toFixed(2));
    setVar(heroBg, "--tilt-y", (rx / 0.09).toFixed(2));

    const logoScale = 0.96 + logoIn * 0.04 + recede * 0.22;
    const R = (logoPx / 2) * logoScale;
    const ox = W / 2, oy = H / 2;
    const spreadX = Math.max(W, H * 0.8) * 0.62;
    const spreadY = Math.max(H, W * 0.5) * 0.62;
    const targetSize = Math.max(4.2, logoPx / 82);
    const camZ = p * DOLLY; // la cámara avanza dentro de la nube
    const span = Z_MAX - Z_MIN;
    const stride = LEVELS[quality][1];
    // En móvil se usa el nivel de desenfoque más cercano en vez de mezclar dos.
    const blend = !small && quality === 0;

    // Repulsión: posición del puntero relativa al lienzo (que sigue al sticky).
    const px = pointerX, py = pointerY - stickyTop;
    const reach = Math.max(110, Math.min(W, H) * 0.16);
    const pushPx = reach * 0.55 * push;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < particles.length; i++) {
      const q = particles[i];
      if (stride > 1 && i % stride && q.cat !== 0) continue;
      const isLogo = i < logoCount;
      const tw = 0.65 + 0.35 * Math.sin(t * (1.2 + q.speed * 2) + q.phase); // titileo

      // Posición en la nube (mundo). X/Y se escalan con la profundidad inicial
      // para que la composición en pantalla no cambie al empezar.
      let zn = q.zn;
      if (!isLogo) zn = ((((zn - camZ) - Z_MIN) % span) + span) % span + Z_MIN;
      const k = 1 + q.zn;
      const near = clamp((Z_FAR - zn) / (Z_FAR - Z_NEAR));
      let X = q.cx * spreadX * k + Math.sin(t * q.speed + q.phase) * (10 + near * 22);
      let Y = q.cy * spreadY * k + Math.cos(t * q.speed * 0.8 + q.phase * 1.3) * (8 + near * 18);
      let Z = zn * F;
      let size = 13;
      let alpha = (0.1 + near * 0.62) * tw;

      if (isLogo) {
        const e = easeInOut(clamp((p - q.delay) / 0.3));
        if (e > 0) {
          // Destino en su capa; X/Y compensados para coincidir con el logo sin inclinar.
          const Zt = LAYER_Z[q.cat] * R;
          const kt = (F + Zt) / F;
          const X1 = (q.tx * R + Math.sin(t * 0.9 + q.phase) * 0.6) * kt;
          const Y1 = (q.ty * R + Math.cos(t * 0.8 + q.phase) * 0.6) * kt;
          const dx = X1 - X, dy = Y1 - Y;
          const arc = Math.sin(Math.PI * e) * q.swirl; // trayectoria curva
          X += dx * e - dy * arc;
          Y += dy * e + dx * arc;
          Z += (Zt - Z) * e;
          size += (targetSize * kt - size) * e;
          const formedAlpha = COLORS[q.cat].alpha * (0.85 + 0.15 * tw);
          alpha += (formedAlpha - alpha) * e;
          alpha *= 1 - logoIn * 0.86 * e;
        }
      } else {
        alpha *= 1 - logoIn * 0.35;
        // Se desvanecen al pasar junto a la cámara y al reaparecer al fondo.
        alpha *= smooth(Z_MIN, Z_MIN + 0.25, zn) * (1 - smooth(Z_MAX - 0.25, Z_MAX, zn));
      }
      alpha *= intro;
      if (alpha < 0.02) { q.ox *= 0.86; q.oy *= 0.86; continue; }

      // Rotación de la cámara (yaw y luego pitch) y proyección en perspectiva.
      const X2 = X * cY + Z * sY;
      const Z1 = -X * sY + Z * cY;
      const Y2 = Y * cX - Z1 * sX;
      const Z2 = Y * sX + Z1 * cX;
      const depth = F + Z2;
      if (depth < F * 0.1) continue;
      const s = F / depth;
      let x = ox + X2 * s;
      let y = oy + Y2 * s;

      // Repulsión del cursor, con resorte para volver suavemente.
      let fx = 0, fy = 0;
      if (pushPx > 0.5) {
        const ddx = x + q.ox - px, ddy = y + q.oy - py;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 < reach * reach) {
          const d = Math.sqrt(d2) + 0.001;
          const f = (1 - d / reach) ** 2 * pushPx * Math.min(1.6, s);
          fx = (ddx / d) * f;
          fy = (ddy / d) * f;
        }
      }
      q.ox += (fx - q.ox) * 0.14;
      q.oy += (fy - q.oy) * 0.14;
      x += q.ox;
      y += q.oy;

      size *= s;
      if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;

      // Profundidad de campo: enfocado en el plano del logo, más borroso
      // hacia el fondo y aún más cerca de la cámara.
      const off = Z2 / F;
      const blur = clamp((Math.abs(off) * (off < 0 ? 1.7 : 1) - 0.16) / 0.42, 0, BLUR_LEVELS.length - 1);

      const glyph = q.flips ? (q.glyph + Math.floor(t * q.speed * 1.5 + q.phase)) % 2 : q.glyph;
      const d = size * (SPRITE_PX / GLYPH_PX);
      const a = alpha > 1 ? 1 : alpha;
      const sx = glyph * BLUR_LEVELS.length * SPRITE_PX;
      const sy = q.cat * SPRITE_PX;
      const lv = blend ? Math.floor(blur) : Math.round(blur);
      const mix = blend ? blur - lv : 0;
      if (mix < 0.08 || lv === BLUR_LEVELS.length - 1) {
        ctx.globalAlpha = a;
        ctx.drawImage(atlas, sx + lv * SPRITE_PX, sy, SPRITE_PX, SPRITE_PX, x - d / 2, y - d / 2, d, d);
      } else if (mix > 0.92) {
        ctx.globalAlpha = a;
        ctx.drawImage(atlas, sx + (lv + 1) * SPRITE_PX, sy, SPRITE_PX, SPRITE_PX, x - d / 2, y - d / 2, d, d);
      } else {
        ctx.globalAlpha = a * (1 - mix);
        ctx.drawImage(atlas, sx + lv * SPRITE_PX, sy, SPRITE_PX, SPRITE_PX, x - d / 2, y - d / 2, d, d);
        ctx.globalAlpha = a * mix;
        ctx.drawImage(atlas, sx + (lv + 1) * SPRITE_PX, sy, SPRITE_PX, SPRITE_PX, x - d / 2, y - d / 2, d, d);
      }
    }
    ctx.globalAlpha = 1;

    if (running) requestAnimationFrame(draw);
  }

  function play() {
    if (running || reduceMotion || !visible) return;
    running = true;
    lastNow = 0;
    requestAnimationFrame(draw);
  }

  /* ---------- Eventos ---------- */
  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", resize);
  window.addEventListener("load", resize);
  if (document.fonts) document.fonts.ready.then(resize, () => {});

  if (!reduceMotion) {
    window.addEventListener("pointermove", (ev) => {
      pointerX = ev.clientX;
      pointerY = ev.clientY;
      if (ev.pointerType === "touch") { pointerUntil = performance.now() + 600; return; }
      pointerOn = true;
      if (!gyroOn) {
        tiltX = (ev.clientX / window.innerWidth) * 2 - 1;
        tiltY = (ev.clientY / window.innerHeight) * 2 - 1;
      }
    }, { passive: true });
    window.addEventListener("pointerdown", (ev) => {
      pointerX = ev.clientX;
      pointerY = ev.clientY;
      pointerUntil = performance.now() + 700;
    }, { passive: true });
    document.addEventListener("pointerleave", () => { pointerOn = false; });
    window.addEventListener("blur", () => { pointerOn = false; });

    /* Giroscopio: la inclinación del teléfono mueve la cámara. La posición
       inicial cuenta como neutra y se recentra poco a poco. */
    const onOrientation = (ev) => {
      if (ev.beta === null || ev.gamma === null) return;
      const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      let gx = ev.gamma, gy = ev.beta;
      if (angle === 90) [gx, gy] = [ev.beta, -ev.gamma];
      else if (angle === -90 || angle === 270) [gx, gy] = [-ev.beta, ev.gamma];
      else if (angle === 180) [gx, gy] = [-ev.gamma, -ev.beta];
      if (!gyroBase) gyroBase = { x: gx, y: gy };
      gyroBase.x += (gx - gyroBase.x) * 0.004;
      gyroBase.y += (gy - gyroBase.y) * 0.004;
      gyroOn = true;
      tiltX = clamp((gx - gyroBase.x) / 20, -1, 1);
      tiltY = clamp((gy - gyroBase.y) / 20, -1, 1);
    };
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      // iOS pide permiso tras un gesto del usuario.
      const ask = () => {
        DOE.requestPermission().then((state) => {
          window.removeEventListener("click", ask);
          window.removeEventListener("touchend", ask);
          if (state === "granted") window.addEventListener("deviceorientation", onOrientation);
        }, () => {});
      };
      window.addEventListener("click", ask);
      window.addEventListener("touchend", ask);
    } else if (DOE) {
      window.addEventListener("deviceorientation", onOrientation, { passive: true });
    }
  }

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
