/* ==========================================================================
   Santa Marta en datos: una maqueta realista que gira con el scroll. Los
   cuadros salen de un video (assets/santa-marta/) y la posición de cada
   elemento en cada cuadro viene de js/santa-marta-track.js; una línea une
   cada dato con su punto. Los valores son ilustrativos.
   ========================================================================== */
(() => {
  const scroller = document.getElementById("sm-scroll");
  const canvas = document.getElementById("sm-canvas");
  const labelsEl = document.getElementById("sm-labels");
  const TRACK = window.SM_TRACK;
  if (!scroller || !canvas || !labelsEl || !TRACK) return;
  const stage = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Los cuadros se eligen una vez según la pantalla; la distribución de las
  // etiquetas (compacta o en columnas) se decide con el ancho real del escenario.
  const FRAMES = TRACK.frames;
  const DIR = `assets/santa-marta/${window.innerWidth < 760 ? "mobile" : "desktop"}/`;
  let compact = false;

  /* ---------- Indicadores ----------
     point: elemento seguido en el video. Escritorio: lado (-1 izquierda, 1 derecha);
     móvil: franja (0 arriba, 1 abajo) y nombre corto. */
  const INDICATORS = [
    { name: "Humedad relativa", short: "Humedad", point: "cloudL", unit: "%", base: 78, amp: 4, dec: 0, side: -1, band: 0 },
    { name: "Cumbre · Sierra Nevada", short: "Cumbre", point: "peak", unit: "°C", base: -3.5, amp: 0.8, dec: 1, side: 1, band: 0 },
    { name: "Nubosidad", short: "Nubes", point: "cloudR", unit: "%", base: 62, amp: 5, dec: 0, side: 1, band: 0 },
    { name: "Cobertura boscosa", point: "forest", unit: "%", base: 64, amp: 0.8, dec: 0, side: -1, desktop: true },
    { name: "Caudal del río", point: "river", unit: "m³/s", base: 4.8, amp: 0.6, dec: 1, side: -1, desktop: true },
    { name: "Calidad del aire", short: "Aire", point: "city", unit: "ICA", base: 38, amp: 6, dec: 0, side: 1, band: 1 },
    { name: "Temp. del mar", short: "Temp. mar", point: "sea", unit: "°C", base: 28.6, amp: 0.3, dec: 1, side: -1, band: 1 },
    { name: "Altura de ola", short: "Oleaje", point: "beach", unit: "m", base: 1.2, amp: 0.3, dec: 1, side: 1, band: 1 },
  ];

  const fmt = (n, dec) => n.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  INDICATORS.forEach((d) => {
    d.value = d.shown = d.base;
    const el = document.createElement("div");
    el.className = "sm-label";
    el.innerHTML = `<span class="sm-label__name"></span><span class="sm-label__value"><b></b><small></small></span>`;
    el.querySelector("small").textContent = d.unit;
    d.nameEl = el.querySelector(".sm-label__name");
    d.valueEl = el.querySelector("b");
    d.valueEl.textContent = fmt(d.base, d.dec);
    d.el = el;
    labelsEl.append(el);
  });

  /* ---------- Carga progresiva de los cuadros ----------
     Primero el inicial y luego en pasadas cada vez más finas (0, 64, 32, 96, 16…),
     así el giro funciona desde temprano aunque falten cuadros intermedios. */
  const frames = new Array(FRAMES).fill(null);
  const loadOrder = [];
  for (let step = 64; step >= 1; step = step >> 1) {
    for (let k = 0; k < FRAMES; k += step) if (!loadOrder.includes(k)) loadOrder.push(k);
  }
  let loading = false;
  function startLoading() {
    if (loading) return;
    loading = true;
    let next = 0;
    const worker = () => {
      if (next >= loadOrder.length) return;
      const k = loadOrder[next++];
      const img = new Image();
      img.decoding = "async";
      img.src = `${DIR}f${String(k).padStart(3, "0")}.webp`;
      img.decode().then(() => { frames[k] = img; dirty = true; }, () => {}).finally(worker);
    };
    for (let n = 0; n < 4; n++) worker(); // cuatro descargas en paralelo
  }
  // Cuadro cargado más cercano al pedido (mientras termina la descarga).
  function nearestLoaded(k) {
    for (let d = 0; d < FRAMES; d++) {
      if (frames[k - d]) return k - d;
      if (frames[k + d]) return k + d;
    }
    return -1;
  }

  /* ---------- Distribución ---------- */
  let W = 0, H = 0, dpr = 1, img = { x: 0, y: 0, w: 0, h: 0 };
  const LABEL_W = 160;
  function resize() {
    W = stage.clientWidth; H = stage.clientHeight;
    if (W < 50 || H < 50) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // La maqueta ocupa el centro; en escritorio quedan columnas para las etiquetas
    // y en móvil franjas arriba y abajo.
    compact = W < 640;
    const room = compact ? { w: W - 16, h: H - 2 * 64 } : { w: W - 2 * (LABEL_W + 32), h: H - 24 };
    const w = Math.min(room.w, room.h * TRACK.aspect);
    img = { w, h: w / TRACK.aspect, x: (W - w) / 2, y: (H - w / TRACK.aspect) / 2 };
    layoutLabels();
    dirty = true;
  }

  function layoutLabels() {
    // En la vista compacta se ocultan los indicadores marcados solo para escritorio.
    INDICATORS.forEach((d) => {
      d.hidden = compact && d.desktop;
      d.el.hidden = d.hidden;
      d.nameEl.textContent = compact && d.short ? d.short : d.name;
      d.el.classList.toggle("sm-label--compact", compact);
    });
    const shown = INDICATORS.filter((d) => !d.hidden);
    if (!compact) {
      // Columnas a los costados; las filas siguen el orden vertical de los puntos
      // en el primer cuadro para que las líneas no se crucen.
      [-1, 1].forEach((side) => {
        const col = shown.filter((d) => d.side === side).sort((a, b) => TRACK.points[a.point][0][1] - TRACK.points[b.point][0][1]);
        const rowH = 44, gap = Math.min(56, (H - 48 - col.length * rowH) / Math.max(1, col.length - 1));
        const y0 = (H - (col.length * rowH + (col.length - 1) * gap)) / 2;
        col.forEach((d, n) => {
          d.lx = side < 0 ? 28 : W - 28 - LABEL_W;
          d.ly = y0 + n * (rowH + gap);
          d.w = LABEL_W; d.h = rowH;
          d.end = side < 0;
        });
      });
    } else {
      // Móvil: tres arriba y tres abajo; columnas según la posición horizontal.
      const w = (W - 24 - 20) / 3;
      [0, 1].forEach((band) => {
        const row = shown.filter((d) => d.band === band).sort((a, b) => TRACK.points[a.point][0][0] - TRACK.points[b.point][0][0]);
        row.forEach((d, n) => {
          d.lx = 12 + n * (w + 10);
          d.ly = band === 0 ? 10 : H - 46;
          d.w = w; d.h = 36;
          d.end = false;
        });
      });
    }
    shown.forEach((d) => {
      d.el.style.transform = `translate(${Math.round(d.lx)}px, ${Math.round(d.ly)}px)`;
      d.el.style.width = d.w + "px";
      d.el.classList.toggle("sm-label--end", d.end);
    });
  }

  /* ---------- Dibujo ---------- */
  let progress = 0, shown = reduceMotion ? 0.5 : 0, dirty = true, visible = false;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function pointAt(name, f) {
    const pts = TRACK.points[name];
    const k = Math.floor(f), t = f - k;
    const a = pts[k], b = pts[Math.min(FRAMES - 1, k + 1)];
    return [img.x + (a[0] + (b[0] - a[0]) * t) * img.w, img.y + (a[1] + (b[1] - a[1]) * t) * img.h];
  }

  function draw() {
    dirty = false;
    const f = shown * (FRAMES - 1);
    const k = Math.floor(f), t = f - k;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Mezcla de dos cuadros vecinos para que el giro se vea continuo.
    const a = nearestLoaded(k), b = frames[Math.min(FRAMES - 1, k + 1)] ? Math.min(FRAMES - 1, k + 1) : -1;
    if (a >= 0) {
      ctx.drawImage(frames[a], img.x, img.y, img.w, img.h);
      if (b >= 0 && b !== a && t > 0.02) {
        ctx.globalAlpha = t;
        ctx.drawImage(frames[b], img.x, img.y, img.w, img.h);
        ctx.globalAlpha = 1;
      }
    }
    if (a < 0) return;

    // Líneas rectas desde cada etiqueta hasta su punto.
    ctx.strokeStyle = "rgba(255, 255, 255, .7)";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 1;
    INDICATORS.forEach((d) => {
      if (d.hidden) return;
      d.el.classList.add("is-on");
      const [px, py] = pointAt(d.point, f);
      let sx, sy;
      if (!compact) { sx = d.end ? d.lx + d.w + 10 : d.lx - 10; sy = d.ly + d.h / 2; }
      else { sx = d.lx + d.w / 2; sy = d.band === 0 ? d.ly + d.h + 6 : d.ly - 6; }
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(px, py); ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, .35)"; ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, .7)";
    });
  }

  function readProgress() {
    const r = scroller.getBoundingClientRect();
    const range = r.height - window.innerHeight;
    progress = range > 0 ? clamp(-r.top / range, 0, 1) : 0;
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

  // Solo se redibuja el lienzo cuando cambia el cuadro o llega uno nuevo.
  function loop(now) {
    if (!visible) return;
    if (!reduceMotion) {
      readProgress();
      const before = shown;
      // Inercia suave: el giro sigue al scroll sin saltos aunque la rueda avance a golpes.
      shown += (progress - shown) * 0.1;
      if (Math.abs(progress - shown) < 0.0002) shown = progress;
      if (shown !== before) dirty = true;
    }
    if (dirty) draw();
    updateValues(now);
    requestAnimationFrame(loop);
  }

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) startLoading();
  }, { rootMargin: "150% 0px" }).observe(scroller);
  new IntersectionObserver(([entry]) => {
    const was = visible;
    visible = entry.isIntersecting;
    if (visible && !was) requestAnimationFrame(loop);
  }).observe(stage);

  // El escenario cambia de tamaño con la ventana y con el texto que tiene encima
  // (fuentes, orientación del teléfono): se vuelve a distribuir cada vez.
  new ResizeObserver(() => { if (stage.clientWidth !== W || stage.clientHeight !== H) resize(); }).observe(stage);
  resize();
})();
