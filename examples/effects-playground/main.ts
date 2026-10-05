/// <reference lib="dom" />
/**
 * effects-playground — one page, one playground per effect. Each playground
 * is the terminal demo itself: `runDemo` from `../effects-feel/app.ts`,
 * showing that one effect, on an xterm.js terminal through
 * `BrowserTerminalHost` — the renderer, the pacing and the keys are the
 * demo's, so what moves here is what moves in your terminal.
 *
 * THIS IS A DEMO for tuning how the effects feel; run it with
 * `npm run effects-playground`.
 *
 * [LAW:one-source-of-truth] `KNOBS` below is the one place a playground's
 * constants are listed; every default is read from where the demo reads it
 * (`EFFECT_DEFAULTS`, `RUN_DEFAULTS`, `FADE_SHAPE`, `DISSOLVE_SHAPE`), never
 * restated here. A change restarts that playground's run with the new
 * values, and the box under it is those values as the source spells them.
 */

import { EASES, type TerminalTheme } from "../../src/index.js";
import type { EaseName } from "../../src/core/easing.js";
import { BrowserTerminalHost, type XtermTerminal } from "../../src/host/terminal-host.js";
import { XTERM } from "../_browser-shell/xterm.js";
import { THEMES, runDemo, type DemoHandle } from "../effects-feel/app.js";
import { DISSOLVE_SHAPE, FADE_SHAPE, type DissolveShape, type FadeShape } from "../effects-feel/curves.js";
import type { NamedCurve, Settings } from "../effects-feel/settings.js";
import { EFFECTS, EFFECT_DEFAULTS, GROUNDS, RUN_DEFAULTS, type EffectName, type Ground } from "../effects-feel/vocabulary.js";

// ─── The constants ────────────────────────────────────────────────

/** A number a control sets, its range, and what it means. */
interface Knob<K extends string> {
  readonly key: K;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly means: string;
}

type CurveKey = "seconds" | "swing";

/**
 * Every constant a playground adjusts. Every effect has its curve; the
 * transitions add their shape, cell by cell.
 */
const KNOBS = {
  curve: [
    { key: "seconds", min: 1, max: 1200, step: 1, means: "a loop's period, a transition's duration" },
    { key: "swing", min: 0, max: 1, step: 0.01, means: "" },
  ] satisfies Knob<CurveKey>[],
  fade: [{ key: "own", min: 0.05, max: 1, step: 0.01, means: "of the duration, each cell's own rise" }] satisfies Knob<keyof FadeShape>[],
  dissolve: [
    { key: "own", min: 0.05, max: 1, step: 0.01, means: "of the duration, each cell's own fade" },
    { key: "depth", min: 0, max: 1, step: 0.01, means: "the most a cell rises back, of whole" },
    { key: "from", min: 0, max: 1, step: 0.01, means: "where in its fade the rising begins" },
    { key: "to", min: 0, max: 1, step: 0.01, means: "where in its fade the rising is done" },
    { key: "maskFrom", min: 0, max: 1, step: 0.01, means: "eddy noise past which a cell may rebound" },
    { key: "maskTo", min: 0, max: 1, step: 0.01, means: "eddy noise past which every cell does" },
    { key: "late", min: 0, max: 1, step: 0.01, means: "how much likelier the later a cell goes" },
  ] satisfies Knob<keyof DissolveShape>[],
} as const;

const FPS_CHOICES = [0.5, 1, 2, 5, 10, 15, 30] as const;

/** What one playground runs with: its effect's curve and, for a transition, its shape. */
interface Values {
  seconds: number;
  swing: number;
  ease: EaseName;
  fade: FadeShape;
  dissolve: DissolveShape;
}

const defaults = (effect: EffectName): Values => ({
  seconds: EFFECT_DEFAULTS[effect].seconds,
  swing: EFFECT_DEFAULTS[effect].swing,
  ease: EFFECT_DEFAULTS[effect].ease,
  fade: FADE_SHAPE,
  dissolve: DISSOLVE_SHAPE,
});

const curveOf = (seconds: number, swing: number, ease: EaseName): NamedCurve => ({ seconds, swing, ease: EASES[ease], easeName: ease });

/** The demo's settings with `effect` alone on show, at `values`; the rest at the demo's defaults. */
function settingsFor(effect: EffectName, values: Values, page: Page): Settings {
  const curves = Object.fromEntries(EFFECTS.map((e) => [e, curveOf(EFFECT_DEFAULTS[e].seconds, EFFECT_DEFAULTS[e].swing, EFFECT_DEFAULTS[e].ease)])) as Record<EffectName, NamedCurve>;
  return {
    fps: page.fps,
    // xterm.js draws 24-bit colour, and `runDemo` refuses a depth its host does not draw.
    depth: "truecolor",
    ground: page.ground,
    curves: { ...curves, [effect]: curveOf(values.seconds, values.swing, values.ease) },
    effects: [effect],
    shapes: { fade: values.fade, dissolve: values.dissolve },
  };
}

