/**
 * A widget constructed without a theme is readable on whatever terminal it
 * lands in, light or dark.
 *
 * The widget cannot ask the terminal what colour its background is, so the
 * contract is checked the way a reader meets it: every state is rendered and
 * each cell resolved against a terminal's own colours. No cell, blank ones
 * included, may leave the terminal's background showing through, and every
 * visible glyph of an enabled widget has to clear the contrast floor on a dark
 * terminal and on a light one.
 */
import { describe, it, expect } from "vitest";
import { contrastRatio, type TerminalTheme } from "../../src/core/color.js";
import { exportCanvas, resolveLook } from "../../src/core/export-lines.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { NULL_STYLE } from "../../src/core/style.js";
import {
  DEFAULT_TERMINAL_THEME,
  SOLARIZED_LIGHT,
  TEXTUAL_LIGHT,
  CATPPUCCIN_MOCHA,
} from "../../src/themes/terminalThemes.js";
import { Button, type ButtonVariant } from "../../src/widgets/button.js";
import { Checkbox } from "../../src/widgets/checkbox.js";
import { Dropdown } from "../../src/widgets/dropdown.js";
import { Slider } from "../../src/widgets/slider.js";
import { TextInput } from "../../src/widgets/text-input.js";
import { Toggle, type ToggleVariant } from "../../src/widgets/toggle.js";

const RENDER: RenderOptions = { maxWidth: 40 };

// WCAG AA for body text.
const FLOOR = 4.5;

const TERMINALS: ReadonlyArray<readonly [string, TerminalTheme]> = [
  ["default (dark)", DEFAULT_TERMINAL_THEME],
  ["catppuccin-mocha (dark)", CATPPUCCIN_MOCHA],
  ["solarized-light (light)", SOLARIZED_LIGHT],
  ["textual-light (light)", TEXTUAL_LIGHT],
];

const VARIANTS = ["default", "primary", "success", "warning", "danger"] as const satisfies
  readonly (ButtonVariant & ToggleVariant)[];

type Scene = readonly [string, () => Iterable<Segment>];

const scenes: Scene[] = [
  ...VARIANTS.flatMap((variant): Scene[] => [
    [`Button ${variant}`, () => new Button({ label: "Save", variant }).render(RENDER)],
    [`Button ${variant} focused`, () => { const b = new Button({ label: "Save", variant }); b.focus(); return b.render(RENDER); }],
    [`Button ${variant} hovered`, () => { const b = new Button({ label: "Save", variant }); b.setHovered(true); return b.render(RENDER); }],
    [`Toggle ${variant} off`, () => new Toggle({ label: "Wifi", variant }).render(RENDER)],
    [`Toggle ${variant} on`, () => new Toggle({ label: "Wifi", variant, on: true }).render(RENDER)],
  ]),
  ["Checkbox", () => new Checkbox({ label: "Agree" }).render(RENDER)],
  ["Checkbox checked", () => new Checkbox({ label: "Agree", checked: true }).render(RENDER)],
  ["Checkbox focused", () => { const c = new Checkbox({ label: "Agree" }); c.focus(); return c.render(RENDER); }],
  ["Slider", () => new Slider({ value: 40, width: 20 }).render(RENDER)],
  ["Slider focused", () => { const s = new Slider({ value: 40, width: 20 }); s.focus(); return s.render(RENDER); }],
  ["TextInput placeholder", () => { const t = new TextInput({ placeholder: "Name" }); t.focus(); return t.render(RENDER); }],
  ["TextInput value", () => new TextInput({ value: "Ada" }).render(RENDER)],
  ["TextInput focused", () => { const t = new TextInput({ value: "Ada" }); t.focus(); return t.render(RENDER); }],
  ["TextInput multiline", () => new TextInput({ value: "a long line that wraps past the edge", multiline: true, continuationMarker: "↪ " }).render({ maxWidth: 12 })],
  ["TextInput ragged rows", () => new TextInput({ value: "ab\n\nlonger line here", multiline: true }).render(RENDER)],
  ["Dropdown", () => new Dropdown({ options: ["Red", "Green"] }).render(RENDER)],
  ["Dropdown expanded", () => {
    const d = new Dropdown({ options: ["Red", "Green", "Blue"], selectedIndex: 1 });
    d.expanded = true;
    d.highlightedIndex = 2;
    return d.renderOverlay(RENDER)!;
  }],
];

// WCAG sets no contrast floor for an inactive control, so these are held only
// to painting their own ground.
const disabledScenes: Scene[] = [
  ["Button disabled", () => new Button({ label: "Save", disabled: true }).render(RENDER)],
  ["Toggle disabled", () => new Toggle({ label: "Wifi", on: true, disabled: true }).render(RENDER)],
  ["Checkbox disabled", () => new Checkbox({ label: "Agree", checked: true, disabled: true }).render(RENDER)],
  ["Slider disabled", () => new Slider({ value: 40, width: 20, disabled: true }).render(RENDER)],
  ["TextInput disabled", () => new TextInput({ value: "ab\n\nlonger line here", multiline: true, disabled: true }).render(RENDER)],
  ["Dropdown disabled", () => new Dropdown({ options: ["Red", "Green"], disabled: true }).render(RENDER)],
];

const cells = (draw: Scene[1]): Segment[] => Segment.splitLines(draw()).flat();

describe("a widget constructed without a theme", () => {
  describe.each(TERMINALS)("on a %s terminal", (_name, terminal) => {
    const canvas = exportCanvas(terminal).background;
    it.each([...scenes, ...disabledScenes])("%s paints the ground under every cell", (_scene, draw) => {
      const bare = cells(draw)
        .filter((segment) => resolveLook(segment.style ?? NULL_STYLE, terminal).background === "canvas")
        .map((segment) => segment.text);
      expect(bare).toEqual([]);
    });
    it.each(scenes)("%s keeps every glyph readable", (_scene, draw) => {
      const unreadable = cells(draw)
        .filter((segment) => segment.text.trim() !== "")
        .map((segment) => {
          const look = resolveLook(segment.style ?? NULL_STYLE, terminal);
          const ground = look.background === "canvas" ? canvas : look.background;
          return { text: segment.text, ratio: contrastRatio(look.foreground, ground) };
        })
        .filter(({ ratio }) => ratio < FLOOR);
      expect(unreadable).toEqual([]);
    });
  });
});
