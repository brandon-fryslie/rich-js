/// <reference lib="dom" />
/// <reference path="../../docs/.vitepress/theme/live-runtime.d.ts" />
/// <reference path="./virtual.d.ts" />
/// <reference types="vite/client" />
/**
 * effects-playground — one page, one playground per effect: the effect's
 * code in an editor, sliders over the values in it, and the docs' live
 * terminal running it.
 *
 * THIS IS A DEMO for tuning how the effects feel; run it with
 * `npm run effects-playground`.
 *
 * Each program opens as the demo's own code (programs.ts) and runs as the
 * docs' playground runs a visitor's (theme/playground-program.ts), on the
 * live library with `effects-kit` added. [LAW:single-enforcer] Every change
 * is an edit to the program: typing is one, a slider is another
 * (tunables.ts), so there is one path from a change to the terminal.
 * An edit does not restart the program: it reaches the one running (edits.ts).
 * Only Restart, or a program that has ended, starts one afresh.
 */

import { library, programs } from "virtual:effects-playground";
import runtime from "virtual:rich-live/runtime";
import { LiveTerminal, elementFont, type LiveState } from "../../docs/.vitepress/theme/live-terminal.js";
import { createEditor } from "../../docs/.vitepress/theme/playground-editor.js";
import { EASES, type TerminalTheme } from "../../src/index.js";
import { THEMES } from "../effects-feel/app.js";
import { DEPTHS, EFFECTS, type EffectName } from "../effects-feel/vocabulary.js";
import { CONTROL_DEFAULTS, SLIDERS, type Controls } from "./controls.js";
import { edit, started, told } from "./edits.js";
import { SAID_EVENT, type Said } from "./mirror.js";
import { range, spelled, tunables, type Tunable } from "./tunables.js";

/** The terminal a program runs in: room for the demo's strip and status line, padded, under a heading. */
const TERMINAL = { columns: 108, rows: 6, isTTY: true, env: { TERM: "xterm-256color", COLORTERM: "truecolor" } } as const;

/** How long editing must pause before the edit reaches the program. */
const RUN_AFTER_MS = 150;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const STATE_TEXT: Record<LiveState["kind"], string> = { idle: "", running: "running", still: "still", stopped: "stopped", exited: "ended" };

/** A control over one tunable: it shows the value the program holds, and `set` writes one into it. */
interface Control {
  readonly element: HTMLElement;
  show(tunable: Tunable): void;
}

function control(first: Tunable, set: (name: string, spelling: string) => void): Control {
  const label = el("span", { textContent: first.name, title: first.name });
  if (first.kind === "ease") {
    const select = el("select", {}, ...Object.keys(EASES).map((name) => el("option", { value: name, textContent: name })));
    select.addEventListener("change", () => set(first.name, select.value));
    return { element: el("label", { className: "control" }, label, select), show: (t) => void (select.value = String(t.value)) };
  }
  const { min, max, step } = range(first.value);
  const slider = el("input", { type: "range", min: String(min), max: String(max), step: String(step) });
  const box = el("input", { type: "number", step: String(step) });
  slider.addEventListener("input", () => set(first.name, spelled(Number(slider.value))));
  box.addEventListener("change", () => set(first.name, spelled(Number(box.value))));
  return {
    element: el("label", { className: "control" }, label, slider, box),
    show: (t) => {
      slider.value = String(t.value);
      // The box is left alone while it is being typed in.
      if (document.activeElement !== box) box.value = String(t.value);
    },
  };
}

/** A playground's terminal refits to its element's font, when the font controls change it. */
const refits: (() => void)[] = [];

/** The run controls every playground plays under, as the demo's one screen does; set only by `setControls`. */
let controls: Controls = CONTROL_DEFAULTS;
/** What each playground does when the run controls change. */
const followers: ((controls: Controls) => void)[] = [];

const themeNamed = (name: string): TerminalTheme => THEMES.find((t) => t.palette.name === name)!;

/** Tell the dev server what the page did, for the terminals playing beside it (mirror.ts). */
function say(said: Said): void {
  import.meta.hot?.send(SAID_EVENT, said);
}

function setControls(next: Controls): void {
  controls = next;
  for (const follow of followers) follow(next);
  say({ kind: "controls", controls: next });
}

/** The demo's transitions, which its `f` and `d` keys replay. */
const TRANSITIONS: readonly EffectName[] = ["fade", "dissolve"];

