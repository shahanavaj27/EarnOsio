import { getTerrainHeightAt } from './levels';
import {
  BikeState,
  CoinItem,
  FloatingPopup,
  InputState,
  LevelConfig,
  MovingObstacle,
  Particle,
  Vec2,
} from './types';

export const WHEEL_BASE_HALF = 80;
export const WHEEL_OFFSET_Y = 35;
export const WHEEL_RADIUS = 42;
export const HEAD_OFFSET_X = 10;
export const HEAD_OFFSET_Y = -96;
export const HEAD_RADIUS = 32;

export interface PhysicsCallbacks {
  onCoinCollect: (coin: CoinItem, combo: number) => void;
  onSpecialCoinCollect: (coin: CoinItem) => void;
  onJump: () => void;
  onStunt: (label: string, x: number, y: number) => void;
  onLand: (intensity: number) => void;
  onBoost: () => void;
  onCrash: () => void;
  onFinish: () => void;
}

export interface WorldSim {
  level: LevelConfig;
  bike: BikeState;
  coins: CoinItem[];
  obstacles: MovingObstacle[];
  particles: Particle[];
  popups: FloatingPopup[];
  score: number;
  elapsedTime: number;
  coinCombo: number;
  coinComboTimer: number;
  popupSeq: number;
  boostCooldown: number;
  wasAirborne: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  jumpCooldown: number;
  prevJumpPressed: boolean;
  rampLaunchCooldown: number;
  reverseDelayTimer: number;
}

export function createWorldSim(level: LevelConfig): WorldSim {
  const startGroundY = getTerrainHeightAt(level.terrainSegments, level.startX);
  const initialY =
    startGroundY != null
      ? startGroundY - (WHEEL_OFFSET_Y + WHEEL_RADIUS)
      : level.startY;
  const startsGrounded = startGroundY != null;

  const bike: BikeState = {
    x: level.startX,
    y: initialY,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVel: 0,
    wheelAngle: 0,
    rearGrounded: startsGrounded,
    frontGrounded: startsGrounded,
    rearCompression: 0,
    frontCompression: 0,
    airTime: 0,
    accumulatedFlipAngle: 0,
    flipsCompleted: 0,
    crashed: false,
    crashTimer: 0,
    finished: false,
    boostTimer: 0,
    riderLean: 0.24,
    riderBobY: 0,
    headTilt: -0.1,
    isReversing: false,
  };

  const coins: CoinItem[] = level.coins.map((c) => ({
    ...c,
    collected: false,
    collectAnim: 0,
  }));

  const obstacles: MovingObstacle[] = level.obstacles.map((o) => ({
    ...o,
    x: o.baseX,
    y: o.baseY,
  }));

  return {
    level,
    bike,
    coins,
    obstacles,
    particles: [],
    popups: [],
    score: 0,
    elapsedTime: 0,
    coinCombo: 0,
    coinComboTimer: 0,
    popupSeq: 1,
    boostCooldown: 0,
    wasAirborne: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    jumpCooldown: 0,
    prevJumpPressed: false,
    rampLaunchCooldown: 0,
    reverseDelayTimer: 0.16,
  };
}

function closestPointOnSegment(
  px: number,
  py: number,
  a: Vec2,
  b: Vec2
): { cx: number; cy: number; t: number; nx: number; ny: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) {
    return { cx: a.x, cy: a.y, t: 0, nx: 0, ny: -1 };
  }
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + dx * t;
  const cy = a.y + dy * t;
  const len = Math.sqrt(lenSq);
  // Upward normal in canvas (+Y down)
  const nx = dy / len;
  const ny = -dx / len;
  return { cx, cy, t, nx, ny };
}

