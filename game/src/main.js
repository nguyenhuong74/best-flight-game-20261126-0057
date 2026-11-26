// Skyline Courier — game loop, screens, scoring and the screenshot hooks.
// The plane flies in a side view over a seeded valley; missions are
// ring runs, a cargo drop and a timed dawn delivery.

import { CONFIG, MISSIONS } from './config.js';
import { clamp, lerp, smooth } from './util.js';
import { Valley } from './world.js';
import { Plane } from './physics.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const sound = new SoundBank();

const SEED = 20261126;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot') || '';

function loadBest() {
  try {
    return JSON.parse(window.localStorage.getItem('skyline-courier-best') || '{}');
  } catch (err) {
    return {};
  }
}

function saveBest(best) {
  try {
    window.localStorage.setItem('skyline-courier-best', JSON.stringify(best));
  } catch (err) {
    /* storage unavailable on the hosted page; best scores are a nicety */
  }
}

const state = {
  screen: 'title', // title | briefing | flying | paused | win | crash
  mission: MISSIONS[0],
  missions: MISSIONS,
  best: loadBest(),
  valley: null,
  plane: null,
  cam: { x: 0, y: 120, zoom: CONFIG.zoom },
  score: 0,
  ringsDone: 0,
  elapsed: 0,
  time: 0,
  flash: '',
  flashColor: '#ffe9a8',
  flashUntil: 0,
  objectiveText: '',
  crashReason: '',
  crashKind: 'terrain',
  scoreBreakdown: { rings: 0, drop: 0, landing: 0, smooth: 0, fuel: 0, time: 0 },
  stars: 0,
  draggingThrottle: false,
  warnCooldown: 0,
};

function startMission(mission) {
  state.mission = mission;
  state.valley = new Valley(SEED, mission);
  state.plane = new Plane(state.valley, mission);
  state.score = 0;
  state.ringsDone = 0;
  state.elapsed = 0;
  state.flash = '';
  state.objectiveText = objectiveFor();
  state.scoreBreakdown = { rings: 0, drop: 0, landing: 0, smooth: 0, fuel: 0, time: 0 };
  state.stars = 0;
  state.screen = 'briefing';
}

function objectiveFor() {
  const m = state.mission;
  const v = state.valley;
  if (m.id === 'ring-run') {
    const left = v ? v.ringsRemaining() : m.rings;
    return left > 0 ? `Thread the rings — ${left} left, then land on the FAR STRIP` : 'All rings done — land on the FAR STRIP';
  }
  if (m.id === 'cargo-drop') {
    if (state.plane && state.plane.dropResult === 'hit') return 'Crate delivered — land on any strip';
    if (state.plane && state.plane.dropped) return 'Crate missed the zone — land and try again';
    return 'Fly to the striped DROP ZONE and press SPACE over it';
  }
  const left = v ? v.ringsRemaining() : m.rings;
  return left > 0 ? `Dawn mail run — ${left} rings, then the FAR STRIP before the clock` : 'Rings done — get to the FAR STRIP before the clock';
}

function beginFlight() {
  state.screen = 'flying';
  sound.ensure();
}

function endFlight(won, reason, kind) {
  if (won) {
    const p = state.plane;
    const m = state.mission;
    const s = state.scoreBreakdown;
    s.rings = state.ringsDone * CONFIG.ringScore;
    s.landing = CONFIG.landingBonus;
    s.smooth = Math.max(0, Math.round(CONFIG.smoothBonus * (1 - p.damage / 100)));
    s.fuel = Math.round(p.fuel * 0.8);
    s.time = m.timeLimit > 0 ? Math.max(0, Math.round((m.timeLimit - state.elapsed) * 2)) : 0;
    s.drop = state.plane.dropResult === 'hit' ? CONFIG.dropScore : 0;
    state.score = s.rings + s.landing + s.smooth + s.fuel + s.time + s.drop;
    state.stars = state.score >= 700 ? 3 : state.score >= 450 ? 2 : 1;
    const best = state.best[m.id] || 0;
    if (state.score > best) {
      state.best[m.id] = state.score;
      saveBest(state.best);
    }
    state.screen = 'win';
    sound.fanfare();
  } else {
    state.crashReason = reason;
    state.crashKind = kind;
    state.screen = 'crash';
    sound.thud();
  }
  document.title = won ? 'Skyline Courier — Mission complete' : 'Skyline Courier — Sortie lost';
}

function flash(text, color) {
  state.flash = text;
  state.flashColor = color || '#ffe9a8';
  state.flashUntil = state.time + 2.2;
}

function updateCamera(dt) {
  const p = state.plane;
  const targetX = p.x + CONFIG.lookAhead * clamp(p.vx / 40, -0.4, 1);
  const targetY = clamp(p.y, 60, 700);
  state.cam.x = lerp(state.cam.x, targetX, 1 - Math.pow(0.001, dt));
  state.cam.y = lerp(state.cam.y, targetY, 1 - Math.pow(0.01, dt));
  state.cam.zoom = CONFIG.zoom;
}

