// The flight model: an arcade bush plane. Speed lives along the nose,
// lift holds the wing up while there is airspeed, and below the stall
// the plane sinks and the nose wants to drop. Landings are judged on
// sink rate, pitch and speed at the moment the wheels touch.

import { CONFIG } from './config.js';
import { clamp } from './util.js';

export class Plane {
  constructor(valley, mission) {
    this.valley = valley;
    this.reset(mission);
  }

  reset(mission) {
    const home = CONFIG.homeRunway;
    this.x = home.x + 60;
    this.y = this.valley.heightAt(this.x) + 2.2;
    this.speed = 0; // m/s along the nose
    this.pitch = 0; // rad, + nose up
    this.throttle = 0;
    this.fuel = mission.fuel;
    this.damage = 0;
    this.airborne = false;
    this.rolling = true;
    this.vy = 0; // vertical speed, m/s, + up
    this.vx = 0;
    this.propAngle = 0;
    this.smoke = [];
    this.crate = null; // dropped cargo, when released
    this.hasCrate = mission.id === 'cargo-drop';
    this.dropped = false;
    this.dropResult = null; // 'hit' | 'miss' once the crate lands
    this.groundSpeed = 0;
  }

  /** One physics step. Returns an event string the game reacts to, or ''. */
  step(dt, pitchInput, throttleInput, dropPressed) {
    const c = CONFIG;
    // Throttle lever moves with the keys; it never jumps.
    this.throttle = clamp(this.throttle + throttleInput * dt * 0.55, 0, 1);
    const engineOn = this.fuel > 0;
    const thrust = engineOn ? this.throttle * c.maxThrust : 0;

    // Pitch authority grows with airspeed: at a standstill the stick is dead.
    const authority = clamp(this.speed / 30, 0.12, 1);
    this.pitch = clamp(this.pitch + pitchInput * c.pitchRate * authority * dt, -c.maxPitch, c.maxPitch);

    // Along the nose: thrust fights drag and the gravity component.
    const along = thrust - c.drag * this.speed - c.gravity * Math.sin(this.pitch) * 0.55;
    this.speed = clamp(this.speed + along * dt, 0, c.maxSpeed);

    // The wing flies the plane while there is airspeed; below the stall
    // it sinks and the nose drops on its own.
    const liftFactor = clamp(this.speed / c.stallSpeed, 0, 1);
    let vy = this.speed * Math.sin(this.pitch);
    if (this.airborne) {
      vy -= (1 - liftFactor) * 26;
      if (this.speed < c.stallSpeed * 0.9) {
        this.pitch -= (c.stallSpeed - this.speed) * 0.012 * dt;
      }
    }
    this.vy = vy;
    this.vx = this.speed * Math.cos(this.pitch);

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.propAngle += (4 + this.throttle * 42) * dt;

    // Ceiling: the air thins out and the nose is pushed gently down.
    if (this.y > c.ceiling) {
      this.y = c.ceiling;
      this.pitch = Math.min(this.pitch, 0);
    }
    if (this.x < 40) this.x = 40;
    if (this.x > CONFIG.worldLength - 40) {
      this.x = CONFIG.worldLength - 40;
      this.speed *= 0.9;
    }

    // Fuel burns with throttle.
    if (engineOn) {
      this.fuel = Math.max(0, this.fuel - (c.fuelBurnIdle + this.throttle * c.fuelBurnFull) * dt);
    }

    // Takeoff: rolling fast enough with the nose up lifts the wheels.
    if (!this.airborne && this.speed > 26 && this.pitch > 0.06) {
      this.airborne = true;
      this.rolling = false;
    }
    // Rolling on the ground: no climb, friction on the grass, none on strip.
    // The stick still works: holding the nose up rotates the plane, and the
    // takeoff check above lifts the wheels once speed and pitch agree.
    if (!this.airborne) {
      const strip = this.valley.isOnRunway(this.x);
      this.y = this.valley.heightAt(this.x) + 2.2;
      this.vy = 0;
      this.pitch = clamp(this.pitch, -0.05, 0.3);
      this.speed = Math.max(0, this.speed - (strip ? 0.6 : 2.4) * dt);
      if (this.speed < 0.5 && this.throttle < 0.05) this.speed = 0;
    }

    // Cargo drop. The crate pops a parachute: it falls no faster than
    // 14 m/s and its forward speed bleeds off, so a drop over the zone
    // lands near the zone instead of sailing past it.
    if (dropPressed && this.hasCrate && this.airborne && !this.dropped) {
      this.dropped = true;
      this.hasCrate = false;
      this.crate = { x: this.x, y: this.y, vy: this.vy, vx: this.vx * 0.25, done: false };
      return 'dropped';
    }
    if (this.crate && !this.crate.done) {
      this.crate.vy = Math.max(this.crate.vy - 9.8 * dt, -14);
      this.crate.vx *= 1 - 0.6 * dt;
      this.crate.x += this.crate.vx * dt;
      this.crate.y += this.crate.vy * dt;
      const ground = this.valley.heightAt(this.crate.x);
      if (this.crate.y <= ground + 2) {
        const dz = this.valley.dropZone;
        this.dropResult = Math.abs(this.crate.x - dz.x) <= dz.radius ? 'hit' : 'miss';
        this.crate.y = ground + 2;
        this.crate.landed = true;
        this.crate.done = true;
        return this.dropResult === 'hit' ? 'drop-hit' : 'drop-miss';
      }
    }

    // Terrain contact. A plane that just lifted off is climbing away from
    // the ground, so only a descending plane can touch down — otherwise
    // takeoff would bounce between airborne and landed every frame.
    const ground = this.valley.heightAt(this.x);
    if (this.y <= ground + 2.2) {
      if (this.airborne && this.vy <= 0.5) return this.touchdown(ground);
      this.y = Math.max(this.y, ground + 2.2);
    }

    // Exhaust puffs while the engine works hard.
    if (this.throttle > 0.6 && Math.random() < 0.35) {
      this.smoke.push({ x: this.x - 26, y: this.y + 4, life: 0.7, size: 3 + Math.random() * 4 });
    }
    for (const p of this.smoke) p.life -= dt;
    this.smoke = this.smoke.filter((p) => p.life > 0);

    return '';
  }

  touchdown(ground) {
    const c = CONFIG;
    const sink = -this.vy;
    const strip = this.valley.isOnRunway(this.x);
    const gentle = sink <= c.safeSink && Math.abs(this.pitch) <= c.safePitch && this.speed <= c.safeSpeed;
    this.y = ground + 2.2;
    this.airborne = false;
    this.rolling = true;
    this.vy = 0;
    if (gentle) {
      this.pitch = 0;
      return strip ? 'landed-runway' : 'landed-field';
    }
    // A hard arrival costs the airframe; a violent one ends the sortie.
    // Damage only ever grows from a real impact, never below zero.
    const excess = Math.max(0, sink - c.safeSink + Math.abs(this.pitch) * 14);
    this.damage = clamp(this.damage + excess * 7, 0, c.damageMax);
    this.speed *= 0.45;
    this.pitch = 0;
    if (this.damage >= c.damageMax || sink > 16) return 'crashed';
    return 'hard-landing';
  }

  get stalled() {
    return this.airborne && this.speed < CONFIG.stallSpeed;
  }

  get lowFuel() {
    return this.fuel < 18;
  }

  get terrainNear() {
    if (!this.airborne) return false;
    const ground = this.valley.heightAt(this.x + this.vx * 1.2);
    return this.y - ground < 45 && this.vy < 2;
  }
}
