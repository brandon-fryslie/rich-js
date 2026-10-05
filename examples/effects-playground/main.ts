/// <reference lib="dom" />
/// <reference path="../../docs/.vitepress/theme/live-runtime.d.ts" />
/// <reference path="./virtual.d.ts" />
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
 * live library with `effects-kit` added. [LAW:single-enforcer] Every run
 * starts from an edit to the program: typing is one, a slider is another
 * (tunables.ts), so there is one path from a change to the terminal.
 */

import { library, programs } from "virtual:effects-playground";
import runtime from "virtual:rich-live/runtime";
import { LiveTerminal, elementFont, type LiveState } from "../../docs/.vitepress/theme/live-terminal.js";
import { createEditor } from "../../docs/.vitepress/theme/playground-editor.js";
import { playgroundScript } from "../../docs/.vitepress/theme/playground-program.js";
import { EASES } from "../../src/index.js";
import { THEMES } from "../effects-feel/app.js";
import { EFFECTS, RUN_DEFAULTS, type EffectName } from "../effects-feel/vocabulary.js";
import { range, spelled, tunables, type Tunable } from "./tunables.js";

/** The terminal a program runs in: room for the demo's strip and status line, padded, under a heading. */
const TERMINAL = { columns: 108, rows: 6, isTTY: true, env: { TERM: "xterm-256color", COLORTERM: "truecolor" } } as const;

/** The theme the kit draws in (kit.ts `play`), so the terminal's own ground matches it. */
const THEME = THEMES.find((t) => t.palette.dark === (RUN_DEFAULTS.ground === "dark"))!;

/** How long editing must pause before the program runs again. */
const RUN_AFTER_MS = 300;

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

async function playground(effect: EffectName, parent: HTMLElement): Promise<void> {
  const screen = el("div", { className: "term" });
  const editorParent = el("div", { className: "editor" });
  const sliders = el("div", { className: "sliders" });
  const state = el("span", { className: "state" });
  const restart = el("button", { textContent: "Restart" });
  const reset = el("button", { textContent: "Demo's code" });
  parent.append(
    el(
      "section",
      {},
      el("div", { className: "bar" }, el("h2", { textContent: effect }), state, restart, reset),
      screen,
      el("div", { className: "panes" }, editorParent, sliders),
    ),
  );

  const live = await LiveTerminal.create(screen, { runtime, terminal: TERMINAL, theme: THEME, font: elementFont(screen) });
  live.onState((s) => {
    state.textContent = STATE_TEXT[s.kind];
    state.className = `state ${s.kind}`;
  });
  refits.push(() => live.setFont(elementFont(screen)));

  const controls = new Map<string, Control>();
  // [LAW:no-ambient-temporal-coupling] The editor's text is read when the
  // pause ends, so a run is always of the program as it stands then.
  let pending: ReturnType<typeof setTimeout> | undefined;
  const run = (): void => {
    clearTimeout(pending);
    live.run(playgroundScript(editor.state.doc.toString(), library), "live");
  };
  // A slider's value is written over its literal, found afresh in the text as it is now.
  const write = (name: string, spelling: string): void => {
    const at = tunables(editor.state.doc.toString()).find((t) => t.name === name);
    if (at !== undefined) editor.dispatch({ changes: { from: at.from, to: at.to, insert: spelling } });
  };
  const reconcile = (source: string): void => {
    const found = tunables(source);
    if (found.map((t) => t.name).join() !== [...controls.keys()].join()) {
      controls.clear();
      for (const t of found) controls.set(t.name, control(t, write));
      sliders.replaceChildren(...[...controls.values()].map((c) => c.element));
    }
    for (const t of found) controls.get(t.name)!.show(t);
  };
  const changed = (source: string): void => {
    reconcile(source);
    clearTimeout(pending);
    pending = setTimeout(run, RUN_AFTER_MS);
  };
  const editor = createEditor(editorParent, programs[effect], { change: changed, run });
  restart.addEventListener("click", run);
  reset.addEventListener("click", () => editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: programs[effect] } }));
  reconcile(programs[effect]);
  run();
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

const panels = document.getElementById("panels")!;
wireFont();
for (const effect of EFFECTS) {
  playground(effect, panels).catch((error: unknown) => {
    panels.append(el("p", { className: "state exited", textContent: `${effect}: the playground did not start: ${String(error)}` }));
    console.error(error);
  });
}
