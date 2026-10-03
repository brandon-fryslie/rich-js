/**
 * A default style that paints its own ground fixes both halves of the pair, so
 * at 16 colours — where each half becomes a slot the terminal paints in its
 * own theme — what reaches the terminal must still read at WCAG's 4.5 on every
 * bundled theme. Measured on the segments the renderable that draws the style
 * actually yields, so a grounded default drawn without `groundedStyle` fails
 * here rather than passing on the strength of the rule alone.
 */
import { describe, it, expect } from "vitest";
import { ColorDepth, contrastRatio, TerminalTheme } from "../../src/core/color.js";
import { DEFAULT_STYLES } from "../../src/core/style.js";
import type { Renderable } from "../../src/core/protocol.js";
import { Markdown } from "../../src/renderables/markdown.js";
import { Syntax } from "../../src/renderables/syntax.js";
import * as terminalThemes from "../../src/themes/terminalThemes.js";

// Each grounded default, the renderable that draws it, and the text of a run
// drawn in it.
const DRAWN_BY: Record<string, { readonly draw: () => Renderable; readonly text: string }> = {
  "syntax.line_number.highlight": {
    draw: () => new Syntax("a\nb", "text", { lineNumbers: true, highlightLines: new Set([2]) }),
    text: "2",
  },
  "markdown.code": { draw: () => new Markdown("Use `code` here"), text: "code" },
};

const grounded = Object.entries(DEFAULT_STYLES).filter(([, style]) => style.bgcolor?.fixedValue !== undefined).map(([name]) => name);
const terminals = Object.entries(terminalThemes).filter(
  (entry): entry is [string, TerminalTheme] => entry[1] instanceof TerminalTheme,
);

describe("grounded defaults at 16 colours", () => {
  it("names the renderable that draws every grounded default", () => {
    expect(Object.keys(DRAWN_BY).sort()).toEqual([...grounded].sort());
  });

  it.each(
    Object.entries(DRAWN_BY).flatMap(([name, drawer]) =>
      [ColorDepth.STANDARD, ColorDepth.WINDOWS].flatMap((depth) =>
        terminals.map(([theme, terminal]) => ({ name, drawer, depth, theme, terminal })),
      ),
    ),
  )("$name reads at depth $depth under $theme", ({ drawer, depth, terminal }) => {
    const run = [...drawer.draw().render({ maxWidth: 80, colorSystem: depth })].find(
      (segment) => segment.text.trim() === drawer.text,
    )!;
    const drawn = run.style!.drawnColors(depth);
    const ink = drawn.color?.getTruecolor(terminal, true) ?? terminal.foregroundColor;
    const ground = drawn.bgcolor?.getTruecolor(terminal, false) ?? terminal.backgroundColor;
    expect(contrastRatio(ink, ground)).toBeGreaterThanOrEqual(4.5);
  });
});
