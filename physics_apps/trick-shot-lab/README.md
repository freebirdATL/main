# Trickshot — a physics playground

A standalone, two-dimensional basketball experiment. Choose a launcher, enter numeric inputs, launch, observe, and adjust. The first version uses one simple court to focus on comparing the three mechanisms.

## Play

Open **`../trickshot.html`** in a modern browser. It is a single offline file: no installation, server, account, network request, or downloaded assets are required. The source version, `index.html`, also works directly if kept beside its CSS and JavaScript files.

- Choose **Slingshot**, **Jetpack ball**, or **Falling weight** before each attempt.
- Enter numbers, then click **Launch shot**. Arrow keys make small adjustments in a focused number field. Arbitrary decimals are accepted within the displayed limits.
- Observe the actual trail, flight time, velocity components, and peak height. There is no predicted trajectory. Slow motion changes playback speed, not physics or reported simulated time.
- Read the result, adjust your inputs, and retry. **Reuse** restores the exact settings from a notebook entry.
- **Space** launches when you are not editing or focused on another control; **R** resets. Settings cannot change during flight. Resetting a live shot records the attempt.
- **Physics guide** explains the equations, coordinate system, and assumptions. Sound is optional and off initially.
- The notebook and counters last for the current page session. Reloading or clearing the session resets them.

## Physics model

All calculations use SI units. The ball has mass `m = 0.60 kg` and radius `0.12 m`. Its release point is `1.20 m` above the floor. The hoop is `10.00 m` to the right, at height `3.05 m`, with a `0.45 m` inside opening. Gravity is `9.81 m/s²`; air drag, spin lift, and wind are omitted.

**Slingshot:** an ideal linear spring with fixed draw `d = 0.50 m`. The chosen force is the peak force at full draw, not a constant force over the stroke. Stored energy `E = ½ F_peak d` becomes `½ m v²`. Launch angle is measured counterclockwise from positive X.

**Jetpack:** simultaneous instantaneous impulses at release. `v_x = J_x / m`, `v_y = J_y / m`. Both axes allow negative values. There is no subsequent thrust. The pack has no modeled mass.

**Falling weight:** an ideal energy-transfer mechanism turns counterweight potential energy `Mgh` into ball kinetic energy `½mv²`. Counterweight mass, drop height, and exit direction are adjustable. The weight ends at rest, the mechanism is massless, and the direction guide loses no energy. This is not a hammer-collision model. The rig illustration is explicitly schematic.

Free-flight positions use constant-acceleration integration. A fixed 240 Hz simulation step subdivides further at high speed so the ball moves at most 30% of its radius between collision checks. Circular rim contacts and a capsule-shaped backboard use approximate normal restitution; floor restitution is `0.72`, rim `0.65`, board `0.78`, and floor contact retains `82%` of horizontal speed. Collision positions are discretized; they are not an exact rigid-body model.

A basket requires downward passage of the ball centre through the hoop plane with enough horizontal clearance for the entire ball. Measurement and contact statistics are captured at the scoring instant, so animation after the basket cannot change its classification. Bank shots and floor bounces count. The net is decorative. Attempts end when the ball settles, leaves the horizontal play area, reaches 12 simulated seconds, or finishes its basket animation.

## Develop and check

No dependencies are needed. From the repository root:

```sh
node --test physics_apps/trick-shot-lab/physics.test.cjs
node --check physics_apps/trick-shot-lab/game.js
node physics_apps/trick-shot-lab/build.cjs
```

Edit `index.html`, `styles.css`, `game.js`, or `physics.js`, then run the build command to update the portable HTML file. `physics.js` is independent of the browser and exports the same engine for the game and tests.

Tests cover each launcher’s physical relationship, equivalent analytically derived baskets, free-flight energy conservation, directional impulses, rim clearance, rejection of upward hoop crossings, high-speed backboard collisions, floor energy loss, invalid inputs, termination, and scoring stability at different integration steps.
