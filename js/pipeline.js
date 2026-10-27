/* ==========================================================================
   Ciclo de los datos: con el scroll, una mancha de datos crudos pasa por
   captura, almacenamiento, procesamiento y análisis hasta formar un gráfico.
   ========================================================================== */
(() => {
  const flow = document.getElementById("flow");
  const canvas = document.getElementById("flow-canvas");
  if (!flow || !canvas) return;
  const ctx = canvas.getContext("2d");
  const caption = document.getElementById("flow-caption");
  const steps = [...flow.querySelectorAll(".pipeline li")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.innerWidth < 760;

  const COUNT = small ? 240 : 420;
  const CAT_COLORS = ["#5ee0ff", "#8b6bff", "#7d9df2"];
  const RAW = [196, 202, 232];
  const OUTLIER = "#ff5f7a";
  const SHARE = [0.24, 0.32, 0.44]; // proporción de cada categoría: el gráfico final sube

  const rand = (() => { let s = 7; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296; })();
  const gaussR = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());

  /* ---------- Puntos y sus destinos en cada etapa (coordenadas 0..1) ---------- */
  const points = [];
  for (let n = 0; n < COUNT; n++) {
    const r = rand();
    const cat = r < SHARE[0] ? 0 : r < SHARE[0] + SHARE[1] ? 1 : 2;
    points.push({ cat, outlier: rand() < 0.14, delay: rand() * 0.35, phase: rand() * 6.28, speed: 0.6 + rand() * 1.4 });
  }
  const valid = points.filter((q) => !q.outlier);

  // 0 Captura: nube desordenada.
  points.forEach((q) => {
    const a = rand() * Math.PI * 2, d = Math.abs(gaussR()) * 0.16 + rand() * 0.06;
    q.s0 = [0.5 + Math.cos(a) * d * 1.5, 0.5 + Math.sin(a) * d];
    q.in = [-0.1 - rand() * 0.3, 0.2 + rand() * 0.6]; // de dónde llega
  });

  // 1 Almacenamiento: tres cubos isométricos de puntos (bases de datos).
  {
    const per = Math.ceil(COUNT / 3);
    const side = Math.ceil(Math.cbrt(per));
    points.forEach((q, n) => {
      const box = n % 3, k = Math.floor(n / 3);
      const gx = k % side, gy = Math.floor(k / side) % side, gz = Math.floor(k / (side * side));
      const d = 0.042 / Math.max(1, side / 4);
      const cx = 0.22 + box * 0.28, cy = 0.56;
      q.s1 = [cx + (gx - gy) * d * 0.87, cy + (gx + gy) * d * 0.5 - gz * d - side * d * 0.2];
    });
  }

  // 2 Procesamiento: filas por categoría; los atípicos se descartan hacia abajo.
  {
    const rows = [[], [], []];
    valid.forEach((q) => rows[q.cat].push(q));
    rows.forEach((row, c) => row.forEach((q, n) => {
      q.s2 = [0.1 + (n / Math.max(1, row.length - 1)) * 0.8, 0.32 + c * 0.17];
    }));
    points.filter((q) => q.outlier).forEach((q) => { q.s2 = [0.15 + rand() * 0.7, 0.84 + rand() * 0.05]; });
  }

  // 3 Análisis: tres grupos.
  const CLUSTERS = [[0.3, 0.4], [0.7, 0.36], [0.5, 0.7]];
  valid.forEach((q) => {
    const [cx, cy] = CLUSTERS[q.cat];
    q.s3 = [cx + gaussR() * 0.06, cy + gaussR() * 0.045];
  });

  // 4 Aprovechamiento: gráfico de barras hecho con los mismos puntos.
  const BAR_X = [0.27, 0.5, 0.73];
  const BAR_COLS = small ? 6 : 8;
  const barTops = [0, 0, 0];
  {
    const rows = [[], [], []];
    valid.forEach((q) => rows[q.cat].push(q));
    rows.forEach((row, c) => row.forEach((q, n) => {
      const col = n % BAR_COLS, rowN = Math.floor(n / BAR_COLS);
      q.s4 = [BAR_X[c] + (col - (BAR_COLS - 1) / 2) * 0.017, 0.84 - rowN * 0.027];
      barTops[c] = Math.max(barTops[c], rowN);
    }));
  }
  points.filter((q) => q.outlier).forEach((q) => { q.s3 = q.s4 = q.s2; });
  // Porcentaje real de cada grupo entre los datos que sobrevivieron a la limpieza.
  const PCT = [0, 1, 2].map((c) => Math.round((valid.filter((q) => q.cat === c).length / valid.length) * 100));

  /* ---------- Dibujo ---------- */
  let W = 0, H = 0, dpr = 1, progress = 0, shown = 0, lastStep = -1;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (reduceMotion) draw(performance.now());
  }

  // Área útil con margen; en pantallas anchas se limita la proporción.
  function box() {
    const pad = 18, capH = small ? 64 : 56;
    const w = W - pad * 2, h = H - pad - capH;
    const size = Math.min(w, h * 1.7);
    return { x: (W - size) / 2, y: pad, w: size, h };
  }

  function readProgress() {
    const r = flow.getBoundingClientRect();
    const range = r.height - window.innerHeight;
    progress = range > 0 ? clamp(-r.top / range) : 1;
  }

  function draw(now) {
    const t = now / 1000;
    if (!reduceMotion) readProgress();
    shown += ((reduceMotion ? 1 : progress) - shown) * 0.12;
    const s = shown * 4; // 0..4, una unidad por etapa
    const stage = Math.min(4, Math.round(s));
    if (stage !== lastStep) {
      lastStep = stage;
      steps.forEach((li, k) => {
        li.classList.toggle("is-active", k === stage);
        li.classList.toggle("is-done", k < stage);
      });
      const li = steps[stage];
      caption.innerHTML = `<b>${li.querySelector(".pipeline__step").textContent} · ${li.querySelector(".pipeline__name").textContent}</b> ${li.querySelector(".pipeline__text").textContent}`;
    }

    const B = box();
    const X = (v) => B.x + v * B.w, Y = (v) => B.y + v * B.h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Peso de cada etapa para las decoraciones (1 en su punto, 0 lejos).
    const near = (k) => clamp(1 - Math.abs(s - k) * 1.6);
    drawDecor(near, X, Y, t);

    const size = small ? 3.2 : 3.6;
    for (let n = 0; n < points.length; n++) {
      const q = points[n];
      // Posición entre la etapa actual y la siguiente, con retraso por punto.
      const k = Math.min(3, Math.floor(s));
      const local = ease(clamp((s - k - 0.15 - q.delay * 0.4) / 0.55));
      const from = q["s" + k], to = q["s" + (k + 1)];
      let x = from[0] + (to[0] - from[0]) * local;
      let y = from[1] + (to[1] - from[1]) * local;
      // Llegada inicial desde la izquierda.
      if (s < 0.35) {
        const arrive = ease(clamp((s + 0.12 - q.delay * 0.3) / 0.3));
        x = q.in[0] + (x - q.in[0]) * arrive;
        y = q.in[1] + (y - q.in[1]) * arrive;
      }
      // Agitación: fuerte con los datos crudos, casi nula en el gráfico.
      const jitter = (s < 1 ? 0.012 : s < 2 ? 0.003 : 0.0015) * (1 - near(4) * 0.9);
      x += Math.sin(t * q.speed + q.phase) * jitter;
      y += Math.cos(t * q.speed * 1.3 + q.phase) * jitter;

      // Color: crudo → por categoría desde el procesamiento; atípicos en rojo.
      const colorMix = clamp(s - 1.4);
      let alpha = 0.9;
      if (q.outlier) {
        alpha *= 1 - clamp((s - 2.2) / 0.6);
        if (alpha <= 0.02) continue;
        ctx.fillStyle = colorMix > 0.3 ? OUTLIER : `rgb(${RAW})`;
      } else {
        ctx.fillStyle = colorMix > 0.5 ? CAT_COLORS[q.cat] : `rgb(${RAW})`;
      }
      ctx.globalAlpha = alpha;
      ctx.fillRect(X(x) - size / 2, Y(y) - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawDecor(near, X, Y, t) {
    ctx.lineWidth = 1;
    // Almacenamiento: aristas de los cubos.
    const a1 = near(1);
    if (a1 > 0.02) {
      ctx.strokeStyle = `rgba(125, 157, 242, ${0.5 * a1})`;
      for (let b = 0; b < 3; b++) {
        const cx = X(0.22 + b * 0.28), cy = Y(0.56);
        const r = B0() * 0.11;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 1.1); ctx.lineTo(cx + r * 0.95, cy - r * 0.55); ctx.lineTo(cx + r * 0.95, cy + r * 0.55);
        ctx.lineTo(cx, cy + r * 1.1); ctx.lineTo(cx - r * 0.95, cy + r * 0.55); ctx.lineTo(cx - r * 0.95, cy - r * 0.55); ctx.closePath();
        ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + r * 1.1);
        ctx.moveTo(cx, cy); ctx.lineTo(cx - r * 0.95, cy - r * 0.55);
        ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.95, cy - r * 0.55);
        ctx.stroke();
      }
    }
    // Procesamiento: filtro y zona de descarte.
    const a2 = near(2);
    if (a2 > 0.02) {
      ctx.strokeStyle = `rgba(255, 95, 122, ${0.45 * a2})`;
      ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(X(0.08), Y(0.78)); ctx.lineTo(X(0.92), Y(0.78)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255, 95, 122, ${0.8 * a2})`;
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.textAlign = "left";
      ctx.fillText("descartados", X(0.08), Y(0.78) - 6);
    }
    // Análisis: anillos de cada grupo.
    const a3 = near(3);
    if (a3 > 0.02) {
      CLUSTERS.forEach(([cx, cy], c) => {
        const pulse = 1 + Math.sin(t * 2 + c) * 0.04;
        ctx.strokeStyle = CAT_COLORS[c];
        ctx.globalAlpha = 0.55 * a3;
        ctx.beginPath();
        ctx.ellipse(X(cx), Y(cy), 0.15 * B0() * pulse, 0.11 * B0() * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
    // Aprovechamiento: ejes, línea de tendencia y conclusión.
    const a4 = near(4);
    if (a4 > 0.02) {
      ctx.strokeStyle = `rgba(167, 175, 212, ${0.5 * a4})`;
      ctx.beginPath(); ctx.moveTo(X(0.12), Y(0.86)); ctx.lineTo(X(0.88), Y(0.86)); ctx.stroke();
      const tops = BAR_X.map((bx, c) => [X(bx), Y(0.84 - barTops[c] * 0.027 - 0.06)]);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * a4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      tops.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = `rgba(255, 255, 255, ${a4})`;
      tops.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); });
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ["A", "B", "C"].forEach((l, c) => {
        ctx.fillText(`Grupo ${l}`, X(BAR_X[c]), Y(0.86) + 16);
        ctx.fillText(`${PCT[c]} %`, X(BAR_X[c]), Y(0.86) + 31);
      });
    }
  }
  const B0 = () => box().w;

  /* ---------- Ciclo de vida ---------- */
  let running = false;
  const loop = (now) => { draw(now); if (running) requestAnimationFrame(loop); };
  new IntersectionObserver(([entry]) => {
    if (reduceMotion) return;
    if (entry.isIntersecting && !running) { running = true; requestAnimationFrame(loop); }
    else if (!entry.isIntersecting) running = false;
  }).observe(flow);
  window.addEventListener("resize", resize);
  resize();
  if (reduceMotion) { shown = 1; draw(performance.now()); }
})();
