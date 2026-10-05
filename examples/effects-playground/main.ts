/// <reference lib="dom" />
/**
 * effects-playground — one page, one playground per effect, every constant
 * that shapes the effect a control beside it.
 *
 * THIS IS A DEMO for tuning how the effects feel; run it with
 * `npm run effects-playground`. It draws the real curves of
 * `../effects-feel/curves.ts` through `Effected` and the library's own HTML
 * encoder, so what moves here is what the terminal demo moves — there is no
 * port of any curve in this file.
 *
 * [LAW:one-source-of-truth] `PANELS` below is the whole of what a playground
 * is: its constants, with their defaults and ranges, and how they build the
 * effect. A control is generated from a constant; adding one is one row.
 * The defaults are the terminal demo's own (`parseSettings([])`, `DISSOLVE_SHAPE`).
 */

import { Console, EASES, Effected, type Effect, type TerminalTheme } from "../../src/index.js";
import { encodeHtmlFragment } from "../../src/core/export-html.js";
import { THEMES, LIGHTS, drawnSubject, pulsedOn, stripSubject, subjectUnder, textSubject, type DrawnSubject } from "../effects-feel/app.js";
import { DISSOLVE_SHAPE, dissolveOut, fadeIn, shimmer, sparkle, wheel, type Curve } from "../effects-feel/curves.js";
import { EFFECT_DEFAULTS } from "../effects-feel/vocabulary.js";

const DEFAULTS = Object.fromEntries(Object.entries(EFFECT_DEFAULTS).map(([name, d]) => [name, { seconds: d.seconds, swing: d.swing, easeName: d.ease }])) as Record<keyof typeof EFFECT_DEFAULTS, { seconds: number; swing: number; easeName: string }>;

// ─── The constants ────────────────────────────────────────────────

type EaseName = keyof typeof EASES;

/** One constant: a number in a range, or one of the named eases. */
type Param =
  | { readonly kind: "number"; readonly key: string; readonly label: string; readonly min: number; readonly max: number; readonly step: number; readonly value: number }
  | { readonly kind: "ease"; readonly key: string; readonly label: string; readonly value: EaseName };

type Values = Record<string, number | string>;

const n = (v: Values, key: string): number => v[key] as number;

const num = (key: string, label: string, value: number, min: number, max: number, step: number): Param => ({ kind: "number", key, label, value, min, max, step });
const ease = (value: string): Param => ({ kind: "ease", key: "ease", label: "ease", value: value as EaseName });

/** How long a loop's period or a transition's duration is: the constant every effect has. */
const seconds = (value: number, max: number): Param => num("seconds", "seconds", value, 1, max, 1);
const swing = (value: number): Param => num("swing", "swing", value, 0, 1, 0.01);
/** Designed seconds that pass in one real second: how fast the page plays the effect. */
const speed = (value: number): Param => num("speed", "time ×", value, 0.1, 400, 0.1);

interface Panel {
  readonly name: string;
  readonly blurb: string;
  /** A transition plays once and replays; a loop never ends. */
  readonly transition: boolean;
  readonly params: readonly Param[];
  readonly build: (v: Values, subject: DrawnSubject, theme: TerminalTheme) => Effect;
}

const curveOf = (v: Values): Curve => ({ seconds: n(v, "seconds"), ease: EASES[v["ease"] as EaseName], swing: n(v, "swing") });

/** A loop plays fast enough here to watch: one period in about twenty real seconds. */
const watchable = (period: number): number => Math.max(1, Math.round(period / 20));

