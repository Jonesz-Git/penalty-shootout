/** The Pitch view: goal, Keeper, ball, Aim Point marker and Power Meter. Draws what the rules decide. */
import {
  diveZoneCentre,
  GOAL_HEIGHT,
  GOAL_WIDTH,
  OVERHIT_FROM,
  WEAK_LIMIT,
  type DiveZone,
  type KickResult,
  type Point,
} from '../rules/kick';

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW_W = 400;
const VIEW_H = 320;
const GOAL_LEFT = 40;
const GOAL_RIGHT = 360;
const GOAL_GROUND = 190;
const SCALE = (GOAL_RIGHT - GOAL_LEFT) / GOAL_WIDTH; // svg units per metre
const GOAL_TOP = GOAL_GROUND - GOAL_HEIGHT * SCALE;
const SPOT = { x: VIEW_W / 2, y: 292 };
const KEEPER_HOME: Point = { x: GOAL_WIDTH / 2, y: 0.95 };
/** Glove centres in the Keeper's own drawing coordinates (see the keeper group below). */
const GLOVES = [
  { x: -36, y: -26 },
  { x: 36, y: -26 },
] as const;
export const FLIGHT_MS = 600;
export const REBOUND_MS = 320;

function toSvg(p: Point): { x: number; y: number } {
  return { x: GOAL_LEFT + p.x * SCALE, y: GOAL_GROUND - p.y * SCALE };
}

function fromSvg(x: number, y: number): Point {
  return { x: (x - GOAL_LEFT) / SCALE, y: (GOAL_GROUND - y) / SCALE };
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  ...children: SVGElement[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...children);
  return el;
}

function translate(p: { x: number; y: number }, extra = ''): string {
  return `translate(${p.x}px, ${p.y}px) ${extra}`.trim();
}

type Vec = { x: number; y: number };

function diveRotation(zone: DiveZone): number {
  const tilt = zone.row === 'low' ? 70 : 40;
  return zone.column === 'left' ? -tilt : zone.column === 'right' ? tilt : 0;
}

/** Rotates a vector clockwise by `deg` (screen coordinates, y down) — matches CSS rotate(). */
function rotateVec(v: Vec, deg: number): Vec {
  const r = (deg * Math.PI) / 180;
  return { x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) };
}

function normalise(v: Vec, fallback: Vec): Vec {
  const len = Math.hypot(v.x, v.y);
  return len < 1e-6 ? fallback : { x: v.x / len, y: v.y / len };
}

interface KeeperPose {
  /** Keeper's centre in svg units. */
  at: Vec;
  rotate: number;
}

/**
 * Where the Keeper ends his dive. On a Save he stretches so the glove pointing
 * most towards the ball meets it; otherwise he lands on his Dive Zone centre.
 * Presentation only — the rules already decided the Outcome.
 */
function keeperPose(result: KickResult): KeeperPose {
  const centre = toSvg(diveZoneCentre(result.diveZone));
  const rotate = diveRotation(result.diveZone);
  if (result.outcome !== 'save') return { at: centre, rotate };

  const ball = toSvg(result.landing);
  const sideways = result.diveZone.column === 'left' ? -1 : result.diveZone.column === 'right' ? 1 : 0;
  const towardsBall = normalise({ x: ball.x - centre.x, y: ball.y - centre.y }, { x: sideways, y: -1 });
  const reach = (g: Vec) => g.x * towardsBall.x + g.y * towardsBall.y;
  const [a, b] = GLOVES.map((g) => rotateVec(g, rotate));
  const glove = reach(b) > reach(a) ? b : a;
  return { at: { x: ball.x - glove.x, y: Math.min(ball.y - glove.y, GOAL_GROUND - 12) }, rotate };
}

function poseTransform(pose: KeeperPose): string {
  return translate(pose.at, `rotate(${pose.rotate}deg)`);
}

