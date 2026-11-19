/** Browser-local persistence. Every access is guarded: storage may be unavailable (private mode, blocked). */

const HIGH_SCORE_KEY = 'penalty-shootout:high-score';
const MUTED_KEY = 'penalty-shootout:muted';

export function loadHighScore(): number {
  try {
    const n = Number(localStorage.getItem(HIGH_SCORE_KEY));
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(streak: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(streak));
  } catch {
    /* ignore */
  }
}

/** Muted unless the player has previously turned sound on. */
export function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, String(muted));
  } catch {
    /* ignore */
  }
}
