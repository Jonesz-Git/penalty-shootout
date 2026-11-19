import { describe, expect, it } from 'vitest';
import {
  chooseDiveZone,
  diveZoneCentre,
  GOAL_HEIGHT,
  GOAL_WIDTH,
  isInFrame,
  keeperDive,
  landingPoint,
  MAX_READ_CHANCE,
  OVERHIT_FROM,
  powerBand,
  reach,
  readChance,
  resolveKick,
  WEAK_LIMIT,
  zoneContaining,
} from './kick';
import { sequence } from './testRng';

const LEFT_LOW = 0; // rng roll landing in the left-low Dive Zone
const RIGHT_HIGH = 0.99; // rng roll landing in the right-high Dive Zone

describe('powerBand', () => {
  it.each([
    [0, 'weak'],
    [0.49, 'weak'],
    [0.5, 'clean'],
    [0.64, 'clean'],
    [0.65, 'overhit'],
    [1, 'overhit'],
  ])('Power %d is %s', (power, band) => {
    expect(powerBand(power)).toBe(band);
  });
});

describe('chooseDiveZone', () => {
  it.each([
    [0, 'left', 'low'],
    [0.19, 'left', 'low'],
    [0.2, 'left', 'high'],
    [0.45, 'centre', 'low'],
    [0.55, 'centre', 'high'],
    [0.7, 'right', 'low'],
    [0.999, 'right', 'high'],
  ])('roll %d dives %s-%s', (roll, column, row) => {
    expect(chooseDiveZone(sequence(roll))).toEqual({ column, row });
  });

  it('dives to the centre about 20% of the time', () => {
    let centre = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      if (chooseDiveZone(sequence((i + 0.5) / n)).column === 'centre') centre++;
    }
    expect(centre / n).toBeCloseTo(0.2, 2);
  });
});

describe('zoneContaining', () => {
  it.each([
    [{ x: 0.5, y: 0.3 }, 'left', 'low'],
    [{ x: 3.66, y: 2.2 }, 'centre', 'high'],
    [{ x: 7.0, y: 1.0 }, 'right', 'low'],
  ])('%o is in %s-%s', (p, column, row) => {
    expect(zoneContaining(p)).toEqual({ column, row });
  });
});

describe('readChance', () => {
  it('is highest for the weakest Kick and falls to zero at the edge of Clean', () => {
    expect(readChance(0)).toBe(MAX_READ_CHANCE);
    expect(readChance(WEAK_LIMIT / 2)).toBeCloseTo(MAX_READ_CHANCE / 2);
    expect(readChance(WEAK_LIMIT)).toBe(0);
  });

  it('is zero for Clean and Over-hit Kicks', () => {
    expect(readChance(0.6)).toBe(0);
    expect(readChance(1)).toBe(0);
  });
});

describe('keeperDive', () => {
  const aim = { x: 0.5, y: 0.3 }; // left-low

  it('dives to the ball\'s Dive Zone when a Weak Kick is Read', () => {
    expect(keeperDive(aim, 0.1, sequence(0.1))).toEqual({ column: 'left', row: 'low' });
  });

  it('dives at random when a Weak Kick is not Read', () => {
    expect(keeperDive(aim, 0.1, sequence(0.99, 0.99))).toEqual({ column: 'right', row: 'high' });
  });

  it('never Reads a Clean Kick, using a single rng value', () => {
    expect(keeperDive(aim, 0.6, sequence(0.99))).toEqual({ column: 'right', row: 'high' });
  });

  it('makes the right Dive Zone about 60% likely for the weakest Kick', () => {
    // Grid over independent (Read roll, dive roll) pairs.
    let right = 0;
    const n = 100;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const zone = keeperDive(aim, 0, sequence((i + 0.5) / n, (j + 0.5) / n));
        if (zone.column === 'left' && zone.row === 'low') right++;
      }
    }
    // Read 50%, plus the random dive's 20% left-low chance on the other half.
    expect(right / (n * n)).toBeCloseTo(0.6, 2);
  });
});

describe('reach', () => {
  it('shrinks as Power increases', () => {
    expect(reach(0)).toBeGreaterThan(reach(0.6));
    expect(reach(0.6)).toBeGreaterThan(reach(1));
  });
});

describe('landingPoint', () => {
  it('lands exactly on the Aim Point for Weak and Clean Kicks without using randomness', () => {
    const aim = { x: 2, y: 1 };
    expect(landingPoint(aim, 0.1, sequence())).toEqual(aim);
    expect(landingPoint(aim, 0.64, sequence())).toEqual(aim);
  });

  it('does not Scatter at the very start of the Over-hit band', () => {
    const p = landingPoint({ x: 2, y: 1 }, OVERHIT_FROM, sequence(0.3, 0.9));
    expect(p.x).toBeCloseTo(2);
    expect(p.y).toBeCloseTo(1);
  });

  it('clamps a ball Scattered into the ground to ground level', () => {
    const p = landingPoint({ x: 3.66, y: 0.3 }, 1, sequence(0.75, 0)); // straight down
    expect(p.y).toBe(0);
    expect(isInFrame(p)).toBe(true);
  });
});

describe('resolveKick', () => {
  const topRightCorner = { x: 7.0, y: 2.3 };

  it('is a Goal when the Keeper dives the wrong way', () => {
    expect(resolveKick(topRightCorner, 0.6, sequence(LEFT_LOW)).outcome).toBe('goal');
  });

  it('is a Save when the ball ends within the Keeper\'s Reach', () => {
    expect(resolveKick(topRightCorner, 0.6, sequence(RIGHT_HIGH)).outcome).toBe('save');
  });

  it('lets a Weak Kick be saved where a harder Clean Kick scores', () => {
    const aim = { x: 2.9, y: diveZoneCentre({ column: 'left', row: 'low' }).y };
    const NOT_READ = 0.99;
    expect(resolveKick(aim, 0.2, sequence(NOT_READ, 0.1)).outcome).toBe('save');
    expect(resolveKick(aim, 0.6, sequence(0.1)).outcome).toBe('goal');
  });

  it('sends the Keeper to the ball when he Reads a Weak Kick', () => {
    const result = resolveKick(topRightCorner, 0.1, sequence(0)); // Read roll succeeds
    expect(result.diveZone).toEqual({ column: 'right', row: 'high' });
    expect(result.outcome).toBe('save');
  });

  it('is a Miss when an Over-hit Kick Scatters over the bar', () => {
    const result = resolveKick({ x: 3.66, y: 2.0 }, 1, sequence(LEFT_LOW, 0.25, 0.999)); // straight up, max distance
    expect(result.landing.y).toBeGreaterThan(GOAL_HEIGHT);
    expect(result.outcome).toBe('miss');
  });

  it('is a Miss even if the Keeper dived to where the ball left the frame', () => {
    const result = resolveKick({ x: GOAL_WIDTH, y: 2.0 }, 1, sequence(RIGHT_HIGH, 0, 0.999)); // straight right
    expect(result.outcome).toBe('miss');
  });

  it('rejects an Aim Point outside the goal frame', () => {
    expect(() => resolveKick({ x: -0.1, y: 1 }, 0.5, sequence(0))).toThrow(RangeError);
    expect(() => resolveKick({ x: 1, y: GOAL_HEIGHT + 0.1 }, 0.5, sequence(0))).toThrow(RangeError);
  });

  it('rejects Power outside 0–1', () => {
    expect(() => resolveKick({ x: 1, y: 1 }, 1.1, sequence(0))).toThrow(RangeError);
  });
});
