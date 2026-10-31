// Shader GLSL ES 3.00 (WebGL2).
//
// Convenzione delle texture dei dati (griglia 0,25°, 1440×720, riga 0 = nord):
//   temperatura  RG16F   R = valore × maschera, G = maschera (1 mare, 0 terra)
//   corrente     RGBA16F R = u × maschera, G = v × maschera, B = maschera
// Con il filtro lineare, R/G e' la media dei soli punti di mare: la costa non
// si sporca con gli zeri della terra.

const COMMON = /* glsl */`
precision highp float;
precision highp sampler2DArray;
const float PI = 3.141592653589793;
vec2 lonlatToUV(vec2 ll) {           // ll in radianti
  return vec2(ll.x / (2.0 * PI) + 0.5, 0.5 - ll.y / PI);
}
vec3 lonlatToXYZ(vec2 ll) {
  float c = cos(ll.y);
  return vec3(c * cos(ll.x), c * sin(ll.x), sin(ll.y));
}
`;

// ── globo: un triangolo a tutto schermo, il raggio si interseca con la sfera ─
export const GLOBE_VS = /* glsl */`#version 300 es
out vec2 vNdc;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2) * 2.0 - 1.0;
  vNdc = p;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

export const GLOBE_FS = /* glsl */`#version 300 es
${COMMON}
in vec2 vNdc;
out vec4 outColor;
uniform mat4 uInvViewProj;
uniform vec3 uEye;
uniform sampler2D uSstA, uSstB;      // due istanti, mescolati con uMix
uniform sampler2D uCurA, uCurB;
uniform sampler2D uSstC, uSstD;      // confronto: la seconda data
uniform sampler2DArray uClim;        // 12 mesi di climatologia
uniform sampler2DArray uP90;         // 12 mesi di 90° percentile
uniform sampler2DArray uBias;        // 12 mesi di differenza anfc − GLORYS (pipeline/bias.py)
uniform float uBiasW, uBiasWCmp;     // quanto del dato mostrato viene da anfc (0…1)
uniform sampler2D uLand;
uniform sampler2D uMedA, uMedB;      // Mediterraneo 1/16° (griglia sua)
uniform vec4 uMedBox;                // ovest, sud, est, nord (gradi, bordi esterni)
uniform bool uMedOn;
uniform sampler2D uLutSst, uLutAnom, uLutSpeed;
uniform float uMix, uMixCmp;
uniform vec4 uClimSel;               // mese a, mese b, peso di b, 0  (per l'istante principale)
uniform vec4 uClimSelCmp;            // idem per la data di confronto
uniform vec3 uLayers;                // pesi 0…1 dei livelli: temperatura, anomalia, velocita'
uniform bool uHasClim, uHotspot, uCompare, uHaveData;
uniform float uSplit;                // confronto: x (pixel) della linea di separazione
uniform vec2 uRangeSst, uRangeAnom, uRangeSpeed;
uniform float uOpacity;
uniform vec3 uBg, uLandCol, uNoData, uCoastGlow;

vec2 sampleSst(sampler2D a, sampler2D b, vec2 uv, float m) {
  vec2 x = mix(texture(a, uv).rg, texture(b, uv).rg, m);
  return vec2(x.g > 0.5 ? x.r / x.g : 0.0, x.g);
}
// Climatologia e 90° percentile sono di GLORYS12. Per un dato anfc la base
// si sposta della differenza media fra i due sistemi in quel mese, cosi'
// l'anomalia non contiene la differenza fra i modelli.
float monthly(sampler2DArray t, vec2 uv, vec4 sel, float missing) {
  vec2 x = mix(texture(t, vec3(uv, sel.x)).rg, texture(t, vec3(uv, sel.y)).rg, sel.z);
  return x.g > 0.5 ? x.r / x.g : missing;
}
float base(sampler2DArray t, vec2 uv, vec4 sel, float w) {
  float b = monthly(t, uv, sel, 1e9);
  return b < 1e8 && w > 0.0 ? b + w * monthly(uBias, uv, sel, 0.0) : b;
}

