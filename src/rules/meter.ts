/**
 * The Power Meter: a needle sweeping 0 → 1 → 0 … at the Meter Speed.
 * Pure — no DOM, no clocks; callers pass elapsed time.
 */

/** Sweeps (one pass from 0 to 1) per second at the start of any Shootout. */
export const BASE_METER_SPEED = 1.4;
/** Meter Speed grows by this fraction of the base … */
export const METER_SPEED_STEP = 0.15;
/** … for every this-many Goals of a Solo Streak. */
export const GOALS_PER_SPEED_STEP = 5;

/** Meter Speed for a Solo Shootout with the given Streak. Two-Player uses a Streak of 0. */
export function meterSpeed(streak: number): number {
  const steps = Math.floor(streak / GOALS_PER_SPEED_STEP);
  return BASE_METER_SPEED * (1 + METER_SPEED_STEP * steps);
}

/** Needle position in [0, 1] after `elapsedSeconds`, starting at 0 and rising. */
export function meterPosition(elapsedSeconds: number, speed: number): number {
  const phase = (elapsedSeconds * speed) % 2;
  return phase <= 1 ? phase : 2 - phase;
}
