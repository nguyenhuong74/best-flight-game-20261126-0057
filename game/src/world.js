// The valley: seeded rolling terrain, two grass strips, a river town,
// pine woods, rings and the drop zone. Everything is placed from one
// seed so the same valley renders identically every load.

import { CONFIG } from './config.js';
import { makeNoise, makeRng, clamp, lerp } from './util.js';

export class Valley {
  constructor(seed, mission) {
    this.seed = seed;
    this.mission = mission;
    this.noise = makeNoise(seed);
    this.noise2 = makeNoise(seed + 101);
    this.rng = makeRng(seed * 7 + 13);
    this.buildTerrain();
    this.buildFeatures();
    this.buildRings();
  }

  buildTerrain() {
    const step = 20;
    this.samples = [];
    for (let x = 0; x <= CONFIG.worldLength + step; x += step) {
      this.samples.push(this.heightAtRaw(x));
    }
    this.step = step;
  }

  heightAtRaw(x) {
    const t = x / CONFIG.worldLength;
    // Valley floor rises gently, then climbs into the ridge at the far end.
    const base = 55 + 60 * this.noise(x * 0.00045) + 26 * this.noise2(x * 0.0016);
    const ridge = 330 * Math.pow(Math.max(0, (t - 0.72) / 0.28), 2);
    const dip = -18 * Math.exp(-Math.pow((x - 3400) / 420, 2)); // river hollow
    const flatHome = this.flattenNear(x, CONFIG.homeRunway.x, 320, 52);
    const flatFar = this.flattenNear(x, CONFIG.farRunway.x, 420, 96);
    return Math.max(18, base + ridge + dip + flatHome + flatFar);
  }

  flattenNear(x, centre, halfWidth, target) {
    const d = Math.abs(x - centre);
    if (d >= halfWidth) return 0;
    const w = 1 - (d / halfWidth) * (d / halfWidth);
    const current = 55 + 60 * this.noise(x * 0.00045);
    return (target - current) * w * 0.9;
  }

  heightAt(x) {
    const fx = clamp(x, 0, CONFIG.worldLength) / this.step;
    const i = Math.floor(fx);
    const f = fx - i;
    const a = this.samples[Math.min(i, this.samples.length - 1)];
    const b = this.samples[Math.min(i + 1, this.samples.length - 1)];
    return lerp(a, b, f);
  }

  buildFeatures() {
    const rng = this.rng;
    this.trees = [];
    for (let x = 500; x < CONFIG.worldLength - 300; x += 26 + rng() * 60) {
      if (this.onRunway(x) || this.nearRiver(x)) continue;
      if (rng() < 0.45) continue;
      this.trees.push({ x, h: 14 + rng() * 16, w: 8 + rng() * 7 });
    }
    this.houses = [];
    for (let i = 0; i < 9; i++) {
      const x = 2950 + i * 95 + rng() * 40;
      this.houses.push({ x, w: 34 + rng() * 14, h: 20 + rng() * 10, roof: rng() });
    }
    this.clouds = [];
    for (let i = 0; i < 14; i++) {
      this.clouds.push({
        x: rng() * CONFIG.worldLength,
        y: 480 + rng() * 320,
        s: 45 + rng() * 85,
        drift: 2 + rng() * 4,
      });
    }
    this.birds = [];
    for (let i = 0; i < 7; i++) {
      this.birds.push({
        x: 800 + rng() * 7000,
        y: 220 + rng() * 160,
        phase: rng() * Math.PI * 2,
        speed: 6 + rng() * 5,
      });
    }
    this.dropZone = { x: 5050, radius: 100 };
    this.riverX = 3400;
  }

  onRunway(x) {
    const h = CONFIG.homeRunway;
    const f = CONFIG.farRunway;
    return (x > h.x - 60 && x < h.x + h.length + 60) || (x > f.x - 60 && x < f.x + f.length + 60);
  }

  nearRiver(x) {
    return Math.abs(x - this.riverX) < 190;
  }

  isOnRunway(x) {
    const h = CONFIG.homeRunway;
    const f = CONFIG.farRunway;
    if (x >= h.x && x <= h.x + h.length) return 'home';
    if (x >= f.x && x <= f.x + f.length) return 'far';
    return null;
  }

  buildRings() {
    const rng = makeRng(this.seed * 31 + 5);
    this.rings = [];
    const count = this.mission.rings || 0;
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1);
      const x = 900 + t * (CONFIG.farRunway.x - 1400);
      const ground = this.heightAt(x);
      const y = ground + 130 + rng() * 190;
      this.rings.push({ x, y, r: CONFIG.ringRadius, done: false, phase: rng() * Math.PI * 2 });
    }
  }

  /** A ring is passed when the plane comes within its radius. */
  ringsRemaining() {
    return this.rings.filter((r) => !r.done).length;
  }

  nextRing() {
    return this.rings.find((r) => !r.done) || null;
  }
}
