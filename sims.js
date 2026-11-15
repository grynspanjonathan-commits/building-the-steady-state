/* Building the steady state: interactive simulations (vanilla canvas). Teaching illustrations, not scanner simulations. */
(function () {
  const C = { bg: '#0b0d10', teal: '#6fd6b5', gold: '#e8c37a', red: '#e8685f', blue: '#8fb3ff', grey: '#8a8f98', dim: '#4a4f57', white: '#e9ecef', purple: '#c39bff' };
  const D2R = Math.PI / 180;

  function pal(n) {
    const stops = [[143, 179, 255], [195, 155, 255], [232, 104, 95], [255, 158, 203], [158, 203, 255]];
    const out = [];
    for (let i = 0; i < n; i++) {
      const u = (i / Math.max(1, n - 1)) * (stops.length - 2), j = Math.min(Math.floor(u), stops.length - 2), f = u - j;
      const c = stops[j].map((v, k) => Math.round(v + (stops[j + 1][k] - v) * f));
      out.push(`rgb(${c[0]},${c[1]},${c[2]})`);
    }
    return out;
  }
  // pulse about the hinge (x): z tips toward +y (matches the video)
  function flip(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c]; }
  function rotz(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; }
  function el(tag, attrs, html) { const e = document.createElement(tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }

  // ---------- canvas helpers ----------
  function makeView(parent, label, cls) {
    const box = el('div', { class: 'view ' + (cls || '') });
    const cv = el('canvas');
    box.appendChild(cv);
    box.appendChild(el('div', { class: 'vlabel' }, label));
    const rd = el('div', { class: 'vread' }); box.appendChild(rd);
    parent.appendChild(box);
    const v = { box, cv, rd, ctx: cv.getContext('2d'), w: 0, h: 0 };
    v.fit = function () {
      const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (r.width === 0) return;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      v.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); v.w = r.width; v.h = r.height;
      v.ctx.clearRect(0, 0, v.w, v.h);
    };
    return v;
  }
  function arrow(ctx, x0, y0, x1, y1, col, w, alpha) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    if (L < 1.5) { ctx.beginPath(); ctx.arc(x0, y0, Math.max(1.5, w * 0.6), 0, 7); ctx.fill(); ctx.restore(); return; }
    const hl = Math.min(L * 0.35, 5 + w * 2), ux = dx / L, uy = dy / L;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hl * 0.8, y1 - uy * hl * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - ux * hl - uy * hl * 0.5, y1 - uy * hl + ux * hl * 0.5); ctx.lineTo(x1 - ux * hl + uy * hl * 0.5, y1 - uy * hl - ux * hl * 0.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function line(ctx, x0, y0, x1, y1, col, w, dash, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.strokeStyle = col; ctx.lineWidth = w || 1; if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
  }
  function text(ctx, s, x, y, col, size, align, base) {
    ctx.save(); ctx.fillStyle = col; ctx.font = `${size || 13}px 'Noto Sans', sans-serif`; ctx.textAlign = align || 'left'; ctx.textBaseline = base || 'middle'; ctx.fillText(s, x, y); ctx.restore();
  }
  function dot(ctx, x, y, r, col, alpha) { ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore(); }
  function polyline(ctx, pts, col, w, alpha, dash) {
    if (pts.length < 2) return;
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.restore();
  }

  function edgeText(ctx, s, x, y, col, w) { ctx.font = '12px sans-serif'; const tw = ctx.measureText(s).width; text(ctx, s, Math.min(x, w - tw - 6), y, col, 12); }

  // top view of one voxel: forward (signal direction) is up
  function Top(v, opts) {
    const o = Object.assign({ fwd: 'forward', R: 0.38 }, opts || {});
    const cx = v.w / 2, cy = v.h / 2 + 8, R = Math.min(Math.min(v.w, v.h) * o.R, v.h / 2 - 52), ctx = v.ctx;
    const P = (x, y) => [cx + R * x, cy - R * y];
    ctx.save(); ctx.strokeStyle = C.dim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.restore();
    for (let k = 0; k < 12; k++) { const a = k * 30 * D2R; line(ctx, cx + R * 0.93 * Math.cos(a), cy - R * 0.93 * Math.sin(a), cx + R * Math.cos(a), cy - R * Math.sin(a), C.dim, 1.5); }
    if (o.fwd) text(ctx, o.fwd, cx, cy - R - 12, C.grey, 12, 'center');
    return { P, R, cx, cy, ctx };
  }

  // 3D view with drag rotation; world: x hinge, y across, z up (B0)
  function View3D(v, state, opt) {
    const o = Object.assign({ scale: 0.36, cy: 0.58 }, opt || {});
    let drag = null;
    v.box.classList.add('drag');
    v.cv.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY, state.yaw, state.pitch]; v.cv.setPointerCapture(e.pointerId); });
    v.cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      state.yaw = drag[2] + (e.clientX - drag[0]) * 0.008;
      state.pitch = Math.max(-5 * D2R, Math.min(89 * D2R, drag[3] + (e.clientY - drag[1]) * 0.008));
      state.redraw();
    });
    v.cv.addEventListener('pointerup', () => { drag = null; });
    v.cv.addEventListener('pointercancel', () => { drag = null; });
    return function project() {
      const cx = v.w / 2, cy = v.h * o.cy, R = Math.min(v.w, v.h * (o.aspect || 1)) * o.scale;
      const cyw = Math.cos(state.yaw), syw = Math.sin(state.yaw), cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
      return function (p) {
        const x1 = p[0] * cyw - p[1] * syw, y1 = p[0] * syw + p[1] * cyw;
        const sy = p[2] * cp - y1 * sp, depth = y1 * cp + p[2] * sp;
        return [cx + R * x1, cy - R * sy, depth];
      };
    };
  }
  function disk(ctx, Pj, r, c0) {
    c0 = c0 || [0, 0, 0];
    ctx.save(); ctx.beginPath();
    for (let k = 0; k <= 72; k++) { const a = (k / 72) * 2 * Math.PI, q = Pj([c0[0] + r * Math.cos(a), c0[1] + r * Math.sin(a), c0[2]]); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
    ctx.fillStyle = 'rgba(28,33,40,0.55)'; ctx.fill(); ctx.strokeStyle = C.dim; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
  }
  function axisB0(ctx, Pj, at, len) {
    at = at || [0, 0, 0]; len = len || 1.25;
    const z0 = Pj([at[0], at[1], -0.25]), z1 = Pj([at[0], at[1], len]);
    arrow(ctx, z0[0], z0[1], z1[0], z1[1], C.dim, 1.5); text(ctx, 'B0', z1[0] + 6, z1[1], C.grey, 12);
  }

  function controlRange(parent, label, min, max, step, val, fmt, oninput) {
    const w = el('div', { class: 'ctl' });
    const lab = el('label'); const nm = el('span', null, label); const b = el('b'); lab.appendChild(nm); lab.appendChild(b);
    const r = el('input', { type: 'range', min, max, step, value: val, 'aria-label': label });
    const upd = () => { b.textContent = fmt(+r.value); oninput(+r.value); };
    r.addEventListener('input', upd);
    w.appendChild(lab); w.appendChild(r); parent.appendChild(w);
    b.textContent = fmt(+val);
    return { r, set: (x) => { r.value = x; upd(); }, get: () => +r.value };
  }
  function segment(parent, label, opts, onpick) {
    const w = el('div', { class: 'ctl' });
    w.appendChild(el('label', null, `<span>${label}</span>`));
    const seg = el('div', { class: 'seg' });
    const btns = opts.map((o, i) => { const b = el('button', { type: 'button', class: i === 0 ? 'on' : '' }, o[1]); b.addEventListener('click', () => { btns.forEach((x) => x.classList.remove('on')); b.classList.add('on'); onpick(o[0]); }); seg.appendChild(b); return b; });
    w.appendChild(seg); parent.appendChild(w);
    return { pick: (i) => btns[i].click() };
  }
  function playButton(parent, rangeCtl, max, dur, label) {
    const w = el('div', { class: 'ctl row' });
    const play = el('button', { class: 'btn small', type: 'button' }, label || 'Play the clock');
    const reset = el('button', { class: 'btn ghost small', type: 'button' }, 'Reset');
    w.appendChild(play); w.appendChild(reset); parent.appendChild(w);
    let raf = null;
    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; play.textContent = label || 'Play the clock'; }
    play.addEventListener('click', () => {
      if (raf) { stop(); return; }
      let t0 = null, start = rangeCtl.get(); const mx = typeof max === 'function' ? max() : max; if (start >= mx - 1e-6) start = 0;
      play.textContent = 'Pause';
      const tick = (ts) => {
        if (t0 == null) t0 = ts;
        const t = start + ((ts - t0) / 1000) * (mx / dur);
        if (t >= mx) { rangeCtl.set(mx); stop(); return; }
        rangeCtl.set(t); raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    reset.addEventListener('click', () => { stop(); rangeCtl.set(0); });
    return { stop };
  }
  // small 2D plot helper
  function Plot(v, xr, yr, pad) {
    pad = Object.assign({ l: 44, r: 14, t: 22, b: 30 }, pad || {});
    const X = (x) => pad.l + ((x - xr[0]) / (xr[1] - xr[0])) * (v.w - pad.l - pad.r);
    const Y = (y) => v.h - pad.b - ((y - yr[0]) / (yr[1] - yr[0])) * (v.h - pad.t - pad.b);
    const ctx = v.ctx;
    line(ctx, X(xr[0]), Y(yr[0]), X(xr[1]), Y(yr[0]), C.dim, 1.2);
    line(ctx, X(xr[0]), Y(yr[0]), X(xr[0]), Y(yr[1]), C.dim, 1.2);
    return { X, Y, ctx, pad };
  }

  // =========================================================
  // Sim 1: a train of three pulses on a row of spins
  // =========================================================
  function TrainSim(host) {
    const NS = 25, NC = 360, SPREAD = 4.0; // spread: turns per unit time across the row
    const st = { alpha: 90 * D2R, t2: 1.0, t3: 2.6, t: 0.5, split: true, yaw: -32 * D2R, pitch: 24 * D2R, redraw: null };
    const views = el('div', { class: 'views' }); host.appendChild(views);
    const v3 = makeView(views, '3D: a row of spins along the hinge · drag to turn', 'wide');
    const vt = makeView(views, 'top view: the voxel sum (the signal)', 'wide');
    const vs = makeView(host, '', 'trace');
    const proj = View3D(v3, st, { scale: 0.34, cy: 0.6, aspect: 1.25 });
    const legend = el('div', { class: 'legend' });
    legend.innerHTML = '<span class="k-blue">each spin: flat part (the shadow)</span><span class="k-purple">stored part: straight up or down along B0, frozen</span><span class="k-white">voxel sum</span>';
    host.appendChild(legend);
    const ctr = el('div', { class: 'controls' }); host.appendChild(ctr);
    const tctl = controlRange(ctr, 'Time', 0, 4.6, 0.005, st.t, (x) => x.toFixed(2), (x) => { st.t = x; draw(); });
    controlRange(ctr, 'Flip angle of all three pulses', 10, 180, 1, 90, (x) => x + '°', (x) => { st.alpha = x * D2R; draw(); });
    controlRange(ctr, 'Time of pulse 3', 1.4, 3.4, 0.05, st.t3, (x) => x.toFixed(2), (x) => { st.t3 = x; draw(); });
    segment(ctr, 'Show each spin as', [[true, 'Flat + stored parts'], [false, 'Whole arrow']], (x) => { st.split = x; draw(); });
    const pb = playButton(ctr, tctl, 4.6, 18);

    // spin rates: positions along the row; rate proportional to position (a gradient)
    const rateOf = (u) => 2 * Math.PI * SPREAD * u; // u in [-0.5, 0.5]
    function stateAt(u, t) {
      const pulses = [0, st.t2, st.t3];
      let m = [0, 0, 1], tc = 0;
      if (t < 0) return m;
      for (let k = 0; k < 3; k++) {
        if (t < pulses[k]) break;
        m = rotz(m, rateOf(u) * (pulses[k] - tc)); tc = pulses[k];
        m = flip(m, st.alpha);
      }
      return rotz(m, rateOf(u) * (t - tc));
    }
    const us = Array.from({ length: NS }, (_, i) => -0.5 + i / (NS - 1));
    const uc = Array.from({ length: NC }, (_, i) => -0.5 + (i + 0.5) / NC);
    const cl = pal(NS);
    function sumAt(t) {
      let x = 0, y = 0, W = 0;
      for (const u of uc) { const w = Math.cos(Math.PI * u) ** 2, m = stateAt(u, t); x += w * m[0]; y += w * m[1]; W += w; }
      return [x / W, y / W];
    }
    let traceCache = null, traceKey = '';
    function trace() {
      const key = [st.alpha, st.t3].join(',');
      if (key === traceKey) return traceCache;
      const out = []; for (let i = 0; i <= 460; i++) { const t = i * 0.01; const s = sumAt(t); out.push([t, Math.hypot(s[0], s[1])]); }
      traceKey = key; traceCache = out; return out;
    }
    function echoes() {
      const t2 = st.t2, t3 = st.t3, out = [];
      if (2 * t2 < t3 - 0.02) out.push({ t: 2 * t2, name: 'spin echo (1, 2)', c: C.teal });
      [{ t: t3 + t2, name: 'stimulated echo', c: C.purple }, { t: 2 * t3 - 2 * t2, name: 'echo of the echo', c: C.teal },
       { t: 2 * t3 - t2, name: 'spin echo (2, 3)', c: C.teal }, { t: 2 * t3, name: 'spin echo (1, 3)', c: C.teal }]
        .forEach((e) => { if (e.t > t3 + 0.02 && e.t <= 4.6) out.push(e); });
      return out.sort((x, y) => x.t - y.t);
    }
    function draw() {
      v3.fit(); vt.fit(); vs.fit();
      // ---- 3D row
      const ctx = v3.ctx; const Pj = proj();
      const X0 = -1.3, X1 = 1.3, L = 0.42;
      const slab = [[X0 - 0.15, -0.55, 0], [X1 + 0.15, -0.55, 0], [X1 + 0.15, 0.55, 0], [X0 - 0.15, 0.55, 0]].map(Pj);
      ctx.save(); ctx.beginPath(); slab.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fillStyle = 'rgba(28,33,40,0.55)'; ctx.fill(); ctx.strokeStyle = C.dim; ctx.stroke(); ctx.restore();
      const h0 = Pj([X0 - 0.3, 0, 0]), h1 = Pj([X1 + 0.3, 0, 0]);
      line(ctx, h0[0], h0[1], h1[0], h1[1], C.gold, 1.5, [6, 5], 0.85);
      const hl = Pj([X1 + 0.3, 0, 0]); text(ctx, 'hinge', hl[0] - 4, hl[1] + 14, C.gold, 12, 'right');
      axisB0(ctx, Pj, [X0 - 0.3, 0, 0], 0.9);
      const items = us.map((u, i) => { const x = X0 + (X1 - X0) * (u + 0.5); return { x, m: stateAt(u, st.t), c: cl[i] }; });
      items.sort((a, b) => Pj([a.x, 0, 0])[2] - Pj([b.x, 0, 0])[2]);
      items.forEach((it) => {
        const o = Pj([it.x, 0, 0]);
        const m = it.m;
        if (st.split) {
          const f = Pj([it.x + L * m[0], L * m[1], 0]); arrow(ctx, o[0], o[1], f[0], f[1], it.c, 2.2, 0.95);
          const z = Pj([it.x, 0, L * m[2]]); if (Math.abs(m[2]) > 0.04) arrow(ctx, o[0], o[1], z[0], z[1], C.purple, 2.4, 0.9);
        } else {
          const f = Pj([it.x + L * m[0], L * m[1], L * m[2]]); arrow(ctx, o[0], o[1], f[0], f[1], it.c, 2.4);
        }
      });
      const ph = st.t < st.t2 ? 'after pulse 1' : st.t < st.t3 ? 'after pulse 2' : 'after pulse 3';
      v3.rd.textContent = `time ${st.t.toFixed(2)} · ${ph}`;
      // ---- top view (voxel sum), forward = +y up
      const T = Top(vt, { fwd: 'FID direction', R: 0.36 });
      const sm = [];
      us.forEach((u, i) => { const m = stateAt(u, st.t); const q = T.P(m[0] * 0.9, m[1] * 0.9); arrow(T.ctx, T.cx, T.cy, q[0], q[1], cl[i], 1.8, 0.75); });
      const s = sumAt(st.t); const q = T.P(s[0] * 0.9, s[1] * 0.9); arrow(T.ctx, T.cx, T.cy, q[0], q[1], C.white, 5);
      const mag = Math.hypot(s[0], s[1]);
      let near = '';
      const allE = [{ t: 0, name: 'FID' }].concat(echoes());
      allE.forEach((e) => { if (Math.abs(st.t - e.t) < 0.06 && st.t >= e.t - 0.06) near = ' · ' + e.name; });
      vt.rd.textContent = `voxel sum ${mag.toFixed(2)}${near}`;
      // ---- trace
      const tr = trace();
      const Pl = Plot(vs, [0, 4.6], [0, 1.05], { l: 24, r: 16, t: 34, b: 26 });
      const pls = [0, st.t2, st.t3];
      pls.forEach((tp, k) => { line(Pl.ctx, Pl.X(tp), Pl.Y(0), Pl.X(tp), Pl.Y(1.05), C.gold, 1.5, [4, 4], 0.9); text(Pl.ctx, 'pulse ' + (k + 1), Pl.X(tp) + 4, Pl.pad.t - 12, C.gold, 12); });
      echoes().forEach((e, k) => { const a = tr[Math.min(460, Math.round(e.t * 100))][1]; if (a > 0.04) text(Pl.ctx, e.name, Pl.X(e.t), Pl.Y(a) - 12, e.c, 11, 'center'); });
      if (vs.w > 640) text(Pl.ctx, 'signal (voxel sum)', vs.w - 16, 12, C.grey, 12, 'right');
      polyline(Pl.ctx, tr.map((p) => [Pl.X(p[0]), Pl.Y(p[1])]), C.white, 2);
      line(Pl.ctx, Pl.X(st.t), Pl.Y(0), Pl.X(st.t), Pl.Y(1.05), C.blue, 1.5, null, 0.8);
      text(Pl.ctx, 'time', Pl.X(4.6), vs.h - 10, C.grey, 11, 'right');
      vs.rd.textContent = '';
    }
    st.redraw = draw;
    return { draw, stop: pb.stop };
  }

  // =========================================================
  // Sim 2: build the steady state pulse by pulse (flipped picture)
  // =========================================================
  const TISSUE = { 'Fluid (CSF)': [4000, 2000], 'White matter': [600, 80], 'Grey matter': [950, 100], 'Fat': [260, 85], 'Blood': [1400, 250], 'Muscle': [900, 45] };
  function relaxMap(m, T1, T2, TR) { const E1 = Math.exp(-TR / T1), E2 = Math.exp(-TR / T2); return [m[0] * E2, m[1] * E2, 1 - (1 - m[2]) * E1]; }
  function BuildSim(host) {
    const st = { tissue: 'White matter', alpha: 60 * D2R, TR: 4.5, prep: false, lab: false, k: 0, yaw: -78 * D2R, pitch: 12 * D2R, redraw: null };
    let NMAX = 400;
    const nmaxFor = () => { const [T1, T2] = TISSUE[st.tissue], a = st.alpha; const tau = 1 / (Math.cos(a / 2) ** 2 / T1 + Math.sin(a / 2) ** 2 / T2); return Math.max(60, Math.min(3000, Math.round(4 * tau / st.TR / 10) * 10)); };
    const views = el('div', { class: 'views' }); host.appendChild(views);
    const v3 = makeView(views, '3D: drag to turn · dots = the arrow just after each pulse');
    const vp = makeView(views, 'signal just after each pulse (one dot per pulse)');
    const legend = el('div', { class: 'legend' });
    legend.innerHTML = '<span class="k-gold">the skewer (tilted flip/2 from B0)</span><span class="k-teal">steady state</span><span class="k-white">the arrow now</span><span class="k-red">lab picture: odd pulses</span>';
    host.appendChild(legend);
    const ctr = el('div', { class: 'controls' }); host.appendChild(ctr);
    const kc = controlRange(ctr, 'Pulse number', 0, NMAX, 1, 0, (x) => String(Math.round(x)), (x) => { st.k = Math.round(x); draw(); });
    const sel = el('div', { class: 'ctl' }); sel.innerHTML = '<label><span>Tissue (1.5 T, approximate)</span></label>';
    const s = el('select', { class: 'select', 'aria-label': 'Tissue' }); Object.keys(TISSUE).forEach((n) => { const o = el('option', { value: n }, n); if (n === st.tissue) o.selected = true; s.appendChild(o); });
    s.addEventListener('change', () => { st.tissue = s.value; draw(); }); sel.appendChild(s); ctr.appendChild(sel);
    controlRange(ctr, 'Flip angle', 10, 90, 1, 60, (x) => x + '°', (x) => { st.alpha = x * D2R; draw(); });
    controlRange(ctr, 'Repetition time TR', 3, 8, 0.1, 4.5, (x) => x.toFixed(1) + ' ms', (x) => { st.TR = x; draw(); });
    segment(ctr, 'Start', [[false, 'Straight up (no preparation)'], [true, 'α/2 preparation']], (x) => { st.prep = x; draw(); });
    segment(ctr, 'Picture', [[false, 'Flipped every other pulse'], [true, 'Lab (alternating hinge)']], (x) => { st.lab = x; draw(); });
    playButton(ctr, kc, () => NMAX, 16, 'Play the pulses');

    function rescale() { const n = nmaxFor(); if (n !== NMAX) { NMAX = n; kc.r.max = n; if (st.k > n) kc.set(n); } }
    function series() {
      const [T1, T2] = TISSUE[st.tissue]; const a = st.alpha;
      const out = [];
      let m = st.prep ? [0, Math.sin(a / 2), Math.cos(a / 2)] : [0, Math.sin(a), Math.cos(a)];
      out.push(m);
      for (let k = 1; k <= NMAX; k++) { m = relaxMap(m, T1, T2, st.TR); m = rotz(m, Math.PI); m = flip(m, a); out.push(m); }
      // steady state by iterating long
      let q = out[NMAX]; for (let k = 0; k < 6000; k++) { q = flip(rotz(relaxMap(q, T1, T2, st.TR), Math.PI), a); }
      return { out, ss: q };
    }
    function draw() {
      rescale(); v3.fit(); vp.fit();
      const S = series(); const a = st.alpha, n = [0, Math.sin(a / 2), Math.cos(a / 2)];
      const ctx = v3.ctx, Pj = proj();
      disk(ctx, Pj, 1);
      const h0 = Pj([-1.2, 0, 0]), h1 = Pj([1.25, 0, 0]);
      line(ctx, h0[0], h0[1], h1[0], h1[1], C.gold, 1.5, [6, 5], 0.6); edgeText(ctx, 'hinge', h1[0] + 4, h1[1] + 10, C.gold, v3.w);
      const y0 = Pj([0, -1.15, 0]), y1 = Pj([0, 1.15, 0]); line(ctx, y0[0], y0[1], y1[0], y1[1], C.dim, 1.2, [3, 4]);
      edgeText(ctx, 'across', y1[0] + 4, y1[1] - 8, C.grey, v3.w);
      axisB0(ctx, Pj);
      const O = Pj([0, 0, 0]);
      const show = (m, k) => (st.lab && k % 2 === 1 ? [-m[0], -m[1], m[2]] : m);
      if (!st.lab) { const s0 = Pj(n.map((x) => -0.35 * x)), s1 = Pj(n.map((x) => 1.25 * x)); line(ctx, s0[0], s0[1], s1[0], s1[1], C.gold, 2.5, [8, 6]); text(ctx, 'skewer', s1[0] + 6, s1[1] - 4, C.gold, 12); }
      if (!st.lab) { const q = Pj(S.ss); arrow(ctx, O[0], O[1], q[0], q[1], C.teal, 3, 0.55); }
      for (let k = 0; k <= st.k; k++) { const m = show(S.out[k], k), q = Pj(m); dot(ctx, q[0], q[1], k === st.k ? 4 : 2.6, st.lab && k % 2 ? C.red : C.gold, k === st.k ? 1 : 0.75); }
      const cur = show(S.out[st.k], st.k), cq = Pj(cur); arrow(ctx, O[0], O[1], cq[0], cq[1], C.white, 3.5);
      const ssig = Math.hypot(S.ss[0], S.ss[1]), sig = Math.hypot(S.out[st.k][0], S.out[st.k][1]);
      v3.rd.textContent = `pulse ${st.k}: arrow length ${Math.hypot(...S.out[st.k]).toFixed(2)} · steady state ${Math.hypot(...S.ss).toFixed(2)}`;
      // plot
      const ymax = Math.max(0.6, ...S.out.map((m) => Math.hypot(m[0], m[1]))) * 1.08;
      const Pl = Plot(vp, [0, NMAX], [0, ymax], { l: 42, r: 14, t: 24, b: 30 });
      line(Pl.ctx, Pl.X(0), Pl.Y(ssig), Pl.X(NMAX), Pl.Y(ssig), C.teal, 1.5, [5, 4], 0.9);
      text(Pl.ctx, 'steady state ' + ssig.toFixed(3), Pl.X(NMAX), Pl.Y(ssig) - 9, C.teal, 11, 'right');
      S.out.slice(0, st.k + 1).forEach((m, k) => dot(Pl.ctx, Pl.X(k), Pl.Y(Math.hypot(m[0], m[1])), NMAX > 600 ? 1.2 : 1.8, C.white, 0.85));
      dot(Pl.ctx, Pl.X(st.k), Pl.Y(sig), 3.5, C.gold);
      text(Pl.ctx, 'pulse number', Pl.X(NMAX), Pl.Y(0) - 6, C.grey, 11, 'right');
      text(Pl.ctx, '0', Pl.X(0) - 6, Pl.Y(0), C.grey, 11, 'right');

      const [T1, T2] = TISSUE[st.tissue];
      const tau = 1 / (Math.cos(a / 2) ** 2 / T1 + Math.sin(a / 2) ** 2 / T2);
      vp.rd.textContent = `signal ${sig.toFixed(3)} · glide time ≈ ${tau.toFixed(0)} ms ≈ ${(tau / st.TR).toFixed(0)} pulses`;
    }
    const proj = View3D(v3, st, { scale: 0.34, cy: 0.62 });
    st.redraw = draw;
    return { draw };
  }

  // =========================================================
  // Sim 3: the hidden echo at TR/2 (breathing fan)
  // =========================================================
  function MirrorSim(host) {
    const T1 = 4000, T2 = 2000, TR = 4.5, A = 60 * D2R;
    const st = { u: 0.25, spread: 120, n: 9, yaw: -30 * D2R, pitch: 26 * D2R, redraw: null };
    const views = el('div', { class: 'views' }); host.appendChild(views);
    const v3 = makeView(views, '3D: one voxel · drag to turn');
    const vt = makeView(views, 'top view: forward = the signal direction');
    const vs = makeView(host, '', 'trace');
    const legend = el('div', { class: 'legend' });
    legend.innerHTML = '<span class="k-blue">spins with different phase advance per repetition</span><span class="k-white">voxel sum</span><span class="k-gold">pulses</span>';
    host.appendChild(legend);
    const ctr = el('div', { class: 'controls' }); host.appendChild(ctr);
    const uc = controlRange(ctr, 'Time (in repetitions)', 0, 3, 0.005, st.u, (x) => x.toFixed(2), (x) => { st.u = x; draw(); });
    controlRange(ctr, 'Spread of phase advance across the voxel', 10, 170, 5, 120, (x) => '±' + x + '°', (x) => { st.spread = x; cache = null; draw(); });
    controlRange(ctr, 'Spins drawn', 5, 15, 2, 9, (x) => String(x), (x) => { st.n = x; draw(); });
    playButton(ctr, uc, 3, 12);

    // steady state for one isochromat in the flipped picture; th = phase advance per TR (radians)
    function post(th) {
      let m = [0, Math.sin(A / 2), Math.cos(A / 2)];
      for (let k = 0; k < 5000; k++) { m = relaxMap(m, T1, T2, TR); m = rotz(m, th); m = rotz(m, Math.PI); m = flip(m, A); }
      return m;
    }
    function at(th, f, m0) { // f = fraction of a repetition after the pulse
      const E1 = Math.exp(-f * TR / T1), E2 = Math.exp(-f * TR / T2);
      const m = [m0[0] * E2, m0[1] * E2, 1 - (1 - m0[2]) * E1];
      return rotz(m, th * f);
    }
    let cache = null;
    function table() {
      if (cache) return cache;
      const NC = 181, ths = Array.from({ length: NC }, (_, i) => (-st.spread + (2 * st.spread * i) / (NC - 1)) * D2R);
      const posts = ths.map(post);
      const tr = [];
      for (let i = 0; i <= 300; i++) {
        const u = i / 100, f = u >= 3 ? 1 : u - Math.floor(u);
        let x = 0, y = 0; posts.forEach((p, j) => { const m = at(ths[j], f, p); x += m[0]; y += m[1]; });
        tr.push([u, Math.hypot(x, y) / NC]);
      }
      cache = { ths, posts, tr };
      return cache;
    }
    function draw() {
      v3.fit(); vt.fit(); vs.fit();
      const tb = table();
      const f = st.u >= 3 ? 1 : st.u - Math.floor(st.u);
      const ths = Array.from({ length: st.n }, (_, i) => (-st.spread + (2 * st.spread * i) / (st.n - 1)) * D2R);
      const cl = pal(st.n);
      const ms = ths.map((th) => at(th, f, post(th)));
      // 3D
      const ctx = v3.ctx, Pj = proj(); disk(ctx, Pj, 1);
      const h0 = Pj([-1.2, 0, 0]), h1 = Pj([1.25, 0, 0]); line(ctx, h0[0], h0[1], h1[0], h1[1], C.gold, 1.5, [6, 5], 0.6); edgeText(ctx, 'hinge', h1[0] + 4, h1[1] + 10, C.gold, v3.w);
      axisB0(ctx, Pj);
      const n = [0, Math.sin(A / 2), Math.cos(A / 2)], s0 = Pj(n.map((x) => -0.3 * x)), s1 = Pj(n.map((x) => 1.2 * x)); line(ctx, s0[0], s0[1], s1[0], s1[1], C.gold, 2, [8, 6], 0.7);
      const O = Pj([0, 0, 0]); const k = 1.25;
      ms.forEach((m, i) => { const q = Pj(m.map((x) => x * k)), sh = Pj([m[0] * k, m[1] * k, 0]); line(ctx, q[0], q[1], sh[0], sh[1], C.grey, 1, [2, 3], 0.6); arrow(ctx, O[0], O[1], q[0], q[1], cl[i], 2.2); });
      v3.rd.textContent = 'fluid-like spins · 60° · TR 4.5 ms';
      // top: forward = +y up
      const T = Top(vt, { fwd: 'forward', R: 0.4 });
      let sx = 0, sy = 0;
      ms.forEach((m, i) => { const r = Math.hypot(m[0], m[1]) || 1e-6, L = 0.25 + 0.7 * Math.min(1, r / 0.3); const q = T.P(L * m[0] / r, L * m[1] / r); arrow(T.ctx, T.cx, T.cy, q[0], q[1], cl[i], 2.4); });
      const fi = Math.min(300, Math.round(st.u * 100)); const sig = tb.tr[fi][1];
      tb.posts.forEach((p, j) => { const m = at(tb.ths[j], f, p); sx += m[0]; sy += m[1]; });
      const ang = Math.atan2(sx, sy) / D2R;
      const sq = T.P(0.95 * sx / Math.hypot(sx, sy), 0.95 * sy / Math.hypot(sx, sy));
      arrow(T.ctx, T.cx, T.cy, sq[0], sq[1], C.white, 4.5, 0.9);
      vt.rd.textContent = `${f < 0.03 || f > 0.97 ? 'at a pulse: fan half open' : Math.abs(f - 0.5) < 0.03 ? 'TR/2: the hidden echo' : 'fan ' + (f < 0.5 ? 'closing' : 'opening')} · hand lengths compressed`;
      // trace
      const ymax = Math.max(...tb.tr.map((p) => p[1])) * 1.15;
      const Pl = Plot(vs, [0, 3], [0, ymax], { l: 24, r: 16, t: 34, b: 26 });
      for (let k2 = 0; k2 <= 3; k2++) { line(Pl.ctx, Pl.X(k2), Pl.Y(0), Pl.X(k2), Pl.Y(ymax), C.gold, 1.5, [4, 4], 0.9); if (k2 < 3) text(Pl.ctx, 'pulse', Pl.X(k2) + 4, Pl.pad.t - 12, C.gold, 12); }
      for (let k2 = 0; k2 < 3; k2++) { line(Pl.ctx, Pl.X(k2 + 0.5), Pl.Y(0), Pl.X(k2 + 0.5), Pl.Y(ymax), C.dim, 1, null, 0.8); text(Pl.ctx, 'TR/2', Pl.X(k2 + 0.5), vs.h - 12, C.grey, 11, 'center'); }
      polyline(Pl.ctx, tb.tr.map((p) => [Pl.X(p[0]), Pl.Y(p[1])]), C.teal, 2);
      if (vs.w > 640) text(Pl.ctx, 'voxel signal over three repetitions', vs.w - 16, 12, C.grey, 12, 'right');
      dot(Pl.ctx, Pl.X(st.u), Pl.Y(sig), 4, C.white);
      vs.rd.textContent = `voxel signal ${sig.toFixed(3)}`;
    }
    const proj = View3D(v3, st, { scale: 0.34, cy: 0.62 });
    st.redraw = draw;
    return { draw };
  }

  window.SSSims = { TrainSim, BuildSim, MirrorSim };
})();
