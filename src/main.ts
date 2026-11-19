import './style.css';
import { isInFrame, resolveKick, type Point } from './rules/kick';
import { meterPosition, meterSpeed } from './rules/meter';
import {
  coinToss,
  goals,
  isSuddenDeath,
  nextKicker,
  other,
  recordSoloKick,
  recordTwoPlayerKick,
  REGULATION_KICKS,
  startSolo,
  startTwoPlayer,
  winner,
  type KickerIndex,
  type SoloShootout,
  type TwoPlayerShootout,
} from './rules/shootout';
import { Pitch } from './ui/pitch';
import { Sound } from './ui/sound';
import { loadHighScore, loadMuted, saveHighScore, saveMuted } from './ui/storage';

type Shootout = SoloShootout | TwoPlayerShootout;
type Names = readonly [string, string];

const app = document.getElementById('app')!;
const sound = new Sound(loadMuted());

// ── Helpers ──────────────────────────────────────────────────────────────

type Child = Node | string;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else e.setAttribute(k, String(v));
  }
  e.append(...children);
  return e;
}

let screen = new AbortController();

/** Replaces the current screen; the returned signal aborts when the screen is left. */
function mount(...children: Child[]): AbortSignal {
  screen.abort();
  screen = new AbortController();
  app.replaceChildren(...children);
  return screen.signal;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      resolve();
    });
  });
}

function muteButton(): HTMLButtonElement {
  const button = el('button', { class: 'ghost', type: 'button' });
  const render = () => {
    button.textContent = sound.muted ? '🔇 Sound off' : '🔊 Sound on';
    button.setAttribute('aria-pressed', String(!sound.muted));
  };
  button.addEventListener('click', () => {
    sound.muted = !sound.muted;
    saveMuted(sound.muted);
    render();
  });
  render();
  return button;
}

// ── Menu ─────────────────────────────────────────────────────────────────

function showMenu(): void {
  const high = loadHighScore();
  const name1 = el('input', { type: 'text', maxlength: 16, placeholder: 'Player 1', 'aria-label': 'Player 1 name' });
  const name2 = el('input', { type: 'text', maxlength: 16, placeholder: 'Player 2', 'aria-label': 'Player 2 name' });

  mount(
    el(
      'main',
      { class: 'screen menu' },
      el('header', { class: 'topbar end' }, muteButton()),
      el('h1', {}, '⚽ Penalty Shootout'),
      el('section', { class: 'card' },
        el('h2', {}, 'Solo'),
        el('p', { class: 'muted' }, 'Score until your first Save or Miss.'),
        el('p', {}, 'High Score: ', el('strong', {}, String(high))),
        el('button', { class: 'primary', type: 'button', onclick: () => playSolo() }, 'Play Solo'),
      ),
      el('form', {
          class: 'card',
          onsubmit: (e: Event) => {
            e.preventDefault();
            playTwoPlayer([name1.value.trim() || 'Player 1', name2.value.trim() || 'Player 2']);
          },
        },
        el('h2', {}, 'Two-Player'),
        el('p', { class: 'muted' }, 'Five Kicks each, then Sudden Death. Pass the device between Kicks.'),
        el('div', { class: 'names' }, name1, name2),
        el('button', { class: 'primary', type: 'submit' }, 'Play Two-Player'),
      ),
      el('p', { class: 'muted small' }, 'Tap the goal to aim, then tap again to stop the Power Meter. Too much Power can fly over!'),
    ),
  );
}

// ── Pitch ────────────────────────────────────────────────────────────────

function playSolo(): void {
  playShootout(startSolo());
}

function playTwoPlayer(names: Names): void {
  playShootout(startTwoPlayer(names, coinToss(Math.random)));
}

function scoreboard(state: Shootout, high: number): HTMLElement[] {
  if (state.mode === 'solo') {
    return [
      el('div', { class: 'stat' }, 'Streak ', el('strong', {}, String(state.streak))),
      el('div', { class: 'stat' }, 'High Score ', el('strong', {}, String(Math.max(high, state.streak)))),
    ];
  }
  const finished = winner(state) !== null;
  const slots = Math.max(REGULATION_KICKS, state.kicks[0].length, state.kicks[1].length);
  return ([0, 1] as const).map((k) => {
    const markers = Array.from({ length: slots }, (_, i) => {
      const o = state.kicks[k][i];
      const [text, cls] = o === undefined ? ['•', 'pending'] : o === 'goal' ? ['✓', 'scored'] : ['✗', 'failed'];
      return el('span', { class: `marker ${cls}`, 'aria-label': o ?? 'not taken' }, text);
    });
    const current = !finished && nextKicker(state) === k ? ' current' : '';
    return el('div', { class: `row${current}` },
      el('span', { class: 'name' }, state.names[k]),
      el('span', { class: 'markers' }, ...markers),
      el('strong', { class: 'total' }, String(goals(state, k))),
    );
  });
}

