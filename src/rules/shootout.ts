/**
 * Shootout progression for Solo and Two-Player Shootouts.
 * Pure and immutable — every record* function returns a new state.
 */
import type { Outcome, Rng } from './kick';

// ── Solo ─────────────────────────────────────────────────────────────────

export interface SoloShootout {
  readonly mode: 'solo';
  readonly streak: number;
  readonly finished: boolean;
}

export function startSolo(): SoloShootout {
  return { mode: 'solo', streak: 0, finished: false };
}

/** A Goal extends the Streak; a Save or Miss ends the Shootout. */
export function recordSoloKick(s: SoloShootout, outcome: Outcome): SoloShootout {
  if (s.finished) throw new Error('Solo Shootout is already finished');
  return outcome === 'goal'
    ? { ...s, streak: s.streak + 1 }
    : { ...s, finished: true };
}

// ── Two-Player ───────────────────────────────────────────────────────────

export const REGULATION_KICKS = 5;

export type KickerIndex = 0 | 1;

export interface TwoPlayerShootout {
  readonly mode: 'two';
  readonly names: readonly [string, string];
  /** Kicker who won the coin toss and kicks first in every pair. */
  readonly first: KickerIndex;
  /** Outcomes of each Kicker's Kicks, in order. */
  readonly kicks: readonly [readonly Outcome[], readonly Outcome[]];
}

export function coinToss(rng: Rng): KickerIndex {
  return rng() < 0.5 ? 0 : 1;
}

export function startTwoPlayer(names: readonly [string, string], first: KickerIndex): TwoPlayerShootout {
  return { mode: 'two', names, first, kicks: [[], []] };
}

export function other(k: KickerIndex): KickerIndex {
  return k === 0 ? 1 : 0;
}

export function goals(s: TwoPlayerShootout, k: KickerIndex): number {
  return s.kicks[k].filter((o) => o === 'goal').length;
}

/** Whose Kick is next. */
export function nextKicker(s: TwoPlayerShootout): KickerIndex {
  const second = other(s.first);
  return s.kicks[s.first].length === s.kicks[second].length ? s.first : second;
}

/** True once regulation is over and Kickers take one Kick each until one scores and the other does not. */
export function isSuddenDeath(s: TwoPlayerShootout): boolean {
  return s.kicks[nextKicker(s)].length >= REGULATION_KICKS;
}

/**
 * The winning Kicker, or null if the Shootout continues.
 * During regulation, a Kicker wins as soon as the Shootout is Decided
 * (the other cannot catch up even by scoring every remaining Kick).
 * In Sudden Death, only after both have taken the same number of Kicks.
 */
export function winner(s: TwoPlayerShootout): KickerIndex | null {
  const [taken0, taken1] = [s.kicks[0].length, s.kicks[1].length];
  const [g0, g1] = [goals(s, 0), goals(s, 1)];

  if (taken0 <= REGULATION_KICKS && taken1 <= REGULATION_KICKS) {
    const best0 = g0 + (REGULATION_KICKS - taken0);
    const best1 = g1 + (REGULATION_KICKS - taken1);
    if (best1 < g0) return 0;
    if (best0 < g1) return 1;
    return null;
  }

  if (taken0 === taken1 && g0 !== g1) return g0 > g1 ? 0 : 1;
  return null;
}

export function recordTwoPlayerKick(s: TwoPlayerShootout, outcome: Outcome): TwoPlayerShootout {
  if (winner(s) !== null) throw new Error('Two-Player Shootout is already finished');
  const k = nextKicker(s);
  const kicks: [Outcome[], Outcome[]] = [[...s.kicks[0]], [...s.kicks[1]]];
  kicks[k].push(outcome);
  return { ...s, kicks };
}
