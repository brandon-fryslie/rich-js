/**
 * A widget constructed without a theme is readable on whatever terminal it
 * lands in, light or dark.
 *
 * The widget cannot ask the terminal what colour its background is, so the
 * contract is checked the way a reader meets it: every state is rendered, each
 * run is resolved against a terminal's own colours — its background showing
 * through wherever the widget paints none — and every visible glyph has to
 * clear the contrast floor on a dark terminal and on a light one.
 */
import { describe, it, expect } from "vitest";
import { contrastRatio, type TerminalTheme } from "../../src/core/color.js";
import { exportCanvas, resolveLook } from "../../src/core/export-lines.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import type { Segment } from "../../src/core/segment.js";
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

// WCAG's floor for text that is large or bold and for the parts of a control
// that identify it. The widgets draw glyph-sized UI chrome as well as text, and
// no state of any of them sits below this on its own ground.
const FLOOR = 3;

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
  ["Dropdown", () => new Dropdown({ options: ["Red", "Green"] }).render(RENDER)],
  ["Dropdown expanded", () => {
    const d = new Dropdown({ options: ["Red", "Green", "Blue"], selectedIndex: 1 });
    d.expanded = true;
    d.highlightedIndex = 2;
    return d.renderOverlay(RENDER)!;
  }],
];

describe("a widget constructed without a theme", () => {
  describe.each(TERMINALS)("on a %s terminal", (_name, terminal) => {
    const canvas = exportCanvas(terminal).background;
    it.each(scenes)("%s keeps every glyph readable", (_scene, draw) => {
      const unreadable = [...draw()]
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
