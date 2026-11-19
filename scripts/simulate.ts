/**
 * Balance simulation for the Kick rules (issue #1).
 * Run with: npm run simulate
 *
 * Part 1 — Outcome rates for every Power band against every aim region.
 * Part 2 — simulated Kickers of different timing skill playing Solo Shootouts
 *          on the real, accelerating Power Meter.
 *
 * Uses a seeded generator so results are repeatable run to run.
 */
import {
  GOAL_HEIGHT,
  GOAL_WIDTH,
  OVERHIT_FROM,
  resolveKick,
  SWEET_SPOT,
  WEAK_LIMIT,
  type Outcome,
  type Point,
  type Rng,
} from '../src/rules/kick';
import { meterSpeed } from '../src/rules/meter';
import { recordSoloKick, startSolo } from '../src/rules/shootout';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Small seeded PRNG (mulberry32). */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: Rng): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

const between = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();

/** Folds any value back into [0, 1] the way the sweeping needle does. */
function fold(x: number): number {
  const phase = ((x % 2) + 2) % 2;
  return phase <= 1 ? phase : 2 - phase;
}

const pct = (n: number, total: number) => `${((100 * n) / total).toFixed(0)}%`.padStart(4);

type Tally = Record<Outcome, number>;
const emptyTally = (): Tally => ({ goal: 0, save: 0, miss: 0 });

// ── Aim regions (metres; x from left post, y from ground) ─────────────────

interface Region {
  name: string;
  sample: (rng: Rng) => Point;
}

const W = GOAL_WIDTH;
const H = GOAL_HEIGHT;
const mirror = (rng: Rng, x: number) => (rng() < 0.5 ? x : W - x);

const REGIONS: Region[] = [
  { name: 'Top corner', sample: (r) => ({ x: mirror(r, between(r, 0.25, 1.0)), y: between(r, 1.7, 2.3) }) },
  { name: 'Bottom corner', sample: (r) => ({ x: mirror(r, between(r, 0.25, 1.0)), y: between(r, 0.1, 0.6) }) },
  { name: 'Side, mid-height', sample: (r) => ({ x: mirror(r, between(r, 0.4, 1.6)), y: between(r, 0.8, 1.5) }) },
  { name: 'Centre high', sample: (r) => ({ x: between(r, 3.0, 4.3), y: between(r, 1.6, 2.3) }) },
  { name: 'Centre low', sample: (r) => ({ x: between(r, 3.0, 4.3), y: between(r, 0.1, 0.7) }) },
  { name: 'Anywhere', sample: (r) => ({ x: between(r, 0, W), y: between(r, 0, H) }) },
];

const CLEAN_THIRD = (OVERHIT_FROM - WEAK_LIMIT) / 3;

/** Power ranges for Part 1. Clean is split into its middle third (Sweet Spot) and outer thirds. */
const BANDS: Array<{ name: string; sample: (rng: Rng) => number }> = [
  { name: 'Weak', sample: (r) => between(r, 0, WEAK_LIMIT) },
  {
    name: 'Clean (edges)',
    sample: (r) =>
      r() < 0.5 ? between(r, WEAK_LIMIT, WEAK_LIMIT + CLEAN_THIRD) : between(r, OVERHIT_FROM - CLEAN_THIRD, OVERHIT_FROM),
  },
  { name: 'Clean (Sweet Spot)', sample: (r) => between(r, WEAK_LIMIT + CLEAN_THIRD, OVERHIT_FROM - CLEAN_THIRD) },
  { name: 'Over-hit', sample: (r) => between(r, OVERHIT_FROM, 1) },
];

// ── Part 1: band × region ────────────────────────────────────────────────

function partOne(rng: Rng, kicksPerCell: number): void {
  console.log(`\nPart 1 — Outcome rates by Power band and aim region (${kicksPerCell.toLocaleString()} Kicks per cell)`);
  console.log('Power is uniform within each range. Each cell: Goal / Save / Miss.\n');

  const header = 'Aim region'.padEnd(18) + BANDS.map((b) => b.name.padEnd(20)).join('');
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const region of REGIONS) {
    let line = region.name.padEnd(18);
    for (const band of BANDS) {
      const t = emptyTally();
      for (let i = 0; i < kicksPerCell; i++) {
        const power = band.sample(rng);
        t[resolveKick(region.sample(rng), power, rng).outcome]++;
      }
      line += `${pct(t.goal, kicksPerCell)} /${pct(t.save, kicksPerCell)} /${pct(t.miss, kicksPerCell)}  `;
    }
    console.log(line);
  }
}