async function playground(effect: EffectName, parent: HTMLElement): Promise<void> {
  const screen = el("div", { className: "term" });
  const editorParent = el("div", { className: "editor" });
  const sliders = el("div", { className: "sliders" });
  const state = el("span", { className: "state" });
  const restartButton = el("button", { textContent: "Restart", title: "Start the program afresh, its clock from 0" });
  const replayButton = el("button", { textContent: "Replay", title: "Replay the transition from now, as the demo's f and d keys do" });
  const reset = el("button", { textContent: "Demo's code" });
  const buttons = TRANSITIONS.includes(effect) ? [replayButton, restartButton, reset] : [restartButton, reset];
  parent.append(
    el(
      "section",
      {},
      el("div", { className: "bar" }, el("h2", { textContent: effect }), state, ...buttons),
      screen,
      el("div", { className: "panes" }, editorParent, sliders),
    ),
  );

  // Every colour as the effect draws it: a cell fading into the ground is
  // meant to lose its contrast, and the docs' floor would draw it readable.
  const live = await LiveTerminal.create(screen, { runtime, terminal: TERMINAL, theme: themeNamed(controls.theme), font: elementFont(screen), minimumContrast: 1 });
  let running = false;
  live.onState((s) => {
    running = s.kind === "running";
    state.textContent = STATE_TEXT[s.kind];
    state.className = `state ${s.kind}`;
  });
  refits.push(() => live.setFont(elementFont(screen)));
  followers.push((next) => {
    live.setTheme(themeNamed(next.theme));
    live.type(told({ kind: "controls", controls: next }));
  });
  replayButton.addEventListener("click", () => {
    live.type(told({ kind: "replay", scene: effect }));
    say({ kind: "replay", effect });
  });

  const shown = new Map<string, Control>();
  // [LAW:no-ambient-temporal-coupling] The editor's text is read when the
  // pause ends, so a run is always of the program as it stands then.
  let pending: ReturnType<typeof setTimeout> | undefined;
  const restart = (): void => {
    clearTimeout(pending);
    const source = editor.state.doc.toString();
    live.run(started(source, library, controls), "live");
    say({ kind: "restart", effect, source });
  };
  const apply = (): void => {
    if (!running) return restart();
    const source = editor.state.doc.toString();
    live.type(edit(source));
    say({ kind: "source", effect, source });
  };
  // A slider's value is written over its literal, found afresh in the text as it is now.
  const write = (name: string, spelling: string): void => {
    const at = tunables(editor.state.doc.toString()).find((t) => t.name === name);
    if (at !== undefined) editor.dispatch({ changes: { from: at.from, to: at.to, insert: spelling } });
  };
  const reconcile = (source: string): void => {
    const found = tunables(source);
    if (found.map((t) => t.name).join() !== [...shown.keys()].join()) {
      shown.clear();
      for (const t of found) shown.set(t.name, control(t, write));
      sliders.replaceChildren(...[...shown.values()].map((c) => c.element));
    }
    for (const t of found) shown.get(t.name)!.show(t);
  };
  const changed = (source: string): void => {
    reconcile(source);
    clearTimeout(pending);
    pending = setTimeout(apply, RUN_AFTER_MS);
  };
  const editor = createEditor(editorParent, programs[effect], { change: changed, run: restart });
  restartButton.addEventListener("click", restart);
  reset.addEventListener("click", () => editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: programs[effect] } }));
  reconcile(programs[effect]);
  restart();
}

/** The font controls: a family installed on this machine, or a font file by URL, ahead of the docs' stack. */
function wireFont(): void {
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
    // xterm measures its cell from a face that has to be loaded by then.
    await document.fonts.load(`14px ${getComputedStyle(document.documentElement).getPropertyValue("--rich-code-font-family")}`);
    for (const refit of refits) refit();
  };
  family.addEventListener("change", () => void apply());
  url.addEventListener("change", () => void apply());
}

/** The run controls, as the demo names them: a slider for each number (controls.ts), a list for the theme and the depth. */
function wireControls(): void {
  const slider = (key: keyof typeof SLIDERS, label: string): HTMLElement => {
    const { min, max, step } = SLIDERS[key];
    const input = el("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(controls[key]) });
    const shown = el("output", { textContent: String(controls[key]) });
    input.addEventListener("input", () => {
      shown.textContent = input.value;
      setControls({ ...controls, [key]: Number(input.value) });
    });
    return el("label", { className: "run-slider" }, `${label} `, input, shown);
  };
  const list = <K extends "theme" | "depth">(key: K, label: string, values: readonly Controls[K][]): HTMLElement => {
    const select = el("select", {}, ...values.map((value) => el("option", { value, textContent: value })));
    select.value = controls[key];
    select.addEventListener("change", () => setControls({ ...controls, [key]: values.find((v) => v === select.value)! }));
    return el("label", {}, `${label} `, select);
  };
  document.getElementById("run-controls")!.replaceChildren(
    slider("fps", "fps"),
    slider("rate", "rate ×"),
    slider("magnitude", "magnitude ×"),
    list("theme", "theme", THEMES.map((t) => t.palette.name)),
    list("depth", "depth", DEPTHS),
  );
}

const panels = document.getElementById("panels")!;
wireFont();
wireControls();
for (const effect of EFFECTS) {
  playground(effect, panels).catch((error: unknown) => {
    panels.append(el("p", { className: "state exited", textContent: `${effect}: the playground did not start: ${String(error)}` }));
    console.error(error);
  });
}
