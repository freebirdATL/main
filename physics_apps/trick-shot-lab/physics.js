/* SI units throughout. The simulation has no rendering or browser dependencies. */
(function (root) {
  'use strict';

  const C = Object.freeze({
    gravity: 9.81,
    ballMass: 0.60,
    ballRadius: 0.12,
    drawDistance: 0.50,
    launchX: 2,
    launchY: 1.2,
    hoopX: 12,
    hoopY: 3.05,
    hoopWidth: 0.45,
    rimRadius: 0.01,
    boardX: 12.385,
    boardBottom: 2.90,
    boardTop: 4.10,
    floorRestitution: 0.72,
    rimRestitution: 0.65,
    boardRestitution: 0.78,
    step: 1 / 240,
    worldWidth: 16,
    worldHeight: 8.8,
    maxFlightTime: 12,
  });

  const limits = Object.freeze({
    slingshot: { force: [0, 600], angle: [-180, 180] },
    jetpack: { jx: [-15, 15], jy: [-15, 15] },
    counterweight: { mass: [0.1, 12], height: [0, 8], angle: [-180, 180] },
  });

  function launch(mode, values) {
    if (!limits[mode]) throw new Error('Choose a launcher.');
    for (const [key, [min, max]] of Object.entries(limits[mode])) {
      if (typeof values[key] !== 'number' || !Number.isFinite(values[key]) || values[key] < min || values[key] > max) {
        throw new Error(`${key} must be between ${min} and ${max}.`);
      }
    }
    let vx, vy, energy, angle;
    if (mode === 'jetpack') {
      vx = values.jx / C.ballMass;
      vy = values.jy / C.ballMass;
      energy = 0.5 * C.ballMass * (vx * vx + vy * vy);
      angle = Math.atan2(vy, vx) * 180 / Math.PI;
    } else {
      // Linear spring: F_peak = k*d, so stored energy = 1/2 * F_peak * d.
      // Ideal counterweight: M*g*h = 1/2 * m_ball * v^2.
      energy = mode === 'slingshot'
        ? 0.5 * values.force * C.drawDistance
        : values.mass * C.gravity * values.height;
      angle = values.angle;
      const speed = Math.sqrt(2 * energy / C.ballMass);
      vx = speed * Math.cos(angle * Math.PI / 180);
      vy = speed * Math.sin(angle * Math.PI / 180);
    }
    return { vx, vy, energy, angle, speed: Math.hypot(vx, vy) };
  }

  function createShot(mode, values) {
    const initial = launch(mode, values);
    return {
      x: C.launchX, y: C.launchY, vx: initial.vx, vy: initial.vy,
      t: 0, peak: C.launchY, speed: initial.speed,
      initial, mode, values: { ...values },
      contacts: 0, floorBounces: 0, rimHits: 0, boardHits: 0,
      scored: false, done: false, scoreTime: null, scoreStats: null,
      rimCrossing: null, closest: Infinity, path: [{ x: C.launchX, y: C.launchY }],
      events: [],
    };
  }

  function pointCollision(s, x, y, radius, restitution, kind) {
    let dx = s.x - x, dy = s.y - y;
    const d = Math.hypot(dx, dy), separation = C.ballRadius + radius;
    if (d >= separation) return;
    const nx = d > 1e-10 ? dx / d : 0;
    const ny = d > 1e-10 ? dy / d : 1;
    s.x = x + nx * (separation + 1e-6);
    s.y = y + ny * (separation + 1e-6);
    const inward = s.vx * nx + s.vy * ny;
    if (inward < 0) {
      s.vx -= (1 + restitution) * inward * nx;
      s.vy -= (1 + restitution) * inward * ny;
      s.contacts += 1;
      s[kind] += 1;
      s.events.push({ type: kind, speed: -inward });
    }
  }

  function integrate(s, dt) {
    if (s.done) return s;
    const previous = { x: s.x, y: s.y, vy: s.vy };
    s.x += s.vx * dt;
    s.y += s.vy * dt - 0.5 * C.gravity * dt * dt;
    s.vy -= C.gravity * dt;
    s.t += dt;
    if (previous.vy > 0 && s.vy <= 0) {
      s.peak = Math.max(s.peak, previous.y + previous.vy ** 2 / (2 * C.gravity));
    }
    s.peak = Math.max(s.peak, s.y);
    s.closest = Math.min(s.closest, Math.hypot(s.x - C.hoopX, s.y - C.hoopY));

    // A basket requires downward passage with the entire ball inside the opening.
    if (previous.y >= C.hoopY && s.y < C.hoopY && s.vy < 0) {
      const f = (previous.y - C.hoopY) / (previous.y - s.y);
      const crossX = previous.x + f * (s.x - previous.x);
      const offset = crossX - C.hoopX;
      if (s.rimCrossing === null || Math.abs(offset) < Math.abs(s.rimCrossing)) s.rimCrossing = offset;
      if (!s.scored && Math.abs(offset) <= C.hoopWidth / 2 - C.ballRadius) {
        s.scored = true;
        s.scoreTime = s.t - dt + f * dt;
        s.scoreStats = {
          vx: s.vx, vy: previous.vy - C.gravity * f * dt, peak: s.peak,
          contacts: s.contacts, floorBounces: s.floorBounces,
          rimHits: s.rimHits, boardHits: s.boardHits,
        };
        s.events.push({ type: 'score' });
      }
    }

    const rimOffset = C.hoopWidth / 2 + C.rimRadius;
    pointCollision(s, C.hoopX - rimOffset, C.hoopY, C.rimRadius, C.rimRestitution, 'rimHits');
    pointCollision(s, C.hoopX + rimOffset, C.hoopY, C.rimRadius, C.rimRestitution, 'rimHits');
    pointCollision(s, C.boardX, Math.max(C.boardBottom, Math.min(C.boardTop, s.y)), 0.025, C.boardRestitution, 'boardHits');

    if (s.y < C.ballRadius) {
      s.y = C.ballRadius;
      if (s.vy < 0) {
        s.events.push({ type: 'floorBounces', speed: -s.vy });
        s.vy = -s.vy * C.floorRestitution;
        s.vx *= 0.82;
        s.floorBounces += 1;
        s.contacts += 1;
        if (Math.abs(s.vy) < 0.65) s.vy = 0;
      }
    }
    s.speed = Math.hypot(s.vx, s.vy);
    const last = s.path[s.path.length - 1];
    if (Math.hypot(s.x - last.x, s.y - last.y) > 0.07) s.path.push({ x: s.x, y: s.y });
    if (s.t >= C.maxFlightTime || s.x < -3 || s.x > C.worldWidth + 5 ||
        (s.y <= C.ballRadius + 0.001 && s.speed < 0.7) ||
        (s.scored && s.t - s.scoreTime > 1)) s.done = true;
    return s;
  }

  function step(s, dt = C.step) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 1) throw new Error('Time step must be in (0, 1] seconds.');
    s.events = [];
    // Bound travel per collision check, including for the strongest counterweights.
    const travel = Math.hypot(s.vx, s.vy) * dt + 0.5 * C.gravity * dt * dt;
    const substeps = Math.max(1, Math.ceil(travel / (C.ballRadius * 0.3)));
    for (let i = 0; i < substeps && !s.done; i++) integrate(s, dt / substeps);
    return s;
  }

  function simulate(mode, values) {
    const s = createShot(mode, values);
    while (!s.done) step(s);
    return s;
  }

  const api = { C, limits, launch, createShot, step, simulate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TrickPhysics = api;
})(typeof window !== 'undefined' ? window : globalThis);