/** `values` as the source spells them, to paste back where the defaults live. */
function asSource(effect: EffectName, values: Values): string {
  const curve = `${effect}: { seconds: ${values.seconds}, ease: "${values.ease}", swing: ${values.swing} }   // vocabulary.ts EFFECT_DEFAULTS`;
  const shape =
    effect === "fade" ? `\nFADE_SHAPE = ${JSON.stringify(values.fade)}   // curves.ts`
    : effect === "dissolve" ? `\nDISSOLVE_SHAPE = ${JSON.stringify(values.dissolve)}   // curves.ts`
    : "";
  return (curve + shape).replaceAll(/"(\w+)":/g, "$1: ").replaceAll(/,(?! )/g, ", ");
}

// ─── The terminals ────────────────────────────────────────────────

/** What a playground's terminal is drawn at: the whole of the demo's view of one effect. */
const TERMINAL = { cols: 132, rows: 9 } as const;

/** The part of xterm.js's `Terminal` this page uses, beyond what the host does. */
interface Xterm extends XtermTerminal {
  open(element: HTMLElement): void;
  reset(): void;
  options: { fontFamily: string; theme: Record<string, string> };
}
type XtermConstructor = new (options: Record<string, unknown>) => Xterm;

/** xterm.js from the site's one pin. */
function loadXterm(): Promise<XtermConstructor> {
  return new Promise((resolve, reject) => {
    const link = Object.assign(document.createElement("link"), { rel: "stylesheet", crossOrigin: "anonymous", ...XTERM.stylesheet });
    const script = Object.assign(document.createElement("script"), { crossOrigin: "anonymous", ...XTERM.script });
    script.onload = () => resolve((globalThis as unknown as { Terminal: XtermConstructor }).Terminal);
    script.onerror = () => reject(new Error(`xterm.js did not load from ${XTERM.script.src}`));
    document.head.append(link, script);
  });
}

/** The theme a run on `ground` starts in, as `runDemo` picks it, so the terminal's own ground matches. */
const startTheme = (ground: Ground): TerminalTheme => THEMES.find((theme) => theme.palette.dark === (ground === "dark"))!;

const fontFamily = (): string => getComputedStyle(document.documentElement).getPropertyValue("--rich-code-font-family");

// ─── The page ─────────────────────────────────────────────────────

interface Page {
  fps: number;
  ground: Ground;
}

