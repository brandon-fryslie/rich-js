/**
 * A widget constructed without a theme is readable on whatever terminal it
 * lands in, light or dark.
 *
 * The widget cannot ask the terminal what color its background is, so the
 * contract is checked the way a reader meets it: every state is rendered and
 * each cell resolved against a terminal's own colors. No cell, blank ones
 * included, may leave the terminal's background showing through, and every
 * visible glyph of an enabled widget has to clear the contrast floor on a dark
 * terminal and on a light one.
 *
 * Given a theme it is drawn in that theme's colors, so each state is also
 * checked on every bundled theme, at full color: the floor is a fact about the
 * palette, not about the slots sixteen colors rounds it to.
 */
import { describe, it, expect } from "vitest";
import { exportCanvas, resolveLook } from "../../src/core/export-lines.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { NULL_STYLE } from "../../src/core/style.js";
import { ColorDepth, ColorSpec, contrastRatio, resolveTerminal, type ColorRgba, TerminalTheme } from "../../src/core/color.js";
import { Oklch } from "../../src/core/oklch.js";
import * as terminalThemes from "../../src/themes/terminalThemes.js";
import { textFloor } from "../../src/themes/text-on.js";
import { Button, type ButtonVariant } from "../../src/widgets/button.js";
import { Checkbox } from "../../src/widgets/checkbox.js";
import { Dropdown } from "../../src/widgets/dropdown.js";
import { Slider } from "../../src/widgets/slider.js";
import { TextInput } from "../../src/widgets/text-input.js";
import { Toggle, type ToggleVariant } from "../../src/widgets/toggle.js";

const RENDER: RenderOptions = { maxWidth: 40 };

// WCAG AA for body text.
const FLOOR = 4.5;

// Under this a disabled label is not drawn so much as lost in its ground.
const VISIBLE = 1.5;

const { DEFAULT_TERMINAL_THEME, SOLARIZED_DARK, SOLARIZED_LIGHT, TEXTUAL_LIGHT, CATPPUCCIN_MOCHA } = terminalThemes;

// Solarized's own text on its raised ground is 4.1:1, and raising it would make
// a Solarized that is not Solarized.
const floorOf = (theme: TerminalTheme): number => (theme === SOLARIZED_DARK || theme === SOLARIZED_LIGHT ? 4 : FLOOR);

const TERMINALS: ReadonlyArray<readonly [string, TerminalTheme]> = [
  ["default (dark)", DEFAULT_TERMINAL_THEME],
  ["catppuccin-mocha (dark)", CATPPUCCIN_MOCHA],
  ["solarized-light (light)", SOLARIZED_LIGHT],
  ["textual-light (light)", TEXTUAL_LIGHT],
];

const BUNDLED = Object.values(terminalThemes).filter((value) => value instanceof TerminalTheme);

const VARIANTS = ["default", "primary", "success", "warning", "danger"] as const satisfies
  readonly (ButtonVariant & ToggleVariant)[];

// A slider's track glyph, which its empty half draws muted.
const TRACK = "─";

type Scene = readonly [string, () => Iterable<Segment>];

// The glyphs each scene draws in muted text — meant to recede, with a floor of
// its own — by their text. Named by what the widget means to draw, never read
// off the color, so body text drawn muted by mistake is held to the body floor
// and fails.
const MUTED: Readonly<Record<string, readonly string[]>> = {
  "Slider": [TRACK],
  "Slider focused": [TRACK],
  "TextInput placeholder": ["ame"],
  "TextInput multiline": ["↪"],
  "Dropdown no matches": ["(no matches)"],
};