void main() {
  vec4 a = uInvViewProj * vec4(vNdc, -1.0, 1.0);
  vec4 b = uInvViewProj * vec4(vNdc, 1.0, 1.0);
  vec3 o = a.xyz / a.w;
  vec3 d = normalize(b.xyz / b.w - o);
  float bq = dot(o, d);
  float c = dot(o, o) - 1.0;
  float disc = bq * bq - c;
  if (disc < 0.0) {
    // fuori dal globo: un alone sottile di atmosfera
    float closest = length(o - d * bq);
    float glow = smoothstep(1.08, 1.0, closest);
    outColor = vec4(mix(uBg, uCoastGlow, glow * 0.55), 1.0);
    return;
  }
  vec3 p = o + d * (-bq - sqrt(disc));
  vec2 ll = vec2(atan(p.y, p.x), asin(clamp(p.z, -1.0, 1.0)));
  vec2 uv = lonlatToUV(ll);
  // ombreggiatura leggera: il bordo del disco piu' scuro, per dare volume
  float shade = mix(0.72, 1.0, pow(max(dot(normalize(uEye - p), p), 0.0), 0.35));

  bool cmpSide = uCompare && gl_FragCoord.x > uSplit;
  // Tre livelli uno sopra l'altro, ognuno col suo peso (uLayers):
  //   temperatura   la base;
  //   anomalia      sopra la temperatura conta soprattutto dove e' forte, cosi'
  //                 le zone nella norma lasciano vedere la temperatura sotto;
  //   velocita'     sopra gli altri due si vede soprattutto dove la corrente e'
  //                 veloce: i grandi flussi come fiumi sopra il mare.
  // Un livello da solo (peso 1, gli altri 0) e' identico alla vecchia modalita'.
  float wT = uLayers.x, wA = uLayers.y, wS = uLayers.z;
  vec3 col = uNoData;
  bool sea = false;
  if (uHaveData && (wT > 0.0 || wA > 0.0)) {
    vec2 s = cmpSide ? sampleSst(uSstC, uSstD, uv, uMixCmp) : sampleSst(uSstA, uSstB, uv, uMix);
    vec4 sel = cmpSide ? uClimSelCmp : uClimSel;
    vec2 sT = s;                       // la temperatura puo' usare il dato regionale, l'anomalia no
    if (uMedOn && !cmpSide && wT > 0.0) {
      // dentro il riquadro del prodotto regionale vince il dato a 1/16°
      vec2 deg = degrees(ll);
      vec2 muv = vec2((deg.x - uMedBox.x) / (uMedBox.z - uMedBox.x), (uMedBox.w - deg.y) / (uMedBox.w - uMedBox.y));
      if (all(greaterThanEqual(muv, vec2(0.0))) && all(lessThanEqual(muv, vec2(1.0)))) {
        vec2 m = sampleSst(uMedA, uMedB, muv, uMix);
        if (m.y > 0.5) sT = m;
      }
    }
    if (sT.y > 0.5 && wT > 0.0) {
      sea = true;
      float t = (sT.x - uRangeSst.x) / (uRangeSst.y - uRangeSst.x);
      col = mix(col, texture(uLutSst, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb, wT);
    }
    if (s.y > 0.5) {
      if (wA > 0.0 && uHasClim) {
        float cl = base(uClim, uv, sel, cmpSide ? uBiasWCmp : uBiasW);
        if (cl < 1e8) {
          sea = true;
          float an = s.x - cl;
          float t = (an - uRangeAnom.x) / (uRangeAnom.y - uRangeAnom.x);
          float span = max(abs(uRangeAnom.x), abs(uRangeAnom.y));
          float strong = smoothstep(0.08, 0.7, abs(an) / max(span, 1e-3));
          col = mix(col, texture(uLutAnom, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb, wA * mix(1.0, strong, wT));
        }
      }
      if (uHotspot && uHasClim) {
        float th = base(uP90, uv, sel, cmpSide ? uBiasWCmp : uBiasW);
        if (th < 1e8 && s.x > th) {
          // tratteggio diagonale sopra le celle oltre il 90° percentile
          float h = fract((gl_FragCoord.x + gl_FragCoord.y) / 7.0);
          col = mix(col, vec3(1.0, 0.12, 0.35), h < 0.38 ? 0.85 : 0.18);
        }
      }
    }
  }
  if (wS > 0.0) {
    vec3 cu = mix(texture(uCurA, uv).rgb, texture(uCurB, uv).rgb, uMix);
    if (cu.b > 0.5) {
      float sp = length(cu.rg / cu.b);
      float t = clamp((sp - uRangeSpeed.x) / (uRangeSpeed.y - uRangeSpeed.x), 0.0, 1.0);
      // anche dove manca la temperatura (laghi, coste) la corrente resta un
      // livello sopra gli altri: se sono accesi, si vede solo dove e' veloce
      float under = max(wT, wA);
      col = mix(col, texture(uLutSpeed, vec2(t, 0.5)).rgb, wS * mix(1.0, pow(smoothstep(0.1, 0.7, t), 1.5), under));
      sea = true;
    }
  }
  if (sea) col = mix(uNoData, col, uOpacity);
  float land = texture(uLand, uv).r;
  col = mix(col, uLandCol, smoothstep(0.35, 0.65, land));
  outColor = vec4(col * shade, 1.0);
  if (uCompare && abs(gl_FragCoord.x - uSplit) < 1.0) outColor = vec4(1.0);
}`;

// ── linee sul globo (coste, riquadro della regione) ─────────────────────────
export const LINE_VS = /* glsl */`#version 300 es
${COMMON}
in vec2 aLonLat;                       // gradi
uniform mat4 uViewProj;
uniform vec3 uEye;
out float vFront;
void main() {
  vec3 p = lonlatToXYZ(radians(aLonLat)) * 1.0004;
  vFront = dot(p, uEye - p);
  gl_Position = uViewProj * vec4(p, 1.0);
}`;

export const LINE_FS = /* glsl */`#version 300 es
precision highp float;
in float vFront;
uniform vec4 uColor;
out vec4 outColor;
void main() {
  if (vFront < 0.0) discard;
  outColor = uColor;
}`;

// ── particelle ──────────────────────────────────────────────────────────────
// Lo stato di ogni particella e' un texel RGBA32F: (lon, lat, eta', velocita').
// Le ultime TRAIL posizioni stanno negli strati di una texture array usata ad
// anello: ogni passo legge lo strato precedente e scrive il successivo.
export const QUAD_VS = /* glsl */`#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2) * 2.0 - 1.0;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

export const UPDATE_FS = /* glsl */`#version 300 es
${COMMON}
uniform sampler2DArray uState;
uniform int uPrev;
uniform sampler2D uCurA, uCurB;
uniform float uMix;
uniform vec3 uCapCenter;               // centro della calotta visibile (xyz)
uniform float uCapCos;                 // coseno del suo raggio angolare
uniform float uStepScale;              // radianti per (m/s) per passo
uniform float uMaxAge;
uniform float uSeed;
uniform float uDrop;
out vec4 outState;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}
vec2 spawn(vec2 id) {
  // punto uniforme sull'area della calotta: cos(theta) uniforme
  float r1 = hash(id + uSeed), r2 = hash(id * 1.37 + uSeed * 2.11);
  float ct = mix(1.0, uCapCos, r1);
  float st = sqrt(max(0.0, 1.0 - ct * ct));
  float az = 2.0 * PI * r2;
  vec3 z = uCapCenter;
  vec3 x = normalize(abs(z.z) < 0.99 ? cross(vec3(0, 0, 1), z) : cross(vec3(1, 0, 0), z));
  vec3 y = cross(z, x);
  vec3 p = z * ct + (x * cos(az) + y * sin(az)) * st;
  return vec2(atan(p.y, p.x), asin(clamp(p.z, -1.0, 1.0)));
}
vec3 current(vec2 ll) {
  vec2 uv = lonlatToUV(ll);
  vec3 c = mix(texture(uCurA, uv).rgb, texture(uCurB, uv).rgb, uMix);
  return c.b > 0.5 ? vec3(c.rg / c.b, 1.0) : vec3(0.0);
}
void main() {
  vec2 id = gl_FragCoord.xy;
  vec4 s = texelFetch(uState, ivec3(ivec2(id), uPrev), 0);
  vec2 ll = s.xy;
  float age = s.z;
  vec3 cu = current(ll);
  bool dead = age < 0.0 || age > uMaxAge || cu.z < 0.5
           || dot(lonlatToXYZ(ll), uCapCenter) < uCapCos - 0.02
           || hash(id * 0.731 + uSeed * 3.7) < uDrop;
  if (dead) {
    vec2 n = spawn(id);
    vec3 c = current(n);
    // eta' negativa: nato in terra, si riprova al passo dopo senza disegnarlo
    outState = vec4(n, c.z > 0.5 ? 0.0 : -1.0, length(c.xy));
    return;
  }
  // spostamento sulla sfera: u verso est, v verso nord
  float clat = max(cos(ll.y), 0.05);
  vec2 n = ll + vec2(cu.x / clat, cu.y) * uStepScale;
  if (n.x > PI) n.x -= 2.0 * PI;
  if (n.x < -PI) n.x += 2.0 * PI;
  n.y = clamp(n.y, -1.55, 1.55);
  outState = vec4(n, age + 1.0, length(cu.xy));
}`;

export const TRAIL_VS = /* glsl */`#version 300 es
${COMMON}
uniform sampler2DArray uState;
uniform int uHead, uTrail, uSide;
uniform mat4 uViewProj;
uniform vec3 uEye;
uniform vec2 uViewport;
uniform float uWidth;
uniform sampler2D uLutSpeed;
uniform vec2 uRangeSpeed;
uniform float uFade;
out vec4 vColor;
void main() {
  int segs = uTrail - 1;
  int corner = gl_VertexID % 6;
  int seg = (gl_VertexID / 6) % segs;
  int pid = gl_VertexID / (6 * segs);
  ivec2 tc = ivec2(pid % uSide, pid / uSide);
  int la = (uHead - seg + uTrail) % uTrail;
  int lb = (uHead - seg - 1 + 2 * uTrail) % uTrail;
  vec4 a = texelFetch(uState, ivec3(tc, la), 0);
  vec4 b = texelFetch(uState, ivec3(tc, lb), 0);
  bool ok = a.z >= 1.0 && b.z >= 0.0 && abs(a.z - b.z - 1.0) < 0.5;
  vec3 pa = lonlatToXYZ(a.xy) * 1.0006, pb = lonlatToXYZ(b.xy) * 1.0006;
  if (!ok || dot(pa, uEye - pa) < 0.0 || dot(pb, uEye - pb) < 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vColor = vec4(0.0);
    return;
  }
  vec4 ca = uViewProj * vec4(pa, 1.0), cb = uViewProj * vec4(pb, 1.0);
  vec2 sa = ca.xy / ca.w * uViewport * 0.5, sb = cb.xy / cb.w * uViewport * 0.5;
  vec2 dir = sb - sa;
  float len = length(dir);
  vec2 nrm = len > 1e-4 ? vec2(-dir.y, dir.x) / len : vec2(0.0, 1.0);
  bool atB = corner == 1 || corner == 4 || corner == 5;
  float side = (corner == 0 || corner == 1 || corner == 4) ? -1.0 : 1.0;
  vec4 clip = atB ? cb : ca;
  clip.xy += nrm * side * uWidth * 0.5 / (uViewport * 0.5) * clip.w;
  gl_Position = clip;
  float t = (a.w - uRangeSpeed.x) / (uRangeSpeed.y - uRangeSpeed.x);
  vec3 col = texture(uLutSpeed, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb;
  float k = float(seg + (atB ? 1 : 0)) / float(segs);
  // coda sfumata e nascita/morte morbide
  float life = min(1.0, a.z / 4.0);
  vColor = vec4(col, (1.0 - k) * uFade * life);
}`;

export const TRAIL_FS = /* glsl */`#version 300 es
precision highp float;
in vec4 vColor;
out vec4 outColor;
void main() { outColor = vec4(vColor.rgb * vColor.a, vColor.a); }`;

// ── frecce: una griglia di vettori che segue lo zoom ────────────────────────
export const ARROW_VS = /* glsl */`#version 300 es
${COMMON}
uniform sampler2D uCurA, uCurB;
uniform float uMix;
uniform mat4 uViewProj;
uniform vec3 uEye;
uniform vec2 uLatLon0;                 // (latitudine della prima riga, longitudine del centro), gradi
uniform float uSpacing;                // passo della griglia (gradi)
uniform int uCols;
uniform float uRefSpeed;
uniform sampler2D uLutSpeed;
uniform vec2 uRangeSpeed;
out vec4 vColor;
// freccia in coordinate locali: x lungo la corrente (0..1), y di traverso
const vec2 SHAPE[9] = vec2[9](
  vec2(0.0, -0.06), vec2(0.62, -0.06), vec2(0.62, 0.06),
  vec2(0.0, -0.06), vec2(0.62, 0.06), vec2(0.0, 0.06),
  vec2(0.55, -0.2), vec2(1.0, 0.0), vec2(0.55, 0.2));
void main() {
  int row = gl_InstanceID / uCols, col = gl_InstanceID % uCols;
  float lat = uLatLon0.x + float(row) * uSpacing;
  // in longitudine il passo si allarga verso i poli: le frecce restano equidistanti
  float lonStep = uSpacing / max(cos(radians(lat)), 0.15);
  // la griglia e' agganciata a multipli del passo: spostando la vista le
  // frecce non scivolano, compaiono e scompaiono ai bordi
  float lonStart = floor((uLatLon0.y - float(uCols) * 0.5 * lonStep) / lonStep) * lonStep;
  float lon = lonStart + float(col) * lonStep;
  bool dup = float(col) * lonStep >= 359.99;          // vicino ai poli il giro si chiude prima
  lon = lon - 360.0 * floor((lon + 180.0) / 360.0);
  vec2 ll = radians(vec2(lon, lat));
  vec2 uv = lonlatToUV(ll);
  vec3 c = mix(texture(uCurA, uv).rgb, texture(uCurB, uv).rgb, uMix);
  vec3 p = lonlatToXYZ(ll);
  float speed = c.b > 0.5 ? length(c.rg / c.b) : 0.0;
  if (dup || c.b < 0.5 || speed < 0.005 || abs(lat) > 85.0 || dot(p, uEye - p) < 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vColor = vec4(0.0); return;
  }
  vec2 uvel = c.rg / c.b / speed;
  vec3 east = vec3(-sin(ll.x), cos(ll.x), 0.0);
  vec3 north = vec3(-sin(ll.y) * cos(ll.x), -sin(ll.y) * sin(ll.x), cos(ll.y));
  vec3 dir = east * uvel.x + north * uvel.y;
  vec3 across = cross(p, dir);
  float len = radians(uSpacing) * 0.92 * clamp(sqrt(speed / uRefSpeed), 0.25, 1.0);
  vec2 s = SHAPE[gl_VertexID];
  vec3 q = normalize(p + dir * (s.x - 0.5) * len + across * s.y * len * 0.8) * 1.0008;
  gl_Position = uViewProj * vec4(q, 1.0);
  float t = (speed - uRangeSpeed.x) / (uRangeSpeed.y - uRangeSpeed.x);
  vColor = vec4(texture(uLutSpeed, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb, 0.95);
}`;

export const ARROW_FS = /* glsl */`#version 300 es
precision highp float;
in vec4 vColor;
out vec4 outColor;
void main() { outColor = vec4(vColor.rgb * vColor.a, vColor.a); }`;