interface Playground {
  readonly term: Xterm;
  /** Starts the run over with the page's and this playground's values as they are now. */
  restart(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function numberControl(label: string, knob: Knob<string>, value: number, set: (v: number) => void): HTMLElement {
  const range = el("input", { type: "range", min: String(knob.min), max: String(knob.max), step: String(knob.step), value: String(value), title: knob.means });
  const box = el("input", { type: "number", min: String(knob.min), max: String(knob.max), step: String(knob.step), value: String(value) });
  range.addEventListener("input", () => (box.value = range.value));
  range.addEventListener("change", () => set(Number(range.value)));
  box.addEventListener("change", () => {
    range.value = box.value;
    set(Number(box.value));
  });
  return el("label", { className: "control", title: knob.means }, el("span", {}, label), range, box);
}

const BLURBS: Record<EffectName, string> = {
  shimmer: "A band of light crossing the element.",
  pulse: "A gentle glow on chosen elements (the strip's “ctx 61%” and “ok”), each on a time of its own.",
  sparkle: "Fireflies: single cells flashing and fading.",
  wheel: "Every segment's hue turning, each at its own pace.",
  fade: "Fade-in, as ink blooming in water.",
  dissolve: "Dissolve-out, as mist lifting; patches of what is left eddy back before they go.",
};

function playground(Terminal: XtermConstructor, effect: EffectName, page: Page): { section: HTMLElement; playground: Playground } {
  let values = defaults(effect);
  const holder = el("div", { className: "term" });
  const status = el("span", { className: "status" });
  const source = el("pre", { className: "values" });
  const controls = el("div", { className: "controls" });
  const term = new Terminal({ ...TERMINAL, fontFamily: fontFamily(), theme: { background: startTheme(page.ground).backgroundColor.hex } });
  term.open(holder);
  const host = new BrowserTerminalHost({ terminal: term });

  // [LAW:no-ambient-temporal-coupling] Runs are chained: a run starts only
  // once the one before it has handed the terminal back, however fast the
  // controls change.
  let run: DemoHandle | undefined;
  let chain = Promise.resolve();
  const report = (error: unknown): void => {
    status.textContent = `stopped: ${error instanceof Error ? error.message : String(error)}`;
    status.className = "status err";
    console.error(error);
  };
  const restart = (): void => {
    chain = chain.then(async () => {
      run?.stop();
      await run?.done.catch(report);
      term.reset();
      term.options.theme = { background: startTheme(page.ground).backgroundColor.hex };
      source.textContent = asSource(effect, values);
      status.textContent = "running — click the terminal for its keys";
      status.className = "status";
      run = runDemo(host, settingsFor(effect, values, page));
      run.done.catch(report);
    }).catch(report);
  };
  const set = (next: Partial<Values>): void => {
    values = { ...values, ...next };
    restart();
  };

  const draw = (): void => {
    const ease = el("select", {}, ...Object.keys(EASES).map((name) => el("option", { value: name, textContent: name, selected: name === values.ease })));
    ease.addEventListener("change", () => set({ ease: ease.value as EaseName }));
    const shape =
      effect === "fade" ? KNOBS.fade.map((k) => numberControl(k.key, k, values.fade[k.key], (v) => set({ fade: { ...values.fade, [k.key]: v } })))
      : effect === "dissolve" ? KNOBS.dissolve.map((k) => numberControl(k.key, k, values.dissolve[k.key], (v) => set({ dissolve: { ...values.dissolve, [k.key]: v } })))
      : [];
    controls.replaceChildren(
      ...KNOBS.curve.map((k) => numberControl(k.key, { ...k, means: k.key === "swing" ? EFFECT_DEFAULTS[effect].unit : k.means }, values[k.key], (v) => set({ [k.key]: v }))),
      el("label", { className: "control" }, el("span", {}, "ease"), ease),
      ...shape,
    );
  };
  draw();

  const replay = el("button", { textContent: "Restart" });
  replay.addEventListener("click", restart);
  const reset = el("button", { textContent: "Demo defaults" });
  reset.addEventListener("click", () => {
    values = defaults(effect);
    draw();
    restart();
  });

  const section = el(
    "section",
    {},
    el("h2", {}, effect),
    el("p", {}, BLURBS[effect]),
    holder,
    controls,
    el("div", { className: "bar" }, replay, reset, status),
    source,
  );
  return { section, playground: { term, restart } };
}

/** The font controls: a family installed on this machine, or a font file by URL, ahead of the docs' stack. */
function wireFont(playgrounds: readonly Playground[]): void {
  const family = document.getElementById("font-family") as HTMLInputElement;
  const url = document.getElementById("font-url") as HTMLInputElement;
  const style = el("style");
  document.head.append(style);
  const stack = getComputedStyle(document.documentElement).getPropertyValue("--rich-code-font-family");
  const apply = async (): Promise<void> => {
    const file = url.value.trim();
    const named = family.value.trim();
    const loaded = file === "" ? "" : `@font-face{font-family:"Playground Font";src:url(${JSON.stringify(file)})}`;
    const first = [file === "" ? "" : '"Playground Font"', named === "" ? "" : JSON.stringify(named)].filter((name) => name !== "");
    style.textContent = `${loaded}:root{--rich-code-font-family:${[...first, stack].join(",")}}`;
    // xterm measures its cell once, from a face that has to be loaded by then.
    await document.fonts.load(`15px ${fontFamily()}`);
    for (const p of playgrounds) p.term.options.fontFamily = fontFamily();
  };
  family.addEventListener("change", () => void apply());
  url.addEventListener("change", () => void apply());
}

async function start(): Promise<void> {
  const page: Page = { fps: RUN_DEFAULTS.fps, ground: RUN_DEFAULTS.ground };
  const Terminal = await loadXterm();
  await document.fonts.load(`15px ${fontFamily()}`);
  const made = EFFECTS.map((effect) => playground(Terminal, effect, page));
  document.getElementById("panels")!.append(...made.map((m) => m.section));
  const playgrounds = made.map((m) => m.playground);

  const ground = document.getElementById("ground") as HTMLSelectElement;
  ground.append(...GROUNDS.map((g) => el("option", { value: g, textContent: g, selected: g === page.ground })));
  ground.addEventListener("change", () => {
    page.ground = ground.value as Ground;
    for (const p of playgrounds) p.restart();
  });
  const fps = document.getElementById("fps") as HTMLSelectElement;
  fps.append(...FPS_CHOICES.map((f) => el("option", { value: String(f), textContent: String(f), selected: f === page.fps })));
  fps.addEventListener("change", () => {
    page.fps = Number(fps.value);
    for (const p of playgrounds) p.restart();
  });
  wireFont(playgrounds);
  for (const p of playgrounds) p.restart();
}

start().catch((error: unknown) => {
  document.body.prepend(el("p", { className: "status err", textContent: `the playground did not start: ${String(error)}` }));
  console.error(error);
});