export class Pitch {
  readonly el: HTMLElement;
  private readonly svgEl: SVGSVGElement;
  private readonly keeper: SVGGElement;
  private readonly ball: SVGGElement;
  private readonly aimMarker: SVGGElement;
  private readonly meter: HTMLElement;
  private readonly needle: HTMLElement;
  private readonly prompt: HTMLElement;
  private animations: Animation[] = [];

  /** `onPointer` receives the tapped point in goal metres (may be outside the frame). */
  constructor(onPointer: (p: Point) => void) {
    this.el = document.createElement('div');
    this.el.className = 'pitch';

    const stripes: SVGElement[] = [];
    for (let i = 0; i < 8; i++) {
      stripes.push(svg('rect', { x: 0, y: 130 + i * 25, width: VIEW_W, height: 25, class: i % 2 ? 'grass-b' : 'grass-a' }));
    }

    const netLines: SVGElement[] = [];
    for (let x = GOAL_LEFT; x <= GOAL_RIGHT; x += 16) {
      netLines.push(svg('line', { x1: x, y1: GOAL_TOP, x2: x, y2: GOAL_GROUND, class: 'net' }));
    }
    for (let y = GOAL_TOP; y <= GOAL_GROUND; y += 16) {
      netLines.push(svg('line', { x1: GOAL_LEFT, y1: y, x2: GOAL_RIGHT, y2: y, class: 'net' }));
    }

    this.keeper = svg(
      'g',
      { class: 'keeper' },
      svg('rect', { x: -34, y: -30, width: 68, height: 9, rx: 4, class: 'kit' }), // arms
      svg('circle', { cx: -36, cy: -26, r: 6, class: 'glove' }),
      svg('circle', { cx: 36, cy: -26, r: 6, class: 'glove' }),
      svg('rect', { x: -12, y: -32, width: 24, height: 38, rx: 5, class: 'kit' }), // torso
      svg('rect', { x: -11, y: 4, width: 9, height: 32, rx: 3, class: 'shorts' }),
      svg('rect', { x: 2, y: 4, width: 9, height: 32, rx: 3, class: 'shorts' }),
      svg('circle', { cx: 0, cy: -42, r: 9, class: 'skin' }),
    );

    this.aimMarker = svg(
      'g',
      { class: 'aim' },
      svg('circle', { r: 9 }),
      svg('line', { x1: -14, y1: 0, x2: 14, y2: 0 }),
      svg('line', { x1: 0, y1: -14, x2: 0, y2: 14 }),
    );

    this.ball = svg(
      'g',
      { class: 'ball' },
      svg('circle', { r: 11, class: 'ball-body' }),
      svg('path', { d: 'M0,-4 L3.8,-1.2 L2.4,3.2 L-2.4,3.2 L-3.8,-1.2 Z', class: 'ball-patch' }),
    );

    this.svgEl = svg(
      'svg',
      { viewBox: `0 0 ${VIEW_W} ${VIEW_H}`, role: 'img', 'aria-label': 'Goal and goalkeeper' },
      svg('rect', { x: 0, y: 0, width: VIEW_W, height: 130, class: 'stands' }),
      ...stripes,
      svg('rect', { x: GOAL_LEFT, y: GOAL_TOP, width: GOAL_RIGHT - GOAL_LEFT, height: GOAL_GROUND - GOAL_TOP, class: 'net-back' }),
      ...netLines,
      svg('line', { x1: 10, y1: GOAL_GROUND, x2: VIEW_W - 10, y2: GOAL_GROUND, class: 'line' }),
      svg('circle', { cx: SPOT.x, cy: SPOT.y, r: 3, class: 'spot' }),
      this.keeper,
      svg('path', {
        d: `M${GOAL_LEFT},${GOAL_GROUND} V${GOAL_TOP} H${GOAL_RIGHT} V${GOAL_GROUND}`,
        class: 'frame',
      }),
      this.aimMarker,
      this.ball,
    );

    this.svgEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const ctm = this.svgEl.getScreenCTM();
      if (!ctm) return;
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      onPointer(fromSvg(pt.x, pt.y));
    });

    this.prompt = document.createElement('div');
    this.prompt.className = 'prompt';

    this.meter = document.createElement('div');
    this.meter.className = 'meter';
    this.meter.style.setProperty('--weak-pct', `${WEAK_LIMIT * 100}%`);
    this.meter.style.setProperty('--overhit-pct', `${OVERHIT_FROM * 100}%`);
    this.needle = document.createElement('div');
    this.needle.className = 'needle';
    this.meter.append(this.needle);

    const stage = document.createElement('div');
    stage.className = 'stage';
    stage.append(this.svgEl, this.prompt);
    this.el.append(stage, this.meter);
    this.reset();
  }

  /** Ball back on the spot, Keeper in the middle, no aim, Meter idle. */
  reset(): void {
    for (const a of this.animations) a.cancel();
    this.animations = [];
    this.keeper.style.transform = translate(toSvg(KEEPER_HOME));
    this.ball.style.transform = translate(SPOT);
    this.aimMarker.style.display = 'none';
    this.setMeter(null);
  }

  showAim(p: Point): void {
    this.aimMarker.style.transform = translate(toSvg(p));
    this.aimMarker.style.display = '';
  }

  /** Needle position in [0, 1], or null to show an idle Meter. */
  setMeter(value: number | null): void {
    this.meter.classList.toggle('active', value !== null);
    this.needle.style.left = `${(value ?? 0) * 100}%`;
  }

  setPrompt(text: string, tone: 'info' | 'good' | 'bad' = 'info'): void {
    this.prompt.textContent = text;
    this.prompt.dataset.tone = tone;
  }

  /**
   * Animates the ball flight and Keeper dive; resolves when the ball reaches the goal.
   * On a Save the ball then rebounds off the Keeper — that continues after this resolves,
   * so the Outcome can be announced as the rebound starts.
   */
  async playKick(result: KickResult): Promise<void> {
    const landing = toSvg(result.landing);
    const pose = keeperPose(result);
    const ballAnim = this.ball.animate(
      [{ transform: translate(SPOT, 'scale(1)') }, { transform: translate(landing, 'scale(0.5)') }],
      { duration: FLIGHT_MS, easing: 'cubic-bezier(.15,.6,.35,1)', fill: 'forwards' },
    );
    const keeperAnim = this.keeper.animate(
      [{ transform: translate(toSvg(KEEPER_HOME)) }, { transform: poseTransform(pose) }],
      { duration: FLIGHT_MS * 0.9, delay: FLIGHT_MS * 0.1, easing: 'ease-out', fill: 'forwards' },
    );
    this.animations = [ballAnim, keeperAnim];
    try {
      await Promise.all([ballAnim.finished, keeperAnim.finished]);
    } catch {
      return; // cancelled by reset()
    }
    if (result.outcome === 'save') this.rebound(landing, pose.at);
  }

  /** Knocks the ball away from the Keeper's body and down towards the pitch. */
  private rebound(from: Vec, keeperAt: Vec): void {
    const away = normalise({ x: from.x - keeperAt.x, y: from.y - keeperAt.y }, { x: 0, y: 1 });
    const clampX = (x: number) => Math.min(VIEW_W - 12, Math.max(12, x));
    const clampY = (y: number) => Math.min(VIEW_H - 12, Math.max(12, y));
    const peak = { x: clampX(from.x + away.x * 40), y: clampY(from.y + away.y * 40 - 10) };
    const end = { x: clampX(from.x + away.x * 70), y: clampY(from.y + away.y * 30 + 70) };
    const anim = this.ball.animate(
      [
        { transform: translate(from, 'scale(0.5)') },
        { transform: translate(peak, 'scale(0.55)'), offset: 0.4 },
        { transform: translate(end, 'scale(0.65)') },
      ],
      { duration: REBOUND_MS, easing: 'ease-out', fill: 'forwards' },
    );
    this.animations.push(anim);
  }
}
