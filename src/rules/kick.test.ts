import { describe, expect, it } from 'vitest';
import {
  chooseDiveZone,
  diveZoneCentre,
  GOAL_HEIGHT,
  GOAL_WIDTH,
  isInFrame,
  landingPoint,
  powerBand,
  reach,
  resolveKick,
} from './kick';
import { sequence } from './testRng';

const LEFT_LOW = 0; // rng roll landing in the left-low Dive Zone
const RIGHT_HIGH = 0.99; // rng roll landing in the right-high Dive Zone

describe('powerBand', () => {
  it.each([
    [0, 'weak'],
    [0.39, 'weak'],
    [0.4, 'clean'],
    [0.79, 'clean'],
    [0.8, 'overhit'],
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
    expect(landingPoint(aim, 0.79, sequence())).toEqual(aim);
  });

  it('does not Scatter at the very start of the Over-hit band', () => {
    const p = landingPoint({ x: 2, y: 1 }, 0.8, sequence(0.3, 0.9));
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
    expect(resolveKick(aim, 0.2, sequence(0.1)).outcome).toBe('save');
    expect(resolveKick(aim, 0.7, sequence(0.1)).outcome).toBe('goal');
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