const PANELS: readonly Panel[] = [
  {
    name: "shimmer",
    blurb: "A band of light crossing the element.",
    transition: false,
    params: [seconds(DEFAULTS.shimmer.seconds, 600), swing(DEFAULTS.shimmer.swing), ease(DEFAULTS.shimmer.easeName), num("width", "band width (cols)", 24, 2, 120, 1), speed(watchable(DEFAULTS.shimmer.seconds))],
    build: (v, s, theme) => subjectUnder(s, shimmer(curveOf(v), s.span, n(v, "width"), LIGHTS.sun, s.z), theme),
  },
  {
    name: "pulse",
    blurb: "A gentle glow on chosen elements (the strip's “ctx 61%” and “ok”), each on a time of its own.",
    transition: false,
    params: [seconds(DEFAULTS.pulse.seconds, 300), swing(DEFAULTS.pulse.swing), ease(DEFAULTS.pulse.easeName), speed(watchable(DEFAULTS.pulse.seconds))],
    build: (v, s, theme) => pulsedOn(s, curveOf(v), theme),
  },
  {
    name: "sparkle",
    blurb: "Fireflies: single cells flashing and fading.",
    transition: false,
    params: [seconds(DEFAULTS.sparkle.seconds, 600), swing(DEFAULTS.sparkle.swing), ease(DEFAULTS.sparkle.easeName), speed(watchable(DEFAULTS.sparkle.seconds))],
    build: (v, s, theme) => subjectUnder(s, sparkle(curveOf(v), s.span, LIGHTS.firefly, s.z), theme),
  },
  {
    name: "wheel",
    blurb: "Every hue turning the whole way round, each segment at its own pace.",
    transition: false,
    params: [seconds(DEFAULTS.wheel.seconds, 3600), swing(DEFAULTS.wheel.swing), ease(DEFAULTS.wheel.easeName), speed(watchable(DEFAULTS.wheel.seconds))],
    build: (v, s) => wheel(curveOf(v), s.colors, new Set(s.pairs.map(([, bg]) => bg.hex).filter((hex) => s.colors.has(hex))), s.z),
  },
  {
    name: "fade",
    blurb: "Ink blooming in water: patches surface first and the rest follows.",
    transition: true,
    params: [seconds(DEFAULTS.fade.seconds, 120), swing(DEFAULTS.fade.swing), ease(DEFAULTS.fade.easeName), num("own", "each cell takes", 0.45, 0.05, 1, 0.01), speed(1)],
    build: (v, s, theme) => fadeIn(curveOf(v), 0, s.z, theme.backgroundColor, n(v, "own")),
  },
  {
    name: "dissolve",
    blurb: "Mist lifting; near the end, patches of what is left rise back before they thin away for good.",
    transition: true,
    params: [
      seconds(DEFAULTS.dissolve.seconds, 300),
      swing(DEFAULTS.dissolve.swing),
      ease(DEFAULTS.dissolve.easeName),
      num("own", "each cell takes", DISSOLVE_SHAPE.own, 0.05, 1, 0.01),
      num("depth", "rebound depth", DISSOLVE_SHAPE.depth, 0, 1, 0.01),
      num("from", "rebound from", DISSOLVE_SHAPE.from, 0, 1, 0.01),
      num("to", "rebound to", DISSOLVE_SHAPE.to, 0, 1, 0.01),
      num("maskFrom", "rebounders: from", DISSOLVE_SHAPE.maskFrom, 0, 1, 0.01),
      num("maskTo", "rebounders: all by", DISSOLVE_SHAPE.maskTo, 0, 1, 0.01),
      num("late", "later = likelier", DISSOLVE_SHAPE.late, 0, 1, 0.01),
      speed(1),
    ],
    build: (v, s, theme) =>
      dissolveOut(curveOf(v), 0, s.z, theme.backgroundColor, {
        own: n(v, "own"),
        depth: n(v, "depth"),
        from: n(v, "from"),
        to: n(v, "to"),
        maskFrom: n(v, "maskFrom"),
        maskTo: n(v, "maskTo"),
        late: n(v, "late"),
      }),
  },
];

/** Real seconds a transition holds on its last frame before replaying. */
const HOLD = 2.5;

// ─── The page ─────────────────────────────────────────────────────

const drawnWith = new Console({ width: 200, colorSystem: "truecolor" }).options;

interface Live {
  readonly panel: Panel;
  readonly values: Values;
  readonly stage: HTMLElement[];
  readonly clock: HTMLElement;
  readonly sync: () => void;
  /** Designed seconds this panel has played. */
  time: number;
  visible: boolean;
  effects: Effect[];
  auto: boolean;
}

let theme: TerminalTheme = THEMES[0]!;
let subjects: DrawnSubject[] = [];
let paused = false;
const live: Live[] = [];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
};

function rebuild(p: Live): void {
  p.effects = subjects.map((s) => p.panel.build(p.values, s, theme));
}

function paint(p: Live): void {
  p.stage.forEach((host, i) => {
    const s = subjects[i]!;
    host.innerHTML = encodeHtmlFragment(new Effected(s.renderable, p.effects[i]!, { t: p.time, key: `${p.panel.name}:${s.name}`, theme }).render(s.options), theme);
  });
  const cycle = p.panel.transition ? ` / ${n(p.values, "seconds")}s` : "";
  p.clock.textContent = `t = ${p.time.toFixed(1)}s${cycle}`;
}

