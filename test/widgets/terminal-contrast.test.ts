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
import { exportCanvas, resolveLook } from "../../src/core/export-lines.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { NULL_STYLE } from "../../src/core/style.js";
import { contrastRatio, TerminalTheme } from "../../src/core/color.js";
import * as terminalThemes from "../../src/themes/terminalThemes.js";
import { Button, type ButtonVariant } from "../../src/widgets/button.js";
import { Checkbox } from "../../src/widgets/checkbox.js";
import { Dropdown } from "../../src/widgets/dropdown.js";
import { Slider } from "../../src/widgets/slider.js";
import { TextInput } from "../../src/widgets/text-input.js";
import { Toggle, type ToggleVariant } from "../../src/widgets/toggle.js";

const RENDER: RenderOptions = { maxWidth: 40 };

// WCAG AA for body text.
const FLOOR = 4.5;

// A bundled theme's colours are its own: Solarized's text on its raised ground
// is 4.1:1 and stays Solarized. So a themed widget is held to WCAG AA for large
// text, and the theme-less widget above, whose colours are ours, to body text.
const THEMED_FLOOR = 3;

// Under this a disabled label is not drawn so much as lost in its ground.
const VISIBLE = 1.5;

const { DEFAULT_TERMINAL_THEME, SOLARIZED_LIGHT, TEXTUAL_LIGHT, CATPPUCCIN_MOCHA } = terminalThemes;

const TERMINALS: ReadonlyArray<readonly [string, TerminalTheme]> = [
  ["default (dark)", DEFAULT_TERMINAL_THEME],
  ["catppuccin-mocha (dark)", CATPPUCCIN_MOCHA],
  ["solarized-light (light)", SOLARIZED_LIGHT],
  ["textual-light (light)", TEXTUAL_LIGHT],
];

const BUNDLED = Object.values(terminalThemes).filter((value) => value instanceof TerminalTheme);

const VARIANTS = ["default", "primary", "success", "warning", "danger"] as const satisfies
  readonly (ButtonVariant & ToggleVariant)[];

type Scene = readonly [string, () => Iterable<Segment>];

const scenes = (theme?: TerminalTheme): Scene[] => [
  ...VARIANTS.flatMap((variant): Scene[] => [
    [`Button ${variant}`, () => new Button({ label: "Save", variant, theme }).render(RENDER)],
    [`Button ${variant} focused`, () => { const b = new Button({ label: "Save", variant, theme }); b.focus(0); return b.render(RENDER); }],
    [`Button ${variant} hovered`, () => { const b = new Button({ label: "Save", variant, theme }); b.setHovered(true); return b.render(RENDER); }],
    [`Toggle ${variant} off`, () => new Toggle({ label: "Wifi", variant, theme }).render(RENDER)],
    [`Toggle ${variant} on`, () => new Toggle({ label: "Wifi", variant, on: true, theme }).render(RENDER)],
  ]),
  ["Checkbox", () => new Checkbox({ label: "Agree", theme }).render(RENDER)],
  ["Checkbox checked", () => new Checkbox({ label: "Agree", checked: true, theme }).render(RENDER)],
  ["Checkbox focused", () => { const c = new Checkbox({ label: "Agree", theme }); c.focus(0); return c.render(RENDER); }],
  ["Slider", () => new Slider({ value: 40, width: 20, theme }).render(RENDER)],
  ["Slider focused", () => { const s = new Slider({ value: 40, width: 20, theme }); s.focus(0); return s.render(RENDER); }],
  ["TextInput placeholder", () => { const t = new TextInput({ placeholder: "Name", theme }); t.focus(0); return t.render(RENDER); }],
  ["TextInput value", () => new TextInput({ value: "Ada", theme }).render(RENDER)],
  ["TextInput focused", () => { const t = new TextInput({ value: "Ada", theme }); t.focus(0); return t.render(RENDER); }],
  ["TextInput multiline", () => new TextInput({ value: "a long line that wraps past the edge", multiline: true, continuationMarker: "↪ ", theme }).render({ maxWidth: 12 })],
  ["TextInput ragged rows", () => new TextInput({ value: "ab\n\nlonger line here", multiline: true, theme }).render(RENDER)],
  ["Dropdown", () => new Dropdown({ options: ["Red", "Green"], theme }).render(RENDER)],
  ["Dropdown expanded", () => {
    const d = new Dropdown({ options: ["Red", "Green", "Blue"], selectedIndex: 1, theme });
    d.expanded = true;
    d.highlightedIndex = 2;
    return d.renderOverlay(RENDER)!;
  }],
];

