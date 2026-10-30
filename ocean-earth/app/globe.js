// Il renderer WebGL2: globo, coste, frecce e particelle.

import * as S from './shaders.js';
import { lut } from './palettes.js';
import { toXYZ, DEG } from './geo.js';

const TRAIL = 10;          // posizioni ricordate per ogni particella

function compile(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(p, sh);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export class Globe {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('webgl2');
    this.gl = gl;
    this.floatTargets = !!gl.getExtension('EXT_color_buffer_float');
    this.progGlobe = compile(gl, S.GLOBE_VS, S.GLOBE_FS);
    this.progLine = compile(gl, S.LINE_VS, S.LINE_FS);
    this.progArrow = compile(gl, S.ARROW_VS, S.ARROW_FS);
    if (this.floatTargets) {
      this.progUpdate = compile(gl, S.QUAD_VS, S.UPDATE_FS);
      this.progTrail = compile(gl, S.TRAIL_VS, S.TRAIL_FS);
    }
    this.emptyVao = gl.createVertexArray();
    this.blank2 = this.makeTex(1, 1, gl.RG16F, gl.RG, gl.HALF_FLOAT, new Uint16Array(2));
    this.blank4 = this.makeTex(1, 1, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, new Uint16Array(4));
    this.blankArr = this.makeArray(1, 1, 1, null);
    this.land = this.makeTex(1, 1, gl.R8, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]));
    this.luts = {};
    this.frameTex = new Map();          // chiave del fotogramma → texture (piccola LRU)
    this.clim = this.blankArr; this.p90 = this.blankArr; this.hasClim = false;
    this.coast = null; this.region = null;
    this.state = {
      sstA: null, sstB: null, curA: null, curB: null, mix: 0,
      sstC: null, sstD: null, mixCmp: 0, compare: false, split: 0.5,
      climSel: [0, 0, 0, 0], climSelCmp: [0, 0, 0, 0],
      mode: 0, hotspot: false, opacity: 1,
      paletteSst: 'classic', rangeSst: [-2, 32], rangeAnom: [-3, 3], rangeSpeed: [0, 1.2],
      particles: true, particleCount: 8000, particleSpeed: 1, particleWidth: 1.6,
      arrows: false, arrowDensity: 1, coast: true,
    };
    this.colors = { bg: [0.05, 0.08, 0.1], land: [0.16, 0.19, 0.21], nodata: [0.12, 0.16, 0.2], glow: [0.35, 0.6, 0.9], coast: [0.85, 0.9, 0.95] };
    this.head = 0; this.side = 0; this.frameNo = 0;
    this.setPalette('sst', 'classic');
    this.setPalette('anom', 'anomaly');
    this.setPalette('speed', 'speed');
    this.setPalette('speedField', 'speedField');
  }

  makeTex(w, h, ifmt, fmt, type, data, filter) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
    const f = filter || gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  makeArray(w, h, layers, data) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RG16F, w, h, layers, 0, gl.RG, gl.HALF_FLOAT, data || new Uint16Array(w * h * layers * 2));
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  setPalette(slot, name) {
    const gl = this.gl;
    if (this.luts[slot]) gl.deleteTexture(this.luts[slot]);
    this.luts[slot] = this.makeTex(256, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, lut(name));
    gl.bindTexture(gl.TEXTURE_2D, this.luts[slot]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  }

  setColors(c) { Object.assign(this.colors, c); }

  // texture di un fotogramma decodificato (scalar → RG16F, vector → RGBA16F)
  frameTexture(key, frame, kind) {
    if (!frame) return null;
    const gl = this.gl;
    let t = this.frameTex.get(key);
    if (t) {
      this.frameTex.delete(key);
      this.frameTex.set(key, t);
      return t;
    }
    t = kind === 'vector'
      ? this.makeTex(frame.w, frame.h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, frame.gpu)
      : this.makeTex(frame.w, frame.h, gl.RG16F, gl.RG, gl.HALF_FLOAT, frame.gpu);
    this.frameTex.set(key, t);
    while (this.frameTex.size > 12) {
      const k = this.frameTex.keys().next().value;
      gl.deleteTexture(this.frameTex.get(k));
      this.frameTex.delete(k);
    }
    return t;
  }

  setLand(gray, w, h) {
    const gl = this.gl;
    gl.deleteTexture(this.land);
    this.land = this.makeTex(w, h, gl.R8, gl.RED, gl.UNSIGNED_BYTE, gray);
  }

  // 12 mesi in una texture array; frames: array di 12 risultati 'scalar'
  setMonthly(which, frames) {
    const gl = this.gl;
    const { w, h } = frames[0];
    const all = new Uint16Array(w * h * 2 * 12);
    frames.forEach((f, k) => all.set(f.gpu, k * w * h * 2));
    const t = this.makeArray(w, h, 12, all);
    if (which === 'clim') { this.clim = t; this.hasClim = true; } else this.p90 = t;
  }

  setCoast(lines) {
    const gl = this.gl;
    let n = 0;
    for (const l of lines) n += (l.length / 2 - 1) * 2;
    const v = new Float32Array(n * 2);
    let k = 0;
    for (const l of lines) {
      for (let i = 0; i + 3 < l.length; i += 2) {
        v[k++] = l[i] / 100; v[k++] = l[i + 1] / 100; v[k++] = l[i + 2] / 100; v[k++] = l[i + 3] / 100;
      }
    }
    this.coast = this.lineBuffer(v, this.coast);
  }

  setRegion(box) {
    if (!box) { this.region = null; return; }
    const [s, w, n, e] = box;
    const pts = [];
    const seg = (a, b, c, d) => {
      for (let i = 0; i < 32; i++) {
        const t0 = i / 32, t1 = (i + 1) / 32;
        pts.push(b + (d - b) * t0, a + (c - a) * t0, b + (d - b) * t1, a + (c - a) * t1);
      }
    };
    seg(s, w, s, e); seg(s, e, n, e); seg(n, e, n, w); seg(n, w, s, w);
    this.region = this.lineBuffer(new Float32Array(pts), this.region);
  }

  lineBuffer(v, old) {
    const gl = this.gl;
    if (old) { gl.deleteBuffer(old.buf); gl.deleteVertexArray(old.vao); }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.progLine.p, 'aLonLat');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao, buf, count: v.length / 2 };
  }

  // ── particelle ──
  ensureParticles() {
    if (!this.floatTargets) return false;
    const want = Math.max(16, Math.round(Math.sqrt(this.state.particleCount)));
    if (want === this.side) return true;
    const gl = this.gl;
    if (this.stateTex) gl.deleteTexture(this.stateTex);
    this.side = want;
    this.stateTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.stateTex);
    const init = new Float32Array(want * want * 4 * TRAIL);
    for (let i = 0; i < want * want * TRAIL; i++) init[i * 4 + 2] = -1;   // tutte da far nascere
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA32F, want, want, TRAIL, 0, gl.RGBA, gl.FLOAT, init);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    // una texture array non puo' essere letta e scritta nello stesso passo,
    // anche su strati diversi: si scrive in una texture d'appoggio e si copia
    if (this.scratch) gl.deleteTexture(this.scratch);
    this.scratch = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.scratch);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, want, want, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.fbo = this.fbo || gl.createFramebuffer();
    this.head = 0;
    return true;
  }

  resetParticles() { this.side = 0; }

  stepParticles(cam, curA, curB) {
    const gl = this.gl, st = this.state, P = this.progUpdate;
    const prev = this.head, next = (this.head + 1) % TRAIL;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.scratch, 0);
    gl.viewport(0, 0, this.side, this.side);
    gl.disable(gl.BLEND);
    gl.useProgram(P.p);
    this.bind(P, 'uState', 0, this.stateTex, gl.TEXTURE_2D_ARRAY);
    this.bind(P, 'uCurA', 1, curA);
    this.bind(P, 'uCurB', 2, curB);
    gl.uniform1i(P.u.uPrev, prev);
    gl.uniform1f(P.u.uMix, st.mix);
    const center = toXYZ(cam.lat, cam.lon);
    gl.uniform3fv(P.u.uCapCenter, center);
    const capDeg = Math.min(89, cam.viewRadiusDeg * 1.05 + 0.5);
    gl.uniform1f(P.u.uCapCos, Math.cos(capDeg * DEG));
    // spostamento per passo proporzionale alla parte di globo inquadrata:
    // la velocita' apparente resta la stessa a ogni zoom
    gl.uniform1f(P.u.uStepScale, capDeg * DEG * 0.0035 * st.particleSpeed);
    gl.uniform1f(P.u.uMaxAge, 60 + Math.random() * 30);
    gl.uniform1f(P.u.uSeed, (this.frameNo % 9973) * 0.6180339);
    gl.uniform1f(P.u.uDrop, 0.002);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // copia nello strato nuovo dell'anello
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.stateTex);
    gl.copyTexSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, next, 0, 0, this.side, this.side);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.head = next;
  }

  bind(P, name, unit, tex, target) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target || gl.TEXTURE_2D, tex);
    gl.uniform1i(P.u[name], unit);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, /Mobi|Android/i.test(navigator.userAgent) ? 1.5 : 2);
    const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.dpr = dpr;
    this.camera.width = this.canvas.clientWidth;
    this.camera.height = this.canvas.clientHeight;
    this.camera.update();
  }

  render() {
    const gl = this.gl, st = this.state, cam = this.camera, C = this.colors;
    this.frameNo++;
    const sstA = st.sstA || this.blank2, sstB = st.sstB || sstA;
    const curA = st.curA || this.blank4, curB = st.curB || curA;
    const haveCur = !!st.curA;

    if (haveCur && st.particles && this.ensureParticles()) this.stepParticles(cam, curA, curB);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVao);

    // 1. globo
    let P = this.progGlobe;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uInvViewProj, false, cam.invViewProj);
    gl.uniform3fv(P.u.uEye, cam.eye);
    this.bind(P, 'uSstA', 0, sstA); this.bind(P, 'uSstB', 1, sstB);
    this.bind(P, 'uCurA', 2, curA); this.bind(P, 'uCurB', 3, curB);
    const sstC = st.sstC || sstA, sstD = st.sstD || sstC;
    this.bind(P, 'uSstC', 4, sstC); this.bind(P, 'uSstD', 5, sstD);
    this.bind(P, 'uClim', 6, this.clim, gl.TEXTURE_2D_ARRAY);
    this.bind(P, 'uP90', 7, this.p90, gl.TEXTURE_2D_ARRAY);
    this.bind(P, 'uLand', 8, this.land);
    this.bind(P, 'uLutSst', 9, this.luts.sst);
    this.bind(P, 'uLutAnom', 10, this.luts.anom);
    this.bind(P, 'uLutSpeed', 11, this.luts.speedField);
    gl.uniform1f(P.u.uMix, st.mix);
    gl.uniform1f(P.u.uMixCmp, st.mixCmp);
    gl.uniform4fv(P.u.uClimSel, st.climSel);
    gl.uniform4fv(P.u.uClimSelCmp, st.climSelCmp);
    gl.uniform1i(P.u.uMode, st.mode);
    gl.uniform1i(P.u.uHasClim, this.hasClim ? 1 : 0);
    gl.uniform1i(P.u.uHotspot, st.hotspot ? 1 : 0);
    gl.uniform1i(P.u.uCompare, st.compare ? 1 : 0);
    gl.uniform1i(P.u.uHaveData, st.sstA ? 1 : 0);
    gl.uniform1f(P.u.uSplit, st.split * this.canvas.width);
    gl.uniform2fv(P.u.uRangeSst, st.rangeSst);
    gl.uniform2fv(P.u.uRangeAnom, st.rangeAnom);
    gl.uniform2fv(P.u.uRangeSpeed, st.rangeSpeed);
    gl.uniform1f(P.u.uOpacity, st.opacity);
    gl.uniform3fv(P.u.uBg, C.bg);
    gl.uniform3fv(P.u.uLandCol, C.land);
    gl.uniform3fv(P.u.uNoData, C.nodata);
    gl.uniform3fv(P.u.uCoastGlow, C.glow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // 2. coste e riquadro
    P = this.progLine;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uViewProj, false, cam.viewProj);
    gl.uniform3fv(P.u.uEye, cam.eye);
    if (this.coast && st.coast) {
      gl.uniform4fv(P.u.uColor, [C.coast[0] * 0.6, C.coast[1] * 0.6, C.coast[2] * 0.6, 0.6]);
      gl.bindVertexArray(this.coast.vao);
      gl.drawArrays(gl.LINES, 0, this.coast.count);
    }
    if (this.region) {
      gl.uniform4fv(P.u.uColor, [1, 1, 1, 1]);
      gl.bindVertexArray(this.region.vao);
      gl.drawArrays(gl.LINES, 0, this.region.count);
    }
    gl.bindVertexArray(this.emptyVao);

    // 3. frecce
    if (haveCur && st.arrows) {
      P = this.progArrow;
      gl.useProgram(P.p);
      const R = Math.min(90, cam.viewRadiusDeg * 1.05 + 1);
      const target = 2600 * st.arrowDensity * (this.canvas.clientWidth * this.canvas.clientHeight) / (1400 * 900);
      let spacing = (2 * R) / Math.sqrt(Math.max(200, target));
      spacing = Math.max(0.25, Math.ceil(spacing / 0.25) * 0.25);
      const rows = Math.ceil((2 * R) / spacing) + 2;
      const cols = Math.min(Math.ceil(360 / spacing), Math.ceil((2 * R * 1.4) / spacing) + 2);
      const lat0 = Math.floor((cam.lat - R) / spacing) * spacing;
      gl.uniformMatrix4fv(P.u.uViewProj, false, cam.viewProj);
      gl.uniform3fv(P.u.uEye, cam.eye);
      this.bind(P, 'uCurA', 0, curA); this.bind(P, 'uCurB', 1, curB);
      this.bind(P, 'uLutSpeed', 2, this.luts.speed);
      gl.uniform1f(P.u.uMix, st.mix);
      gl.uniform2fv(P.u.uLatLon0, [lat0, cam.lon]);
      gl.uniform1f(P.u.uSpacing, spacing);
      gl.uniform1i(P.u.uCols, cols);
      gl.uniform1f(P.u.uRefSpeed, Math.max(0.3, st.rangeSpeed[1]));
      gl.uniform2fv(P.u.uRangeSpeed, st.rangeSpeed);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 9, rows * cols);
    }

    // 4. scie delle particelle
    if (haveCur && st.particles && this.side) {
      P = this.progTrail;
      gl.useProgram(P.p);
      this.bind(P, 'uState', 0, this.stateTex, gl.TEXTURE_2D_ARRAY);
      this.bind(P, 'uLutSpeed', 1, this.luts.speed);
      gl.uniform1i(P.u.uHead, this.head);
      gl.uniform1i(P.u.uTrail, TRAIL);
      gl.uniform1i(P.u.uSide, this.side);
      gl.uniformMatrix4fv(P.u.uViewProj, false, cam.viewProj);
      gl.uniform3fv(P.u.uEye, cam.eye);
      gl.uniform2fv(P.u.uViewport, [this.canvas.width, this.canvas.height]);
      gl.uniform1f(P.u.uWidth, st.particleWidth * this.dpr);
      gl.uniform2fv(P.u.uRangeSpeed, st.rangeSpeed);
      gl.uniform1f(P.u.uFade, 0.9);
      gl.drawArrays(gl.TRIANGLES, 0, this.side * this.side * (TRAIL - 1) * 6);
    }
    gl.disable(gl.BLEND);
  }
}
