import { SPECIES, BALLS, BOSS_CATCH_MULT } from './data.js';

const GRACE = 12;
const BALL_R = 14;
const TARGET_R = 56;
const GRAB_R = 48;
const WEAK_SPEED = 1.5;

const ABSORB_MS = 400;
const DROP_MS = 280;
const SHAKE_MS = 450;
const BREAK_MS = 500;
const SPARK_MS = 700;
const MISS_MS = 420;
const SNAP_MS = 180;

const BACKDROPS = {
  grassland: ['#87ceeb', '#c6e6a8', '#5d9a45'],
  misty_woods: ['#9fd4c8', '#b7d7a8', '#3f7d55'],
  coast: ['#8fd4f2', '#f6e7c1', '#3f8fc4'],
  frost_lake: ['#d7eef8', '#b9d4ea', '#6aa0c8'],
  sky_terrace: ['#b9dcff', '#efe6c8', '#7eb0d8'],
  cave: ['#3a3438', '#6a4038', '#241c1c'],
  ancient_ruins: ['#6e6458', '#c4b49a', '#3e342c'],
  thunder_ridge: ['#6a7890', '#9aa4a8', '#3c4654'],
  champion_path: ['#f0d78c', '#e7e2cf', '#8a7044'],
  lava_canyon: ['#6a3020', '#c45a28', '#3a180e'],
  deep_trench: ['#1a4a78', '#0e3058', '#083050'],
  gloom_yard: ['#3a2848', '#2a2230', '#16141c'],
  moss_wilds: ['#3a7a40', '#245028', '#16381c'],
  volt_plain: ['#3a4870', '#606878', '#2a3048'],
  frost_shrine: ['#d0e4f0', '#e8f2f8', '#8ab0c8'],
  bone_waste: ['#8a6840', '#b08050', '#5a4028'],
  fairy_court: ['#e0b0d8', '#b8d8a8', '#f0c8dc'],
  fight_dojo: ['#8a3830', '#c07040', '#5a2818'],
  final_realm: ['#1a1028', '#301838', '#0c0814'],
};

/**
 * Catch probability before the roll. Clamped to [0.05, 0.95] unless master ball.
 */
export function catchProbability(target, ballId, { mapId, throwsThisEncounter } = {}) {
  const ball = BALLS[ballId];
  if (!ball) return 0;
  if (ball.alwaysCatch) return 1;

  const species = SPECIES[target.speciesId];
  const hpFactor = (3 * target.maxHp - 2 * target.hp) / (3 * target.maxHp);
  let mult = ball.multiplier;
  if (ball.firstThrowBonus && throwsThisEncounter === 0) {
    mult *= ball.firstThrowBonus;
  }
  if (ball.caveBonus && mapId === 'cave') {
    mult *= ball.caveBonus;
  }
  let chance = species.catchRate * mult * Math.max(0.1, hpFactor);
  if (target.boss) chance *= BOSS_CATCH_MULT;
  return Math.min(0.95, Math.max(0.05, chance));
}

/** 0 = pops immediately, 3 = caught. */
export function shakeCount(chance, roll) {
  if (roll < chance) return 3;
  const miss = roll - chance;
  if (miss < 0.12) return 2;
  if (miss < 0.28) return 1;
  return 0;
}

export function catchOutlook(chance) {
  if (chance >= 0.75) return '很容易';
  if (chance >= 0.45) return '有机会';
  if (chance >= 0.2) return '很难';
  return '几乎抓不住';
}

/**
 * Catch probability after a successful hit, plus how many times the ball shakes.
 */
export function catchChance(target, ballId, opts = {}) {
  const ball = BALLS[ballId];
  if (!ball) return { chance: 0, success: false, shakes: 0 };
  if (ball.alwaysCatch) return { chance: 1, success: true, shakes: 3 };

  const chance = catchProbability(target, ballId, opts);
  const roll = (opts.rng || Math.random)();
  return { chance, success: roll < chance, shakes: shakeCount(chance, roll) };
}

/**
 * Drag from the hand (`start`) to the pointer (`end`).
 * flick: the ball flies with the drag. sling: it flies back the other way.
 */
export function velocityFromDrag(start, end, { maxSpeed = 18, scale = 0.12, style = 'flick' } = {}) {
  const forward = style !== 'sling';
  const dx = forward ? end.x - start.x : start.x - end.x;
  const dy = forward ? end.y - start.y : start.y - end.y;
  let vx = dx * scale;
  let vy = dy * scale;
  const speed = Math.hypot(vx, vy);
  if (speed > maxSpeed) {
    vx = (vx / speed) * maxSpeed;
    vy = (vy / speed) * maxSpeed;
  }
  return { vx, vy };
}

