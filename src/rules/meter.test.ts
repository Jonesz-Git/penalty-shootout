import { describe, expect, it } from 'vitest';
import { BASE_METER_SPEED, meterPosition, meterSpeed } from './meter';

describe('meterPosition', () => {
  const speed = 2; // two sweeps per second

  it.each([
    [0, 0],
    [0.25, 0.5],
    [0.5, 1],
    [0.75, 0.5],
    [1, 0],
    [1.25, 0.5],
  ])('at %ds is %d', (t, expected) => {
    expect(meterPosition(t, speed)).toBeCloseTo(expected);
  });
});

describe('meterSpeed', () => {
  it('starts at the base speed', () => {
    expect(meterSpeed(0)).toBe(BASE_METER_SPEED);
    expect(meterSpeed(4)).toBe(BASE_METER_SPEED);
  });

  it('speeds up every 5 Goals of Streak', () => {
    expect(meterSpeed(5)).toBeGreaterThan(meterSpeed(4));
    expect(meterSpeed(9)).toBe(meterSpeed(5));
    expect(meterSpeed(10)).toBeGreaterThan(meterSpeed(9));
  });
});
