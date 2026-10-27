/* ==========================================================================
   Resultados de aprendizaje como una red 3D: seis nodos (SO1–SO6) en una
   corona que gira, todos conectados entre sí. Al tocar un nodo se muestra
   su resultado; si nadie interactúa, la red los recorre sola.
   ========================================================================== */
(() => {
  const net = document.getElementById("net");
  const canvas = document.getElementById("net-canvas");
  const nodesEl = document.getElementById("net-nodes");
  const list = document.getElementById("outcomes");
  if (!net || !canvas || !nodesEl || !list) return;
  const stage = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const items = [...list.querySelectorAll(".outcome")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COLORS = ["#5ee0ff", "#7d9df2", "#8b6bff", "#b06bff", "#8eaaff", "#d4d6fc"];

  /* ---------- Nodos: hexágono en zigzag (alternan arriba y abajo) ---------- */
  const nodes = items.map((li, k) => {
    const a = (k / items.length) * Math.PI * 2;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "net__node";
    btn.textContent = li.querySelector(".outcome__code").textContent;
    btn.style.setProperty("--c", COLORS[k % COLORS.length]);
    btn.setAttribute("aria-controls", li.id);
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => { if (!dragged) { select(k); pauseAuto(); } });
    nodesEl.append(btn);
    return { x: Math.cos(a), y: k % 2 ? 0.34 : -0.34, z: Math.sin(a), btn, sx: 0, sy: 0, depth: 0 };
  });
  const edges = [];
  for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) edges.push([a, b]);
  const packets = Array.from({ length: 7 }, (_, k) => ({ e: (k * 5) % edges.length, t: k / 7, speed: 0.25 + (k % 3) * 0.1 }));

  /* ---------- Selección ---------- */
  let active = -1, autoAt = 0;
  net.classList.add("net--ready");
  list.setAttribute("aria-live", "polite");
  function select(k) {
    if (k === active) return;
    active = k;
    items.forEach((li, n) => li.classList.toggle("is-active", n === k));
    nodes.forEach((nd, n) => {
      nd.btn.classList.toggle("is-active", n === k);
      nd.btn.setAttribute("aria-pressed", String(n === k));
    });
  }
  const pauseAuto = () => { autoAt = performance.now() + 12000; };
  select(0);

  /* ---------- Cámara y dibujo ---------- */
  let W = 0, H = 0, dpr = 1, R = 100;
  let yaw = 0, spin = 0, dragYaw = 0, drag = null, dragged = false;
  const PITCH = 0.42, DIST = 3.4;
  const cP = Math.cos(PITCH), sP = Math.sin(PITCH);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth; H = stage.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    R = Math.min(W, H) * 0.36;
    if (reduceMotion) draw(performance.now());
  }

  function project(n) {
    const cY = Math.cos(yaw), sY = Math.sin(yaw);
    const x1 = n.x * cY - n.z * sY;
    const z1 = n.x * sY + n.z * cY;
    const y1 = n.y * cP - z1 * sP;
    const z2 = n.y * sP + z1 * cP;
    const s = DIST / (DIST + z2);
    n.sx = W / 2 + x1 * R * s;
    n.sy = H / 2 + y1 * R * s;
    n.depth = (1 - z2) / 2; // 1 = al frente, 0 = al fondo
    n.scale = s;
  }

  function draw(now) {
    const t = now / 1000;
    if (!reduceMotion) spin += 0.0025;
    yaw = spin + dragYaw;
    nodes.forEach(project);

    if (!reduceMotion && now > autoAt && Math.floor(t / 4.5) % nodes.length !== active && now > autoAt) {
      select(Math.floor(t / 4.5) % nodes.length);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Núcleo y anillo orbital.
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R * 0.55);
    g.addColorStop(0, "rgba(139, 107, 255, .55)");
    g.addColorStop(0.4, "rgba(97, 70, 219, .18)");
    g.addColorStop(1, "rgba(97, 70, 219, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(125, 157, 242, .18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, R * 1.08, R * 1.08 * sP, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Aristas: las del nodo activo brillan; el resto se atenúa con la profundidad.
    edges.forEach(([a, b]) => {
      const A = nodes[a], B = nodes[b];
      const hot = a === active || b === active;
      const d = (A.depth + B.depth) / 2;
      ctx.strokeStyle = hot ? COLORS[active % COLORS.length] : "rgba(150, 165, 255, 1)";
      ctx.globalAlpha = hot ? 0.35 + 0.5 * d : 0.06 + 0.22 * d;
      ctx.lineWidth = hot ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(A.sx, A.sy); ctx.lineTo(B.sx, B.sy); ctx.stroke();
    });

    // Paquetes de datos que viajan por la red.
    packets.forEach((p) => {
      if (!reduceMotion) p.t += p.speed / 60;
      if (p.t >= 1) { p.t = 0; p.e = (p.e + 4 + ((t * 10) | 0)) % edges.length; }
      const [a, b] = edges[p.e];
      const A = nodes[a], B = nodes[b];
      ctx.globalAlpha = 0.5 + 0.5 * ((A.depth + B.depth) / 2);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(A.sx + (B.sx - A.sx) * p.t, A.sy + (B.sy - A.sy) * p.t, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Halo del nodo activo.
    if (active >= 0) {
      const A = nodes[active];
      const pulse = (t * 0.9) % 1;
      ctx.strokeStyle = COLORS[active % COLORS.length];
      ctx.globalAlpha = (1 - pulse) * 0.7;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(A.sx, A.sy, 22 * A.scale + pulse * 26, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Botones HTML encima, escalados y ordenados por profundidad.
    nodes.forEach((n) => {
      const sc = 0.72 + n.depth * 0.38;
      n.btn.style.transform = `translate(${n.sx.toFixed(1)}px, ${n.sy.toFixed(1)}px) translate(-50%, -50%) scale(${sc.toFixed(3)})`;
      n.btn.style.zIndex = String(Math.round(n.depth * 100));
      n.btn.style.opacity = (0.55 + n.depth * 0.45).toFixed(2);
    });
  }

  /* ---------- Arrastre para girar ---------- */
  stage.addEventListener("pointerdown", (ev) => {
    drag = { x: ev.clientX, yaw: dragYaw };
    dragged = false;
  });
  window.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x;
    if (Math.abs(dx) > 4) dragged = true;
    dragYaw = drag.yaw + (dx / W) * Math.PI;
    if (reduceMotion) draw(performance.now());
  });
  const endDrag = () => { drag = null; setTimeout(() => { dragged = false; }, 0); };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  /* ---------- Ciclo de vida ---------- */
  let running = false;
  const loop = (now) => { draw(now); if (running) requestAnimationFrame(loop); };
  new IntersectionObserver(([entry]) => {
    if (reduceMotion) return;
    if (entry.isIntersecting && !running) { running = true; requestAnimationFrame(loop); }
    else if (!entry.isIntersecting) running = false;
  }).observe(stage);
  window.addEventListener("resize", resize);
  resize();
  if (reduceMotion) draw(performance.now());
})();