function mount(panel: Panel): Live {
  const values: Values = Object.fromEntries(panel.params.map((q) => [q.key, q.value]));
  const stage = subjects.map(() => el("div"));
  const clock = el("span", { className: "clock" });
  const syncs: (() => void)[] = [];
  const controls = el("div", { className: "controls" });
  const p: Live = { panel, values, stage, clock, sync: () => syncs.forEach((f) => f()), time: 0, visible: true, effects: [], auto: true };

  for (const q of panel.params) {
    const row = el("label", { className: "control" }, el("span", { textContent: q.label }));
    if (q.kind === "ease") {
      const select = el("select");
      for (const name of Object.keys(EASES)) select.append(el("option", { value: name, textContent: name }));
      select.addEventListener("change", () => ((values[q.key] = select.value), rebuild(p), paint(p)));
      syncs.push(() => (select.value = String(values[q.key])));
      row.append(select, el("span"));
    } else {
      const range = el("input", { type: "range", min: String(q.min), max: String(q.max), step: String(q.step) });
      const box = el("input", { type: "number", min: String(q.min), max: String(q.max), step: String(q.step) });
      const set = (value: number): void => {
        values[q.key] = value;
        range.value = box.value = String(value);
        if (q.key !== "speed") rebuild(p);
        paint(p);
      };
      range.addEventListener("input", () => set(Number(range.value)));
      box.addEventListener("change", () => Number.isFinite(box.valueAsNumber) && set(box.valueAsNumber));
      syncs.push(() => (range.value = box.value = String(values[q.key])));
      row.append(range, box);
    }
    controls.append(row);
  }

  const replay = el("button", { type: "button", textContent: panel.transition ? "Replay" : "Restart" });
  replay.addEventListener("click", () => ((p.time = 0), paint(p)));
  const reset = el("button", { type: "button", textContent: "Reset constants" });
  reset.addEventListener("click", () => {
    for (const q of panel.params) values[q.key] = q.value;
    p.sync();
    rebuild(p);
    p.time = 0;
    paint(p);
  });
  const bar = el("div", { className: "bar" }, replay, reset, clock);
  if (panel.transition) {
    const auto = el("input", { type: "checkbox", checked: true });
    auto.addEventListener("change", () => (p.auto = auto.checked));
    bar.append(el("label", { className: "check" }, auto, " replay on its own"));
  }

  const section = el("section", { id: panel.name }, el("h2", { textContent: panel.name }), el("p", { textContent: panel.blurb }), el("div", { className: "stage" }, ...stage), controls, bar);
  document.getElementById("panels")!.append(section);
  new IntersectionObserver((entries) => (p.visible = entries.at(-1)!.isIntersecting)).observe(section);
  p.sync();
  rebuild(p);
  paint(p);
  return p;
}

/** The theme everything is drawn in: the scene rebuilt, every panel's effects settled again on it. */
function show(next: TerminalTheme): void {
  theme = next;
  subjects = [stripSubject(theme), textSubject(theme, drawnWith.colorSystem!)].map((s) => drawnSubject(s, drawnWith, theme));
  document.documentElement.style.setProperty("--page-bg", theme.backgroundColor.hex);
  document.documentElement.style.setProperty("--page-fg", theme.foregroundColor.hex);
  live.forEach((p) => (rebuild(p), paint(p)));
}

/**
 * A Nerd Font for the strip's glyphs: a family installed on the viewing
 * device, or a font file loaded by URL, tried before the page's own stack.
 * Remembered per browser, so a reload keeps it.
 */
function wireFont(): void {
  const family = document.getElementById("font-family") as HTMLInputElement;
  const url = document.getElementById("font-url") as HTMLInputElement;
  const style = el("style");
  document.head.append(style);
  const saved = (key: string): string => {
    try {
      return localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  };
  const apply = (): void => {
    try {
      localStorage.setItem("effects-playground:family", family.value);
      localStorage.setItem("effects-playground:url", url.value);
    } catch {}
    const loaded = url.value.trim() === "" ? "" : `@font-face{font-family:"Playground Font";src:url(${JSON.stringify(url.value.trim())})}`;
    const names = [url.value.trim() === "" ? "" : '"Playground Font"', family.value.trim() === "" ? "" : JSON.stringify(family.value.trim())].filter(Boolean);
    style.textContent = `${loaded}:root{--rich-code-font-family:${[...names, "'Rich Powerline'", "'JetBrains Mono'", "ui-monospace", "Menlo", "monospace"].join(",")}}`;
  };
  family.value = saved("effects-playground:family");
  url.value = saved("effects-playground:url");
  family.addEventListener("change", apply);
  url.addEventListener("change", apply);
  apply();
}

function start(): void {
  subjects = [stripSubject(theme), textSubject(theme, drawnWith.colorSystem!)].map((s) => drawnSubject(s, drawnWith, theme));
  for (const panel of PANELS) live.push(mount(panel));
  const picker = document.getElementById("theme") as HTMLSelectElement;
  THEMES.forEach((t, i) => picker.append(el("option", { value: String(i), textContent: `${t.palette.name} (${t.palette.dark ? "dark" : "light"})` })));
  picker.addEventListener("change", () => show(THEMES[Number(picker.value)]!));
  (document.getElementById("paused") as HTMLInputElement).addEventListener("change", (e) => (paused = (e.target as HTMLInputElement).checked));
  show(theme);
  wireFont();

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = (now - last) / 1000;
    last = now;
    if (!paused) {
      for (const p of live) {
        if (!p.visible) continue;
        p.time += dt * (n(p.values, "speed"));
        const length = (n(p.values, "seconds")) + HOLD * (n(p.values, "speed"));
        if (p.panel.transition && p.auto && p.time > length) p.time = 0;
        paint(p);
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

start();