function spawnParticles(
  particles: Particle[],
  x: number,
  y: number,
  count: number,
  kind: Particle['kind'],
  color: string,
  baseVx = 0,
  baseVy = 0
) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed =
      kind === 'coin'
        ? 80 + Math.random() * 140
        : kind === 'confetti'
          ? 120 + Math.random() * 240
          : 30 + Math.random() * 90;
    const maxLife =
      kind === 'confetti'
        ? 1.1 + Math.random() * 0.8
        : kind === 'dust'
          ? 0.35 + Math.random() * 0.25
          : 0.4 + Math.random() * 0.3;
    particles.push({
      x,
      y,
      vx: baseVx + Math.cos(angle) * speed,
      vy: baseVy + Math.sin(angle) * speed - (kind === 'confetti' ? 160 : 35),
      size:
        kind === 'confetti'
          ? 8 + Math.random() * 6
          : kind === 'coin'
            ? 5 + Math.random() * 5
            : 4.5 + Math.random() * 5.5,
      life: maxLife,
      maxLife,
      color,
      kind,
    });
  }
}

export function stepWorldSim(
  sim: WorldSim,
  input: InputState,
  dt: number,
  callbacks: PhysicsCallbacks
) {
  const { bike, level } = sim;

  if (!bike.crashed && !bike.finished) {
    sim.elapsedTime += dt;
  }

  if (sim.coinComboTimer > 0) {
    sim.coinComboTimer -= dt;
    if (sim.coinComboTimer <= 0) sim.coinCombo = 0;
  }
  if (sim.boostCooldown > 0) sim.boostCooldown -= dt;
  if (sim.jumpCooldown > 0) sim.jumpCooldown -= dt;
  if (sim.rampLaunchCooldown > 0) sim.rampLaunchCooldown -= dt;
  if (sim.jumpBufferTimer > 0) sim.jumpBufferTimer -= dt;
  if (bike.boostTimer > 0) bike.boostTimer -= dt;

  // Buffer jump press so tapping slightly before landing or ramp lip works crisply
  if (input.jump && !sim.prevJumpPressed) {
    sim.jumpBufferTimer = 0.16;
  }
  sim.prevJumpPressed = input.jump;

  // Update moving obstacles
  for (const obs of sim.obstacles) {
    const arg = sim.elapsedTime * obs.speed + obs.phase;
    if (obs.axis === 'x') {
      obs.x = obs.baseX + Math.sin(arg) * obs.amplitude;
      obs.y = obs.baseY;
    } else if (obs.axis === 'y') {
      obs.x = obs.baseX;
      obs.y = obs.baseY + Math.sin(arg) * obs.amplitude;
    } else {
      obs.x = obs.baseX + Math.cos(arg) * obs.amplitude;
      obs.y = obs.baseY + Math.sin(arg) * obs.amplitude;
    }
  }

  // Update particles
  for (let i = sim.particles.length - 1; i >= 0; i--) {
    const p = sim.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      sim.particles.splice(i, 1);
      continue;
    }
    if (p.kind === 'confetti') {
      p.vy += 380 * dt;
      p.vx *= 0.99;
    } else if (p.kind === 'dust' || p.kind === 'exhaust') {
      p.vy -= 25 * dt;
      p.vx *= 0.96;
    } else {
      p.vy += 260 * dt;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  // Update floating popups
  for (let i = sim.popups.length - 1; i >= 0; i--) {
    const pop = sim.popups[i];
    pop.life -= dt;
    pop.y -= 38 * dt;
    if (pop.life <= 0) {
      sim.popups.splice(i, 1);
    }
  }

  // Update coin collection animation
  for (const c of sim.coins) {
    if (c.collected && c.collectAnim < 1) {
      c.collectAnim = Math.min(1, c.collectAnim + dt * 4.5);
    }
  }

  if (bike.crashed) {
    bike.crashTimer += dt;
    bike.isReversing = false;
    bike.vy += level.gravity * dt;
    bike.x += bike.vx * dt;
    bike.y += bike.vy * dt;
    bike.angle += bike.angularVel * dt;
    bike.vx *= 0.98;
    return;
  }

  if (bike.finished) {
    // Hard stop: lock motorcycle and rider cleanly at the finish line with zero velocity
    bike.x = Math.min(bike.x, level.finishX);
    bike.vx = 0;
    bike.vy = 0;
    bike.angularVel = 0;
    bike.boostTimer = 0;
    bike.isReversing = false;
    bike.riderBobY = 0;
    return;
  }

  // Slightly lighter arcade air gravity for responsive Bike Race jumps & arcs
  const effectiveGravity = level.gravity * 0.84;

  // Normal physics step
  bike.vy += effectiveGravity * dt;

  // Integrate candidate pose
  bike.x += bike.vx * dt;
  bike.y += bike.vy * dt;
  bike.angle += bike.angularVel * dt;

  // Prevent riding past finish line before ground collision step
  const crossedFinish = bike.x >= level.finishX;
  if (crossedFinish) {
    bike.x = level.finishX;
  }

  // Normalize angle lightly for stability while preserving flip delta separately
  const prevGrounded = bike.rearGrounded || bike.frontGrounded;

  // Compute world wheel positions
  const cos = Math.cos(bike.angle);
  const sin = Math.sin(bike.angle);

  const getWheelWorld = (localX: number, localY: number) => ({
    x: bike.x + localX * cos - localY * sin,
    y: bike.y + localX * sin + localY * cos,
  });

  const rearLocal = { x: -WHEEL_BASE_HALF, y: WHEEL_OFFSET_Y };
  const frontLocal = { x: WHEEL_BASE_HALF, y: WHEEL_OFFSET_Y };

  const resolveWheel = (
    localX: number,
    localY: number,
    isRear: boolean
  ): {
    grounded: boolean;
    nx: number;
    ny: number;
    penetration: number;
    onBoost: boolean;
    onRamp: boolean;
    rampBoost: number;
    nearRampLip: boolean;
  } => {
    const wPos = getWheelWorld(localX, localY);
    let bestPen = 0;
    let bestNx = 0;
    let bestNy = -1;
    let hitBoost = false;
    let onRamp = false;
    let rampBoost = 1;
    let nearRampLip = false;

    // 1. Check terrain segments
    for (const seg of level.terrainSegments) {
      const pts = seg.points;
      if (wPos.x < pts[0].x - 90 || wPos.x > pts[pts.length - 1].x + 90) {
        continue;
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        if (wPos.x < Math.min(a.x, b.x) - 52 || wPos.x > Math.max(a.x, b.x) + 52) {
          continue;
        }
        const { cx, cy, nx, ny } = closestPointOnSegment(wPos.x, wPos.y, a, b);
        const dx = wPos.x - cx;
        const dy = wPos.y - cy;
        const signed = dx * nx + dy * ny;
        const distSq = dx * dx + dy * dy;

        if (signed >= -58 && signed < WHEEL_RADIUS && distSq < (WHEEL_RADIUS + 58) ** 2) {
          const pen = WHEEL_RADIUS - signed;
          if (pen > bestPen) {
            bestPen = pen;
            bestNx = nx;
            bestNy = ny;
          }
        }
      }
    }

    // 2. Check elevated ramps & bridges
    for (const ramp of level.ramps) {
      const minX = Math.min(ramp.p1.x, ramp.p2.x) - 52;
      const maxX = Math.max(ramp.p1.x, ramp.p2.x) + 52;
      if (wPos.x < minX || wPos.x > maxX) continue;

      const { cx, cy, t, nx, ny } = closestPointOnSegment(
        wPos.x,
        wPos.y,
        ramp.p1,
        ramp.p2
      );
      const dx = wPos.x - cx;
      const dy = wPos.y - cy;
      const signed = dx * nx + dy * ny;
      const distSq = dx * dx + dy * dy;

      // One-way top collision so bike can pass cleanly underneath sky bridges
      if (
        signed >= -36 &&
        signed < WHEEL_RADIUS &&
        distSq < (WHEEL_RADIUS + 36) ** 2 &&
        bike.vx * nx + bike.vy * ny <= 420
      ) {
        const pen = WHEEL_RADIUS - signed;
        if (pen > bestPen) {
          bestPen = pen;
          bestNx = nx;
          bestNy = ny;
          onRamp = ramp.style !== 'bridge';
          rampBoost = ramp.boost ?? 1.08;
          hitBoost = Boolean(ramp.boost);
          // True when wheel reaches the launch end of an upward-sloped stunt ramp
          if (onRamp && ramp.p2.y < ramp.p1.y - 18 && t >= 0.86) {
            nearRampLip = true;
          }
        }
      }
    }

    if (bestPen > 0) {
      // Positional pushout
      bike.x += bestNx * bestPen * 0.85;
      bike.y += bestNy * bestPen * 0.85;

      // Compute velocity at wheel contact point
      const rx = wPos.x - bike.x;
      const ry = wPos.y - bike.y;
      const vwx = bike.vx - bike.angularVel * ry;
      const vwy = bike.vy + bike.angularVel * rx;

      const vn = vwx * bestNx + vwy * bestNy;
      if (vn < 0) {
        // Apply normal impulse + torque to chassis
        const rCrossN = rx * bestNy - ry * bestNx;
        const invMass = 1.0;
        const invInertia = 1 / 5600;
        const denom = invMass + rCrossN * rCrossN * invInertia;
        const restitution = Math.abs(vn) > 340 ? 0.12 : 0.0;
        const j = (-(1 + restitution) * vn) / denom;

        bike.vx += bestNx * j * invMass;
        bike.vy += bestNy * j * invMass;
        bike.angularVel += rCrossN * j * invInertia;
      }

      const comp = Math.min(1, bestPen / 20);
      if (isRear) {
        bike.rearCompression = Math.max(bike.rearCompression, comp);
      } else {
        bike.frontCompression = Math.max(bike.frontCompression, comp);
      }

      return {
        grounded: true,
        nx: bestNx,
        ny: bestNy,
        penetration: bestPen,
        onBoost: hitBoost,
        onRamp,
        rampBoost,
        nearRampLip,
      };
    }

    return {
      grounded: false,
      nx: 0,
      ny: -1,
      penetration: 0,
      onBoost: false,
      onRamp: false,
      rampBoost: 1,
      nearRampLip: false,
    };
  };

  const rearRes = resolveWheel(rearLocal.x, rearLocal.y, true);
  const frontRes = resolveWheel(frontLocal.x, frontLocal.y, false);

  bike.rearGrounded = rearRes.grounded;
  bike.frontGrounded = frontRes.grounded;
  // Smooth springy motocross suspension recovery
  bike.rearCompression *= Math.exp(-9.5 * dt);
  bike.frontCompression *= Math.exp(-9.5 * dt);

  const anyGrounded = bike.rearGrounded || bike.frontGrounded;
  const bothGrounded = bike.rearGrounded && bike.frontGrounded;

  if (anyGrounded) {
    sim.coyoteTimer = 0.13;
  } else if (sim.coyoteTimer > 0) {
    sim.coyoteTimer -= dt;
  }

  // Trigger boost pad
  if ((rearRes.onBoost || frontRes.onBoost) && !bike.finished && !input.brake) {
    if (sim.boostCooldown <= 0) {
      sim.boostCooldown = 0.6;
      bike.boostTimer = 0.75;
      callbacks.onBoost();
      sim.popups.push({
        id: sim.popupSeq++,
        x: bike.x,
        y: bike.y - 145,
        text: 'BOOST!',
        color: '#34D399',
        life: 0.75,
        maxLife: 0.75,
      });
    }
  }

  // Automatic Ramp Launch when reaching a ramp lip at sufficient forward speed
  const launchLipHit =
    (frontRes.nearRampLip && !rearRes.nearRampLip) ||
    (rearRes.nearRampLip && !frontRes.grounded);
  if (
    !bike.finished &&
    !input.brake &&
    launchLipHit &&
    bike.vx > 260 &&
    sim.rampLaunchCooldown <= 0
  ) {
    const rampFactor = Math.max(frontRes.rampBoost, rearRes.rampBoost, 1.08);
    const speedRatio = Math.min(1.35, bike.vx / level.maxSpeed);
    const desiredLaunchVy = -(430 + 195 * speedRatio) * rampFactor;
    if (bike.vy > desiredLaunchVy) {
      bike.vy = desiredLaunchVy;
    }
    bike.vx = Math.min(level.maxSpeed * 1.25, bike.vx * 1.04);
    // Counteract rear-wheel pitch-down torque at ramp exit so bike launches level/slightly nose-up
    bike.angularVel = Math.min(bike.angularVel, -0.55);
    bike.rearGrounded = false;
    bike.frontGrounded = false;
    sim.rampLaunchCooldown = 0.42;
    spawnParticles(sim.particles, bike.x, bike.y + 24, 10, 'dust', '#6EE7B7', -80, 40);
  }

  // Manual Jump (dedicated Jump button / Space) when grounded or within coyote window
  if (
    !bike.finished &&
    (sim.jumpBufferTimer > 0 || (input.jump && anyGrounded)) &&
    sim.coyoteTimer > 0 &&
    sim.jumpCooldown <= 0
  ) {
    const jumpPower = 520;
    bike.vy = Math.min(bike.vy - jumpPower * 0.42, -jumpPower);
    if (bike.vx >= -20) {
      bike.vx = Math.max(bike.vx, 195);
    }
    // Slight responsive wheelie pop on jump
    bike.angularVel = Math.max(-5.5, bike.angularVel - 1.55);
    bike.rearCompression = Math.max(bike.rearCompression, 0.85);
    bike.frontCompression = Math.max(bike.frontCompression, 0.65);
    bike.rearGrounded = false;
    bike.frontGrounded = false;
    sim.coyoteTimer = 0;
    sim.jumpBufferTimer = 0;
    sim.jumpCooldown = 0.34;
    callbacks.onJump();
    spawnParticles(sim.particles, bike.x - 40, bike.y + 30, 8, 'dust', '#A7F3D0', -60, 20);
    spawnParticles(sim.particles, bike.x + 40, bike.y + 30, 6, 'dust', '#FFFFFF', 40, 20);
  }

  // Landing & flip check
  if (anyGrounded && !prevGrounded) {
    const impactSpeed = Math.abs(bike.vy);
    const intensity = Math.min(1, impactSpeed / 720);
    if (sim.wasAirborne && bike.airTime > 0.22) {
      callbacks.onLand(intensity);
      // Visible suspension compression & dust splash on landing
      const squish = Math.min(1, 0.35 + intensity * 0.65);
      bike.rearCompression = Math.max(bike.rearCompression, squish);
      bike.frontCompression = Math.max(bike.frontCompression, squish);
      spawnParticles(
        sim.particles,
        bike.x - 45,
        bike.y + 34,
        Math.round(5 + intensity * 9),
        'dust',
        level.palette.groundRim,
        -bike.vx * 0.18,
        -45
      );
      spawnParticles(
        sim.particles,
        bike.x + 45,
        bike.y + 34,
        Math.round(4 + intensity * 7),
        'dust',
        level.palette.groundRim,
        bike.vx * 0.1,
        -45
      );
    }

    // Check completed 360 flips
    const flips = Math.floor(Math.abs(bike.accumulatedFlipAngle) / (Math.PI * 1.72));
    if (flips >= 1 && !bike.finished) {
      const isBackflip = bike.accumulatedFlipAngle < 0;
      const label =
        flips > 1
          ? `${flips}x ${isBackflip ? 'BACKFLIP' : 'FRONTFLIP'}!`
          : isBackflip
            ? 'BACKFLIP!'
            : 'FRONTFLIP!';
      bike.flipsCompleted += flips;
      callbacks.onStunt(label, bike.x, bike.y - 160);
      sim.popups.push({
        id: sim.popupSeq++,
        x: bike.x,
        y: bike.y - 165,
        text: label,
        color: '#FBBF24',
        life: 1.15,
        maxLife: 1.15,
      });
    }

    bike.airTime = 0;
    bike.accumulatedFlipAngle = 0;
    sim.wasAirborne = false;
  } else if (!anyGrounded) {
    bike.airTime += dt;
    if (bike.airTime > 0.14) {
      sim.wasAirborne = true;
    }
    bike.accumulatedFlipAngle += bike.angularVel * dt;
  }

  // Drive, Brake, Reverse, and Air Control
  if (!bike.finished) {
    const groundNormal = rearRes.grounded
      ? { x: rearRes.nx, y: rearRes.ny }
      : { x: frontRes.nx, y: frontRes.ny };
    const tx = -groundNormal.y;
    const ty = groundNormal.x;
    const maxSpd = level.maxSpeed * (bike.boostTimer > 0 ? 1.32 : 1.0);

    if (anyGrounded) {
      const tangentSpeed = bike.vx * tx + bike.vy * ty;

      if (input.brake) {
        bike.boostTimer = 0;
        if (tangentSpeed > 22) {
          // 1. Reduce forward speed smoothly
          bike.isReversing = false;
          sim.reverseDelayTimer = 0.16;
          const brakeForce = level.accel * 2.55;
          const nextSpeed = Math.max(
            0,
            (tangentSpeed - brakeForce * dt) * Math.exp(-4.5 * dt)
          );
          const delta = nextSpeed - tangentSpeed;
          bike.vx += tx * delta;
          bike.vy += ty * delta;

          if (bike.rearGrounded && tangentSpeed > 90 && Math.random() < 0.55) {
            const rw = getWheelWorld(rearLocal.x, rearLocal.y + WHEEL_RADIUS - 3);
            spawnParticles(
              sim.particles,
              rw.x,
              rw.y,
              1,
              'dust',
              '#FCA5A5',
              bike.vx * 0.15,
              -35
            );
          }
        } else if (sim.reverseDelayTimer > 0) {
          // Brief clean pause at 0 before engaging reverse
          sim.reverseDelayTimer -= dt;
          bike.isReversing = false;
          bike.vx *= Math.exp(-16 * dt);
          bike.vy *= Math.exp(-16 * dt);
        } else {
          // 2. Continue holding Brake to move backward slowly on flats & slopes
          const targetReverse = -225;
          const slopeGravityCounter = effectiveGravity * ty;
          const reverseForce = 680 + Math.max(0, slopeGravityCounter);
          if (tangentSpeed > targetReverse) {
            const nextSpeed = Math.max(targetReverse, tangentSpeed - reverseForce * dt);
            const delta = nextSpeed - tangentSpeed;
            bike.vx += tx * delta;
            bike.vy += ty * delta;
          } else {
            const clampDelta = (targetReverse - tangentSpeed) * Math.min(1, 10 * dt);
            bike.vx += tx * clampDelta;
            bike.vy += ty * clampDelta;
          }
          bike.isReversing = bike.vx < -14;
        }
      } else {
        sim.reverseDelayTimer = 0.16;
        bike.isReversing = false;

        if (input.gas) {
          if (tangentSpeed < maxSpd) {
            const force = level.accel * (bike.boostTimer > 0 ? 1.45 : 1.0);
            bike.vx += tx * force * dt;
            bike.vy += ty * force * dt;
          }
          // Subtle wheelie torque when throttling
          if (input.leanBack) {
            bike.angularVel -= 4.2 * dt;
          }
          // Kick up dirt particles from rear wheel
          if (bike.rearGrounded && Math.random() < 0.45) {
            const rw = getWheelWorld(rearLocal.x, rearLocal.y + WHEEL_RADIUS - 3);
            spawnParticles(
              sim.particles,
              rw.x,
              rw.y,
              1,
              'dust',
              level.palette.groundRim,
              -bike.vx * 0.25,
              -40
            );
          }
        } else {
          // Gentle rolling resistance when neither Gas nor Brake is held
          bike.vx *= Math.pow(0.75, dt);
        }
      }

      if (!input.brake) {
        if (input.leanForward) {
          bike.angularVel += 4.2 * dt;
        } else if (input.leanBack && !input.gas) {
          bike.angularVel -= 4.2 * dt;
        }
      }

      // Slope alignment & damping on ground (extra steady while reversing)
      if (bike.isReversing) {
        bike.angularVel *= Math.exp(-14 * dt);
      } else if (bothGrounded) {
        bike.angularVel *= Math.exp(-12 * dt);
      } else {
        bike.angularVel *= Math.exp(-5 * dt);
      }

      // Exhaust puff
      if (input.gas && !input.brake && Math.random() < 0.28) {
        const ex = getWheelWorld(-94, -5);
        spawnParticles(
          sim.particles,
          ex.x,
          ex.y,
          1,
          'exhaust',
          'rgba(226, 232, 240, 0.45)',
          -110,
          -35
        );
      }
    } else {
      bike.isReversing = false;
      // Airborne Bike Race-style pitch control (responsive flips & landing alignment)
      const targetSpin = 7.4;
      if (input.leanBack && !input.leanForward) {
        bike.angularVel += (-targetSpin - bike.angularVel) * Math.min(1, 11.5 * dt);
      } else if (input.leanForward && !input.leanBack) {
        bike.angularVel += (targetSpin - bike.angularVel) * Math.min(1, 11.5 * dt);
      } else {
        bike.angularVel *= Math.exp(-5.0 * dt);
      }
    }
  }

  // Clamp angular velocity
  bike.angularVel = Math.max(-9.5, Math.min(9.5, bike.angularVel));

  // Rotate wheels visually (forward or reverse!)
  const forwardSpeed = bike.vx * cos + bike.vy * sin;
  bike.wheelAngle += (forwardSpeed / WHEEL_RADIUS) * dt;

  // Dynamic Rider Posture Animation (acceleration lean, brake/reverse brace, jump crouch/stretch, landing squish)
  let targetLean = 0.34;
  if (anyGrounded) {
    if (bike.isReversing) targetLean = 0.05;
    else if (input.brake) targetLean = -0.02;
    else if (input.gas) targetLean = 0.56;
    if (input.leanForward) targetLean += 0.12;
    if (input.leanBack) targetLean -= 0.14;
  } else {
    targetLean = 0.14;
    if (input.leanBack && !input.leanForward) targetLean = -0.10;
    else if (input.leanForward && !input.leanBack) targetLean = 0.62;
  }
  bike.riderLean += (targetLean - bike.riderLean) * Math.min(1, 11 * dt);

  const suspensionDip = (bike.rearCompression + bike.frontCompression) * 11.5;
  const roadJitter = anyGrounded
    ? Math.sin(bike.wheelAngle * 1.15) * Math.min(2.6, Math.abs(forwardSpeed) / 320)
    : -6.5;
  const targetBobY = suspensionDip + roadJitter;
  bike.riderBobY += (targetBobY - bike.riderBobY) * Math.min(1, 14 * dt);

  const targetHeadTilt = -bike.riderLean * 0.45;
  bike.headTilt += (targetHeadTilt - bike.headTilt) * Math.min(1, 10 * dt);

  // Prevent riding off left side of start
  if (bike.x < -80) {
    bike.x = -80;
    if (bike.vx < 0) {
      bike.vx = 0;
      bike.isReversing = false;
    }
  }

  // Coin collection check
  const bikeCenterX = bike.x;
  const bikeCenterY = bike.y - 24;
  for (const coin of sim.coins) {
    if (coin.collected) continue;
    const dx = coin.x - bikeCenterX;
    const dy = coin.y - bikeCenterY;
    const pickupRadius = coin.radius + 72;
    if (dx * dx + dy * dy <= pickupRadius * pickupRadius) {
      coin.collected = true;
      coin.collectAnim = 0.01;
      sim.coinCombo += 1;

      if (coin.isSpecial) {
        sim.score += 10;
        sim.coinComboTimer = 1.8;
        callbacks.onSpecialCoinCollect(coin);
        spawnParticles(sim.particles, coin.x, coin.y, 16, 'coin', '#FACC15');
        spawnParticles(sim.particles, coin.x, coin.y, 14, 'coin', '#4ADE80');
        spawnParticles(sim.particles, coin.x, coin.y, 8, 'coin', '#FFFFFF');
        sim.popups.push({
          id: sim.popupSeq++,
          x: coin.x,
          y: coin.y - 46,
          text: '+10 POINTS',
          color: '#FDE047',
          life: 1.45,
          maxLife: 1.45,
          isSpecial: true,
        });
      } else {
        sim.score += 1;
        sim.coinComboTimer = 1.4;
        callbacks.onCoinCollect(coin, sim.coinCombo);
        spawnParticles(sim.particles, coin.x, coin.y, 10, 'coin', '#FFFFFF');
        spawnParticles(sim.particles, coin.x, coin.y, 6, 'coin', '#16C768');
        sim.popups.push({
          id: sim.popupSeq++,
          x: coin.x,
          y: coin.y - 34,
          text: '+1',
          color: '#FFFFFF',
          life: 0.65,
          maxLife: 0.65,
        });
      }
    }
  }

  // Finish line detection — stop immediately and clamp strictly at finishX
  if (crossedFinish || bike.x >= level.finishX) {
    const finishGroundY = getTerrainHeightAt(level.terrainSegments, level.finishX);
    bike.x = level.finishX;
    if (finishGroundY != null) {
      const restingY = finishGroundY - (WHEEL_OFFSET_Y + WHEEL_RADIUS);
      if (bike.y > restingY) {
        bike.y = restingY;
      }
    }
    bike.vx = 0;
    bike.vy = 0;
    bike.angularVel = 0;
    bike.boostTimer = 0;
    bike.isReversing = false;
    bike.riderLean = 0.24;
    bike.riderBobY = 0;
    bike.headTilt = -0.1;
    bike.finished = true;

    spawnParticles(
      sim.particles,
      level.finishX,
      bike.y - 110,
      36,
      'confetti',
      '#16C768'
    );
    spawnParticles(
      sim.particles,
      level.finishX,
      bike.y - 110,
      28,
      'confetti',
      '#FFFFFF'
    );
    spawnParticles(
      sim.particles,
      level.finishX,
      bike.y - 110,
      20,
      'confetti',
      '#FBBF24'
    );
    callbacks.onFinish();
    return;
  }

  // Crash checks: 1) Fell into chasm
  if (bike.y > level.deathY) {
    triggerCrash(sim, callbacks);
    return;
  }

  // 2) Head hit terrain (upside-down impact)
  const headX = bike.x + HEAD_OFFSET_X * cos - HEAD_OFFSET_Y * sin;
  const headY = bike.y + HEAD_OFFSET_X * sin + HEAD_OFFSET_Y * cos;

  for (const seg of level.terrainSegments) {
    const pts = seg.points;
    if (headX < pts[0].x || headX > pts[pts.length - 1].x) continue;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (headX < Math.min(a.x, b.x) - 24 || headX > Math.max(a.x, b.x) + 24) {
        continue;
      }
      const { cx, cy, nx, ny } = closestPointOnSegment(headX, headY, a, b);
      const dx = headX - cx;
      const dy = headY - cy;
      const signed = dx * nx + dy * ny;
      const distSq = dx * dx + dy * dy;
      if (signed < HEAD_RADIUS - 6 && signed > -65 && distSq < (HEAD_RADIUS + 40) ** 2) {
        triggerCrash(sim, callbacks);
        return;
      }
    }
  }

  // 3) Hit moving obstacle
  for (const obs of sim.obstacles) {
    const hitR = obs.radius + 42;
    const dx = obs.x - bike.x;
    const dy = obs.y - (bike.y - 18);
    if (dx * dx + dy * dy <= hitR * hitR) {
      triggerCrash(sim, callbacks);
      return;
    }
    const hdx = obs.x - headX;
    const hdy = obs.y - headY;
    const headHitR = obs.radius + HEAD_RADIUS - 4;
    if (hdx * hdx + hdy * hdy <= headHitR * headHitR) {
      triggerCrash(sim, callbacks);
      return;
    }
  }
}

function triggerCrash(sim: WorldSim, callbacks: PhysicsCallbacks) {
  const { bike } = sim;
  if (bike.crashed) return;
  bike.crashed = true;
  bike.crashTimer = 0;
  bike.vy = -210;
  bike.vx *= 0.35;
  bike.angularVel = (Math.random() > 0.5 ? 1 : -1) * 7.5;
  spawnParticles(sim.particles, bike.x, bike.y, 18, 'spark', '#F87171');
  spawnParticles(sim.particles, bike.x, bike.y, 12, 'dust', '#94A3B8');
  callbacks.onCrash();
}