// ── Part 2: simulated Kickers ────────────────────────────────────────────

interface Skill {
  name: string;
  /** Standard deviation of the Kicker's timing error when stopping the meter, in seconds. */
  timingSigma: number;
}

const SKILLS: Skill[] = [
  { name: 'Casual (±80 ms)', timingSigma: 0.08 },
  { name: 'Good (±50 ms)', timingSigma: 0.05 },
  { name: 'Sharp (±30 ms)', timingSigma: 0.03 },
  { name: 'Expert (±15 ms)', timingSigma: 0.015 },
];

/** A Kicker aiming for the Sweet Spot, stopping the needle with Gaussian timing error. */
function stopMeter(rng: Rng, skill: Skill, speed: number): number {
  return fold(SWEET_SPOT + gaussian(rng) * skill.timingSigma * speed);
}

/** Kickers mostly go for the corners, as real penalty takers do. */
function chooseAim(rng: Rng): Point {
  const roll = rng();
  if (roll < 0.4) return REGIONS[0].sample(rng); // top corner
  if (roll < 0.8) return REGIONS[1].sample(rng); // bottom corner
  return REGIONS[2].sample(rng); // side, mid-height
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function partTwo(rng: Rng, shootouts: number): void {
  console.log(`\nPart 2 — Solo Shootouts by timing skill (${shootouts.toLocaleString()} Shootouts each)`);
  console.log('Kickers aim mostly for the corners and try to stop the needle in the middle of Clean.');
  console.log('Meter Speed rises with the Streak exactly as in the game.\n');

  const header =
    'Kicker'.padEnd(18) +
    'Hit Clean'.padStart(10) +
    'Goal'.padStart(7) +
    'Save'.padStart(7) +
    'Miss'.padStart(7) +
    'Median'.padStart(9) +
    'Mean'.padStart(7) +
    '90th'.padStart(7) +
    'Max'.padStart(6);
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const skill of SKILLS) {
    const streaks: number[] = [];
    const t = emptyTally();
    let kicks = 0;
    let clean = 0;
    for (let s = 0; s < shootouts; s++) {
      let shootout = startSolo();
      while (!shootout.finished && shootout.streak < 1000) {
        const power = stopMeter(rng, skill, meterSpeed(shootout.streak));
        if (power >= WEAK_LIMIT && power < OVERHIT_FROM) clean++;
        const { outcome } = resolveKick(chooseAim(rng), power, rng);
        t[outcome]++;
        kicks++;
        shootout = recordSoloKick(shootout, outcome);
      }
      streaks.push(shootout.streak);
    }
    streaks.sort((a, b) => a - b);
    const mean = streaks.reduce((a, b) => a + b, 0) / streaks.length;
    console.log(
      skill.name.padEnd(18) +
        pct(clean, kicks).padStart(10) +
        pct(t.goal, kicks).padStart(7) +
        pct(t.save, kicks).padStart(7) +
        pct(t.miss, kicks).padStart(7) +
        String(percentile(streaks, 0.5)).padStart(9) +
        mean.toFixed(1).padStart(7) +
        String(percentile(streaks, 0.9)).padStart(7) +
        String(streaks[streaks.length - 1]).padStart(6),
    );
  }
}

// ── Run ──────────────────────────────────────────────────────────────────

const rng = seeded(20261119);
console.log('Penalty Shootout — balance simulation');
console.log(`Bands: Weak 0–${WEAK_LIMIT * 100}%, Clean ${WEAK_LIMIT * 100}–${OVERHIT_FROM * 100}%, Over-hit ${OVERHIT_FROM * 100}–100%`);
console.log(`Meter Speed at Streak 0: ${meterSpeed(0)} sweeps/s (Clean window ≈ ${(((OVERHIT_FROM - WEAK_LIMIT) / meterSpeed(0)) * 1000).toFixed(0)} ms)`);
partOne(rng, 20_000);
partTwo(rng, 5_000);
console.log();