function bannerText(state: Shootout): string {
  if (state.mode === 'solo') return 'Solo Shootout';
  return `${state.names[nextKicker(state)]}'s Kick${isSuddenDeath(state) ? ' · Sudden Death' : ''}`;
}

function playShootout(initial: Shootout): void {
  let state = initial;
  const high = loadHighScore();
  let phase: 'waiting' | 'aiming' | 'power' | 'flight' = 'waiting';
  let aim: Point = { x: 0, y: 0 };
  let meterStart = 0;
  let raf = 0;

  const pitch = new Pitch(onPointer);
  const banner = el('div', { class: 'banner', 'aria-live': 'polite' });
  const board = el('div', { class: `scoreboard ${state.mode}` });
  const signal = mount(
    el('main', { class: 'screen play' },
      el('header', { class: 'topbar' },
        el('button', { class: 'ghost', type: 'button', onclick: showMenu }, '✕ Menu'),
        muteButton(),
      ),
      board,
      banner,
      pitch.el,
    ),
  );
  signal.addEventListener('abort', () => cancelAnimationFrame(raf));
  document.addEventListener(
    'keydown',
    (e) => {
      if (phase === 'power' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        void strike();
      }
    },
    { signal },
  );

  const speed = () => meterSpeed(state.mode === 'solo' ? state.streak : 0);
  const meterValue = () => meterPosition((performance.now() - meterStart) / 1000, speed());

  function render(): void {
    board.replaceChildren(...scoreboard(state, high));
    banner.textContent = bannerText(state);
  }

  function beginKick(): void {
    pitch.reset();
    render();
    phase = 'aiming';
    pitch.setPrompt('Tap the goal to aim');
  }

  function tick(): void {
    pitch.setMeter(meterValue());
    raf = requestAnimationFrame(tick);
  }

  function onPointer(p: Point): void {
    if (phase === 'aiming' && isInFrame(p)) {
      aim = p;
      pitch.showAim(p);
      phase = 'power';
      meterStart = performance.now();
      pitch.setPrompt('Tap again to strike!');
      tick();
    } else if (phase === 'power') {
      void strike();
    }
  }

  async function strike(): Promise<void> {
    phase = 'flight';
    cancelAnimationFrame(raf);
    const power = meterValue();
    pitch.setMeter(power);
    pitch.setPrompt('');
    const result = resolveKick(aim, power, Math.random);
    sound.kick();
    await pitch.playKick(result);
    if (signal.aborted) return;

    if (result.outcome === 'goal') {
      sound.cheer();
      pitch.setPrompt('GOAL!', 'good');
    } else {
      sound.groan();
      pitch.setPrompt(result.outcome === 'save' ? 'SAVED!' : 'MISSED!', 'bad');
    }

    state = state.mode === 'solo' ? recordSoloKick(state, result.outcome) : recordTwoPlayerKick(state, result.outcome);
    render();
    await delay(1200, signal);
    if (signal.aborted) return;

    if (state.mode === 'solo' && state.finished) showSoloResult(state.streak);
    else if (state.mode === 'two' && winner(state) !== null) showTwoPlayerResult(state);
    else beginKick();
  }

  render();
  if (state.mode === 'two') {
    pitch.setPrompt(`🪙 ${state.names[state.first]} wins the toss and kicks first`);
    void delay(1600, signal).then(() => {
      if (!signal.aborted) beginKick();
    });
  } else {
    beginKick();
  }
}

// ── Result ───────────────────────────────────────────────────────────────

function resultScreen(body: Child[], playAgain: () => void): void {
  mount(
    el('main', { class: 'screen result' },
      el('header', { class: 'topbar end' }, muteButton()),
      el('section', { class: 'card center' }, ...body),
      el('div', { class: 'actions' },
        el('button', { class: 'primary', type: 'button', onclick: playAgain }, 'Play again'),
        el('button', { class: 'secondary', type: 'button', onclick: showMenu }, 'Menu'),
      ),
    ),
  );
}

function showSoloResult(streak: number): void {
  const previous = loadHighScore();
  const isNew = streak > previous;
  if (isNew) saveHighScore(streak);
  resultScreen(
    [
      el('h1', {}, 'Shootout over'),
      el('p', { class: 'big' }, String(streak)),
      el('p', {}, streak === 1 ? 'Goal in a row' : 'Goals in a row'),
      isNew ? el('p', { class: 'badge' }, '🏆 New High Score!') : el('p', { class: 'muted' }, `High Score: ${previous}`),
    ],
    playSolo,
  );
}

function showTwoPlayerResult(state: TwoPlayerShootout): void {
  const w = winner(state) as KickerIndex;
  const suddenDeath = state.kicks[w].length > REGULATION_KICKS;
  resultScreen(
    [
      el('h1', {}, `🏆 ${state.names[w]} wins!`),
      el('p', { class: 'big' }, `${goals(state, w)}–${goals(state, other(w))}`),
      el('p', { class: 'muted' }, suddenDeath ? 'after Sudden Death' : 'in regulation'),
    ],
    () => playTwoPlayer(state.names),
  );
}

showMenu();