function flyStep(dt) {
  const p = state.plane;
  const v = state.valley;
  state.elapsed += dt;

  // Throttle lever drag (mouse) beats the keys while held.
  if (state.draggingThrottle) {
    const r = renderer.throttleRect;
    if (r) {
      const frac = clamp(1 - (input.mouseY - r.trackY) / r.trackH, 0, 1);
      p.throttle = frac;
    }
    if (!input.mouseDown) state.draggingThrottle = false;
  }

  const ev = p.step(dt, input.pitchAxis(), input.throttleAxis(), input.hit(' '));
  if (ev === 'dropped') {
    sound.drop();
    flash('CRATE AWAY — watch it fall', '#ffe9a8');
  } else if (ev === 'drop-hit') {
    state.score += CONFIG.dropScore;
    sound.ring();
    flash('ON TARGET! +150', '#7be382');
  } else if (ev === 'drop-miss') {
    flash('Crate missed the zone', '#ff8a7a');
  } else if (ev === 'landed-runway' || ev === 'landed-field') {
    const far = v.isOnRunway(p.x) === 'far';
    const home = v.isOnRunway(p.x) === 'home';
    const missionDone = state.mission.id === 'ring-run' || state.mission.id === 'dawn-delivery'
      ? far && v.ringsRemaining() === 0
      : state.mission.id === 'cargo-drop'
        ? (far || home) && p.dropResult === 'hit'
        : false;
    if (missionDone) {
      endFlight(true);
      return;
    }
    if (ev === 'landed-runway') {
      p.fuel = state.mission.fuel;
      flash('Refuelled on the strip', '#7be382');
      sound.ring();
    } else {
      flash('Down in the field — take off again', '#ffe9a8');
    }
  } else if (ev === 'hard-landing') {
    flash(`Hard landing! Damage ${Math.round(p.damage)}%`, '#ff8a7a');
    sound.thud();
  } else if (ev === 'crashed') {
    const kind = p.damage >= CONFIG.damageMax ? 'damage' : 'terrain';
    endFlight(false, kind === 'damage' ? 'The airframe gave up after too many hard arrivals.' : 'You flew into the hillside.', kind);
    return;
  }

  // Rings.
  for (const ring of v.rings) {
    if (ring.done) continue;
    const dx = p.x - ring.x;
    const dy = p.y - ring.y;
    if (dx * dx + dy * dy < ring.r * ring.r) {
      ring.done = true;
      state.ringsDone += 1;
      state.score += CONFIG.ringScore;
      sound.ring();
      flash(`RING ${state.ringsDone} / ${v.rings.length}  +${CONFIG.ringScore}`, '#ffe9a8');
    }
  }

  // Clock.
  if (state.mission.timeLimit > 0 && state.elapsed > state.mission.timeLimit) {
    endFlight(false, 'The clock ran out before you reached the far strip.', 'time');
    return;
  }
  // Out of fuel over the valley with no wheels down ends the sortie.
  if (p.fuel <= 0 && p.airborne && p.speed < 12 && p.y - v.heightAt(p.x) < 30) {
    endFlight(false, 'The tank ran dry and she settled into the valley floor.', 'fuel');
    return;
  }
  // Stall warning beep, throttled.
  if (p.stalled && state.warnCooldown <= 0) {
    sound.warn();
    state.warnCooldown = 0.9;
  }
  state.warnCooldown -= dt;

  state.objectiveText = objectiveFor();
  sound.update(p.throttle, p.speed, p.airborne);
  updateCamera(dt);
}

function drawWorld(t) {
  const dawn = state.mission.id === 'dawn-delivery';
  renderer.drawSky(state, dawn);
  renderer.drawClouds(state.valley, state.cam);
  renderer.drawRidges(state.cam);
  renderer.drawTerrain(state.valley, state.cam);
  renderer.drawRings(state.valley, state.cam, t);
  renderer.drawBirds(state.valley, t, state.cam);
  renderer.drawPlane(state.plane, state.cam, t);
}

function handleClick(click) {
  if (!click) return;
  sound.ensure();
  for (const b of renderer.buttons || []) {
    if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
      if (b.id.startsWith('mission-')) {
        startMission(MISSIONS[Number(b.id.split('-')[1])]);
      } else if (b.id === 'fly') beginFlight();
      else if (b.id === 'resume') state.screen = 'flying';
      else if (b.id === 'quit' || b.id === 'menu' || b.id === 'menu2') state.screen = 'title';
      else if (b.id === 'again' || b.id === 'retry') startMission(state.mission);
      return;
    }
  }
  // Throttle lever grab.
  const r = renderer.throttleRect;
  if (r && state.screen === 'flying' && click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) {
    state.draggingThrottle = true;
  }
}

