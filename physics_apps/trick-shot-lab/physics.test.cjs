const test = require('node:test');
const assert = require('node:assert/strict');
const { C, launch, createShot, step, simulate } = require('./physics.js');
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should equal ${expected} ± ${tolerance}`);

test('slingshot converts linear spring work into kinetic energy in SI units', () => {
  const a = launch('slingshot', { force: 120, angle: 60 });
  near(a.energy, 30); near(a.speed, 10); near(a.vx, 5); near(a.vy, Math.sqrt(75));
  const b = launch('slingshot', { force: 240, angle: 60 });
  near(b.speed / a.speed, Math.sqrt(2));
});

test('jetpack impulses preserve signs and are a single change in momentum', () => {
  const a = launch('jetpack', { jx: -3, jy: 6 });
  near(a.vx, -5); near(a.vy, 10); near(a.energy, 37.5);
  const s = createShot('jetpack', { jx: 3, jy: 6 });
  for (let i = 0; i < 120; i++) step(s);
  near(s.vx, 5); near(s.vy, 10 - C.gravity * .5);
});

test('falling-weight energy depends on both mass and drop height', () => {
  const a = launch('counterweight', { mass: 2, height: 3, angle: 40 });
  near(a.energy, 58.86); near(.5 * C.ballMass * a.speed ** 2, 58.86);
  const b = launch('counterweight', { mass: 4, height: 3, angle: 40 });
  const c = launch('counterweight', { mass: 2, height: 6, angle: 40 });
  near(b.speed, c.speed); near(b.speed / a.speed, Math.sqrt(2));
});

test('free flight matches the closed-form trajectory and conserves mechanical energy', () => {
  const s = createShot('jetpack', { jx: 3, jy: 6 });
  for (let i = 0; i < 240; i++) step(s);
  near(s.t, 1); near(s.x, C.launchX + 5); near(s.y, C.launchY + 10 - .5 * C.gravity);
  near(s.vy, 10 - C.gravity);
  near(.5 * C.ballMass * (s.vx ** 2 + s.vy ** 2) + C.ballMass * C.gravity * s.y,
    s.initial.energy + C.ballMass * C.gravity * C.launchY);
});

// Derive a shot from the target geometry, rather than tuning a magic answer.
const theta = 55 * Math.PI / 180;
const dx = C.hoopX - C.launchX, dy = C.hoopY - C.launchY;
const speedSquared = C.gravity * dx ** 2 / (2 * Math.cos(theta) ** 2 * (dx * Math.tan(theta) - dy));
const energy = .5 * C.ballMass * speedSquared;
const perfect = {
  slingshot: { force: 2 * energy / C.drawDistance, angle: 55 },
  jetpack: { jx: C.ballMass * Math.sqrt(speedSquared) * Math.cos(theta), jy: C.ballMass * Math.sqrt(speedSquared) * Math.sin(theta) },
  counterweight: { mass: 1, height: energy / C.gravity, angle: 55 },
};

test('all three launchers can make the same analytically derived clean basket', () => {
  let expected;
  for (const [mode, values] of Object.entries(perfect)) {
    const s = simulate(mode, values);
    assert.equal(s.scored, true, `${mode} should score`);
    assert.equal(s.scoreStats.contacts, 0, `${mode} should be a clean basket`);
    assert.ok(s.scoreStats.vy < 0);
    near(s.scoreTime, dx / s.initial.vx, .00002);
    if (expected) near(s.scoreTime, expected.scoreTime, 1e-7);
    expected = s;
  }
});

test('upward passage through the opening is not a basket', () => {
  const s = createShot('jetpack', { jx: 0, jy: 6 });
  s.x = C.hoopX; s.y = C.hoopY - .03;
  step(s, .01);
  assert.ok(s.y > C.hoopY); assert.equal(s.scored, false);
});

test('a centre crossing without room for the whole ball hits the rim', () => {
  const s = createShot('jetpack', { jx: 0, jy: -3 });
  s.x = C.hoopX + C.hoopWidth / 2 - .02; s.y = C.hoopY + .2;
  for (let i = 0; i < 40; i++) step(s);
  assert.ok(s.rimHits > 0); assert.equal(s.scored, false);
});

test('backboard reflects fast shots without tunnelling through it', () => {
  const s = createShot('counterweight', { mass: 12, height: 8, angle: 0 });
  s.x = C.boardX - 1; s.y = C.hoopY + .6;
  step(s, .03);
  assert.ok(s.boardHits >= 1); assert.ok(s.vx < 0);
});

test('floor bounces lose energy and remain above the floor', () => {
  const s = createShot('jetpack', { jx: 0, jy: -3 });
  const initialEnergy = s.initial.energy + C.ballMass * C.gravity * C.launchY;
  while (s.floorBounces === 0) step(s);
  assert.ok(s.y >= C.ballRadius); assert.ok(s.vy > 0);
  assert.ok(.5 * C.ballMass * s.speed ** 2 + C.ballMass * C.gravity * s.y < initialEnergy);
});

test('stationary, extreme, and backwards shots terminate with finite results', () => {
  const cases = [
    ['slingshot', { force: 0, angle: 0 }],
    ['slingshot', { force: 600, angle: 180 }],
    ['jetpack', { jx: -15, jy: -15 }],
    ['counterweight', { mass: 12, height: 8, angle: 90 }],
  ];
  for (const [mode, values] of cases) {
    const s = simulate(mode, values);
    assert.equal(s.done, true); assert.equal(s.scored, false);
    assert.ok(Number.isFinite(s.x + s.y + s.vx + s.vy));
    assert.ok(s.t < C.maxFlightTime + C.step);
  }
});

test('invalid or incomplete inputs cannot enter the simulation', () => {
  for (const values of [{ force: NaN, angle: 50 }, { force: -1, angle: 50 }, { force: 200 }, { force: 100, angle: Infinity }]) {
    assert.throws(() => launch('slingshot', values));
  }
  assert.throws(() => launch('counterweight', { mass: 0, height: 3, angle: 50 }));
  assert.throws(() => launch('missing', {}));
});

test('basket scoring is stable across display-frame-sized integration steps', () => {
  const a = simulate('slingshot', perfect.slingshot);
  const b = createShot('slingshot', perfect.slingshot);
  while (!b.done) step(b, 1 / 60);
  assert.equal(b.scored, true); near(a.scoreTime, b.scoreTime, .0001);
});
