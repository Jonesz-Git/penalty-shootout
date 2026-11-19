/**
 * Kick resolution: Aim Point + Power + Keeper's Dive Zone → Outcome.
 * Pure — no DOM, randomness injected. Vocabulary per GLOSSARY.md.
 *
 * Goal coordinates are in metres, seen from behind the Kicker:
 * x runs from the left post (0) to the right post (GOAL_WIDTH),
 * y from the ground (0) to the crossbar (GOAL_HEIGHT).
 */

/** Returns a number in [0, 1). */
export type Rng = () => number;

export const GOAL_WIDTH = 7.32;
export const GOAL_HEIGHT = 2.44;

export interface Point {
  x: number;
  y: number;
}

export function isInFrame(p: Point): boolean {
  return p.x >= 0 && p.x <= GOAL_WIDTH && p.y >= 0 && p.y <= GOAL_HEIGHT;
}

// ── Power ────────────────────────────────────────────────────────────────

export type PowerBand = 'weak' | 'clean' | 'overhit';

/** Power below this is Weak. */
export const WEAK_LIMIT = 0.4;
/** Power at or above this is Over-hit. */
export const OVERHIT_FROM = 0.8;

export function powerBand(power: number): PowerBand {
  if (power < WEAK_LIMIT) return 'weak';
  if (power < OVERHIT_FROM) return 'clean';
  return 'overhit';
}

/** Furthest an Over-hit Kick at full Power can Scatter, in metres. */
export const MAX_SCATTER = 1.6;

/**
 * Where the ball actually goes. Weak and Clean Kicks land on the Aim Point;
 * Over-hit Kicks Scatter in a random direction, further with more Power.
 * Consumes two rng values for an Over-hit Kick (angle, then distance), none otherwise.
 * A ball scattered below the ground skids along it (y clamped to 0).
 */
export function landingPoint(aim: Point, power: number, rng: Rng): Point {
  if (powerBand(power) !== 'overhit') return { ...aim };
  const severity = (power - OVERHIT_FROM) / (1 - OVERHIT_FROM);
  const angle = rng() * 2 * Math.PI;
  const distance = MAX_SCATTER * severity * (0.4 + 0.6 * rng());
  return {
    x: aim.x + Math.cos(angle) * distance,
    y: Math.max(0, aim.y + Math.sin(angle) * distance),
  };
}

// ── Keeper ───────────────────────────────────────────────────────────────

export type DiveColumn = 'left' | 'centre' | 'right';
export type DiveRow = 'low' | 'high';

export interface DiveZone {
  column: DiveColumn;
  row: DiveRow;
}

/** Each Dive Zone with its chance of being chosen; centre ≈ 20% in total. */
export const DIVE_ZONE_WEIGHTS: ReadonlyArray<{ zone: DiveZone; weight: number }> = [
  { zone: { column: 'left', row: 'low' }, weight: 0.2 },
  { zone: { column: 'left', row: 'high' }, weight: 0.2 },
  { zone: { column: 'centre', row: 'low' }, weight: 0.1 },
  { zone: { column: 'centre', row: 'high' }, weight: 0.1 },
  { zone: { column: 'right', row: 'low' }, weight: 0.2 },
  { zone: { column: 'right', row: 'high' }, weight: 0.2 },
];

/** Picks the Keeper's Dive Zone. Consumes one rng value; ignores the Aim Point by design. */
export function chooseDiveZone(rng: Rng): DiveZone {
  let roll = rng();
  for (const { zone, weight } of DIVE_ZONE_WEIGHTS) {
    if (roll < weight) return zone;
    roll -= weight;
  }
  return DIVE_ZONE_WEIGHTS[DIVE_ZONE_WEIGHTS.length - 1].zone;
}

export function diveZoneCentre(zone: DiveZone): Point {
  const third = GOAL_WIDTH / 3;
  const column = { left: 0, centre: 1, right: 2 }[zone.column];
  return {
    x: third * (column + 0.5),
    y: zone.row === 'low' ? GOAL_HEIGHT * 0.25 : GOAL_HEIGHT * 0.75,
  };
}

export const REACH_AT_NO_POWER = 2.0;
export const REACH_AT_FULL_POWER = 0.9;

/** Keeper's Reach in metres; shrinks linearly as Power increases. */
export function reach(power: number): number {
  return REACH_AT_NO_POWER - (REACH_AT_NO_POWER - REACH_AT_FULL_POWER) * power;
}

// ── Resolution ───────────────────────────────────────────────────────────

export type Outcome = 'goal' | 'save' | 'miss';

export interface KickResult {
  aim: Point;
  power: number;
  diveZone: DiveZone;
  landing: Point;
  outcome: Outcome;
}

/**
 * Resolves one Kick. The Keeper commits to a Dive Zone as the ball is struck
 * (first rng value), then any Scatter is applied (see landingPoint).
 */
export function resolveKick(aim: Point, power: number, rng: Rng): KickResult {
  if (!isInFrame(aim)) throw new RangeError('Aim Point must be inside the goal frame');
  if (!(power >= 0 && power <= 1)) throw new RangeError('Power must be between 0 and 1');

  const diveZone = chooseDiveZone(rng);
  const landing = landingPoint(aim, power, rng);

  let outcome: Outcome;
  if (!isInFrame(landing)) {
    outcome = 'miss';
  } else {
    const centre = diveZoneCentre(diveZone);
    const distance = Math.hypot(landing.x - centre.x, landing.y - centre.y);
    outcome = distance <= reach(power) ? 'save' : 'goal';
  }

  return { aim, power, diveZone, landing, outcome };
}
