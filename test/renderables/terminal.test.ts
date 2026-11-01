/**
 * The terminal a frame is drawn on travels with the frame.
 *
 * [LAW:behavior-not-structure] What is asserted is what an effect is handed, read
 * from a container written here and not imported from the library, on every road
 * a frame takes to a terminal, and the bytes a renderable that reads it writes.
 */

import { describe, expect, it } from "vitest";

import { Animation } from "../../src/core/animation.js";
import { ColorDepth, resolveTerminal, type TerminalColors } from "../../src/core/color.js";
import { Console } from "../../src/core/console.js";
import { EASES } from "../../src/core/easing.js";
import { render, type Renderable } from "../../src/core/protocol.js";
import { renderToString } from "../../src/core/render.js";
import { RichText } from "../../src/core/text.js";
import { App } from "../../src/host/app.js";
import { crossfade } from "../../src/renderables/change.js";
import { Effected, type Effect, type EffectFrame } from "../../src/renderables/effect.js";
import { fadeIn } from "../../src/renderables/effects.js";
import { Group } from "../../src/renderables/group.js";
import { lifecycle, throughColors } from "../../src/renderables/lifecycle.js";
import { Panel } from "../../src/renderables/panel.js";
import { ProgressBar } from "../../src/renderables/progressBar.js";
import { CATPPUCCIN_LATTE, CATPPUCCIN_MOCHA, SOLARIZED_LIGHT } from "../../src/themes/terminalThemes.js";
import { scriptedHost } from "../host/scripted-host.js";
import { inFrame } from "./in-frame.js";

/** A container the library has never heard of: it draws its child through the protocol and nothing else. */
const box = (child: Renderable): Renderable => ({ render: (options) => render(child, options) });

/** Two effects in one frame, in that container in a `Panel`, and the terminals they were handed. */
function placed(): { readonly view: Renderable; readonly seen: TerminalColors[] } {
  const seen: TerminalColors[] = [];
  const spy: Effect = (drawn) => {
    seen.push(drawn.terminal);
    return Animation.constant<EffectFrame>((look) => look);
  };
  const effected = (key: string): Renderable => new Effected(new RichText(key), spy, { key });
  return { view: new Panel(box(new Group(effected("a"), effected("b")))), seen };
}

const curve = { seconds: 1, ease: EASES.linear, swing: 1 };
const sink = { write: (): void => {} };

describe("an effect reads the terminal off the frame", () => {
  it("as a console named it", () => {
    const { view, seen } = placed();
    new Console({ file: sink, width: 40, colorSystem: "truecolor", terminal: CATPPUCCIN_MOCHA }).print(view);
    expect(seen).toEqual([CATPPUCCIN_MOCHA, CATPPUCCIN_MOCHA]);
  });

  it("as renderToString was told it", () => {
    const { view, seen } = placed();
    renderToString(view, { width: 40, colorSystem: "truecolor", terminal: SOLARIZED_LIGHT });
    expect(seen).toEqual([SOLARIZED_LIGHT, SOLARIZED_LIGHT]);
  });

  it("as an app was told it", () => {
    const { view, seen } = placed();
    void new App({ host: scriptedHost({ cols: 40, rows: 5 }), surface: "inline", view, terminal: CATPPUCCIN_LATTE }).run();
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen)).toEqual(new Set([CATPPUCCIN_LATTE]));
  });

  it.each([ColorDepth.TRUECOLOR, ColorDepth.EIGHT_BIT, ColorDepth.STANDARD, ColorDepth.WINDOWS])("with none named, as the terminal depth %s assumes", (depth) => {
    const { view, seen } = placed();
    [...render(view, { maxWidth: 40, colorSystem: depth })];
    expect(new Set(seen)).toEqual(new Set([resolveTerminal(undefined, depth)]));
  });
});

describe("what fades, fades toward the ground of the frame's terminal", () => {
  const words = new RichText("words", { style: "#ff0000", end: "" });
  const on = (renderable: Renderable, terminal: TerminalColors): string => renderToString(renderable, { width: 40, colorSystem: "truecolor", terminal });
  const ground = ({ backgroundColor: { red, green, blue } }: TerminalColors): string => `38;2;${red};${green};${blue}`;

  it.each<[string, Renderable]>([
    ["an effect", new Effected(words, fadeIn(curve, 0).effect, { key: "k" }).at(0)],
    ["a lifecycle half", lifecycle(words, { enter: throughColors(fadeIn(curve, 0)), exit: throughColors(fadeIn(curve, 0)), key: "k" }, 0).at(0)],
    ["a change", crossfade(curve).effect({ from: words, to: words }).at(0.5)],
  ])("%s", (_, renderable) => {
    expect(on(renderable, CATPPUCCIN_MOCHA)).toContain(ground(CATPPUCCIN_MOCHA));
    expect(on(renderable, CATPPUCCIN_LATTE)).toContain(ground(CATPPUCCIN_LATTE));
  });
});

describe("a pulsing bar reads the frame's terminal", () => {
  // A back in an ANSI colour: only the terminal says what shade the light falls on.
  const pulsing = inFrame(new ProgressBar({ width: 40, pulse: true, style: "red" }), 3);
  const drawn = (terminal?: TerminalColors): string => renderToString(pulsing, { width: 40, colorSystem: "truecolor", terminal });

  it("with none named, as the terminal the depth assumes", () => {
    expect(drawn()).toBe(drawn(resolveTerminal(undefined, ColorDepth.TRUECOLOR)));
  });

  it("and is lit on the one named", () => {
    expect(drawn(SOLARIZED_LIGHT)).not.toBe(drawn());
  });
});