const scenes = (theme?: TerminalTheme, at: RenderOptions = RENDER): Scene[] => [
  ...VARIANTS.flatMap((variant): Scene[] => [
    [`Button ${variant}`, () => new Button({ label: "Save", variant, theme }).render(at)],
    [`Button ${variant} focused`, () => { const b = new Button({ label: "Save", variant, theme }); b.focus(0); return b.render(at); }],
    [`Button ${variant} hovered`, () => { const b = new Button({ label: "Save", variant, theme }); b.setHovered(true); return b.render(at); }],
    [`Toggle ${variant} off`, () => new Toggle({ label: "Wifi", variant, theme }).render(at)],
    [`Toggle ${variant} on`, () => new Toggle({ label: "Wifi", variant, on: true, theme }).render(at)],
  ]),
  ["Checkbox", () => new Checkbox({ label: "Agree", theme }).render(at)],
  ["Checkbox checked", () => new Checkbox({ label: "Agree", checked: true, theme }).render(at)],
  ["Checkbox focused", () => { const c = new Checkbox({ label: "Agree", theme }); c.focus(0); return c.render(at); }],
  ["Slider", () => new Slider({ value: 40, width: 20, theme }).render(at)],
  ["Slider focused", () => { const s = new Slider({ value: 40, width: 20, theme }); s.focus(0); return s.render(at); }],
  ["TextInput placeholder", () => { const t = new TextInput({ placeholder: "Name", theme }); t.focus(0); return t.render(at); }],
  ["TextInput value", () => new TextInput({ value: "Ada", theme }).render(at)],
  ["TextInput focused", () => { const t = new TextInput({ value: "Ada", theme }); t.focus(0); return t.render(at); }],
  ["TextInput multiline", () => new TextInput({ value: "a long line that wraps past the edge", multiline: true, continuationMarker: "↪ ", theme }).render({ ...at, maxWidth: 12 })],
  ["TextInput ragged rows", () => new TextInput({ value: "ab\n\nlonger line here", multiline: true, theme }).render(at)],
  ["Dropdown", () => new Dropdown({ options: ["Red", "Green"], theme }).render(at)],
  ["Dropdown expanded", () => {
    const d = new Dropdown({ options: ["Red", "Green", "Blue"], selectedIndex: 1, theme });
    d.expanded = true;
    d.highlightedIndex = 2;
    return d.renderOverlay(at)!;
  }],
  ["Dropdown no matches", () => {
    const d = new Dropdown({ options: ["Ultramarine blue", "Green"], theme });
    d.expanded = true;
    d.filter = "zzz";
    return d.renderOverlay(at)!;
  }],
];

// WCAG sets no contrast floor for an inactive control, so these paint their own
// ground and, on a bundled theme, stay seen and under the floor for text.
const disabledScenes = (theme?: TerminalTheme, at: RenderOptions = RENDER): Scene[] => [
  ["Button disabled", () => new Button({ label: "Save", disabled: true, theme }).render(at)],
  ["Toggle disabled", () => new Toggle({ label: "Wifi", on: true, disabled: true, theme }).render(at)],
  ["Checkbox disabled", () => new Checkbox({ label: "Agree", checked: true, disabled: true, theme }).render(at)],
  ["Slider disabled", () => new Slider({ value: 40, width: 20, disabled: true, theme }).render(at)],
  ["TextInput disabled", () => new TextInput({ value: "ab\n\nlonger line here", multiline: true, disabled: true, theme }).render(at)],
  ["TextInput disabled wrapped", () => new TextInput({ value: "a long line that wraps past the edge", multiline: true, continuationMarker: "↪ ", disabled: true, theme }).render({ ...at, maxWidth: 12 })],
  ["Dropdown disabled", () => new Dropdown({ options: ["Red", "Green"], disabled: true, theme }).render(at)],
];

// The segments that cover a cell: one of no text covers none.
const cells = (draw: Scene[1]): Segment[] => Segment.splitLines(draw()).flat().filter((segment) => segment.cellLength > 0);

