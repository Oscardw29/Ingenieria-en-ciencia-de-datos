/* ==========================================================================
   Santa Marta en datos: maqueta isométrica animada (Sierra Nevada, bahía,
   ciudad y mar Caribe) con indicadores que salen de cada elemento.
   El relieve es procedural y estilizado; los valores son ilustrativos.
   ========================================================================== */
(() => {
  const canvas = document.getElementById("sm-canvas");
  const labelsEl = document.getElementById("sm-labels");
  if (!canvas || !labelsEl) return;
  const stage = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.innerWidth < 760;

  /* ---------- Relieve procedural ---------- */
  const N = small ? 40 : 58;           // celdas por lado
  const BASE_Z = -0.34;                // fondo del bloque
  const hash = (x, y) => {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) {
    let s = 0, amp = 0.5, f = 1;
    for (let o = 0; o < 4; o++) { s += amp * noise(x * f, y * f); f *= 2.03; amp *= 0.5; }
    return s;
  }
  const gauss = (u, v, cu, cv, r) => Math.exp(-((u - cu) ** 2 + (v - cv) ** 2) / (r * r));

  // u crece hacia el frente derecho y v hacia el frente izquierdo; la Sierra
  // queda al fondo y el mar Caribe al frente, con la bahía y El Morro.
  const BAY = [0.66, 0.74], RODADERO = [0.45, 0.92];
  function elevation(u, v) {
    let e = 0.8 - 0.5 * u - 0.62 * v + 0.08 * (fbm(u * 3.2 + 7, v * 3.2 + 3) - 0.5);
    e -= 0.11 * gauss(u, v, BAY[0], BAY[1], 0.1);
    e -= 0.07 * gauss(u, v, RODADERO[0], RODADERO[1], 0.07);
    e += 0.15 * gauss(u, v, 0.75, 0.83, 0.022); // El Morro
    if (e <= 0) return Math.max(-0.26, e * 0.9);
    // Macizo de la Sierra Nevada: varias cumbres sobre una cresta ancha al fondo.
    const ridge = 1 - Math.abs(2 * fbm(u * 5 + 1, v * 5 + 9) - 1);
    const massif = gauss(u, v, 0.2, 0.18, 0.5);
    return 0.02 + 0.45 * e ** 1.2 * (0.35 + 0.8 * ridge) + 0.75 * massif * ridge ** 1.6 * smoothstep(0, 0.35, e);
  }

  const V = N + 1;
  const hv = new Float32Array(V * V);  // altura por vértice
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) hv[j * V + i] = elevation(i / N, j / N);
  // Se normaliza la altura máxima para que la maqueta siempre quepa en el escenario.
  const H_MAX = 0.78;
  const top = hv.reduce((m, h) => Math.max(m, h), 0);
  for (let k = 0; k < hv.length; k++) if (hv[k] > 0) hv[k] *= H_MAX / top;
  // La ciudad se aplana junto a la bahía.
  const cityCells = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N, v = (j + 0.5) / N;
    const near = Math.hypot(u - BAY[0] + 0.06, v - BAY[1] + 0.05);
    const k = j * V + i;
    const avg = (hv[k] + hv[k + 1] + hv[k + V] + hv[k + V + 1]) / 4;
    if (near < 0.17 && avg > 0.005 && avg < 0.2) cityCells.push({ i, j, near });
  }
  for (const { i, j } of cityCells) for (const k of [j * V + i, j * V + i + 1, (j + 1) * V + i, (j + 1) * V + i + 1]) {
    if (hv[k] > 0) hv[k] = Math.min(hv[k], 0.035);
  }

  /* ---------- Color de cada celda (iluminación fija en el mundo) ---------- */
  const LIGHT = (() => { const l = [-0.55, 0.35, 0.85]; const m = Math.hypot(...l); return l.map((c) => c / m); })();
  const mix = (a, b, t) => a.map((c, k) => c + (b[k] - c) * t);
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const NAVY = [16, 26, 66];
  const LAND = [
    [0, [214, 196, 146]],   // playa
    [0.05, [92, 150, 86]],  // tierras bajas
    [0.16, [46, 110, 66]],  // bosque
    [0.36, [52, 86, 64]],   // bosque de montaña
    [0.5, [118, 104, 88]],  // roca
    [0.64, [226, 234, 246]], // picos nevados
  ];
  function landColor(h) {
    for (let k = LAND.length - 1; k >= 0; k--) {
      if (h >= LAND[k][0]) {
        const next = LAND[k + 1];
        if (!next) return LAND[k][1];
        return mix(LAND[k][1], next[1], smoothstep(LAND[k][0], next[0], h) * 0.6);
      }
    }
    return LAND[0][1];
  }
  function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  const WATER_LEVELS = 8, SHIMMER = 6;
  const waterPalette = [];
  for (let d = 0; d < WATER_LEVELS; d++) {
    const base = mix([70, 214, 226], [12, 52, 128], d / (WATER_LEVELS - 1));
    const row = [];
    for (let b = 0; b < SHIMMER; b++) row.push(rgb(mix(base, [190, 245, 255], (b / (SHIMMER - 1)) * 0.22)));
    waterPalette.push(row);
  }
  const foamPalette = [];
  for (let b = 0; b < SHIMMER; b++) foamPalette.push(rgb(mix([120, 226, 236], [235, 252, 255], b / (SHIMMER - 1))));

  // Tipo de celda: 0 tierra, 1 agua, 2 espuma (agua junto a la costa).
  const cellType = new Uint8Array(N * N);
  const cellFill = new Array(N * N);
  const cellDepth = new Uint8Array(N * N);
  const cellAvg = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * V + i, c = j * N + i;
    const a = hv[k], b = hv[k + 1], d = hv[k + V], e = hv[k + V + 1];
    const avg = (a + b + d + e) / 4;
    cellAvg[c] = avg;
    if (avg <= 0.004) {
      cellType[c] = 1;
      cellDepth[c] = Math.min(WATER_LEVELS - 1, Math.floor((-avg / 0.2) * WATER_LEVELS));
    } else {
      const dx = ((b + e) - (a + d)) / 2 * N * 0.5;
      const dy = ((d + e) - (a + b)) / 2 * N * 0.5;
      const m = Math.hypot(dx, dy, 1);
      const shade = 0.5 + 0.62 * Math.max(0, (-dx * LIGHT[0] - dy * LIGHT[1] + LIGHT[2]) / m);
      const base = landColor(avg + (hash(i, j) - 0.5) * 0.03);
      cellFill[c] = rgb(mix(base.map((x) => Math.min(255, x * shade)), NAVY, 0.14));
    }
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const c = j * N + i;
    if (cellType[c] !== 1) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni >= 0 && nj >= 0 && ni < N && nj < N && cellType[nj * N + ni] === 0) { cellType[c] = 2; break; }
    }
  }

  /* Edificios de la ciudad: prismas pequeños con la cara superior iluminada. */
  const buildings = new Map();
  cityCells.forEach(({ i, j, near }) => {
    if (hash(i * 7, j * 13) > 0.62 + near) return;
    buildings.set(j * N + i, {
      h: 0.025 + hash(i, j * 3) * 0.07 * (1 - near * 3),
      w: 0.55 + hash(j, i) * 0.3,
    });
  });

  /* ---------- Indicadores ---------- */
  function findCell(test, score) {
    let best = null, bestScore = -Infinity;
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const c = j * N + i;
      if (!test(c, i, j)) continue;
      const s = score(c, i, j);
      if (s > bestScore) { bestScore = s; best = { i, j }; }
    }
    return best || { i: N >> 1, j: N >> 1 };
  }
  const toWorld = ({ i, j }) => ({ x: ((i + 0.5) / N) * 2 - 1, y: ((j + 0.5) / N) * 2 - 1 });
  const peak = findCell((c) => cellType[c] === 0, (c) => cellAvg[c]);
  const forest = findCell((c) => cellType[c] === 0 && cellAvg[c] > 0.16 && cellAvg[c] < 0.3, (c, i, j) => i * 0.6 + j - Math.abs(i - N * 0.45) * 2);
  const city = cityCells.length ? cityCells.reduce((a, b) => (a.near < b.near ? a : b)) : peak;
  const sea = findCell((c) => cellType[c] === 1, (c, i, j) => -Math.hypot(i / N - 0.86, j / N - 0.9));
  const waves = findCell((c) => cellType[c] === 2, (c, i, j) => -Math.hypot(i / N - RODADERO[0], j / N - RODADERO[1]));

  const CLOUDS = [
    { x: -0.55, y: -0.25, z: 0.98, s: 1.05, speed: 0.018 },
    { x: 0.35, y: 0.25, z: 0.82, s: 0.8, speed: 0.026, rain: true },
    { x: -0.15, y: -0.75, z: 1.08, s: 0.9, speed: 0.012 },
  ];

  const fmt = (n, dec) => n.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const INDICATORS = [
    { name: "Humedad relativa", unit: "%", base: 78, amp: 4, dec: 0, cloud: 0, lift: 0.34, side: -1, color: "#d4d6fc" },
    { name: "Precipitación", unit: "mm/h", base: 3.4, amp: 1.1, dec: 1, cloud: 1, lift: 0.3, side: 1, color: "#8eaaff", desktop: true },
    { name: "Temp. del mar", unit: "°C", base: 28.6, amp: 0.3, dec: 1, at: sea, z: 0, lift: 0.62, side: 1, color: "#5ee0ff" },
    { name: "Altura de ola", unit: "m", base: 1.2, amp: 0.3, dec: 1, at: waves, z: 0, lift: 0.5, side: -1, color: "#5ee0ff" },
    { name: "Calidad del aire", unit: "ICA", base: 38, amp: 6, dec: 0, at: city, z: 0.06, lift: 0.78, side: 1, color: "#b06bff" },
    { name: "Cumbre · Sierra Nevada", unit: "°C", base: -3.5, amp: 0.8, dec: 1, at: peak, lift: 0.3, side: 1, color: "#ffffff" },
    { name: "Cobertura boscosa", unit: "%", base: 64, amp: 0.8, dec: 0, at: forest, lift: 0.55, side: 1, color: "#7ee08a", desktop: true },
  ].filter((d) => !(small && d.desktop));

  INDICATORS.forEach((d) => {
    if (d.at) {
      const w = toWorld(d.at);
      d.x = w.x; d.y = w.y;
      if (d.z === undefined) d.z = Math.max(0, cellAvg[d.at.j * N + d.at.i]);
    }
    d.value = d.base;
    d.shown = d.base;
    const el = document.createElement("div");
    el.className = "sm-label" + (d.side < 0 ? " sm-label--left" : "");
    el.style.setProperty("--c", d.color);
    el.innerHTML = `<div class="sm-label__card"><span class="sm-label__name"></span><span class="sm-label__value"><b></b><small></small></span></div>`;
    el.querySelector(".sm-label__name").textContent = d.name;
    el.querySelector("small").textContent = d.unit;
    d.valueEl = el.querySelector("b");
    d.valueEl.textContent = fmt(d.base, d.dec);
    d.el = el;
    d.lx = d.ly = null;
    labelsEl.append(el);
  });

  /* ---------- Cámara ---------- */
  const ELEV = 0.6;                     // elevación de la vista (rad)
  const sinE = Math.sin(ELEV), cosE = Math.cos(ELEV);
  const YAW0 = Math.PI / 4, YAW_RANGE = 0.3;
  let W = 0, H = 0, dpr = 1, S = 100, cx = 0, cy = 0;
  let yaw = YAW0, yawTarget = YAW0, drag = null, inputYaw = 0, gyroYaw = 0;
  let cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  let rise = reduceMotion ? 1 : 0, riseStart = null;

  const px = new Float32Array(V * V), py = new Float32Array(V * V);
  function project(x, y, z) {
    const xr = x * cosY - y * sinY;
    const yr = x * sinY + y * cosY;
    return [cx + xr * S, cy + yr * S * sinE - z * S * cosE];
  }

  // Orden de pintado (del fondo al frente); se recalcula al girar lo suficiente.
  let order = null, orderYaw = Infinity;
  function sortCells() {
    const idx = Array.from({ length: N * N }, (_, c) => c);
    const sy = Math.sin(yaw), cyy = Math.cos(yaw);
    idx.sort((a, b) => ((a % N) * sy + ((a / N) | 0) * cyy) - ((b % N) * sy + ((b / N) | 0) * cyy));
    order = idx;
    orderYaw = yaw;
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    if (w !== W || h !== H) {
      W = w; H = h;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    // Ajuste del bloque: ancho del rombo y alto desde las etiquetas hasta los dígitos.
    const halfW = Math.SQRT2;
    const top = Math.SQRT2 * sinE + 1.32 * cosE;
    const bottom = Math.SQRT2 * sinE - BASE_Z * cosE + 0.36;
    S = Math.min((W * (small ? 0.84 : 0.78)) / (2 * halfW), (H - 40) / (top + bottom));
    cx = W / 2;
    cy = (H - (top + bottom) * S) / 2 + top * S; // contenido centrado en vertical
    if (reduceMotion) draw(performance.now());
  }

  /* ---------- Dibujo ---------- */
  const DIGIT_COLS = small ? 18 : 30;
  const digits = Array.from({ length: DIGIT_COLS }, (_, k) => ({
    t: hash(k, 99), speed: 0.25 + hash(k, 7) * 0.5, seed: (hash(k, 3) * 1000) | 0,
  }));

  function quad(ax, ay, bx, by, cxp, cyp, dx, dy) {
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cxp, cyp); ctx.lineTo(dx, dy);
    ctx.closePath();
  }

  function drawSides() {
    // Caras frontales del bloque (x = 1 y y = 1): estratos de suelo y columna de agua.
    const BANDS = [[BASE_Z, -0.22, [40, 30, 44]], [-0.22, -0.11, [66, 48, 52]], [-0.11, 2, [92, 70, 62]]];
    for (const face of [0, 1]) {
      const light = face === 0 ? 0.78 : 1;
      for (let s = 0; s < N; s++) {
        const k1 = face === 0 ? s * V + N : N * V + s;
        const k2 = face === 0 ? (s + 1) * V + N : N * V + s + 1;
        const x1 = face === 0 ? 1 : (s / N) * 2 - 1, y1 = face === 0 ? (s / N) * 2 - 1 : 1;
        const x2 = face === 0 ? 1 : ((s + 1) / N) * 2 - 1, y2 = face === 0 ? ((s + 1) / N) * 2 - 1 : 1;
        const h1 = hv[k1] * rise, h2 = hv[k2] * rise;
        for (const [z0, z1, col] of BANDS) {
          const t1 = Math.min(z1, h1), t2 = Math.min(z1, h2);
          if (t1 <= z0 && t2 <= z0) continue;
          const [ax, ay] = project(x1, y1, z0), [bx, by] = project(x2, y2, z0);
          const [cx2, cy2] = project(x2, y2, Math.max(z0, t2)), [dx, dy] = project(x1, y1, Math.max(z0, t1));
          quad(ax, ay, bx, by, cx2, cy2, dx, dy);
          ctx.fillStyle = rgb(col.map((c) => c * light));
          ctx.fill();
        }
        if (h1 < 0 || h2 < 0) {
          const [ax, ay] = project(x1, y1, Math.min(0, h1)), [bx, by] = project(x2, y2, Math.min(0, h2));
          const [cx2, cy2] = project(x2, y2, 0), [dx, dy] = project(x1, y1, 0);
          quad(ax, ay, bx, by, cx2, cy2, dx, dy);
          ctx.fillStyle = face === 0 ? "rgba(32, 120, 190, .78)" : "rgba(40, 140, 210, .82)";
          ctx.fill();
        }
      }
    }
    // Aristas con brillo cian, estilo "maqueta de datos".
    ctx.strokeStyle = "rgba(94, 224, 255, .55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [x, y] of [[1, -1], [1, 1], [-1, 1]]) {
      const [ax, ay] = project(x, y, BASE_Z), [bx, by] = project(x, y, Math.max(0, hv[((y + 1) / 2) * N * V + ((x + 1) / 2) * N] * rise));
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    }
    const p1 = project(1, -1, BASE_Z), p2 = project(1, 1, BASE_Z), p3 = project(-1, 1, BASE_Z);
    ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]);
    ctx.stroke();
  }

  function drawDigits(t) {
    // Flujo de 0 y 1 bajo el bloque, como en el hero.
    const p1 = project(1, -1, BASE_Z), p2 = project(1, 1, BASE_Z), p3 = project(-1, 1, BASE_Z);
    const depth = S * 0.34;
    ctx.font = `600 ${Math.max(9, S * 0.075).toFixed(0)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    digits.forEach((d, k) => {
      const f = (k + 0.5) / DIGIT_COLS;
      // Recorre el borde inferior: primero la cara derecha y luego la izquierda.
      const [ax, ay] = f < 0.5 ? [p3[0] + (p2[0] - p3[0]) * f * 2, p3[1] + (p2[1] - p3[1]) * f * 2]
        : [p2[0] + (p1[0] - p2[0]) * (f - 0.5) * 2, p2[1] + (p1[1] - p2[1]) * (f - 0.5) * 2];
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const prog = ((t * d.speed + d.t + r / rows) % 1);
        const y = ay + 10 + prog * depth;
        const a = (1 - prog) * 0.55 * rise;
        if (a < 0.03) continue;
        ctx.fillStyle = `rgba(94, 224, 255, ${a.toFixed(2)})`;
        ctx.fillText(hash(d.seed + r, Math.floor(t * d.speed * 2 + r)) > 0.5 ? "1" : "0", ax, y);
      }
    });
  }

  function cloudShape(x, y, z, s, a) {
    const puffs = [[0, 0, 0.16], [0.13, 0.03, 0.12], [-0.13, 0.04, 0.11], [0.05, -0.08, 0.1], [-0.06, 0.1, 0.1]];
    puffs.forEach(([ox, oy, r]) => {
      const [sx, sy] = project(x + ox * s, y + oy * s, z);
      const rad = r * s * S;
      const g = ctx.createRadialGradient(sx, sy - rad * 0.3, rad * 0.1, sx, sy, rad);
      g.addColorStop(0, `rgba(255,255,255,${(0.92 * a).toFixed(2)})`);
      g.addColorStop(0.6, `rgba(220,228,255,${(0.6 * a).toFixed(2)})`);
      g.addColorStop(1, "rgba(200,210,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(sx, sy, rad, rad * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawIndicators(t, appear) {
    INDICATORS.forEach((d, n) => {
      let x = d.x, y = d.y, z = d.z * rise;
      if (d.cloud !== undefined) {
        const c = CLOUDS[d.cloud];
        x = c.cx; y = c.y; z = c.z + 0.05;
      }
      const show = smoothstep(n * 0.08, n * 0.08 + 0.4, appear);
      const zTop = z + d.lift;
      const [ax, ay] = project(x, y, z);
      const [bx, by] = project(x, y, z + (zTop - z) * show);
      // Anillo en el plano del suelo donde nace el dato.
      const pulse = (t * 0.8 + n * 0.37) % 1;
      ctx.strokeStyle = d.color;
      ctx.globalAlpha = (1 - pulse) * 0.8 * show;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(ax, ay, (4 + pulse * 16) * (S / 160), (4 + pulse * 16) * (S / 160) * sinE, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Línea vertical con un paquete de datos que sube.
      ctx.globalAlpha = 0.85 * show;
      const g = ctx.createLinearGradient(ax, ay, bx, by);
      g.addColorStop(0, d.color);
      g.addColorStop(1, "rgba(255,255,255,.9)");
      ctx.strokeStyle = g;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const q = (t * 0.6 + n * 0.21) % 1;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(ax + (bx - ax) * q, ay + (by - ay) * q, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.arc(ax, ay, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      d.bx = bx; d.by = by;
      d.el.classList.toggle("is-on", show > 0.95);
    });
    placeLabels();
  }

  // Coloca las etiquetas junto a la punta de su línea y las separa en vertical
  // cuando se enciman (relajación simple, suavizada entre cuadros).
  function placeLabels() {
    INDICATORS.forEach((d) => {
      if (!d.w) { const card = d.el.firstElementChild; d.w = card.offsetWidth; d.h = card.offsetHeight; }
      // Cambia de lado si la etiqueta se saldría del escenario.
      let side = d.side;
      if (side > 0 && d.bx + 10 + d.w > W - 6) side = -1;
      else if (side < 0 && d.bx - 10 - d.w < 6) side = 1;
      if (side !== d.curSide) { d.curSide = side; d.el.classList.toggle("sm-label--left", side < 0); }
      d.x0 = side < 0 ? d.bx - 10 - d.w : d.bx + 10;
      d.target = 0;
    });
    const sorted = [...INDICATORS].sort((a, b) => a.by - b.by);
    for (let pass = 0; pass < 3; pass++) {
      for (let a = 0; a < sorted.length; a++) for (let b = a + 1; b < sorted.length; b++) {
        const p = sorted[a], q = sorted[b];
        if (p.x0 > q.x0 + q.w + 4 || q.x0 > p.x0 + p.w + 4) continue;
        const gap = (q.by + q.target) - (p.by + p.target);
        const need = (p.h + q.h) / 2 + 6;
        if (Math.abs(gap) < need) { const push = (need - Math.abs(gap)) / 2; p.target -= push; q.target += push; }
      }
    }
    INDICATORS.forEach((d) => {
      d.dy = d.dy === undefined ? d.target : d.dy + (d.target - d.dy) * 0.15;
      const lx = Math.round(d.bx), ly = Math.round(d.by), dy = Math.round(d.dy);
      if (lx !== d.lx || ly !== d.ly) {
        d.lx = lx; d.ly = ly;
        d.el.style.transform = `translate(${lx}px, ${ly}px)`;
      }
      if (dy !== d.ldy) { d.ldy = dy; d.el.style.setProperty("--dy", dy + "px"); }
    });
  }

  function drawDataLayer(t, appear) {
    // Capa de datos flotante: cuadrícula translúcida con un barrido.
    const z = 1.28, k = 0.8;
    const a = smoothstep(0.2, 0.9, appear);
    if (a <= 0) return;
    const c = [[-k, -k], [k, -k], [k, k], [-k, k]].map(([x, y]) => project(x, y, z));
    ctx.globalAlpha = a;
    quad(c[0][0], c[0][1], c[1][0], c[1][1], c[2][0], c[2][1], c[3][0], c[3][1]);
    ctx.fillStyle = "rgba(94, 160, 255, .07)";
    ctx.fill();
    ctx.strokeStyle = "rgba(94, 224, 255, .45)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = "rgba(125, 157, 242, .16)";
    ctx.beginPath();
    for (let g = 1; g < 8; g++) {
      const f = -k + (2 * k * g) / 8;
      const [ax, ay] = project(f, -k, z), [bx, by] = project(f, k, z);
      const [cx2, cy2] = project(-k, f, z), [dx, dy] = project(k, f, z);
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.moveTo(cx2, cy2); ctx.lineTo(dx, dy);
    }
    ctx.stroke();
    const sweep = -k + ((t * 0.18) % 1) * 2 * k;
    const [sx1, sy1] = project(sweep, -k, z), [sx2, sy2] = project(sweep, k, z);
    ctx.strokeStyle = "rgba(94, 224, 255, .7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    const t = now / 1000;
    if (!reduceMotion && riseStart !== null) rise = smoothstep(0, 1, (now - riseStart) / 1800);
    const appear = reduceMotion ? 1 : riseStart === null ? 0 : smoothstep(0, 1, (now - riseStart - 1200) / 1600);

    // Giro: arrastre o giroscopio más un vaivén suave.
    if (!drag) yawTarget = YAW0 + clampYaw(inputYaw + gyroYaw + (reduceMotion ? 0 : Math.sin(t * 0.15) * 0.07));
    yaw += (yawTarget - yaw) * 0.08;
    cosY = Math.cos(yaw); sinY = Math.sin(yaw);
    if (!order || Math.abs(yaw - orderYaw) > 0.05) sortCells();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Sombra suave bajo el bloque.
    const [gx, gy] = project(0, 0, BASE_Z);
    const sh = ctx.createRadialGradient(gx, gy + S * 0.3, 0, gx, gy + S * 0.3, S * 1.7);
    sh.addColorStop(0, "rgba(97, 70, 219, .28)");
    sh.addColorStop(1, "rgba(97, 70, 219, 0)");
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, W, H);

    drawDigits(t);

    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
      const k = j * V + i;
      const h = hv[k];
      const [sx, sy] = project((i / N) * 2 - 1, (j / N) * 2 - 1, h > 0 ? h * rise : 0);
      px[k] = sx; py[k] = sy;
    }

    for (let o = 0; o < order.length; o++) {
      const c = order[o];
      const i = c % N, j = (c / N) | 0;
      const k = j * V + i;
      quad(px[k], py[k], px[k + 1], py[k + 1], px[k + V + 1], py[k + V + 1], px[k + V], py[k + V]);
      const type = cellType[c];
      if (type === 0) ctx.fillStyle = cellFill[c];
      else {
        const wave = Math.sin(t * 1.3 + i * 0.42 + j * 0.27) * 0.5 + 0.5;
        const b = Math.min(SHIMMER - 1, (wave * SHIMMER) | 0);
        ctx.fillStyle = type === 2 ? foamPalette[b] : waterPalette[cellDepth[c]][b];
      }
      ctx.fill();
      const bld = buildings.get(c);
      if (bld && rise > 0.6) drawBuilding(i, j, bld, t);
    }

    drawSides();
    drawBoats(t);

    CLOUDS.forEach((c) => {
      c.cx = ((c.x + 1 + t * c.speed) % 2.2) - 1.1;
      const a = Math.min(1, (1.1 - Math.abs(c.cx)) * 5) * rise;
      if (c.rain && a > 0.2) drawRain(c, t, a);
      cloudShape(c.cx, c.y, c.z, c.s, a);
    });

    drawDataLayer(t, appear);
    drawIndicators(t, appear);
    updateValues(now);
  }

  function drawBuilding(i, j, b, t) {
    const x0 = ((i + 0.5) / N) * 2 - 1, y0 = ((j + 0.5) / N) * 2 - 1;
    const half = (b.w / N), z0 = 0.035 * rise, z1 = z0 + b.h * rise;
    const P = (dx, dy, z) => project(x0 + dx * half, y0 + dy * half, z);
    const [a0, a1, a2, a3] = [P(-1, -1, z1), P(1, -1, z1), P(1, 1, z1), P(-1, 1, z1)];
    const [b1, b2, b3] = [P(1, -1, z0), P(1, 1, z0), P(-1, 1, z0)];
    quad(a1[0], a1[1], a2[0], a2[1], b2[0], b2[1], b1[0], b1[1]);
    ctx.fillStyle = "#3b4a8c"; ctx.fill();
    quad(a2[0], a2[1], a3[0], a3[1], b3[0], b3[1], b2[0], b2[1]);
    ctx.fillStyle = "#2a3670"; ctx.fill();
    quad(a0[0], a0[1], a1[0], a1[1], a2[0], a2[1], a3[0], a3[1]);
    const lit = Math.sin(t * 2 + i * 3.1 + j * 1.7) > 0.6;
    ctx.fillStyle = lit ? "#e9ecff" : "#aab6ff"; ctx.fill();
  }

  const BOATS = [
    { r: 0.16, speed: 0.05, phase: 0 },
    { r: 0.26, speed: -0.035, phase: 2 },
  ];
  function drawBoats(t) {
    BOATS.forEach((b) => {
      const ang = b.phase + t * b.speed;
      const x = 0.66 + Math.cos(ang) * b.r, y = 0.74 + Math.sin(ang) * b.r * 0.6;
      const c = cellAt(x, y);
      if (c < 0 || cellType[c] === 0) return;
      const [sx, sy] = project(x, y, 0);
      const s = S / 160;
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.beginPath(); ctx.ellipse(sx, sy + 1, 7 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f4f6ff";
      ctx.fillRect(sx - 3 * s, sy - 3 * s, 6 * s, 3 * s);
    });
  }
  function cellAt(x, y) {
    const i = Math.floor(((x + 1) / 2) * N), j = Math.floor(((y + 1) / 2) * N);
    return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i;
  }

  function drawRain(c, t, a) {
    ctx.strokeStyle = `rgba(150, 190, 255, ${(0.5 * a).toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let r = 0; r < 14; r++) {
      const ox = (hash(r, 5) - 0.5) * 0.28 * c.s, oy = (hash(r, 9) - 0.5) * 0.18 * c.s;
      const f = (t * 1.6 + hash(r, 1)) % 1;
      const z = c.z - 0.05 - f * (c.z - 0.05);
      const [x1, y1] = project(c.cx + ox, c.y + oy, z);
      const [x2, y2] = project(c.cx + ox, c.y + oy, Math.max(0, z - 0.07));
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  }

  // Los valores varían un poco cada cierto tiempo, como una lectura en vivo.
  let nextTick = 0;
  function updateValues(now) {
    if (now >= nextTick) {
      nextTick = now + 1600;
      INDICATORS.forEach((d) => { d.value = d.base + (Math.random() * 2 - 1) * d.amp; });
    }
    INDICATORS.forEach((d) => {
      d.shown += (d.value - d.shown) * 0.08;
      const txt = fmt(d.shown, d.dec);
      if (txt !== d.text) { d.text = txt; d.valueEl.textContent = txt; }
    });
  }

  const clampYaw = (v) => Math.max(-YAW_RANGE, Math.min(YAW_RANGE, v));

  /* ---------- Interacción ---------- */
  stage.addEventListener("pointerdown", (ev) => {
    drag = { x: ev.clientX, yaw: yawTarget };
    stage.setPointerCapture(ev.pointerId);
  });
  stage.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    yawTarget = YAW0 + clampYaw(drag.yaw - YAW0 - ((ev.clientX - drag.x) / W) * 1.4);
    inputYaw = yawTarget - YAW0;
  });
  const endDrag = () => { drag = null; };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  if (!reduceMotion && window.DeviceOrientationEvent) {
    // El permiso de iOS se pide en hero.js; aquí solo se escucha.
    let base = null;
    window.addEventListener("deviceorientation", (ev) => {
      if (ev.gamma === null) return;
      if (base === null) base = ev.gamma;
      base += (ev.gamma - base) * 0.004;
      gyroYaw = clampYaw(-(ev.gamma - base) / 60);
    }, { passive: true });
  }

  /* ---------- Ciclo de vida ---------- */
  let running = false, raf = 0;
  const loop = (now) => { draw(now); if (running) raf = requestAnimationFrame(loop); };
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && riseStart === null) riseStart = performance.now();
    if (reduceMotion) return;
    if (entry.isIntersecting && !running) { running = true; raf = requestAnimationFrame(loop); }
    else if (!entry.isIntersecting) { running = false; cancelAnimationFrame(raf); }
  }, { threshold: 0.2 }).observe(stage);

  window.addEventListener("resize", resize);
  if (document.fonts) document.fonts.ready.then(resize, () => {});
  resize();
  if (reduceMotion) { INDICATORS.forEach((d) => d.el.classList.add("is-on")); draw(performance.now()); }
})();