// WCAG sets no contrast floor for an inactive control, so these are held only
// to painting their own ground.
const disabledScenes = (theme?: TerminalTheme): Scene[] => [
  ["Button disabled", () => new Button({ label: "Save", disabled: true, theme }).render(RENDER)],
  ["Toggle disabled", () => new Toggle({ label: "Wifi", on: true, disabled: true, theme }).render(RENDER)],
  ["Checkbox disabled", () => new Checkbox({ label: "Agree", checked: true, disabled: true, theme }).render(RENDER)],
  ["Slider disabled", () => new Slider({ value: 40, width: 20, disabled: true, theme }).render(RENDER)],
  ["TextInput disabled", () => new TextInput({ value: "ab\n\nlonger line here", multiline: true, disabled: true, theme }).render(RENDER)],
  ["Dropdown disabled", () => new Dropdown({ options: ["Red", "Green"], disabled: true, theme }).render(RENDER)],
];

// The segments that cover a cell: one of no text covers none.
const cells = (draw: Scene[1]): Segment[] => Segment.splitLines(draw()).flat().filter((segment) => segment.cellLength > 0);

// Every visible glyph of a scene and its contrast, resolved on `terminal`.
const glyphs = (draw: Scene[1], terminal: TerminalTheme): { text: string; ratio: number; dim: boolean }[] => {
  const canvas = exportCanvas(terminal).background;
  return cells(draw)
    .filter((segment) => segment.text.trim() !== "")
    .map((segment) => {
      const look = resolveLook(segment.style ?? NULL_STYLE, terminal);
      const ground = look.background === "canvas" ? canvas : look.background;
      return { text: segment.text, ratio: contrastRatio(look.foreground, ground), dim: segment.style?.dim === true };
    });
};

describe("a widget constructed without a theme", () => {
  describe.each(TERMINALS)("on a %s terminal", (_name, terminal) => {
    it.each([...scenes(), ...disabledScenes()])("%s paints the ground under every cell", (_scene, draw) => {
      const bare = cells(draw)
        .filter((segment) => resolveLook(segment.style ?? NULL_STYLE, terminal).background === "canvas")
        .map((segment) => segment.text);
      expect(bare).toEqual([]);
    });
    it.each(scenes())("%s keeps every glyph readable", (_scene, draw) => {
      expect(glyphs(draw, terminal).filter(({ ratio }) => ratio < FLOOR)).toEqual([]);
    });
  });
});

describe.each(BUNDLED.map((theme) => [theme.palette.name, theme] as const))("a widget on %s", (_name, theme) => {
  it.each(scenes(theme))("%s keeps every glyph at the theme's floor", (_scene, draw) => {
    expect(glyphs(draw, theme).filter(({ ratio, dim }) => !dim && ratio < THEMED_FLOOR)).toEqual([]);
  });

  it.each(disabledScenes(theme))("%s is seen and reads as inactive", (_scene, draw) => {
    expect(glyphs(draw, theme).filter(({ ratio }) => ratio <= VISIBLE || ratio >= FLOOR)).toEqual([]);
  });

  it("gives each Button variant its own ground", () => {
    const grounds = VARIANTS.map((variant) => {
      const [label] = cells(() => new Button({ label: "Save", variant, theme }).render(RENDER));
      return resolveLook(label!.style ?? NULL_STYLE, theme).background;
    });
    expect(new Set(grounds).size).toBe(VARIANTS.length);
  });
});
