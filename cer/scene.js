/* Una giornata della comunita' energetica, disegnata su canvas.
   Il cielo segue le ore, i pannelli producono col sole, le pale col vento;
   l'energia corre sui cavi verso la cabina e da li' alle case. Quella in piu'
   esce verso la rete nazionale, quella che manca arriva da li'. In basso il
   grafico della stessa giornata: prodotta, consumata e condivisa (il minimo
   delle due, ora per ora: e' la regola della CER). Profili illustrativi.
   Passando col puntatore sulla scena si sceglie l'ora. */
(function () {
  'use strict';
  const cv = document.getElementById('scene');
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const W = 800, H = 620;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── profili della giornata (unita' arbitrarie) ─────────────────────────
  const g = (h, c, s) => Math.exp(-((h - c) * (h - c)) / (2 * s * s));
  const solar = (h) => (h > 6 && h < 20 ? Math.pow(Math.sin(Math.PI * (h - 6) / 14), 1.3) : 0);
  const wind = (h) => 0.24 + 0.1 * Math.sin(2 * Math.PI * h / 16 + 0.8) + 0.05 * Math.sin(2 * Math.PI * h / 5);
  const cons = (h) => 0.3 + 0.38 * (g(h, 7.6, 1.2) + g(h, 31.6, 1.2)) + 0.62 * (g(h, 20.2, 1.9) + g(h, -3.8, 1.9)) + 0.14 * g(h, 13, 1.4);
  const prod = (h) => solar(h) * 1.05 + wind(h) * 0.75;
  const shared = (h) => Math.min(prod(h), cons(h));
  const daylight = (h) => Math.max(0, Math.min(1, Math.sin(Math.PI * (h - 5.2) / 15.6) * 1.6));

  // ── colori ──────────────────────────────────────────────────────────────
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const mixc = (a, b, f) => { a = hex(a); b = hex(b); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(',')})`; };
  const SKY = [ // ora, alto, orizzonte
    [0, '#070d24', '#18224a'], [4.8, '#0d1534', '#2c2a58'], [6.2, '#4a5aa6', '#f7a47a'],
    [8.5, '#5aaee8', '#cfeaf8'], [16.5, '#4fa6e6', '#d6eef9'], [18.8, '#5257a0', '#f69a66'],
    [20.4, '#1a2152', '#5b3e6e'], [24, '#070d24', '#18224a']];
  function sky(h) {
    for (let i = 0; i < SKY.length - 1; i++) {
      const a = SKY[i], b = SKY[i + 1];
      if (h >= a[0] && h <= b[0]) { const f = (h - a[0]) / (b[0] - a[0]); return [mixc(a[1], b[1], f), mixc(a[2], b[2], f)]; }
    }
    return [SKY[0][1], SKY[0][2]];
  }
  const dn = (day, night, L) => mixc(night, day, L);

  // ── scena ──────────────────────────────────────────────────────────────
  const CAB = { x: 432, y: 476 };
  const houses = [
    { x: 150, base: 470, w: 112, h: 66, pv: 0.42, use: 0.30, roof: 40 },
    { x: 292, base: 458, w: 88, h: 54, pv: 0.33, use: 0.24, roof: 32 },
    { x: 528, base: 482, w: 82, h: 52, pv: 0, use: 0.2, roof: 30 },
    { x: 640, base: 474, w: 104, h: 60, pv: 0.25, use: 0.26, roof: 36 }];
  const turbines = [{ x: 600, y: 352, hgt: 128, s: 0.9, a: 0.3 }, { x: 690, y: 338, hgt: 158, s: 1, a: 1.7 }, { x: 760, y: 360, hgt: 104, s: 1.15, a: 4 }];
  const PYLON = { x: 58, y: 432 };
  const trees = [[238, 474, 15], [402, 452, 11], [592, 470, 13], [22, 474, 12], [92, 482, 13]];
  const stars = Array.from({ length: 70 }, (_, i) => ({ x: (i * 137.5) % W, y: ((i * 71.3) % 260) + 8, r: 0.6 + ((i * 13) % 10) / 10, p: i * 1.7 }));
  const clouds = [{ x: 120, y: 92, s: 1.1, v: 7 }, { x: 470, y: 60, s: 0.8, v: 11 }, { x: 690, y: 130, s: 1.3, v: 5 }];

  // cavi: curve cubiche dalla casa (o pala, o pilone) alla cabina
  const cable = (x, y) => [x, y, x + (CAB.x - x) * 0.25, y + 26, CAB.x - (CAB.x - x) * 0.25, CAB.y + 30, CAB.x, CAB.y + 14];
  houses.forEach((o) => { o.path = cable(o.x + o.w / 2, o.base); });
  turbines.forEach((o) => { o.path = [o.x, o.y, o.x - 10, o.y + 90, CAB.x + 120, CAB.y + 34, CAB.x + 30, CAB.y + 8]; });
  const gridPath = [PYLON.x, PYLON.y - 64, 150, PYLON.y + 40, 300, CAB.y + 44, CAB.x - 24, CAB.y + 6];
  function bez(p, t) {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * p[0] + b * p[2] + c * p[4] + d * p[6], a * p[1] + b * p[3] + c * p[5] + d * p[7]];
  }

  // ── particelle: sprite luminosi pre-disegnati ──────────────────────────
  function sprite(col) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,240,.95)'); gr.addColorStop(0.22, col); gr.addColorStop(0.55, col.replace(/[\d.]+\)$/, '.25)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return c;
  }
  const SPR = { sun: sprite('rgba(255,170,30,1)'), wind: sprite('rgba(40,200,190,1)'), share: sprite('rgba(60,210,100,1)'), grid: sprite('rgba(140,150,200,1)') };
  let parts = [];
  const acc = new Map();
  function spawn(key, path, rate, kind, rev, dt) {
    let a = (acc.get(key) || 0) + rate * 24 * dt;
    while (a >= 1) { a -= 1; parts.push({ path, t: 0, v: 0.4 + Math.random() * 0.22, kind, rev, j: (Math.random() - 0.5) * 3 }); }
    acc.set(key, a);
  }
  function simulate(h, dt) {
    const s = solar(h), w = wind(h), P = prod(h), C = cons(h), S = Math.min(P, C);
    houses.forEach((o, i) => {
      if (o.pv) spawn('pv' + i, o.path, s * 1.05 * o.pv, 'sun', false, dt);
      spawn('use' + i, o.path, S * o.use, 'share', true, dt);
    });
    turbines.forEach((o, i) => spawn('w' + i, o.path, w * 0.75 / 3, 'wind', false, dt));
    if (carAt(h).charging) spawn('ev', chargePath, S * 0.45, 'share', false, dt);
    if (P > C) spawn('exp', gridPath, (P - C) * 0.8, 'sun', true, dt);
    else spawn('imp', gridPath, (C - P) * 0.8, 'grid', false, dt);
    for (const p of parts) p.t += p.v * dt;
    parts = parts.filter((p) => p.t < 1);
    if (parts.length > 520) parts.splice(0, parts.length - 520);
  }

  // ── disegno ────────────────────────────────────────────────────────────
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function hill(y0, amp, ph, col) {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y0 + Math.sin(x / 140 + ph) * amp + Math.sin(x / 61 + ph * 2) * amp * 0.3);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }
  function cloud(x, y, s, col) {
    ctx.fillStyle = col; ctx.beginPath();
    [[0, 0, 22], [24, -10, 26], [52, -2, 22], [76, 4, 16], [36, 8, 20]].forEach(([dx, dy, r]) => { ctx.moveTo(x + dx * s + r * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); });
    ctx.fill();
  }

  const hy = (y0, amp, ph, x) => y0 + Math.sin(x / 140 + ph) * amp + Math.sin(x / 61 + ph * 2) * amp * 0.3;
  const ROAD = (x) => 489 + Math.sin(x / 190 + 1) * 2;
  const ease = (f) => f * f * (3 - 2 * f);
  // l'auto elettrica della casa a destra: esce, torna a mezzogiorno a
  // ricaricarsi col sole, riparte, torna la sera
  const PARK = 776, OUT = -80;
  const TRIPS = [[8, 8.7, PARK, OUT], [12.3, 13, OUT, PARK], [16.3, 17, PARK, OUT], [19.2, 19.9, OUT, PARK]];
  function carAt(h) {
    for (const [a, b, x0, x1] of TRIPS) if (h >= a && h < b) return { x: x0 + (x1 - x0) * ease((h - a) / (b - a)), dir: Math.sign(x1 - x0), moving: true };
    const away = (h >= 8.7 && h < 12.3) || (h >= 17 && h < 19.2);
    return { x: away ? -999 : PARK, dir: 1, moving: false, charging: h >= 13 && h < 16.3 };
  }
  const chargePath = [744, 462, 754, 476, 762, 478, 768, 474];
  const LAMPS = [274, 488, 616];
  const VILLAGE = [[170, 10, 8], [183, 12, 10], [198, 9, 7], [214, 13, 9], [232, 6, 22], [242, 11, 8], [256, 12, 10], [272, 9, 7], [286, 13, 9], [302, 10, 8]];
  const PEAKS = [[0, 300], [70, 258], [130, 286], [200, 236], [268, 282], [335, 252], [410, 290], [478, 256], [560, 286], [640, 242], [718, 280], [800, 258]];
  const flies = Array.from({ length: 18 }, (_, i) => ({ x: 40 + ((i * 97) % 720), y: 432 + ((i * 37) % 44), p: i * 2.1 }));
  const flock = { on: false, x: 0, y: 0, wait: 2 };
  let shoot = null;
  let hour = 9, clock = 0;
  function draw(dt) {
    const h = hour, L = daylight(h), s = solar(h), w = wind(h), P = prod(h), C = cons(h), S = Math.min(P, C);
    ctx.save();
    const k = cv.width / W; ctx.setTransform(k, 0, 0, k, 0, 0);

    // cielo
    const [top, hor] = sky(h);
    let gr = ctx.createLinearGradient(0, 0, 0, 420); gr.addColorStop(0, top); gr.addColorStop(1, hor);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // stelle
    if (L < 0.6) {
      ctx.fillStyle = '#fff';
      for (const st of stars) { ctx.globalAlpha = (1 - L / 0.6) * (0.45 + 0.55 * Math.sin(clock * 2 + st.p) ** 2); ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // sole e luna
    const arc = (f) => [70 + f * 660, 340 - Math.sin(Math.PI * f) * 270];
    // stella cadente, ogni tanto
    if (L < 0.2 && !shoot && Math.random() < dt * 0.18) shoot = { x: 80 + Math.random() * 520, y: 20 + Math.random() * 120, t: 0 };
    if (shoot) {
      shoot.t += dt;
      const f = shoot.t / 0.9, hx = shoot.x + f * 170, hyy = shoot.y + f * 60;
      const sg = ctx.createLinearGradient(hx - 90, hyy - 32, hx, hyy);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(1, `rgba(255,255,255,${1 - f})`);
      ctx.strokeStyle = sg; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(hx - 90, hyy - 32); ctx.lineTo(hx, hyy); ctx.stroke();
      if (f >= 1) shoot = null;
    }
    const golden = g(h, 6.9, 0.8) + g(h, 19.3, 0.8);
    if (h > 5.5 && h < 20.5) {
      const [sx, sy] = arc((h - 6) / 14);
      // raggi che ruotano piano, piu' visibili all'alba e al tramonto
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(clock * 0.04);
      const rg = ctx.createRadialGradient(0, 0, 20, 0, 0, 260);
      rg.addColorStop(0, `rgba(255,220,140,${0.16 + 0.2 * golden})`); rg.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = rg;
      for (let q = 0; q < 12; q++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(260, -16); ctx.lineTo(260, 16); ctx.fill(); }
      ctx.restore();
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 150);
      halo.addColorStop(0, 'rgba(255,214,120,.55)'); halo.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = halo; ctx.fillRect(sx - 150, sy - 150, 300, 300);
      ctx.fillStyle = mixc('#ff8a3d', '#ffd24a', Math.min(1, s * 1.6)); ctx.beginPath(); ctx.arc(sx, sy, 30, 0, 7); ctx.fill();
    }
    const mh = (h + 4) % 24; // la luna fa il suo arco fra le 20 e le 6
    if (mh < 10.5) {
      const [mx, my] = arc(mh / 10);
      ctx.fillStyle = 'rgba(235,240,255,.95)'; ctx.beginPath(); ctx.arc(mx, my, 18, 0, 7); ctx.fill();
      ctx.fillStyle = top; ctx.beginPath(); ctx.arc(mx + 8, my - 5, 16, 0, 7); ctx.fill();
    }
    // montagne lontane, nella foschia dell'orizzonte
    const mg = ctx.createLinearGradient(0, 236, 0, 330);
    mg.addColorStop(0, dn('#8ea4c8', '#1a2348', L)); mg.addColorStop(1, hor);
    ctx.fillStyle = mg; ctx.beginPath(); ctx.moveTo(0, 340);
    for (const [x, y] of PEAKS) ctx.lineTo(x, y);
    ctx.lineTo(W, 340); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * L})`;
    for (const [x, y] of [[200, 236], [640, 242], [478, 256]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 17, y + 13); ctx.lineTo(x - 6, y + 9); ctx.lineTo(x + 2, y + 15); ctx.lineTo(x + 15, y + 11); ctx.closePath(); ctx.fill(); }
    // uccelli, di giorno
    if (L > 0.6) {
      if (!flock.on && (flock.wait -= dt) < 0) Object.assign(flock, { on: true, x: -60, y: 70 + Math.random() * 110 });
      if (flock.on) {
        flock.x += 42 * dt;
        ctx.strokeStyle = 'rgba(30,45,55,.75)'; ctx.lineWidth = 1.5;
        [[0, 0], [-15, -8], [-15, 9], [-30, -15], [-30, 17], [-46, -21]].forEach(([dx, dy], q) => {
          const bx = flock.x + dx, by = flock.y + dy + Math.sin(clock * 1.5 + q) * 2, f = Math.sin(clock * 9 + q * 1.3) * 4;
          ctx.beginPath(); ctx.moveTo(bx - 6, by - f); ctx.quadraticCurveTo(bx - 2, by - 1, bx, by); ctx.quadraticCurveTo(bx + 2, by - 1, bx + 6, by - f); ctx.stroke();
        });
        if (flock.x > W + 70) Object.assign(flock, { on: false, wait: 5 + Math.random() * 8 });
      }
    }
    // nuvole
    for (const c of clouds) {
      c.x += c.v * dt; if (c.x > W + 60) c.x = -120;
      cloud(c.x, c.y, c.s, L > 0.3 ? `rgba(255,255,255,${0.55 + 0.3 * L})` : `rgba(120,130,170,${0.25 + L})`);
    }

    // colline lontane, pale
    hill(330, 14, 0.4, dn('#a9d9b9', '#17302e', L));
    // il paese sulla collina lontana
    for (const [x, w0, h0] of VILLAGE) {
      const y = hy(330, 14, 0.4, x) + 3, peak = h0 > 20 ? 8 : 4;
      ctx.fillStyle = dn('#86a597', '#0f2120', L); ctx.fillRect(x, y - h0, w0, h0);
      ctx.beginPath(); ctx.moveTo(x - 1, y - h0); ctx.lineTo(x + w0 / 2, y - h0 - peak); ctx.lineTo(x + w0 + 1, y - h0); ctx.fill();
      if (L < 0.5) { ctx.fillStyle = `rgba(255,210,120,${(1 - L / 0.5) * (0.6 + 0.4 * Math.sin(clock * 0.7 + x))})`; ctx.fillRect(x + w0 * 0.3, y - h0 * 0.6, 2, 2); }
    }
    for (const t of turbines) {
      t.a += (0.6 + w * 7) * t.s * dt;
      const tc = dn('#f5f7f6', '#9aa7ad', L);
      ctx.fillStyle = tc; ctx.beginPath(); ctx.moveTo(t.x - 4, t.y); ctx.lineTo(t.x - 1.5, t.y - t.hgt); ctx.lineTo(t.x + 1.5, t.y - t.hgt); ctx.lineTo(t.x + 4, t.y); ctx.fill();
      ctx.save(); ctx.translate(t.x, t.y - t.hgt); ctx.rotate(t.a);
      for (let b = 0; b < 3; b++) {
        ctx.rotate((2 * Math.PI) / 3); ctx.beginPath(); ctx.moveTo(-2.5, 0); ctx.quadraticCurveTo(-5, -t.hgt * 0.3, 0, -t.hgt * 0.48); ctx.quadraticCurveTo(3, -t.hgt * 0.2, 2.5, 0); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = '#ffc94a'; ctx.beginPath(); ctx.arc(t.x, t.y - t.hgt, 4, 0, 7); ctx.fill();
    }
    hill(392, 12, 2.1, dn('#7cc596', '#13291f', L));

    // pilone della rete nazionale
    ctx.strokeStyle = dn('#56636a', '#8792a0', L); ctx.lineWidth = 2;
    const px = PYLON.x, py = PYLON.y;
    ctx.beginPath(); ctx.moveTo(px - 14, py); ctx.lineTo(px, py - 80); ctx.lineTo(px + 14, py);
    ctx.moveTo(px - 20, py - 62); ctx.lineTo(px + 20, py - 62); ctx.moveTo(px - 14, py - 50); ctx.lineTo(px + 14, py - 50);
    ctx.moveTo(px - 9, py - 30); ctx.lineTo(px + 9, py - 20); ctx.moveTo(px + 9, py - 30); ctx.lineTo(px - 9, py - 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, py - 50); ctx.quadraticCurveTo(px / 2 - 5, py - 44, px - 20, py - 62); ctx.stroke();
    ctx.font = '600 13px Archivo, sans-serif'; ctx.fillStyle = dn('#33413f', '#a9b6bc', L); ctx.fillText('rete nazionale', px - 44, py - 92);

    // terreno davanti
    hill(446, 8, 4.2, dn('#58ad7c', '#0f231b', L));
    ctx.fillStyle = `rgba(10,40,25,${0.12 * L})`;
    for (const c of clouds) { ctx.beginPath(); ctx.ellipse(c.x + 40 * c.s, 470, 80 * c.s, 9, 0, 0, 7); ctx.fill(); }
    // strada in primo piano
    ctx.beginPath(); ctx.moveTo(-10, ROAD(-10) - 4);
    for (let x = 0; x <= W + 10; x += 20) ctx.lineTo(x, ROAD(x) - 4);
    for (let x = W + 10; x >= -10; x -= 20) ctx.lineTo(x, ROAD(x) + 5);
    ctx.closePath(); ctx.fillStyle = dn('#9a9d94', '#1d2427', L); ctx.fill();
    ctx.setLineDash([9, 11]); ctx.strokeStyle = dn('#f4f1e6', '#59616a', L); ctx.lineWidth = 1.2;
    ctx.beginPath(); for (let x = -10; x <= W + 10; x += 10) x === -10 ? ctx.moveTo(x, ROAD(x) + 0.5) : ctx.lineTo(x, ROAD(x) + 0.5); ctx.stroke(); ctx.setLineDash([]);

    // cavi
    ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    const cabCol = dn('rgba(30,50,45,.35)', 'rgba(255,220,140,.22)', L);
    const curve = (p) => { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]); ctx.stroke(); };
    ctx.strokeStyle = cabCol; houses.forEach((o) => curve(o.path)); turbines.forEach((o) => curve(o.path)); curve(gridPath);
    // i cavi si illuminano con l'energia che ci passa
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 5;
    houses.forEach((o) => { const f = Math.min(1, s * o.pv * 2.2 + S * o.use * 1.6); ctx.strokeStyle = `rgba(150,240,160,${0.16 * f * (1 - 0.5 * L)})`; curve(o.path); });
    turbines.forEach((o) => { ctx.strokeStyle = `rgba(90,225,210,${0.5 * w * (1 - 0.7 * L)})`; curve(o.path); });
    ctx.strokeStyle = P > C ? `rgba(255,190,60,${Math.min(0.3, (P - C) * 0.5)})` : `rgba(170,180,215,${Math.min(0.3, (C - P) * 0.4)})`; curve(gridPath);
    ctx.restore();

    // alberi
    for (const [x, y, r] of trees) {
      const sw = Math.sin(clock * 1.3 + x) * (1 + w * 3);
      ctx.fillStyle = dn('#3c5a4a', '#1b2a24', L); ctx.fillRect(x - 1.5, y - 4, 3, 14);
      ctx.fillStyle = dn('#2f9e6a', '#16473a', L); ctx.beginPath(); ctx.ellipse(x + sw * 0.4, y - r, r * 0.9, r * 1.1, sw * 0.02, 0, 7); ctx.fill();
    }

    // ombre delle case: dalla parte opposta al sole, lunghe quando e' basso
    if (h > 6.2 && h < 19.8) {
      const f = (h - 6) / 14, sxx = 70 + f * 660, el = Math.sin(Math.PI * f);
      ctx.fillStyle = `rgba(10,35,25,${0.2 * L})`;
      for (const o of houses) {
        const d = Math.sign(o.x + o.w / 2 - sxx) || 1, len = 16 + 90 * (1 - el);
        ctx.beginPath(); ctx.moveTo(o.x, o.base); ctx.lineTo(o.x + o.w, o.base); ctx.lineTo(o.x + o.w + d * len, o.base + 7); ctx.lineTo(o.x + d * len, o.base + 7); ctx.fill();
      }
    }
    // case
    houses.forEach((o, i) => {
      const x = o.x, b = o.base, top = b - o.h;
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(x + o.w / 2, b + 2, o.w * 0.6, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = dn('#fbf8f1', '#273035', L); ctx.fillRect(x, top, o.w, o.h);
      ctx.fillStyle = dn('#24302e', '#11181a', L);
      ctx.beginPath(); ctx.moveTo(x - 9, top + 3); ctx.lineTo(x + o.w / 2, top - o.roof); ctx.lineTo(x + o.w + 9, top + 3); ctx.fill();
      // finestre: accese quando serve luce
      const lit = Math.max(0, Math.min(1, (1 - L) * 1.4)) * (0.5 + 0.5 * Math.min(1, C));
      const win = (wx, wy, ww, wh) => {
        ctx.fillStyle = dn('#cfe6ef', '#1b2226', L); ctx.fillRect(wx, wy, ww, wh);
        if (lit > 0.02) {
          ctx.fillStyle = `rgba(255,205,110,${lit})`; ctx.fillRect(wx, wy, ww, wh);
          const gl = ctx.createRadialGradient(wx + ww / 2, wy + wh / 2, 0, wx + ww / 2, wy + wh / 2, 34);
          gl.addColorStop(0, `rgba(255,200,100,${0.35 * lit})`); gl.addColorStop(1, 'rgba(255,200,100,0)');
          ctx.fillStyle = gl; ctx.fillRect(wx - 30, wy - 30, ww + 60, wh + 60);
        }
      };
      win(x + o.w * 0.14, top + o.h * 0.25, o.w * 0.2, o.h * 0.3);
      win(x + o.w * 0.66, top + o.h * 0.25, o.w * 0.2, o.h * 0.3);
      ctx.fillStyle = dn('#3a4a48', '#0b1012', L); ctx.fillRect(x + o.w * 0.42, b - o.h * 0.48, o.w * 0.16, o.h * 0.48);
      // pannelli sulla falda destra, con il riflesso del sole
      if (o.pv) {
        const ax = x + o.w / 2 + 6, ay = top - o.roof + 8, bx = x + o.w + 2, by = top - 1;
        const n = 3, dx = (bx - ax) / n, dy = (by - ay) / n;
        for (let q = 0; q < n; q++) {
          const cx0 = ax + dx * q, cy0 = ay + dy * q;
          ctx.fillStyle = dn('#2563b8', '#18305a', L);
          ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx0 + dx - 1.5, cy0 + dy - 1); ctx.lineTo(cx0 + dx - 1.5 - 7, cy0 + dy + 8); ctx.lineTo(cx0 - 7, cy0 + 9); ctx.fill();
        }
        if (s > 0.05) {
          const f = (clock * 0.35 + i * 0.3) % 1.6;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const gx = ax + (bx - ax) * f, gy = ay + (by - ay) * f;
          const gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, 14);
          gl.addColorStop(0, `rgba(255,255,255,${0.75 * s})`); gl.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gl; ctx.fillRect(gx - 14, gy - 14, 28, 28); ctx.restore();
        }
      }
    });

    // cabina: anelli che pulsano con l'energia condivisa
    const ph = (clock * 0.9) % 1;
    for (let r = 0; r < 2; r++) {
      const f = (ph + r * 0.5) % 1;
      ctx.strokeStyle = `rgba(120,235,140,${(1 - f) * 0.7 * Math.min(1, S * 1.4)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(CAB.x, CAB.y + 8, 20 + f * 60, 7 + f * 20, 0, 0, 7); ctx.stroke();
    }
    ctx.fillStyle = dn('#1f2b29', '#e9efe9', L); rr(CAB.x - 22, CAB.y - 30, 44, 40, 6); ctx.fill();
    ctx.fillStyle = '#ffc23d';
    ctx.beginPath(); ctx.moveTo(CAB.x + 3, CAB.y - 24); ctx.lineTo(CAB.x - 8, CAB.y - 8); ctx.lineTo(CAB.x - 1, CAB.y - 8); ctx.lineTo(CAB.x - 4, CAB.y + 4); ctx.lineTo(CAB.x + 8, CAB.y - 12); ctx.lineTo(CAB.x + 1, CAB.y - 12); ctx.closePath(); ctx.fill();

    // particelle: di notte si sommano e brillano, di giorno restano colorate
    ctx.globalCompositeOperation = L > 0.45 ? 'source-over' : 'lighter';
    for (const p of parts) {
      const t = p.rev ? 1 - p.t : p.t;
      const [x, y] = bez(p.path, t);
      const a = Math.min(1, p.t * 6, (1 - p.t) * 6);
      const sz = p.kind === 'share' ? 24 : 21;
      // scia: tre copie piu' piccole e trasparenti dietro la particella
      for (let q = 3; q >= 0; q--) {
        const tq = p.rev ? 1 - Math.max(0, p.t - q * 0.018) : Math.max(0, p.t - q * 0.018);
        const [qx, qy] = q ? bez(p.path, tq) : [x, y];
        const zq = sz * (1 - q * 0.2);
        ctx.globalAlpha = a * (q ? 0.28 / q : 1);
        ctx.drawImage(SPR[p.kind], qx - zq / 2, qy - zq / 2 + p.j, zq, zq);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    // in primo piano, davanti a case e cavi: lampioni e auto
    ctx.strokeStyle = dn('#3e4a4c', '#5d6a70', L); ctx.lineWidth = 2;
    for (const x of LAMPS) { const y = ROAD(x) - 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 34); ctx.lineTo(x + 8, y - 36); ctx.stroke(); }
    const car = carAt(h);
    if (car.charging) {
      ctx.strokeStyle = dn('#2a3536', '#9aa6aa', L); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(chargePath[0], chargePath[1]); ctx.bezierCurveTo(chargePath[2], chargePath[3], chargePath[4], chargePath[5], chargePath[6], chargePath[7]); ctx.stroke();
    }
    if (car.x > -100) {
      const y = ROAD(car.x) + 1;
      ctx.save(); ctx.translate(car.x, y); ctx.scale(car.dir, 1);
      if (L < 0.55 && car.moving) {
        const hl = ctx.createLinearGradient(22, 0, 110, 0);
        hl.addColorStop(0, `rgba(255,240,190,${0.6 * (1 - L)})`); hl.addColorStop(1, 'rgba(255,240,190,0)');
        ctx.fillStyle = hl; ctx.beginPath(); ctx.moveTo(21, -10); ctx.lineTo(110, -24); ctx.lineTo(110, 6); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 1, 24, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = dn('#e0533f', '#8a3226', L);
      rr(-23, -15, 46, 11, 5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(-8, -23); ctx.lineTo(8, -23); ctx.lineTo(15, -14); ctx.fill();
      ctx.fillStyle = dn('#cfeaf6', '#2b3c4a', L);
      ctx.beginPath(); ctx.moveTo(-11, -15); ctx.lineTo(-7, -21); ctx.lineTo(-1, -21); ctx.lineTo(-1, -15); ctx.fill();
      ctx.beginPath(); ctx.moveTo(1, -15); ctx.lineTo(1, -21); ctx.lineTo(7, -21); ctx.lineTo(12, -15); ctx.fill();
      ctx.fillStyle = L < 0.55 ? '#fff4c8' : '#ffe08a'; ctx.fillRect(20, -12, 3, 3);
      ctx.fillStyle = '#ff5a4a'; ctx.fillRect(-23, -12, 2, 3);
      for (const wx of [-13, 13]) {
        ctx.fillStyle = '#15191b'; ctx.beginPath(); ctx.arc(wx, -4, 5, 0, 7); ctx.fill();
        ctx.strokeStyle = '#9aa3a8'; ctx.lineWidth = 1; const ra = car.x / 5;
        ctx.beginPath(); ctx.moveTo(wx + Math.cos(ra) * 3, -4 + Math.sin(ra) * 3); ctx.lineTo(wx - Math.cos(ra) * 3, -4 - Math.sin(ra) * 3); ctx.stroke();
      }
      ctx.restore();
      if (car.charging) {
        const lev = 0.3 + 0.7 * Math.min(1, (h - 13) / 3.2), bx = PARK - 13, by = ROAD(PARK) - 44;
        ctx.fillStyle = 'rgba(10,20,18,.75)'; rr(bx - 3, by - 3, 32, 16, 4); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.strokeRect(bx, by, 22, 10); ctx.fillStyle = '#fff'; ctx.fillRect(bx + 22, by + 3, 2.5, 4);
        ctx.fillStyle = `rgba(110,230,140,${0.75 + 0.25 * Math.sin(clock * 5)})`; ctx.fillRect(bx + 1.5, by + 1.5, 19 * lev, 7);
      }
    }
    // luci della sera: lampioni e lucciole
    if (L < 0.5) {
      ctx.globalCompositeOperation = 'lighter';
      const on = 1 - L / 0.5;
      for (const x of LAMPS) {
        const y = ROAD(x) - 40;
        const lg = ctx.createRadialGradient(x + 8, y + 2, 0, x + 8, y + 2, 26);
        lg.addColorStop(0, `rgba(255,214,140,${0.9 * on})`); lg.addColorStop(1, 'rgba(255,214,140,0)');
        ctx.fillStyle = lg; ctx.fillRect(x - 20, y - 24, 56, 52);
        const cg = ctx.createLinearGradient(0, y, 0, y + 42);
        cg.addColorStop(0, `rgba(255,214,140,${0.32 * on})`); cg.addColorStop(1, 'rgba(255,214,140,0)');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(x + 5, y + 3); ctx.lineTo(x + 11, y + 3); ctx.lineTo(x + 30, y + 44); ctx.lineTo(x - 14, y + 44); ctx.fill();
      }
      for (const f of flies) {
        const a = on * Math.max(0, Math.sin(clock * 1.7 + f.p)) ** 3;
        if (a < 0.02) continue;
        ctx.globalAlpha = a;
        ctx.drawImage(SPR.sun, f.x + Math.sin(clock * 0.6 + f.p) * 14 - 5, f.y + Math.cos(clock * 0.8 + f.p) * 6 - 5, 10, 10);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // luce dorata all'alba e al tramonto
    if (golden > 0.02) { ctx.fillStyle = `rgba(255,130,60,${0.12 * Math.min(1, golden)})`; ctx.fillRect(0, 0, W, 500); }

    // ── il grafico della giornata ──
    const X0 = 20, Y0 = 500, GW = W - 40, GH = 104;
    ctx.fillStyle = 'rgba(8,16,14,.62)'; rr(X0, Y0, GW, GH, 14); ctx.fill();
    const cx0 = X0 + 168, cw = GW - 186, base = Y0 + GH - 18, ch = 62, vmax = 1.45;
    const xs = (hh) => cx0 + (hh / 24) * cw, ys = (v) => base - (v / vmax) * ch;
    const area = (f, col) => { ctx.beginPath(); ctx.moveTo(xs(0), base); for (let q = 0; q <= 96; q++) ctx.lineTo(xs(q / 4), ys(f(q / 4))); ctx.lineTo(xs(24), base); ctx.fillStyle = col; ctx.fill(); };
    area(prod, 'rgba(255,190,60,.18)');
    area(shared, 'rgba(110,230,140,.7)');
    ctx.beginPath(); for (let q = 0; q <= 96; q++) { const xx = xs(q / 4), yy = ys(cons(q / 4)); q ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath(); for (let q = 0; q <= 96; q++) { const xx = xs(q / 4), yy = ys(prod(q / 4)); q ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
    ctx.strokeStyle = 'rgba(255,196,70,.95)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '500 12px "IBM Plex Mono", monospace';
    for (const hh of [0, 6, 12, 18, 24]) ctx.fillText(String(hh).padStart(2, '0'), xs(hh) - 7, base + 13);
    // cursore
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xs(h), Y0 + 10); ctx.lineTo(xs(h), base); ctx.stroke();
    ctx.fillStyle = '#7ee69a'; ctx.beginPath(); ctx.arc(xs(h), ys(S), 4, 0, 7); ctx.fill();
    // testo
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 15) * 15;
    ctx.fillStyle = '#fff'; ctx.font = '700 32px "IBM Plex Mono", monospace';
    ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, X0 + 16, Y0 + 42);
    ctx.font = '600 14px Archivo, sans-serif';
    const leg = [['#ffc446', 'prodotta'], ['#ffffff', 'consumata'], ['#6ee68c', 'condivisa']];
    leg.forEach(([c, tx], q) => { ctx.fillStyle = c; ctx.fillRect(X0 + 16, Y0 + 56 + q * 16, 10, 10); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillText(tx, X0 + 32, Y0 + 66 + q * 16); });
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '500 12.5px Archivo, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(hover ? 'ora scelta col puntatore' : 'una giornata d’esempio', X0 + GW - 14, Y0 + 20); ctx.textAlign = 'left';
    ctx.restore();
  }

  // ── tempo, dimensioni, interazione ──────────────────────────────────────
  let hover = false, last = 0, running = false, visible = true;
  function size() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cv.clientWidth * dpr);
    if (w && cv.width !== w) { cv.width = w; cv.height = Math.round(w * H / W); }
  }
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    clock += dt;
    if (!hover) hour = (hour + dt * 24 / 30) % 24;   // una giornata in 30 secondi
    simulate(hour, dt);
    draw(dt);
    requestAnimationFrame(frame);
  }
  function start() { if (!running && visible && !document.hidden && !reduce) { running = true; last = 0; requestAnimationFrame(frame); } }
  function stop() { running = false; }
  function still() { for (let q = 0; q < 120; q++) simulate(hour, 1 / 30); draw(0); }

  new ResizeObserver(() => { size(); if (!running) still(); }).observe(cv);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(cv);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect();
    hover = true;
    hour = Math.max(0, Math.min(23.99, ((e.clientX - r.left) / r.width) * 24));
    if (!running) still();
  });
  cv.addEventListener('pointerleave', () => { hover = false; if (!running) still(); });
  if (document.fonts) document.fonts.ready.then(() => { if (!running) still(); });

  hour = reduce ? 12.5 : 9;
  size(); still(); start();
  window.__cerScene = { setHour(h) { hour = h; hover = true; parts = []; acc.clear(); still(); }, resume() { hover = false; } };
})();
