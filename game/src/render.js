// Every pixel of Skyline Courier: sky, ridges, valley floor, the plane,
// the rings, and the instruments. All art is drawn in code — no images.

import { CONFIG, PALETTE } from './config.js';
import { clamp, lerp, metresToFeet, msToKnots, headingOf, headingLabel, clockString } from './util.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = CONFIG.viewWidth;
    this.H = CONFIG.viewHeight;
  }

  // -- sky -----------------------------------------------------------------

  drawSky(state, dawn) {
    const ctx = this.ctx;
    const top = dawn ? PALETTE.dawnTop : PALETTE.skyTop;
    const mid = dawn ? PALETTE.dawnMid : PALETTE.skyMid;
    const low = dawn ? PALETTE.dawnLow : PALETTE.skyLow;
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, top);
    g.addColorStop(0.55, mid);
    g.addColorStop(1, low);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    // Sun low over the ridge.
    const sunX = dawn ? this.W * 0.78 : this.W * 0.82;
    const sunY = dawn ? this.H * 0.34 : this.H * 0.16;
    const sg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    sg.addColorStop(0, 'rgba(255,244,200,0.95)');
    sg.addColorStop(0.25, 'rgba(255,220,140,0.55)');
    sg.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
    ctx.fillStyle = dawn ? '#ffe9b0' : '#fff6cf';
    ctx.beginPath();
    ctx.arc(sunX, sunY, dawn ? 34 : 28, 0, Math.PI * 2);
    ctx.fill();
  }

  drawClouds(valley, cam) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    for (const c of valley.clouds) {
      const sx = ((c.x - cam.x * 0.25) % 9800 + 9800) % 9800;
      const px = (sx * 0.62) % (this.W + 300) - 150;
      const py = (c.y - cam.y * 0.12) * 0.35 + 40;
      if (px < -200 || px > this.W + 200) continue;
      ctx.beginPath();
      ctx.ellipse(px, py, c.s * 0.9, c.s * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(px + c.s * 0.5, py + 6, c.s * 0.6, c.s * 0.26, 0, 0, Math.PI * 2);
      ctx.ellipse(px - c.s * 0.55, py + 8, c.s * 0.55, c.s * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBirds(valley, t, cam) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(40,50,60,0.75)';
    ctx.lineWidth = 2;
    for (const b of valley.birds) {
      const bx = b.x + t * b.speed;
      const px = (bx - cam.x) * cam.zoom + 420;
      const py = this.H * 0.62 - (b.y - cam.y) * cam.zoom;
      if (px < -20 || px > this.W + 20 || py < -20 || py > this.H + 20) continue;
      const flap = Math.sin(t * 6 + b.phase) * 5;
      ctx.beginPath();
      ctx.moveTo(px - 9, py + flap);
      ctx.quadraticCurveTo(px, py - 3, px, py);
      ctx.quadraticCurveTo(px, py - 3, px + 9, py + flap);
      ctx.stroke();
    }
  }

  // -- terrain ---------------------------------------------------------------

  worldToScreen(cam, x, y) {
    return {
      x: (x - cam.x) * cam.zoom + 420,
      y: this.H * 0.62 - (y - cam.y) * cam.zoom,
    };
  }

  drawRidges(cam) {
    const ctx = this.ctx;
    // Two far ridge silhouettes, parallaxed, for depth behind the valley.
    for (let layer = 0; layer < 2; layer++) {
      const par = layer === 0 ? 0.12 : 0.22;
      const baseY = this.H * (layer === 0 ? 0.52 : 0.58);
      const amp = layer === 0 ? 60 : 90;
      ctx.fillStyle = layer === 0 ? PALETTE.ridgeFar : PALETTE.ridgeNear;
      ctx.globalAlpha = layer === 0 ? 0.55 : 0.8;
      ctx.beginPath();
      ctx.moveTo(-10, this.H);
      for (let sx = -10; sx <= this.W + 10; sx += 16) {
        const wx = (sx - 420) / cam.zoom + cam.x * par + layer * 1700;
        const h = Math.sin(wx * 0.0011 + layer * 2.4) * amp * 0.6
          + Math.sin(wx * 0.0029 + layer * 5.1) * amp * 0.4;
        ctx.lineTo(sx, baseY - h);
      }
      ctx.lineTo(this.W + 10, this.H);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawTerrain(valley, cam) {
    const ctx = this.ctx;
    const x0 = Math.max(0, cam.x - 500);
    const x1 = Math.min(CONFIG.worldLength, cam.x + 2600);
    const ground = (x) => this.worldToScreen(cam, x, valley.heightAt(x));

    // Grass body.
    ctx.beginPath();
    let p = ground(x0);
    ctx.moveTo(p.x, p.y);
    for (let x = x0; x <= x1; x += 20) {
      p = ground(x);
      ctx.lineTo(p.x, p.y);
    }
    p = ground(x1);
    ctx.lineTo(p.x, this.H + 10);
    ctx.lineTo(ground(x0).x, this.H + 10);
    ctx.closePath();
    const gg = ctx.createLinearGradient(0, this.H * 0.45, 0, this.H);
    gg.addColorStop(0, PALETTE.grass);
    gg.addColorStop(1, '#3d5c31');
    ctx.fillStyle = gg;
    ctx.fill();

    // Dry patches and rock where the ridge climbs.
    ctx.fillStyle = 'rgba(138,154,82,0.5)';
    for (let x = x0; x < x1; x += 340) {
      const gy = valley.heightAt(x + 120);
      if (gy > 150) continue;
      const s = ground(x + 120);
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 12, 90, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // River: a blue band through the hollow.
    if (valley.riverX > x0 - 400 && valley.riverX < x1 + 400) {
      const r0 = ground(valley.riverX - 150);
      const r1 = ground(valley.riverX + 150);
      ctx.fillStyle = PALETTE.river;
      ctx.beginPath();
      ctx.moveTo(r0.x, r0.y - 2);
      ctx.lineTo(r1.x, r1.y - 2);
      ctx.lineTo(r1.x, r1.y + 14);
      ctx.lineTo(r0.x, r0.y + 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(r0.x + 20, r0.y + 4, 60, 2);
      ctx.fillRect(r0.x + 110, r0.y + 8, 80, 2);
    }

    // Pine woods.
    for (const tree of valley.trees) {
      if (tree.x < x0 || tree.x > x1) continue;
      const s = ground(tree.x);
      const h = tree.h * cam.zoom;
      const w = tree.w * cam.zoom;
      ctx.fillStyle = '#2c4a26';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - h);
      ctx.lineTo(s.x - w / 2, s.y);
      ctx.lineTo(s.x + w / 2, s.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3a5f30';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - h * 1.25);
      ctx.lineTo(s.x - w * 0.36, s.y - h * 0.45);
      ctx.lineTo(s.x + w * 0.36, s.y - h * 0.45);
      ctx.closePath();
      ctx.fill();
    }

    // Riverside town.
    for (const house of valley.houses) {
      if (house.x < x0 || house.x > x1) continue;
      const s = ground(house.x);
      const w = house.w * cam.zoom;
      const h = house.h * cam.zoom;
      ctx.fillStyle = house.roof > 0.5 ? '#c96f4a' : '#e8dcc0';
      ctx.fillRect(s.x - w / 2, s.y - h, w, h);
      ctx.fillStyle = house.roof > 0.5 ? '#8a4a34' : '#7a5a3c';
      ctx.beginPath();
      ctx.moveTo(s.x - w / 2 - 3, s.y - h);
      ctx.lineTo(s.x, s.y - h - 12);
      ctx.lineTo(s.x + w / 2 + 3, s.y - h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(s.x - 3, s.y - h * 0.55, 7, 8);
    }

    this.drawRunway(valley, cam, CONFIG.homeRunway, 'HOME');
    this.drawRunway(valley, cam, CONFIG.farRunway, 'FAR STRIP');
    this.drawDropZone(valley, cam);
  }

  drawRunway(valley, cam, strip, label) {
    const ctx = this.ctx;
    const a = this.worldToScreen(cam, strip.x, valley.heightAt(strip.x));
    const b = this.worldToScreen(cam, strip.x + strip.length, valley.heightAt(strip.x + strip.length));
    if (b.x < -50 || a.x > this.W + 50) return;
    const y = (a.y + b.y) / 2;
    ctx.fillStyle = PALETTE.runway;
    ctx.fillRect(a.x, y - 7, b.x - a.x, 14);
    ctx.fillStyle = '#e8e8e8';
    for (let x = a.x + 14; x < b.x - 14; x += 42) {
      ctx.fillRect(x, y - 1.5, 22, 3);
    }
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, a.x + 6, y - 14);
    // Windsock on a pole at the strip's near end.
    ctx.strokeStyle = '#5a4632';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x + 8, y - 7);
    ctx.lineTo(a.x + 8, y - 52);
    ctx.stroke();
    ctx.fillStyle = '#ff7a3c';
    ctx.beginPath();
    ctx.moveTo(a.x + 8, y - 52);
    ctx.lineTo(a.x + 30, y - 46);
    ctx.lineTo(a.x + 8, y - 40);
    ctx.closePath();
    ctx.fill();
  }

  drawDropZone(valley, cam) {
    const ctx = this.ctx;
    const dz = valley.dropZone;
    const s = this.worldToScreen(cam, dz.x, valley.heightAt(dz.x));
    if (s.x < -140 || s.x > this.W + 140) return;
    const r = dz.radius * cam.zoom;
    ctx.save();
    ctx.beginPath();
    ctx.arc(s.x, s.y - 4, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(s.x - r, s.y - r - 4, r * 2, r * 2);
    ctx.fillStyle = '#d94f3d';
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(s.x + i * r * 0.5 - 5, s.y - r - 4, 10, r * 2);
    }
    ctx.restore();
    ctx.strokeStyle = '#d94f3d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 4, r, 0, Math.PI * 2);
    ctx.stroke();
    // Flag pole.
    ctx.strokeStyle = '#5a4632';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x + r + 6, s.y - 4);
    ctx.lineTo(s.x + r + 6, s.y - 54);
    ctx.stroke();
    ctx.fillStyle = '#d94f3d';
    ctx.beginPath();
    ctx.moveTo(s.x + r + 6, s.y - 54);
    ctx.lineTo(s.x + r + 30, s.y - 47);
    ctx.lineTo(s.x + r + 6, s.y - 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a3b2e';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DROP ZONE', s.x, s.y - 62);
  }

  drawRings(valley, cam, t) {
    const ctx = this.ctx;
    for (const ring of valley.rings) {
      const s = this.worldToScreen(cam, ring.x, ring.y);
      if (s.x < -120 || s.x > this.W + 120) continue;
      const r = ring.r * cam.zoom;
      const pulse = 1 + Math.sin(t * 3 + ring.phase) * 0.05;
      ctx.save();
      ctx.globalAlpha = ring.done ? 0.35 : 0.95;
      ctx.strokeStyle = ring.done ? PALETTE.ringDone : PALETTE.ring;
      ctx.lineWidth = 7;
      ctx.shadowColor = ring.done ? PALETTE.ringDone : PALETTE.ring;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * pulse - 6, 0, Math.PI * 2);
      ctx.stroke();
      // Chevrons point the way through.
      ctx.fillStyle = ring.done ? PALETTE.ringDone : PALETTE.ring;
      for (let i = -1; i <= 1; i++) {
        const cy = s.y + i * r * 0.55;
        ctx.beginPath();
        ctx.moveTo(s.x - r * 0.35, cy - 8);
        ctx.lineTo(s.x - r * 0.1, cy);
        ctx.lineTo(s.x - r * 0.35, cy + 8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // -- the plane ---------------------------------------------------------------

  drawPlane(plane, cam, t) {
    const ctx = this.ctx;
    const s = this.worldToScreen(cam, plane.x, plane.y);
    const blink = Math.floor(t * 2) % 2 === 0;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(-plane.pitch);
    const scale = cam.zoom * 2.6;
    ctx.scale(scale, scale);

    // Exhaust smoke puffs behind the tail.
    for (const p of plane.smoke) {
      const ps = this.worldToScreen(cam, p.x, p.y);
      ctx.fillStyle = `rgba(230,230,230,${clamp(p.life, 0, 0.6)})`;
      ctx.beginPath();
      ctx.arc((ps.x - s.x) / scale, (ps.y - s.y) / scale, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tail, fuselage, cabin, wing, gear — a little yellow bush plane.
    ctx.fillStyle = '#d8433a';
    ctx.beginPath(); // tail fin
    ctx.moveTo(-16, -2);
    ctx.lineTo(-24, -14);
    ctx.lineTo(-17, -14);
    ctx.lineTo(-11, -2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f2b01e'; // fuselage
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d18f0e';
    ctx.beginPath();
    ctx.ellipse(2, 4.5, 20, 3.5, 0, 0, Math.PI);
    ctx.fill();

    ctx.fillStyle = '#bfe3f2'; // cabin windows, lit from inside
    ctx.beginPath();
    ctx.ellipse(4, -3.5, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(6, -4.5, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f2b01e'; // high wing
    ctx.beginPath();
    ctx.roundRect(-6, -11, 22, 4.5, 2);
    ctx.fill();
    ctx.fillStyle = '#d8433a';
    ctx.fillRect(-6, -11, 4, 4.5);

    // Propeller disc, spinning.
    ctx.save();
    ctx.translate(25, 0);
    ctx.rotate(plane.propAngle);
    ctx.fillStyle = 'rgba(60,60,70,0.75)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.2, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#3a3f46';
    ctx.beginPath();
    ctx.arc(25, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Landing gear.
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 6);
    ctx.lineTo(-10, 12);
    ctx.moveTo(10, 6);
    ctx.lineTo(12, 12);
    ctx.stroke();
    ctx.fillStyle = '#22252a';
    ctx.beginPath();
    ctx.arc(-10, 13, 3, 0, Math.PI * 2);
    ctx.arc(12, 13, 3, 0, Math.PI * 2);
    ctx.fill();

    // Nav lights.
    if (blink) {
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(-24, -2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#39e75f';
    ctx.beginPath();
    ctx.arc(20, -6, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Cargo crate slung under the belly.
    if (plane.hasCrate) {
      ctx.fillStyle = '#8a5a2e';
      ctx.fillRect(-4, 8, 12, 9);
      ctx.strokeStyle = '#5a3a1a';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(-4, 8, 12, 9);
      ctx.beginPath();
      ctx.moveTo(-4, 8);
      ctx.lineTo(8, 17);
      ctx.moveTo(8, 8);
      ctx.lineTo(-4, 17);
      ctx.stroke();
    }
    ctx.restore();

    // Dropped crate falling.
    if (plane.crate) {
      const cs = this.worldToScreen(cam, plane.crate.x, plane.crate.y);
      ctx.fillStyle = '#8a5a2e';
      ctx.fillRect(cs.x - 8, cs.y - 8, 16, 16);
      ctx.strokeStyle = '#5a3a1a';
      ctx.lineWidth = 2;
      ctx.strokeRect(cs.x - 8, cs.y - 8, 16, 16);
      if (!plane.crate.landed) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.moveTo(cs.x - 8, cs.y - 8);
        ctx.lineTo(cs.x, cs.y - 26);
        ctx.lineTo(cs.x + 8, cs.y - 8);
        ctx.stroke();
      }
    }
  }

  // -- HUD -------------------------------------------------------------------

  drawHud(state, t) {
    const ctx = this.ctx;
    const plane = state.plane;
    const valley = state.valley;
    const mission = state.mission;
    this.buttons = [];

    // Top bar.
    ctx.fillStyle = 'rgba(8,20,32,0.62)';
    roundRect(ctx, 12, 12, this.W - 24, 64, 10);
    ctx.fill();

    const alt = metresToFeet(plane.y);
    const spd = msToKnots(plane.speed);
    const hdg = headingOf(plane.vx);
    this.hudCell(28, 26, 'ALT', `${alt} FT`, plane.y - valley.heightAt(plane.x) < 40 ? PALETTE.warn : PALETTE.hud);
    this.hudCell(150, 26, 'SPD', `${spd} KT`, plane.stalled ? PALETTE.warn : PALETTE.hud);
    this.hudCell(272, 26, 'HDG', `${String(hdg).padStart(3, '0')}°`, PALETTE.hud);
    this.hudCell(394, 26, 'THR', `${Math.round(plane.throttle * 100)}%`, PALETTE.hud);
    this.barCell(516, 26, 'FUEL', plane.fuel / 100, plane.lowFuel ? PALETTE.warn : '#7be382');
    this.barCell(648, 26, 'DMG', plane.damage / 100, plane.damage > 60 ? PALETTE.warn : PALETTE.amber);

    // Score and clock, right side.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText('SCORE', this.W - 28, 30);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.fillText(String(state.score), this.W - 28, 54);
    if (mission.timeLimit > 0) {
      const left = mission.timeLimit - state.elapsed;
      ctx.fillStyle = left < 30 ? PALETTE.warn : PALETTE.hudDim;
      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.fillText('TIME', this.W - 130, 30);
      ctx.fillStyle = left < 30 ? PALETTE.warn : PALETTE.hud;
      ctx.font = 'bold 22px "Segoe UI", sans-serif';
      ctx.fillText(clockString(left), this.W - 130, 54);
    }

    // Compass tape, below the bar so it never covers the gauges.
    this.drawCompass(plane, t);

    // Objective line under the compass.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,20,32,0.62)';
    const obj = state.objectiveText;
    const ow = ctx.measureText(obj).width + 28;
    roundRect(ctx, (this.W - ow) / 2, 126, ow, 28, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.hud;
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.fillText(obj, this.W / 2, 145);

    // Instruments, bottom left: attitude, airspeed, altimeter.
    this.drawAttitude(plane, 92, this.H - 92);
    this.drawDial(196, this.H - 92, 'SPD', spd, 140, 'KT');
    this.drawDial(292, this.H - 92, 'ALT', alt, 3000, 'FT');

    // Throttle lever, bottom right (draggable with the mouse).
    this.drawThrottle(plane, t);

    // Warnings.
    const warnings = [];
    if (plane.stalled) warnings.push('STALL — NOSE DOWN, POWER UP');
    else if (plane.lowFuel) warnings.push('LOW FUEL — LAND SOON');
    if (plane.terrainNear) warnings.push('PULL UP — TERRAIN');
    if (warnings.length) {
      const blinkOn = Math.floor(t * 3) % 2 === 0;
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px "Segoe UI", sans-serif';
      ctx.fillStyle = blinkOn ? PALETTE.warn : 'rgba(255,90,78,0.35)';
      ctx.fillText(warnings[0], this.W / 2, 196);
    }

    // Transient message (ring scored, drop landed...).
    if (state.flash && state.flashUntil > t) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 26px "Segoe UI", sans-serif';
      ctx.fillStyle = state.flashColor || '#ffe9a8';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.fillText(state.flash, this.W / 2, 248);
      ctx.shadowBlur = 0;
    }
  }

  hudCell(x, y, label, value, color) {
    const ctx = this.ctx;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText(label, x, y);
    ctx.fillStyle = color;
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.fillText(value, x, y + 26);
  }

  barCell(x, y, label, frac, color) {
    const ctx = this.ctx;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText(label, x, y);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, x, y + 10, 84, 12, 6);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x, y + 10, Math.max(4, 84 * clamp(frac, 0, 1)), 12, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.hud;
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillText(`${Math.round(clamp(frac, 0, 1) * 100)}%`, x + 92, y + 21);
  }

  drawCompass(plane, t) {
    const ctx = this.ctx;
    const cx = this.W / 2;
    const cy = 100;
    const hdg = plane.vx >= 0 ? 90 : 270;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 170, cy - 16, 340, 32);
    ctx.clip();
    ctx.fillStyle = 'rgba(8,20,32,0.35)';
    ctx.fillRect(cx - 170, cy - 16, 340, 32);
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    for (let d = -180; d <= 180; d += 15) {
      let deg = ((hdg + d) % 360 + 360) % 360;
      const px = cx + d * 1.4;
      const major = deg % 90 === 0;
      ctx.strokeStyle = major ? PALETTE.hud : 'rgba(234,246,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(px, cy + 8);
      ctx.lineTo(px, cy + (major ? -4 : 2));
      ctx.stroke();
      if (major) {
        ctx.fillStyle = PALETTE.hud;
        ctx.fillText(headingLabel(deg), px, cy - 6);
      }
    }
    ctx.restore();
    ctx.fillStyle = PALETTE.amber;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 16);
    ctx.lineTo(cx - 6, cy + 6);
    ctx.lineTo(cx + 6, cy + 6);
    ctx.closePath();
    ctx.fill();
  }

  drawAttitude(plane, cx, cy) {
    const ctx = this.ctx;
    const r = 52;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    // Sky / ground halves, rolled by the pitch (side view: roll is small).
    ctx.fillStyle = '#5aa3d8';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const horizon = clamp(plane.pitch * 90, -r, r);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(cx - r, cy + horizon, r * 2, r * 2 - horizon);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + horizon);
    ctx.lineTo(cx + r, cy + horizon);
    ctx.stroke();
    // Fixed wings.
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy);
    ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx + 8, cy);
    ctx.lineTo(cx + 30, cy);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(234,246,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', cx, cy + r + 16);
  }

  drawDial(cx, cy, label, value, max, unit) {
    const ctx = this.ctx;
    const r = 52;
    ctx.fillStyle = 'rgba(8,20,32,0.62)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(234,246,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    const frac = clamp(value / max, 0, 1);
    const a0 = Math.PI * 0.75;
    const a1 = Math.PI * 2.25;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 10, a0, a1);
    ctx.stroke();
    ctx.strokeStyle = '#7be382';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 10, a0, a0 + (a1 - a0) * frac);
    ctx.stroke();
    const na = a0 + (a1 - a0) * frac;
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(na) * (r - 16), cy + Math.sin(na) * (r - 16));
    ctx.stroke();
    ctx.fillStyle = PALETTE.hud;
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(value)), cx, cy + 8);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText(`${label} · ${unit}`, cx, cy + r + 16);
  }

  drawThrottle(plane) {
    const ctx = this.ctx;
    const x = this.W - 150;
    const y = this.H - 190;
    const h = 130;
    ctx.fillStyle = 'rgba(8,20,32,0.62)';
    roundRect(ctx, x - 26, y - 14, 76, h + 40, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, x, y, 12, h, 6);
    ctx.fill();
    const fy = y + h - plane.throttle * h;
    ctx.fillStyle = '#ffd94a';
    roundRect(ctx, x - 8, fy - 7, 28, 14, 5);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THR', x + 6, y + h + 20);
    ctx.fillText('drag · W/S', x + 12, y - 22);
    this.throttleRect = { x: x - 26, y: y - 14, w: 76, h: h + 40, trackY: y, trackH: h };
  }

  // -- screens -----------------------------------------------------------------

  panel(x, y, w, h, title) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,20,32,0.78)';
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(234,246,255,0.25)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
    if (title) {
      ctx.fillStyle = PALETTE.hud;
      ctx.font = 'bold 26px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, x + w / 2, y + 42);
    }
  }

  button(id, x, y, w, h, label, accent) {
    const ctx = this.ctx;
    ctx.fillStyle = accent ? '#f2b01e' : 'rgba(234,246,255,0.14)';
    roundRect(ctx, x, y, w, h, 9);
    ctx.fill();
    ctx.strokeStyle = accent ? '#ffd94a' : 'rgba(234,246,255,0.4)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 9);
    ctx.stroke();
    ctx.fillStyle = accent ? '#241a05' : PALETTE.hud;
    ctx.font = 'bold 17px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + 6);
    this.buttons.push({ id, x, y, w, h });
  }

  drawTitle(state, t) {
    const ctx = this.ctx;
    this.buttons = [];
    // Big sky, the valley below, a plane cruising across the title.
    ctx.fillStyle = 'rgba(8,20,32,0.25)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff8e0';
    ctx.font = 'bold 64px "Segoe UI", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 14;
    ctx.fillText('SKYLINE COURIER', this.W / 2, 128);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 26px "Segoe UI", sans-serif';
    ctx.fillText('— VALLEY RUN —', this.W / 2, 166);
    ctx.fillStyle = 'rgba(234,246,255,0.9)';
    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.fillText('A bush-plane courier game. Fly the valley, mind your fuel, land like you mean it.', this.W / 2, 196);

    // Mission cards.
    const cw = 300;
    const gap = 24;
    const total = cw * 3 + gap * 2;
    let x = (this.W - total) / 2;
    const y = 236;
    state.missions.forEach((m, i) => {
      this.panel(x, y, cw, 220, null);
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.tag.toUpperCase(), x + cw / 2, y + 34);
      ctx.fillStyle = PALETTE.hud;
      ctx.font = 'bold 24px "Segoe UI", sans-serif';
      ctx.fillText(m.name, x + cw / 2, y + 68);
      ctx.fillStyle = 'rgba(234,246,255,0.85)';
      ctx.font = '14px "Segoe UI", sans-serif';
      this.wrapText(m.blurb, x + 20, y + 96, cw - 40, 20);
      const best = state.best[m.id] || 0;
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = '13px "Segoe UI", sans-serif';
      ctx.fillText(best ? `Best score: ${best}` : 'Not flown yet', x + cw / 2, y + 176);
      // The whole card is the button.
      this.buttons.push({ id: `mission-${i}`, x, y, w: cw, h: 220 });
      x += cw + gap;
    });

    ctx.fillStyle = 'rgba(234,246,255,0.85)';
    ctx.font = '15px "Segoe UI", sans-serif';
    ctx.fillText('W / S — throttle · A / D or ↑ / ↓ — pitch · Space — drop cargo · P — pause · M — mute', this.W / 2, 500);
    ctx.fillText('Mouse: pick a mission, drag the throttle lever in flight.', this.W / 2, 526);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '13px "Segoe UI", sans-serif';
    ctx.fillText('An original game — no real aircraft, places or brands. Built with plain canvas and code.', this.W / 2, 566);
    const bob = Math.sin(t * 1.4) * 8;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.fillText('▼  click a mission card to fly  ▼', this.W / 2, 610 + bob);
  }

  wrapText(text, x, y, maxW, lh) {
    const ctx = this.ctx;
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x + maxW / 2, cy);
        line = word;
        cy += lh;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x + maxW / 2, cy);
    return cy;
  }

  drawBriefing(state) {
    const ctx = this.ctx;
    this.buttons = [];
    const m = state.mission;
    this.panel(this.W / 2 - 330, 150, 660, 380, m.name);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.tag.toUpperCase(), this.W / 2, 208);
    ctx.fillStyle = 'rgba(234,246,255,0.9)';
    ctx.font = '16px "Segoe UI", sans-serif';
    this.wrapText(m.blurb, this.W / 2 - 280, 240, 560, 24);
    const lines = [
      `Fuel on board: ${m.fuel} units — throttle drinks it, gliding sips it.`,
      m.timeLimit ? `Clock: ${m.timeLimit} seconds. Land before it runs out.` : 'No clock — fly it clean.',
      m.rings ? `Sky rings: ${m.rings} to thread, 50 points each.` : 'No rings on this one — the drop is the job.',
      'Land gently: sink under 6.5 m/s, wings near level, speed under 46 m/s.',
      'Below 24 m/s the wing stalls — keep the nose down and the power up.',
    ];
    ctx.textAlign = 'left';
    ctx.font = '15px "Segoe UI", sans-serif';
    let y = 320;
    for (const line of lines) {
      ctx.fillStyle = '#ffd94a';
      ctx.fillText('▸', this.W / 2 - 290, y);
      ctx.fillStyle = 'rgba(234,246,255,0.9)';
      ctx.fillText(line, this.W / 2 - 268, y);
      y += 30;
    }
    this.button('fly', this.W / 2 - 110, 470, 220, 44, 'TAKE OFF  ▶', true);
  }

  drawPause(state) {
    const ctx = this.ctx;
    this.buttons = [];
    ctx.fillStyle = 'rgba(4,10,18,0.55)';
    ctx.fillRect(0, 0, this.W, this.H);
    this.panel(this.W / 2 - 260, 220, 520, 260, 'PAUSED');
    ctx.fillStyle = 'rgba(234,246,255,0.9)';
    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('The valley waits. The fuel does not burn while paused.', this.W / 2, 300);
    this.button('resume', this.W / 2 - 110, 340, 220, 44, 'RESUME', true);
    this.button('quit', this.W / 2 - 110, 398, 220, 44, 'QUIT TO MENU', false);
  }

  drawWin(state) {
    const ctx = this.ctx;
    this.buttons = [];
    ctx.fillStyle = 'rgba(4,10,18,0.45)';
    ctx.fillRect(0, 0, this.W, this.H);
    const s = state.scoreBreakdown;
    this.panel(this.W / 2 - 300, 130, 600, 440, 'MISSION COMPLETE');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7be382';
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.fillText('★'.repeat(state.stars) + '☆'.repeat(3 - state.stars), this.W / 2, 218);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.fillText(state.mission.name, this.W / 2, 248);
    const rows = [
      ['Rings threaded', s.rings],
      ['Cargo on target', s.drop],
      ['Gentle landing', s.landing],
      ['Smooth touchdown bonus', s.smooth],
      ['Fuel left', s.fuel],
      ['Time bonus', s.time],
    ];
    ctx.font = '16px "Segoe UI", sans-serif';
    let y = 292;
    for (const [label, val] of rows) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(234,246,255,0.85)';
      ctx.fillText(label, this.W / 2 - 240, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.hud;
      ctx.fillText(`+${val}`, this.W / 2 + 240, y);
      y += 30;
    }
    ctx.strokeStyle = 'rgba(234,246,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(this.W / 2 - 240, y - 8);
    ctx.lineTo(this.W / 2 + 240, y - 8);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillText('TOTAL', this.W / 2 - 240, y + 22);
    ctx.textAlign = 'right';
    ctx.fillText(String(state.score), this.W / 2 + 240, y + 22);
    this.button('again', this.W / 2 - 230, 500, 220, 44, 'FLY AGAIN', true);
    this.button('menu', this.W / 2 + 10, 500, 220, 44, 'MAIN MENU', false);
  }

  drawCrash(state) {
    const ctx = this.ctx;
    this.buttons = [];
    ctx.fillStyle = 'rgba(20,4,4,0.45)';
    ctx.fillRect(0, 0, this.W, this.H);
    this.panel(this.W / 2 - 300, 170, 600, 360, 'SORTIE LOST');
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.warn;
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.fillText(state.crashReason || 'The valley wins this round.', this.W / 2, 262);
    ctx.fillStyle = 'rgba(234,246,255,0.9)';
    ctx.font = '16px "Segoe UI", sans-serif';
    const tips = {
      terrain: 'You met the hillside. Watch the ridge ahead and keep 40 m over the ground.',
      stall: 'The wing stalled and the nose fell. Keep speed above 24 m/s — power first, then pitch.',
      fuel: 'The tank ran dry over the valley. Throttle discipline saves fuel: cruise at 60%, climb short.',
      damage: 'Too many hard arrivals. Sink under 6.5 m/s and keep the wings level to land.',
      time: 'The clock beat you to the strip. Fly the direct line and keep the throttle honest.',
    };
    this.wrapText(tips[state.crashKind] || tips.terrain, this.W / 2 - 260, 300, 520, 24);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '15px "Segoe UI", sans-serif';
    ctx.fillText(`Score banked: ${state.score} · Rings: ${state.ringsDone} / ${state.mission.rings}`, this.W / 2, 392);
    this.button('retry', this.W / 2 - 230, 440, 220, 44, 'TRY AGAIN', true);
    this.button('menu2', this.W / 2 + 10, 440, 220, 44, 'MAIN MENU', false);
  }
}

