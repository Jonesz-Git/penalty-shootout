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
export const WEAK_LIMIT = 0.5;
/** Power at or above this is Over-hit. */
export const OVERHIT_FROM = 0.65;

export function powerBand(power: number): PowerBand {
  if (power < WEAK_LIMIT) return 'weak';
  if (power < OVERHIT_FROM) return 'clean';
  return 'overhit';
}

/** Middle of the Clean band: where a Kick is struck best. */
export const SWEET_SPOT = (WEAK_LIMIT + OVERHIT_FROM) / 2;

/** How well a Kick is struck: 1 on the Sweet Spot, falling to 0 at either edge of Clean; 0 outside Clean. */
export function strikeQuality(power: number): number {
  if (powerBand(power) !== 'clean') return 0;
  const halfWidth = (OVERHIT_FROM - WEAK_LIMIT) / 2;
  return Math.max(0, 1 - Math.abs(power - SWEET_SPOT) / halfWidth);
}

/** Furthest an Over-hit Kick at full Power can Scatter, in metres. */
export const MAX_SCATTER = 1.6;
/** Fraction of MAX_SCATTER an Over-hit Kick already has at the very start of the band. */
export const MIN_SCATTER_FRACTION = 0.5;

/**
 * Where the ball actually goes. Weak and Clean Kicks land on the Aim Point;
 * Over-hit Kicks Scatter in a random direction — already substantially at the
 * start of the band, and further with more Power.
 * Consumes two rng values for an Over-hit Kick (angle, then distance), none otherwise.
 * A ball scattered below the ground skids along it (y clamped to 0).
 */
export function landingPoint(aim: Point, power: number, rng: Rng): Point {
  if (powerBand(power) !== 'overhit') return { ...aim };
  const severity = (power - OVERHIT_FROM) / (1 - OVERHIT_FROM);
  const scale = MIN_SCATTER_FRACTION + (1 - MIN_SCATTER_FRACTION) * severity;
  const angle = rng() * 2 * Math.PI;
  const distance = MAX_SCATTER * scale * (0.4 + 0.6 * rng());
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

/** Picks a Dive Zone at random by DIVE_ZONE_WEIGHTS. Consumes one rng value. */
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

/** The Dive Zone a point in the goal falls in. */
export function zoneContaining(p: Point): DiveZone {
  const third = GOAL_WIDTH / 3;
  const column: DiveColumn = p.x < third ? 'left' : p.x < 2 * third ? 'centre' : 'right';
  return { column, row: p.y < GOAL_HEIGHT / 2 ? 'low' : 'high' };
}

/** Chance the Keeper Reads a Kick at zero Power; falls linearly to 0 at the edge of Clean. */
export const MAX_READ_CHANCE = 0.7;

/** Chance the Keeper Reads a Kick of this Power. Only Weak Kicks can be Read. */
export function readChance(power: number): number {
  if (powerBand(power) !== 'weak') return 0;
  return MAX_READ_CHANCE * (1 - power / WEAK_LIMIT);
}

/**
 * The Keeper's Dive Zone for a Kick. A Weak Kick may be Read (first rng value),
 * sending him to the zone the ball is heading for; otherwise he dives at random
 * (one more rng value). Clean and Over-hit Kicks are never Read and consume only one.
 */
export function keeperDive(aim: Point, power: number, rng: Rng): DiveZone {
  if (powerBand(power) === 'weak' && rng() < readChance(power)) return zoneContaining(aim);
  return chooseDiveZone(rng);
}

/** Keeper's Reach (metres) for the weakest possible Kick … */
export const REACH_WEAKEST = 2.4;
/** … shrinking linearly to this for the strongest Weak Kick. */
export const REACH_WEAK_EDGE = 2.0;
/** Reach for a Clean Kick struck at either edge of the band. */
export const REACH_CLEAN_EDGE = 1.6;
/** Reach for a Kick struck exactly on the Sweet Spot. */
export const REACH_SWEET_SPOT = 0.5;
/** Reach for any Over-hit Kick: the ball is fast, but it Scatters. */
export const REACH_OVERHIT = 1.3;

/** A Top Corner is the part of the goal within this distance of a post … */
export const TOP_CORNER_WIDTH = 1.2;
/** … and at least this high. */
export const TOP_CORNER_FROM = 1.6;
/** The Keeper's Reach is multiplied by this for a ball into a Top Corner. */
export const TOP_CORNER_REACH_FACTOR = 0.7;

export function isTopCorner(p: Point): boolean {
  return p.y >= TOP_CORNER_FROM && (p.x <= TOP_CORNER_WIDTH || p.x >= GOAL_WIDTH - TOP_CORNER_WIDTH);
}

/**
 * Keeper's Reach in metres for a ball of this Power landing here.
 * Weak Kicks are easiest to reach; Clean Kicks get harder to reach the closer they
 * are struck to the Sweet Spot; and anything into a Top Corner is harder still.
 */
export function reach(power: number, landing: Point): number {
  let r: number;
  switch (powerBand(power)) {
    case 'weak':
      r = REACH_WEAKEST - (REACH_WEAKEST - REACH_WEAK_EDGE) * (power / WEAK_LIMIT);
      break;
    case 'clean':
      r = REACH_CLEAN_EDGE - (REACH_CLEAN_EDGE - REACH_SWEET_SPOT) * strikeQuality(power);
      break;
    case 'overhit':
      r = REACH_OVERHIT;
      break;
  }
  return isTopCorner(landing) ? r * TOP_CORNER_REACH_FACTOR : r;
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
 * (see keeperDive), then any Scatter is applied (see landingPoint).
 */
export function resolveKick(aim: Point, power: number, rng: Rng): KickResult {
  if (!isInFrame(aim)) throw new RangeError('Aim Point must be inside the goal frame');
  if (!(power >= 0 && power <= 1)) throw new RangeError('Power must be between 0 and 1');

  const diveZone = keeperDive(aim, power, rng);
  const landing = landingPoint(aim, power, rng);

  let outcome: Outcome;
  if (!isInFrame(landing)) {
    outcome = 'miss';
  } else {
    const centre = diveZoneCentre(diveZone);
    const distance = Math.hypot(landing.x - centre.x, landing.y - centre.y);
    outcome = distance <= reach(power, landing) ? 'save' : 'goal';
  }

  return { aim, power, diveZone, landing, outcome };
}
