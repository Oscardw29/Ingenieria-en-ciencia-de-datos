/* ==========================================================================
   Ciclo de los datos en 3D: con el scroll, una nube de datos crudos pasa por
   captura, almacenamiento, procesamiento y análisis hasta formar un gráfico
   de barras de vóxeles. La cámara orbita en perspectiva mientras avanza.
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

  const COUNT = small ? 260 : 440;
  const CAT_COLORS = ["#5ee0ff", "#8b6bff", "#7d9df2"];
  const RAW_COLOR = "#c4cae8";
  const OUTLIER = "#ff5f7a";
  const SHARE = [0.24, 0.32, 0.44]; // proporción de cada categoría: el gráfico final sube
  const FLOOR = -0.78;

  const rand = (() => { let s = 7; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296; })();
  const gaussR = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  /* ---------- Puntos ---------- */
  const points = [];
  for (let n = 0; n < COUNT; n++) {
    const r = rand();
    const cat = r < SHARE[0] ? 0 : r < SHARE[0] + SHARE[1] ? 1 : 2;
    points.push({ cat, outlier: rand() < 0.14, delay: rand() * 0.35, phase: rand() * 6.28, speed: 0.6 + rand() * 1.4, lane: rand() });
  }
  const valid = points.filter((q) => !q.outlier);
  const byCat = [0, 1, 2].map((c) => valid.filter((q) => q.cat === c));
  const PCT = byCat.map((g) => Math.round((g.length / valid.length) * 100));

  // 0 Captura: nube esférica desordenada que llega desde la izquierda.
  points.forEach((q) => {
    const u = rand() * 2 - 1, a = rand() * Math.PI * 2, r = 0.25 + Math.cbrt(rand()) * 0.5;
    const ring = Math.sqrt(1 - u * u);
    q.s0 = [Math.cos(a) * ring * r * 1.3, u * r * 0.8 + 0.05, Math.sin(a) * ring * r];
    q.in = [-3 - rand() * 1.5, (rand() - 0.5) * 1.4, (rand() - 0.5) * 1.6];
  });

  // 1 Almacenamiento: tres cubos de vóxeles; la caja de cada uno se calcula con
  // los puntos que contiene, así ninguno queda por fuera.
  const BOX_X = [-0.82, 0, 0.82];
  const boxes = [];
  {
    const groups = [[], [], []];
    points.forEach((q, n) => groups[n % 3].push(q));
    groups.forEach((g, b) => {
      const side = Math.ceil(Math.cbrt(g.length));
      const layers = Math.ceil(g.length / (side * side));
      const d = 0.46 / Math.max(1, side - 1);
      const x0 = BOX_X[b] - ((side - 1) * d) / 2, z0 = -((side - 1) * d) / 2, y0 = FLOOR + 0.12;
      g.forEach((q, k) => {
        const gx = k % side, gz = Math.floor(k / side) % side, gy = Math.floor(k / (side * side));
        q.s1 = [x0 + gx * d, y0 + gy * d, z0 + gz * d];
      });
      const pad = d * 0.6;
      boxes.push({ min: [x0 - pad, y0 - pad, z0 - pad], max: [x0 + (side - 1) * d + pad, y0 + (layers - 1) * d + pad, z0 + (side - 1) * d + pad] });
    });
  }

  // 2 Procesamiento: tres carriles por categoría; los atípicos caen al piso.
  const LANE_Z = [-0.42, 0, 0.42];
  valid.forEach((q) => { q.s2 = [-1.05 + q.lane * 2.1, -0.28, LANE_Z[q.cat]]; });
  points.filter((q) => q.outlier).forEach((q) => { q.s2 = [-0.9 + rand() * 1.8, FLOOR + 0.02, (rand() - 0.5) * 1.1]; });

  // 3 Análisis: tres grupos esféricos.
  const CLUSTERS = [[-0.62, 0.0, -0.2], [0.62, 0.12, -0.15], [0, -0.22, 0.42]];
  const CLUSTER_R = 0.24;
  valid.forEach((q) => {
    const c = CLUSTERS[q.cat];
    let x, y, z;
    do { x = gaussR() * 0.42; y = gaussR() * 0.42; z = gaussR() * 0.42; } while (x * x + y * y + z * z > 0.9);
    q.s3 = [c[0] + x * CLUSTER_R, c[1] + y * CLUSTER_R, c[2] + z * CLUSTER_R];
  });

  // 4 Aprovechamiento: barras de vóxeles que crecen desde el piso.
  const BAR_X = [-0.7, 0, 0.7];
  const FOOT = 3;
  const VOX = 0.072;
  const bars = byCat.map((g, c) => {
    g.forEach((q, n) => {
      const fx = n % FOOT, fz = Math.floor(n / FOOT) % FOOT, fy = Math.floor(n / (FOOT * FOOT));
      q.s4 = [BAR_X[c] + (fx - (FOOT - 1) / 2) * VOX, FLOOR + 0.04 + fy * VOX, (fz - (FOOT - 1) / 2) * VOX];
    });
    const levels = Math.ceil(g.length / (FOOT * FOOT));
    const half = ((FOOT - 1) / 2) * VOX + VOX * 0.6;
    return { x: BAR_X[c], top: FLOOR + 0.04 + (levels - 1) * VOX + VOX * 0.6, half };
  });
  points.filter((q) => q.outlier).forEach((q) => { q.s3 = q.s4 = q.s2; });

  /* ---------- Sprites con brillo (uno por color) ---------- */
  const SPRITE = 32;
  const sprites = {};
  [...CAT_COLORS, RAW_COLOR, OUTLIER].forEach((color) => {
    const c = document.createElement("canvas");
    c.width = c.height = SPRITE;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.45, color + "55");
    grad.addColorStop(1, color + "00");
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE, SPRITE);
    sprites[color] = c;
  });

  /* ---------- Cámara ---------- */
  let W = 0, H = 0, dpr = 1, F = 300, cx = 0, cy = 0;
  let yaw = -0.5, pitch = 0.36, pointerYaw = 0, pointerYawS = 0;
  const DIST = 4;
  let cYw = 1, sYw = 0, cPt = 1, sPt = 0;
  function project(x, y, z) {
    const x1 = x * cYw - z * sYw;
    const z1 = x * sYw + z * cYw;
    // Cámara por encima del piso: lo lejano sube en pantalla y lo alto queda más cerca.
    const y1 = y * cPt + z1 * sPt;
    const z2 = -y * sPt + z1 * cPt;
    const s = F / (DIST + z2);
    return [cx + x1 * s, cy - y1 * s, s];
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const capH = small ? 74 : 64;
    F = Math.min((W * 0.47 * DIST) / 1.35, ((H - capH) * 0.42 * DIST) / 0.95);
    cx = W / 2;
    cy = (H - capH) * 0.5 + 6;
    if (reduceMotion) draw(performance.now());
  }

  /* ---------- Dibujo ---------- */
  let progress = 0, shown = 0, lastStep = -1;
  function readProgress() {
    const r = flow.getBoundingClientRect();
    const range = r.height - window.innerHeight;
    progress = range > 0 ? clamp(-r.top / range) : 1;
  }

  const line3 = (a, b) => {
    const p = project(...a), q = project(...b);
    ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
  };
  function boxEdges(min, max) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([a, b]) => line3(c[a], c[b]));
  }

  function draw(now) {
    const t = now / 1000;
    if (!reduceMotion) readProgress();
    shown += ((reduceMotion ? 1 : progress) - shown) * 0.12;
    const s = shown * 4;
    const stage = Math.min(4, Math.round(s));
    if (stage !== lastStep) {
      lastStep = stage;
      steps.forEach((li, k) => { li.classList.toggle("is-active", k === stage); li.classList.toggle("is-done", k < stage); });
      const li = steps[stage];
      caption.innerHTML = `<b>${li.querySelector(".pipeline__step").textContent} · ${li.querySelector(".pipeline__name").textContent}</b> ${li.querySelector(".pipeline__text").textContent}`;
    }

    // La cámara orbita con el scroll y sigue un poco al mouse.
    pointerYawS += (pointerYaw - pointerYawS) * 0.05;
    yaw = -0.62 + s * 0.24 + pointerYawS + (reduceMotion ? 0 : Math.sin(t * 0.25) * 0.05);
    pitch = 0.34 + Math.sin(s * 0.8) * 0.06;
    cYw = Math.cos(yaw); sYw = Math.sin(yaw); cPt = Math.cos(pitch); sPt = Math.sin(pitch);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const near = (k) => clamp(1 - Math.abs(s - k) * 1.6);

    drawFloor(t);
    drawDecor(near, t);

    // Puntos con brillo aditivo (no requieren orden de profundidad).
    ctx.globalCompositeOperation = "lighter";
    const k = Math.min(3, Math.floor(s));
    const flowX = reduceMotion ? 0 : t * 0.12;
    for (let n = 0; n < points.length; n++) {
      const q = points[n];
      // En el procesamiento los datos avanzan por su carril como en una banda.
      if (!q.outlier) q.s2[0] = -1.05 + ((q.lane * 2.1 + flowX) % 2.1);
      const local = ease(clamp((s - k - 0.15 - q.delay * 0.4) / 0.55));
      const a = q["s" + k], b = q["s" + (k + 1)];
      let x = a[0] + (b[0] - a[0]) * local;
      let y = a[1] + (b[1] - a[1]) * local;
      let z = a[2] + (b[2] - a[2]) * local;
      if (s < 0.4) {
        const arrive = ease(clamp((s + 0.15 - q.delay * 0.3) / 0.32));
        x = q.in[0] + (x - q.in[0]) * arrive;
        y = q.in[1] + (y - q.in[1]) * arrive;
        z = q.in[2] + (z - q.in[2]) * arrive;
      }
      const jitter = (s < 1 ? 0.03 : s < 2 ? 0.006 : 0.004) * (1 - near(4) * 0.9);
      x += Math.sin(t * q.speed + q.phase) * jitter;
      y += Math.cos(t * q.speed * 1.3 + q.phase) * jitter;
      z += Math.sin(t * q.speed * 0.7 + q.phase * 2) * jitter;

      const colorMix = clamp(s - 1.4);
      let alpha = 0.95, color;
      if (q.outlier) {
        alpha *= 1 - clamp((s - 2.2) / 0.6);
        if (alpha <= 0.02) continue;
        color = colorMix > 0.3 ? OUTLIER : RAW_COLOR;
      } else {
        color = colorMix > 0.5 ? CAT_COLORS[q.cat] : RAW_COLOR;
        // Se desvanecen en los extremos de la banda para no "saltar" al reiniciar.
        alpha *= 1 - near(2) * (1 - clamp((1.05 - Math.abs(q.s2[0])) / 0.2));
      }

      const [px, py, sc] = project(x, y, z);
      const size = (small ? 13 : 15) * sc / (F / DIST);
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprites[color], px - size / 2, py - size / 2, size, size);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    drawLabels(near);
  }

  function drawFloor(t) {
    // Piso en perspectiva con cuadrícula que se desvanece hacia los bordes.
    ctx.lineWidth = 1;
    for (let g = -6; g <= 6; g++) {
      const v = g * 0.24;
      const fade = 1 - Math.abs(g) / 7;
      ctx.strokeStyle = `rgba(125, 157, 242, ${(0.16 * fade).toFixed(3)})`;
      ctx.beginPath();
      line3([v, FLOOR, -1.45], [v, FLOOR, 1.45]);
      line3([-1.45, FLOOR, v], [1.45, FLOOR, v]);
      ctx.stroke();
    }
    // Pulso que recorre el piso.
    const r = ((t * 0.35) % 1) * 1.4;
    ctx.strokeStyle = `rgba(94, 224, 255, ${(0.35 * (1 - r / 1.4)).toFixed(3)})`;
    ctx.beginPath();
    for (let a = 0; a <= 48; a++) {
      const ang = (a / 48) * Math.PI * 2;
      const [px, py] = project(Math.cos(ang) * r, FLOOR, Math.sin(ang) * r);
      if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }

  function drawDecor(near, t) {
    ctx.lineWidth = 1.2;
    // Almacenamiento: cajas de las bases de datos, ajustadas a sus puntos.
    const a1 = near(1);
    if (a1 > 0.02) {
      ctx.strokeStyle = `rgba(125, 157, 242, ${(0.7 * a1).toFixed(3)})`;
      ctx.beginPath();
      boxes.forEach((b) => boxEdges(b.min, b.max));
      ctx.stroke();
    }
    // Procesamiento: carriles y compuerta de filtrado.
    const a2 = near(2);
    if (a2 > 0.02) {
      LANE_Z.forEach((z, c) => {
        ctx.strokeStyle = CAT_COLORS[c];
        ctx.globalAlpha = 0.45 * a2;
        ctx.beginPath(); line3([-1.15, -0.28, z], [1.15, -0.28, z]); ctx.stroke();
      });
      ctx.globalAlpha = a2;
      const gate = [[0, -0.6, -0.6], [0, 0.05, -0.6], [0, 0.05, 0.6], [0, -0.6, 0.6]].map((p) => project(...p));
      ctx.fillStyle = "rgba(94, 224, 255, .07)";
      ctx.strokeStyle = "rgba(94, 224, 255, .55)";
      ctx.beginPath();
      gate.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Análisis: círculos alrededor de cada grupo (siempre de frente a la cámara).
    const a3 = near(3);
    if (a3 > 0.02) {
      CLUSTERS.forEach((c, k) => {
        const [px, py, sc] = project(...c);
        const r = CLUSTER_R * 1.25 * sc * (1 + Math.sin(t * 2 + k) * 0.03);
        ctx.strokeStyle = CAT_COLORS[k];
        ctx.globalAlpha = 0.7 * a3;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.18 * a3;
        ctx.setLineDash([3, 6]);
        ctx.beginPath(); ctx.arc(px, py, r * 1.25, t * 0.5, t * 0.5 + Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      });
      ctx.globalAlpha = 1;
    }
    // Aprovechamiento: cajas de las barras y línea de tendencia.
    const a4 = near(4);
    if (a4 > 0.02) {
      ctx.strokeStyle = `rgba(167, 175, 212, ${(0.45 * a4).toFixed(3)})`;
      ctx.beginPath();
      bars.forEach((b) => boxEdges([b.x - b.half, FLOOR, -b.half], [b.x + b.half, b.top, b.half]));
      ctx.stroke();
      const tops = bars.map((b) => project(b.x, b.top + 0.08, 0));
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.9 * a4).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      tops.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 255, 255, ${a4.toFixed(3)})`;
      tops.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); });
      ctx.lineWidth = 1;
    }
  }

  function drawLabels(near) {
    const font = small ? 11 : 12;
    ctx.font = `600 ${font}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    const a3 = near(3), a4 = near(4);
    ["A", "B", "C"].forEach((l, c) => {
      if (a3 > 0.05) {
        const [px, py] = project(CLUSTERS[c][0], CLUSTERS[c][1] + CLUSTER_R * 1.5, CLUSTERS[c][2]);
        ctx.fillStyle = CAT_COLORS[c];
        ctx.globalAlpha = a3;
        ctx.fillText(`Grupo ${l}`, px, py - 4);
      }
      if (a4 > 0.05) {
        const [px, py] = project(bars[c].x, FLOOR, bars[c].half + 0.32);
        ctx.globalAlpha = a4;
        ctx.fillStyle = "#eef1ff";
        ctx.fillText(`Grupo ${l}`, px, py + 14);
        ctx.fillStyle = CAT_COLORS[c];
        ctx.fillText(`${PCT[c]} %`, px, py + 14 + font + 4);
      }
    });
    ctx.globalAlpha = 1;
  }

  /* ---------- Ciclo de vida ---------- */
  let running = false;
  const loop = (now) => { draw(now); if (running) requestAnimationFrame(loop); };
  new IntersectionObserver(([entry]) => {
    if (reduceMotion) return;
    if (entry.isIntersecting && !running) { running = true; requestAnimationFrame(loop); }
    else if (!entry.isIntersecting) running = false;
  }).observe(flow);
  if (!reduceMotion) {
    canvas.parentElement.addEventListener("pointermove", (ev) => {
      if (ev.pointerType !== "mouse") return;
      const r = canvas.getBoundingClientRect();
      pointerYaw = ((ev.clientX - r.left) / r.width - 0.5) * 0.5;
    });
    canvas.parentElement.addEventListener("pointerleave", () => { pointerYaw = 0; });
  }
  window.addEventListener("resize", resize);
  resize();
  if (reduceMotion) { shown = 1; draw(performance.now()); }
})();
