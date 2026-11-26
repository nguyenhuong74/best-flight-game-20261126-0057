// Skyline Courier — tuning constants. One place for every number the
// flight model, the missions and the renderer agree on.

export const CONFIG = {
  // Canvas the game is drawn at (the page scales it to the window).
  viewWidth: 1280,
  viewHeight: 720,

  // World: metres. The valley runs from the home strip to the far strip.
  worldLength: 9200,
  homeRunway: { x: 160, length: 420 },
  farRunway: { x: 8300, length: 520 },
  ceiling: 950,

  // Flight model.
  maxThrust: 20, // m/s^2 along the nose at full throttle
  drag: 0.22, // linear drag, 1/s
  gravity: 9.8,
  stallSpeed: 24, // m/s, below this the wing stops flying
  pitchRate: 1.15, // rad/s at full authority
  maxPitch: 0.62, // rad, about 35 degrees
  maxSpeed: 68,

  // Fuel and damage.
  fuelMax: 100,
  fuelBurnIdle: 0.08, // units per second
  fuelBurnFull: 0.35, // extra units per second at full throttle
  damageMax: 100,

  // Landing: what counts as a survivable touchdown.
  safeSink: 6.5, // m/s vertical speed
  safePitch: 0.28, // rad
  safeSpeed: 46, // m/s

  // Rings and scoring.
  ringRadius: 58,
  ringScore: 50,
  landingBonus: 120,
  smoothBonus: 80,
  dropScore: 150,

  // Camera.
  zoom: 0.62, // px per metre at the plane's altitude band
  lookAhead: 260, // metres ahead of the nose the camera leads
};

export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    tag: 'Learn the valley',
    blurb: 'Thread all 8 sky rings, then put her down gently on the far strip.',
    fuel: 100,
    timeLimit: 0,
    rings: 8,
  },
  {
    id: 'cargo-drop',
    name: 'Cargo Drop',
    tag: 'Supply the ridge camp',
    blurb: 'Carry the crate to the striped drop zone, release it with Space, then land anywhere safe.',
    fuel: 100,
    timeLimit: 0,
    rings: 0,
  },
  {
    id: 'dawn-delivery',
    name: 'Dawn Delivery',
    tag: 'Beat the clock',
    blurb: 'A dawn mail run to the far strip. 180 seconds on the clock and a light fuel load — fly clean, fly fast.',
    fuel: 72,
    timeLimit: 180,
    rings: 4,
  },
];

export const PALETTE = {
  skyTop: '#7db8e8',
  skyMid: '#bcd9ef',
  skyLow: '#e8d9b0',
  dawnTop: '#3d4a7a',
  dawnMid: '#c97e56',
  dawnLow: '#f2b879',
  ridgeFar: '#8fa8c4',
  ridgeNear: '#6b8a6d',
  grass: '#5d8a4a',
  grassDry: '#8a9a52',
  rock: '#7d7468',
  river: '#4f8fc4',
  runway: '#3a3f46',
  ring: '#ffc93c',
  ringDone: '#7be382',
  hud: '#eaf6ff',
  hudDim: '#9db8cc',
  warn: '#ff5a4e',
  amber: '#ffb02e',
};