function tick(now) {
  const dt = Math.min(0.05, (now - tick.last) / 1000 || 0.016);
  tick.last = now;
  state.time += dt;
  const t = state.time;

  if (input.hit('p') || input.hit('Escape')) {
    if (state.screen === 'flying') state.screen = 'paused';
    else if (state.screen === 'paused') state.screen = 'flying';
  }
  if (input.hit('m')) sound.toggleMute();
  if (input.hit('Enter') && state.screen === 'briefing') beginFlight();
  if (input.hit('Enter') && (state.screen === 'win' || state.screen === 'crash')) startMission(state.mission);

  const click = input.click();
  handleClick(click);

  if (state.screen === 'flying') flyStep(dt);
  else if (state.screen === 'title') {
    // A quiet demo flight drifts across the title behind the menu.
    if (!state.valley) {
      state.valley = new Valley(SEED, MISSIONS[0]);
      state.plane = new Plane(state.valley, MISSIONS[0]);
      state.plane.x = 600;
      state.plane.y = 320;
      state.plane.speed = 34;
      state.plane.pitch = 0.04;
      state.plane.airborne = true;
      state.plane.throttle = 0.55;
    }
    const p = state.plane;
    p.x += p.speed * dt;
    p.y = state.valley.heightAt(p.x) + 190 + Math.sin(t * 0.5) * 22;
    if (p.x > 8800) p.x = 600;
    state.cam.x = p.x + 200;
    state.cam.y = p.y;
  }

  // Draw.
  const ctx = renderer.ctx;
  ctx.clearRect(0, 0, renderer.W, renderer.H);
  if (state.screen === 'title') {
    drawWorld(t);
    renderer.drawTitle(state, t);
  } else if (state.screen === 'briefing') {
    drawWorld(t);
    renderer.drawBriefing(state);
  } else if (state.screen === 'paused') {
    drawWorld(t);
    renderer.drawHud(state, t);
    renderer.drawPause(state);
  } else if (state.screen === 'win') {
    drawWorld(t);
    renderer.drawWin(state);
  } else if (state.screen === 'crash') {
    drawWorld(t);
    renderer.drawCrash(state);
  } else {
    drawWorld(t);
    renderer.drawHud(state, t);
  }

  input.endFrame();
  requestAnimationFrame(tick);
}
tick.last = 0;

// -- Screenshot hooks -------------------------------------------------------
// ?shot=title|flight|win|crash renders a fixed, deterministic scene so the
// entry's screenshots are real renders of this game's own code.
function applyShot() {
  if (shot === 'flight') {
    startMission(MISSIONS[0]);
    beginFlight();
    const p = state.plane;
    p.x = 4300;
    p.y = state.valley.heightAt(4300) + 260;
    p.speed = 46;
    p.pitch = 0.08;
    p.throttle = 0.72;
    p.fuel = 64;
    p.airborne = true;
    p.rolling = false;
    state.valley.rings.slice(0, 4).forEach((r) => { r.done = true; });
    state.ringsDone = 4;
    state.score = 200;
    state.cam.x = p.x + 200;
    state.cam.y = p.y;
    state.objectiveText = objectiveFor();
  } else if (shot === 'win') {
    startMission(MISSIONS[0]);
    beginFlight();
    const p = state.plane;
    p.x = CONFIG.farRunway.x + 180;
    p.y = state.valley.heightAt(p.x) + 2.2;
    p.speed = 0;
    p.throttle = 0;
    p.fuel = 41;
    state.valley.rings.forEach((r) => { r.done = true; });
    state.ringsDone = 8;
    state.cam.x = p.x + 200;
    state.cam.y = p.y;
    state.scoreBreakdown = { rings: 400, drop: 0, landing: 120, smooth: 72, fuel: 32, time: 0 };
    state.score = 624;
    state.stars = 2;
    state.screen = 'win';
  } else if (shot === 'crash') {
    startMission(MISSIONS[2]);
    beginFlight();
    const p = state.plane;
    p.x = 7100;
    p.y = state.valley.heightAt(7100) + 2.2;
    p.speed = 0;
    p.throttle = 0;
    p.fuel = 0;
    p.damage = 100;
    state.valley.rings.slice(0, 2).forEach((r) => { r.done = true; });
    state.ringsDone = 2;
    state.score = 100;
    state.cam.x = p.x + 200;
    state.cam.y = p.y;
    state.crashReason = 'The tank ran dry and she settled into the valley floor.';
    state.crashKind = 'fuel';
    state.screen = 'crash';
    for (let i = 0; i < 14; i++) {
      p.smoke.push({ x: p.x - 20 + Math.random() * 30, y: p.y + 6 + Math.random() * 10, life: 0.9, size: 5 + Math.random() * 6 });
    }
  } else if (shot === 'title') {
    state.screen = 'title';
  }
}

applyShot();
requestAnimationFrame(tick);

// Debug handle for play-testing (read the live state from the console).
window.__skyline = state;