// Every visible glyph of a scene, its contrast resolved on `terminal`, and
// whether the scene names it muted: a run of one named text counts as it.
const glyphs = (draw: Scene[1], terminal: TerminalTheme | undefined, mutedTexts: readonly string[] = []): { text: string; ratio: number; muted: boolean; ground: ColorRgba }[] => {
  const canvas = exportCanvas(terminal).background;
  return cells(draw)
    .filter((segment) => segment.text.trim() !== "")
    .map((segment) => {
      const look = resolveLook(segment.style ?? NULL_STYLE, terminal);
      const ground = look.background === "canvas" ? canvas : look.background;
      const shown = segment.text.trim();
      const muted = mutedTexts.some((text) => shown.replaceAll(text, "") === "");
      return { text: segment.text, ratio: contrastRatio(look.foreground, ground), muted, ground };
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
  it.each(scenes(theme))("%s keeps every glyph at the theme's floor", (scene, draw) => {
    expect(glyphs(draw, theme, MUTED[scene]).filter(({ ratio, muted }) => ratio < (muted ? textFloor("foreground-muted") : floorOf(theme)))).toEqual([]);
  });

  it.each(disabledScenes(theme))("%s is seen and reads as inactive", (_scene, draw) => {
    expect(glyphs(draw, theme).filter(({ ratio }) => ratio <= VISIBLE || ratio >= FLOOR)).toEqual([]);
  });

  it("gives each Button variant its own ground", () => {
    const grounds = VARIANTS.map((variant) => {
      const [label] = cells(() => new Button({ label: "Save", variant, theme }).render(RENDER));
      const { background } = resolveLook(label!.style ?? NULL_STYLE, theme);
      return background === "canvas" ? background : background.hex;
    });
    expect(new Set(grounds).size).toBe(VARIANTS.length);
  });
});

// Below truecolor a widget's colors are slots of a table, chosen among those
// the frame's terminal shows — the theme itself, or the VGA sixteen where the
// frame names none — and every rule above still has to hold there.
const DEPTHS = [["sixteen", ColorDepth.STANDARD], ["256", ColorDepth.EIGHT_BIT]] as const;

// Under this chroma a ground reads as grey: a grey ground has to stay grey, not
// turn into the table's maroon or navy.
const GREY = 0.06;

const grounds = (draw: Scene[1], terminal: TerminalTheme | undefined): Oklch[] =>
  cells(draw).map((segment) => {
    const { background } = resolveLook(segment.style ?? NULL_STYLE, terminal);
    return Oklch.fromRgba(background === "canvas" ? exportCanvas(terminal).background : background);
  });

// The cells of `drawn` whose ground took on a hue where `stated` has a grey one.
const greysLost = (drawn: readonly Oklch[], stated: readonly Oklch[]): Oklch[] =>
  drawn.filter((g, i) => stated[i]!.c <= GREY / 2 && g.c > GREY);

describe.each(BUNDLED.map((theme) => [theme.palette.name, theme] as const))("a widget on %s", (_name, theme) => {
  describe.each(DEPTHS)("at %s colors", (_depth, depth) => {
    describe.each([["no terminal named", undefined], ["its own terminal", theme]] as const)("on %s", (_terminal, terminal) => {
      const at: RenderOptions = { ...RENDER, colorSystem: depth, terminal };
      // A table may hold no color that reads on a ground at the floor; text is
      // then the most legible color the table has there.
      const shownBy = resolveTerminal(terminal, depth);
      const best = (ground: ColorRgba): number =>
        Math.max(contrastRatio(shownBy.foregroundColor, ground), ...ColorSpec.indexed(depth, shownBy).map(([, shown]) => contrastRatio(shown, ground)));
      it.each(scenes(theme, at).map(([scene, draw], i) => [scene, draw, scenes(theme)[i]![1]] as const))(
        "%s keeps every glyph at the theme's floor, or the most its table reaches, on no ground in a hue the theme's grounds lack",
        (scene, draw, truecolor) => {
          expect(glyphs(draw, terminal, MUTED[scene]).filter(({ ratio, muted, ground }) => ratio < Math.min(muted ? textFloor("foreground-muted") : floorOf(theme), best(ground)) - 1e-9)).toEqual([]);
          const [drawn, stated] = [grounds(draw, terminal), grounds(truecolor, theme)];
          expect(drawn.length).toBe(stated.length);
          expect(greysLost(drawn, stated).map((g) => g.toRgba().hex)).toEqual([]);
        },
      );
      it.each(disabledScenes(theme, at))("%s is seen", (_scene, draw) => {
        expect(glyphs(draw, terminal).filter(({ ratio }) => ratio <= 1)).toEqual([]);
      });
    });
  });
});
