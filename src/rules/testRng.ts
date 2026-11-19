import type { Rng } from './kick';

/** Deterministic Rng for tests: returns the given values in order, and throws if asked for more. */
export function sequence(...values: number[]): Rng {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error(`Rng exhausted after ${values.length} values`);
    return values[i++];
  };
}
