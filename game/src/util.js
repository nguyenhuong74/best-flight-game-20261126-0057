// Small helpers shared by the world generator, the physics and the renderer.

/** Deterministic PRNG (mulberry32) so a seed always builds the same valley. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Smoothstep 0..1, for easing camera and terrain blends. */
export const smooth = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Metres to feet, knots, and the compass heading of a side-view flight. */
export const metresToFeet = (m) => Math.round(m * 3.28084);
export const msToKnots = (v) => Math.round(v * 1.94384);
export const headingOf = (vx) => (vx >= 0 ? 90 : 270);

/** Cardinal label for a compass degree (0 N, 90 E, 180 S, 270 W). */
export function headingLabel(deg) {
  const d = ((deg % 360) + 360) % 360;
  if (d < 45 || d >= 315) return 'N';
  if (d < 135) return 'E';
  if (d < 225) return 'S';
  return 'W';
}

/** Distance from a point to a ring centre, in metres. */
export const dist2d = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/** Format seconds as M:SS for the mission clock. */
export function clockString(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A tiny value-noise field: stable, cheap, good enough for hills. */
export function makeNoise(seed) {
  const rng = makeRng(seed);
  const grid = new Float64Array(256);
  for (let i = 0; i < 256; i++) grid[i] = rng();
  const at = (i) => grid[((i % 256) + 256) % 256];
  return function noise(x) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return lerp(at(i), at(i + 1), u);
  };
}
