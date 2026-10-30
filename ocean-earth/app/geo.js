// Matematica del globo: coordinate, matrici della camera, raggio dal pixel.
// Il globo e' una sfera di raggio 1 centrata nell'origine; z punta al polo
// nord, x all'incrocio fra equatore e meridiano di Greenwich.

export const DEG = Math.PI / 180;
export const EARTH_R = 6371e3;

export function toXYZ(latDeg, lonDeg, r = 1) {
  const la = latDeg * DEG, lo = lonDeg * DEG;
  const c = Math.cos(la);
  return [r * c * Math.cos(lo), r * c * Math.sin(lo), r * Math.sin(la)];
}

export function toLatLon(p) {
  const r = Math.hypot(p[0], p[1], p[2]);
  return [Math.asin(p[2] / r) / DEG, Math.atan2(p[1], p[0]) / DEG];
}

export function wrapLon(lon) {
  return ((lon + 540) % 360) - 180;
}

// distanza angolare in gradi fra due punti
export function angularDistance(lat1, lon1, lat2, lon2) {
  const a = toXYZ(lat1, lon1), b = toXYZ(lat2, lon2);
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return Math.acos(d) / DEG;
}

// ── matrici 4×4 in colonna (convenzione WebGL) ─────────────────────────────
export function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

export function lookAt(eye, target, up) {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
}

export function multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}

export function invert(m) {
  const inv = new Float32Array(16);
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  det = 1 / det;
  inv[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  inv[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  inv[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  inv[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  inv[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  inv[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  inv[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  inv[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  inv[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  inv[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  inv[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  inv[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  inv[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  inv[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  inv[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  inv[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return inv;
}

export function transform(m, v) {
  const x = v[0], y = v[1], z = v[2], w = v.length > 3 ? v[3] : 1;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w];
}

// ── camera orbitale ────────────────────────────────────────────────────────
// lat/lon del punto al centro dello schermo e distanza dal centro della Terra
// (in raggi terrestri). L'alto dello schermo e' sempre il nord.
export class Camera {
  constructor() {
    this.lat = 25; this.lon = -30; this.dist = 3.2;
    this.minDist = 1.012; this.maxDist = 6;
    this.fovy = 38 * DEG;
    this.width = 1; this.height = 1;
    this.update();
  }

  get altitudeKm() { return (this.dist - 1) * EARTH_R / 1000; }

  // raggio angolare (gradi) della calotta visibile dalla camera
  get horizonDeg() { return Math.acos(1 / this.dist) / DEG; }

  // raggio angolare della parte di globo dentro l'inquadratura
  get viewRadiusDeg() {
    const halfDiag = Math.atan(Math.tan((this.fovyEff || this.fovy) / 2) * Math.hypot(1, this.width / this.height));
    // angolo al centro della Terra sotteso dal bordo dello schermo (se tocca il globo)
    const s = this.dist * Math.sin(halfDiag);
    if (s >= 1) return this.horizonDeg;
    const centralAng = Math.asin(s) - halfDiag;          // geometria del triangolo camera-centro-punto
    return Math.min(this.horizonDeg, Math.abs(centralAng) / DEG + 0.0);
  }

  update() {
    this.lat = Math.max(-88, Math.min(88, this.lat));
    this.lon = wrapLon(this.lon);
    this.dist = Math.max(this.minDist, Math.min(this.maxDist, this.dist));
    this.eye = toXYZ(this.lat, this.lon, this.dist);
    const near = Math.max(0.0005, (this.dist - 1) * 0.3);
    const aspect = this.width / this.height;
    // in verticale (telefono) il campo si allarga: e' l'angolo orizzontale a
    // restare quello scelto, cosi' il globo intero ci sta in larghezza
    this.fovyEff = aspect < 1 ? 2 * Math.atan(Math.tan(this.fovy / 2) / aspect) : this.fovy;
    this.proj = perspective(this.fovyEff, aspect, near, this.dist + 2);
    this.view = lookAt(this.eye, [0, 0, 0], [0, 0, 1]);
    this.viewProj = multiply(this.proj, this.view);
    this.invViewProj = invert(this.viewProj);
  }

  // dal pixel (coordinate CSS) al punto del globo: [lat, lon] o null
  pick(x, y) {
    const nx = (x / this.width) * 2 - 1, ny = 1 - (y / this.height) * 2;
    const a = transform(this.invViewProj, [nx, ny, -1, 1]);
    const b = transform(this.invViewProj, [nx, ny, 1, 1]);
    const o = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
    const f = [b[0] / b[3], b[1] / b[3], b[2] / b[3]];
    const d = [f[0] - o[0], f[1] - o[1], f[2] - o[2]];
    const dl = Math.hypot(d[0], d[1], d[2]);
    d[0] /= dl; d[1] /= dl; d[2] /= dl;
    const bq = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
    const c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - 1;
    const disc = bq * bq - c;
    if (disc < 0) return null;
    const t = -bq - Math.sqrt(disc);
    return toLatLon([o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t]);
  }

  // dal punto del globo al pixel; null se dietro l'orizzonte
  project(lat, lon) {
    const p = toXYZ(lat, lon);
    const e = this.eye;
    if (p[0] * (e[0] - p[0]) + p[1] * (e[1] - p[1]) + p[2] * (e[2] - p[2]) < 0) return null;
    const c = transform(this.viewProj, [...p, 1]);
    return [(c[0] / c[3] * 0.5 + 0.5) * this.width, (0.5 - c[1] / c[3] * 0.5) * this.height];
  }
}
