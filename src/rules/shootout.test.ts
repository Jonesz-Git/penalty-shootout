import { describe, expect, it } from 'vitest';
import type { Outcome } from './kick';
import {
  coinToss,
  goals,
  isSuddenDeath,
  nextKicker,
  recordSoloKick,
  recordTwoPlayerKick,
  startSolo,
  startTwoPlayer,
  winner,
  type KickerIndex,
  type TwoPlayerShootout,
} from './shootout';
import { sequence } from './testRng';

describe('Solo Shootout', () => {
  it('extends the Streak on each Goal', () => {
    const s = recordSoloKick(recordSoloKick(startSolo(), 'goal'), 'goal');
    expect(s).toEqual({ mode: 'solo', streak: 2, finished: false });
  });

  it.each<Outcome>(['save', 'miss'])('ends on a %s, keeping the Streak', (outcome) => {
    const s = recordSoloKick(recordSoloKick(startSolo(), 'goal'), outcome);
    expect(s.finished).toBe(true);
    expect(s.streak).toBe(1);
  });

  it('refuses Kicks after it has finished', () => {
    const s = recordSoloKick(startSolo(), 'save');
    expect(() => recordSoloKick(s, 'goal')).toThrow();
  });
});

/** Plays Kicks in turn order; 'G' = Goal, 'S' = Save, 'M' = Miss. */
function play(first: KickerIndex, script: string): TwoPlayerShootout {
  const map: Record<string, Outcome> = { G: 'goal', S: 'save', M: 'miss' };
  let s = startTwoPlayer(['Alex', 'Sam'], first);
  for (const ch of script) s = recordTwoPlayerKick(s, map[ch]);
  return s;
}

describe('Two-Player Shootout', () => {
  it('uses the coin toss to pick who kicks first', () => {
    expect(coinToss(sequence(0.2))).toBe(0);
    expect(coinToss(sequence(0.7))).toBe(1);
  });

  it('alternates Kickers, starting with the coin-toss winner', () => {
    let s = startTwoPlayer(['Alex', 'Sam'], 1);
    const order: KickerIndex[] = [];
    for (let i = 0; i < 4; i++) {
      order.push(nextKicker(s));
      s = recordTwoPlayerKick(s, 'goal');
    }
    expect(order).toEqual([1, 0, 1, 0]);
  });

  it('is Decided early at 3–0 after three Kicks each', () => {
    expect(winner(play(0, 'GSGSG'))).toBeNull(); // 3–0, second Kicker still has 3 Kicks
    expect(winner(play(0, 'GSGSGS'))).toBe(0);
  });

  it('can be Decided before the second Kicker has matched the first', () => {
    // After 4 Kicks vs 3: first has 4 Goals; second has 1 Goal and only 2 Kicks left.
    const s = play(0, 'GGGSGSG');
    expect(s.kicks[0].length).toBe(4);
    expect(s.kicks[1].length).toBe(3);
    expect(winner(s)).toBe(0);
  });

  it('lets the second Kicker win when the first cannot catch up', () => {
    expect(winner(play(0, 'SGSGSG'))).toBe(1);
  });

  it('is won in regulation when the score differs after five Kicks each', () => {
    const s = play(0, 'GGGSSGGSSS'); // first: G G S G S, second: G S G S S → 3–2
    expect(goals(s, 0)).toBe(3);
    expect(goals(s, 1)).toBe(2);
    expect(winner(s)).toBe(0);
  });

  it('goes to Sudden Death when level after five Kicks each', () => {
    const s = play(0, 'GGSSGGSSGG'); // 3–3
    expect(winner(s)).toBeNull();
    expect(isSuddenDeath(s)).toBe(true);
  });

  it('is not in Sudden Death during regulation', () => {
    expect(isSuddenDeath(play(0, 'GGSS'))).toBe(false);
  });

  it('does not end Sudden Death until both Kickers have kicked in the pair', () => {
    expect(winner(play(0, 'GGSSGGSSGG' + 'G'))).toBeNull();
    expect(winner(play(0, 'GGSSGGSSGG' + 'S'))).toBeNull();
  });

  it('continues Sudden Death while both score or both fail', () => {
    expect(winner(play(0, 'GGSSGGSSGG' + 'GG' + 'MS'))).toBeNull();
  });

  it('ends Sudden Death when one scores and the other does not', () => {
    expect(winner(play(0, 'GGSSGGSSGG' + 'GG' + 'SG'))).toBe(1);
    expect(winner(play(1, 'GGSSGGSSGG' + 'GM'))).toBe(1);
  });

  it('refuses Kicks once there is a winner', () => {
    expect(() => play(0, 'GSGSGS' + 'G')).toThrow();
  });
});