/**
 * Simulate ball parabola until ground or timeout.
 * A point within `grace` px outside the ring still counts as a hit.
 */
export function simulateThrow({
  origin,
  velocity,
  target,
  gravity = 0.35,
  groundY,
  maxFrames = 120,
  ballRadius = BALL_R,
  grace = GRACE,
}) {
  let x = origin.x;
  let y = origin.y;
  let vx = velocity.vx;
  let vy = velocity.vy;
  const path = [{ x, y }];
  let hit = false;
  let frame = 0;
  const reach = target.radius + ballRadius + grace;

  while (frame < maxFrames) {
    frame += 1;
    x += vx;
    y += vy;
    vy += gravity;
    path.push({ x, y });

    if (Math.hypot(x - target.x, y - target.y) <= reach) {
      hit = true;
      break;
    }
    if (y >= groundY && vy > 0) break;
    if (x < -40 || x > target.boundsW + 40) break;
  }

  return { path, hit, final: path[path.length - 1] };
}

function lerp(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Canvas catch mini-game. Throw style comes from getCatchStyle(): 'flick' | 'sling'.
 */
export function createCatchController(canvas, {
  onThrowLanded,
  onThrowStart,
  onWeakThrow,
  onEmpty,
  onAim,
  onBusyChange,
  canThrow,
  getSelectedBall,
  getCatchStyle,
  targetPokemon,
  mapId,
}) {
  const ctx = canvas.getContext('2d');
  let phase = 'idle';
  let phaseMs = 0;
  let aimPoint = null;
  let path = null;
  let pathIndex = 0;
  let landedHit = false;
  let ballPos = null;
  let snapFrom = null;
  let thrownTarget = null;
  let outcome = null;
  let spriteScale = 1;
  let raf = null;
  let stopped = false;
  let nowMs = 0;
  let lastTs = 0;
  let spriteImg = null;
  let ballImg = null;

  function loadImages() {
    const sp = SPECIES[targetPokemon.speciesId];
    spriteImg = new Image();
    spriteImg.src = `${sp.sprite}?pixel64`;
    const ball = BALLS[getSelectedBall()];
    ballImg = new Image();
    if (ball) ballImg.src = ball.sprite;
  }

  loadImages();

  function busy() {
    return phase !== 'idle';
  }

  function setPhase(next) {
    const was = busy();
    phase = next;
    if (was !== busy()) onBusyChange?.(busy());
  }

  function handOrigin() {
    // Leave room below the hand so a slingshot pull can still arc upward.
    return { x: canvas.width * 0.5, y: canvas.height - 110 };
  }

  function groundLine() {
    return canvas.height - 28;
  }

  function liveTarget() {
    const bobbing = phase === 'idle' || phase === 'aiming';
    const bob = bobbing ? Math.sin(nowMs / 280) * 4 : 0;
    return {
      x: canvas.width * 0.72,
      y: canvas.height * 0.42 + bob,
      radius: TARGET_R,
      boundsW: canvas.width,
    };
  }

  function shownTarget() {
    return thrownTarget || liveTarget();
  }

  function clampAim(pointer) {
    const origin = handOrigin();
    let x = pointer.x;
    let y = pointer.y;
    const dx = x - origin.x;
    const dy = y - origin.y;
    const dist = Math.hypot(dx, dy);
    const maxPull = 160;
    if (dist > maxPull) {
      x = origin.x + (dx / dist) * maxPull;
      y = origin.y + (dy / dist) * maxPull;
    }
    const t = liveTarget();
    const td = Math.hypot(x - t.x, y - t.y) || 1;
    const minGap = t.radius + 28;
    if (td < minGap) {
      x = t.x + ((x - t.x) / td) * minGap;
      y = t.y + ((y - t.y) / td) * minGap;
    }
    x = Math.max(20, Math.min(canvas.width - 20, x));
    y = Math.max(20, Math.min(canvas.height - 20, y));
    return { x, y };
  }

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches?.[0] || e.changedTouches?.[0] || e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  function ballXY() {
    if (phase === 'aiming' && aimPoint) return aimPoint;
    if (phase === 'flying' && path && pathIndex < path.length) return path[Math.floor(pathIndex)];
    if (ballPos) return ballPos;
    return handOrigin();
  }

  function drawBackdrop() {
    const stops = BACKDROPS[mapId] || BACKDROPS.grassland;
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, stops[0]);
    g.addColorStop(0.55, stops[1]);
    g.addColorStop(1, stops[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const gy = groundLine();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, gy, canvas.width, canvas.height - gy);
  }

  function drawPokemon(target) {
    const sp = SPECIES[targetPokemon.speciesId];
    const scale = spriteScale;
    if (scale < 0.04) return;
    const size = 112 * scale;
    if (spriteImg && spriteImg.complete) {
      ctx.save();
      if (targetPokemon.shiny) ctx.filter = 'hue-rotate(160deg) saturate(1.4)';
      ctx.drawImage(spriteImg, target.x - size / 2, target.y - size / 2, size, size);
      ctx.restore();
      if (targetPokemon.boss && scale > 0.6) {
        const ey = target.y + (sp.eyeOffset?.y ?? -10) * scale;
        const ex = target.x + (sp.eyeOffset?.x ?? 0) * scale;
        ctx.fillStyle = '#ff1a1a';
        ctx.beginPath();
        ctx.arc(ex - 10 * scale, ey, 5 * scale, 0, Math.PI * 2);
        ctx.arc(ex + 10 * scale, ey, 5 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.radius * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRing(target, hot) {
    ctx.save();
    ctx.strokeStyle = hot ? 'rgba(129, 199, 132, 0.95)' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = hot ? 3 : 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBallAt(x, y, wobble) {
    ctx.save();
    ctx.translate(x, y);
    if (wobble) ctx.rotate(wobble);
    if (ballImg && ballImg.complete && ballImg.naturalWidth) {
      ctx.drawImage(ballImg, -16, -16, 32, 32);
    } else {
      ctx.fillStyle = '#e33';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSpark(x, y, t) {
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = '#ffd54f';
    for (let i = 0; i < 6; i += 1) {
      const a = t * 4 + i;
      const r = 16 + t * 28;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function previewThrow() {
    if (phase !== 'aiming' || !aimPoint) return null;
    const vel = velocityFromDrag(handOrigin(), aimPoint, { style: getCatchStyle?.() || 'flick' });
    if (Math.hypot(vel.vx, vel.vy) < WEAK_SPEED) return null;
    return simulateThrow({
      origin: aimPoint,
      velocity: vel,
      target: liveTarget(),
      groundY: groundLine(),
    });
  }

  function draw() {
    const target = shownTarget();
    const preview = previewThrow();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackdrop();

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(target.x, target.y + target.radius * 0.72, 36, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    const hideMon = phase === 'shake' || phase === 'spark' || phase === 'done' || phase === 'drop';
    if (!hideMon) drawPokemon(target);
    if (phase !== 'absorb') drawRing(target, !!preview?.hit);

    if (preview) {
      ctx.save();
      ctx.strokeStyle = preview.hit ? 'rgba(129, 199, 132, 0.95)' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.moveTo(preview.path[0].x, preview.path[0].y);
      for (let i = 3; i < preview.path.length; i += 3) {
        ctx.lineTo(preview.path[i].x, preview.path[i].y);
      }
      const last = preview.path[preview.path.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      ctx.restore();
    }

    const origin = handOrigin();
    ctx.fillStyle = 'rgba(255, 214, 170, 0.95)';
    ctx.beginPath();
    ctx.ellipse(origin.x, origin.y + 16, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    if (phase === 'aiming' && aimPoint) {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(aimPoint.x, aimPoint.y);
      ctx.stroke();
    }

    let wobble = 0;
    let pos = ballXY();
    if (phase === 'shake' && outcome) {
      const dir = outcome.shakesDone % 2 === 0 ? 1 : -1;
      const u = Math.min(1, phaseMs / SHAKE_MS);
      wobble = Math.sin(u * Math.PI) * 0.45 * dir;
      pos = { x: pos.x + Math.sin(u * Math.PI) * 14 * dir, y: pos.y };
    }
    if (phase === 'absorb' && thrownTarget) {
      const t = Math.min(1, phaseMs / ABSORB_MS);
      ctx.save();
      ctx.globalAlpha = Math.sin(t * Math.PI) * 0.65;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(thrownTarget.x, thrownTarget.y, 18 + t * 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawBallAt(pos.x, pos.y, wobble);
    if (phase === 'spark') drawSpark(pos.x, pos.y, Math.min(1, phaseMs / SPARK_MS));
  }

  function finishOutcome() {
    const cb = outcome?.onDone;
    const caught = outcome?.caught;
    outcome = null;
    spriteScale = caught ? 0 : 1;
    if (!caught) {
      ballPos = null;
      thrownTarget = null;
    }
    setPhase(caught ? 'done' : 'idle');
    cb?.();
  }

  function tick(dt) {
    if (phase === 'flying' && path) {
      pathIndex += 2;
      if (pathIndex >= path.length) {
        ballPos = path[path.length - 1];
        path = null;
        if (landedHit) {
          setPhase('hold');
          onThrowLanded?.({ hit: true });
        } else {
          phaseMs = 0;
          setPhase('miss');
          onThrowLanded?.({ hit: false });
        }
      }
      return;
    }

    if (phase === 'snap') {
      phaseMs += dt;
      const t = Math.min(1, phaseMs / SNAP_MS);
      ballPos = lerp(snapFrom, handOrigin(), t);
      if (t >= 1) {
        ballPos = null;
        setPhase('idle');
      }
      return;
    }

    if (phase === 'miss') {
      phaseMs += dt;
      if (phaseMs >= MISS_MS) {
        ballPos = null;
        thrownTarget = null;
        setPhase('idle');
      }
      return;
    }

    if (phase === 'absorb') {
      phaseMs += dt;
      const t = Math.min(1, phaseMs / ABSORB_MS);
      spriteScale = 1 - t;
      if (thrownTarget) ballPos = { x: thrownTarget.x, y: thrownTarget.y };
      if (t >= 1) {
        phaseMs = 0;
        setPhase('drop');
      }
      return;
    }

    if (phase === 'drop' && thrownTarget) {
      phaseMs += dt;
      const t = Math.min(1, phaseMs / DROP_MS);
      const from = { x: thrownTarget.x, y: thrownTarget.y };
      const to = { x: thrownTarget.x, y: groundLine() - 16 };
      ballPos = lerp(from, to, t);
      if (t >= 1) {
        phaseMs = 0;
        if (!outcome || outcome.shakes <= 0) {
          setPhase(outcome?.caught ? 'spark' : 'break');
        } else {
          outcome.shakesDone = 0;
          setPhase('shake');
        }
      }
      return;
    }

    if (phase === 'shake' && outcome) {
      phaseMs += dt;
      if (phaseMs >= SHAKE_MS) {
        outcome.shakesDone += 1;
        phaseMs = 0;
        if (outcome.shakesDone >= outcome.shakes) {
          setPhase(outcome.caught ? 'spark' : 'break');
        }
      }
      return;
    }

    if (phase === 'break') {
      phaseMs += dt;
      spriteScale = Math.min(1, phaseMs / BREAK_MS);
      if (phaseMs >= BREAK_MS) finishOutcome();
      return;
    }

    if (phase === 'spark') {
      phaseMs += dt;
      if (phaseMs >= SPARK_MS) finishOutcome();
    }
  }

  function loop(now) {
    if (stopped) return;
    const dt = lastTs ? Math.min(32, now - lastTs) : 16;
    lastTs = now;
    nowMs = now;
    tick(dt);
    if (stopped) return;
    draw();
    raf = requestAnimationFrame(loop);
  }

  function startSnap(from) {
    snapFrom = from;
    ballPos = from;
    aimPoint = null;
    phaseMs = 0;
    setPhase('snap');
  }

  function onDown(e) {
    if (phase !== 'idle') return;
    const p = pointerPos(e);
    const origin = handOrigin();
    if (Math.hypot(p.x - origin.x, p.y - origin.y) > GRAB_R) return;
    e.preventDefault();
    aimPoint = clampAim(p);
    setPhase('aiming');
    onAim?.();
    const ball = BALLS[getSelectedBall()];
    if (ball) {
      ballImg = new Image();
      ballImg.src = ball.sprite;
    }
  }

  function onMove(e) {
    if (phase !== 'aiming') return;
    e.preventDefault();
    aimPoint = clampAim(pointerPos(e));
  }

  function onUp(e) {
    if (phase !== 'aiming' || !aimPoint) return;
    e.preventDefault();
    const origin = handOrigin();
    const end = clampAim(pointerPos(e));
    aimPoint = end;
    const vel = velocityFromDrag(origin, end, { style: getCatchStyle?.() || 'flick' });
    if (Math.hypot(vel.vx, vel.vy) < WEAK_SPEED) {
      startSnap(end);
      onWeakThrow?.();
      return;
    }
    if (canThrow && !canThrow()) {
      startSnap(end);
      onEmpty?.();
      return;
    }
    thrownTarget = liveTarget();
    const sim = simulateThrow({
      origin: end,
      velocity: vel,
      target: thrownTarget,
      groundY: groundLine(),
    });
    onThrowStart?.();
    path = sim.path;
    landedHit = sim.hit;
    pathIndex = 0;
    aimPoint = null;
    setPhase('flying');
  }

  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp, { passive: false });

  raf = requestAnimationFrame(loop);

  return {
    destroy() {
      stopped = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    },
    reloadBall() {
      loadImages();
    },
    isBusy() {
      return busy();
    },
    cancelHold() {
      outcome = null;
      ballPos = null;
      thrownTarget = null;
      spriteScale = 1;
      setPhase('idle');
    },
    playOutcome({ shakes, caught, onDone }) {
      if (!thrownTarget) return;
      outcome = { shakes, caught, onDone, shakesDone: 0 };
      phaseMs = 0;
      spriteScale = 1;
      ballPos = { x: thrownTarget.x, y: thrownTarget.y };
      setPhase('absorb');
    },
  };
}
