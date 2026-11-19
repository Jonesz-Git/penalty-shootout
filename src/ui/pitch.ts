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
export const FLIGHT_MS = 600;

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

function diveTransform(zone: DiveZone): string {
  const centre = toSvg(diveZoneCentre(zone));
  const tilt = zone.row === 'low' ? 70 : 40;
  const rotate = zone.column === 'left' ? -tilt : zone.column === 'right' ? tilt : 0;
  return translate(centre, `rotate(${rotate}deg)`);
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

  /** Animates the ball flight and Keeper dive; resolves when both land. */
  async playKick(result: KickResult): Promise<void> {
    const landing = toSvg(result.landing);
    const ballAnim = this.ball.animate(
      [{ transform: translate(SPOT, 'scale(1)') }, { transform: translate(landing, 'scale(0.5)') }],
      { duration: FLIGHT_MS, easing: 'cubic-bezier(.15,.6,.35,1)', fill: 'forwards' },
    );
    const keeperAnim = this.keeper.animate(
      [{ transform: translate(toSvg(KEEPER_HOME)) }, { transform: diveTransform(result.diveZone) }],
      { duration: FLIGHT_MS * 0.9, delay: FLIGHT_MS * 0.1, easing: 'ease-out', fill: 'forwards' },
    );
    this.animations = [ballAnim, keeperAnim];
    try {
      await Promise.all([ballAnim.finished, keeperAnim.finished]);
    } catch {
      /* cancelled by reset() */
    }
  }
}
