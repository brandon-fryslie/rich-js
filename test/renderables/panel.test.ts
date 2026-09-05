import { describe, it, expect } from "vitest";
import { cellLen } from "../../src/core/cells.js";
import type { PaddingDimensions } from "../../src/renderables/padding.js";
import { Panel } from "../../src/renderables/panel.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import { ASCII, DOUBLE } from "../../src/core/box.js";
import type { Measurable, Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectLines(renderable: Renderable, options: RenderOptions): string[] {
  const segments = [...renderable.render(options)];
  const lines = Segment.splitLines(segments);
  return lines.map((line) => line.map((s) => s.text).join(""));
}

function collectSegments(renderable: Renderable, options: RenderOptions): Segment[] {
  return [...renderable.render(options)];
}

describe("Panel", () => {
  // --- Construction defaults ---
  // Spec: box defaults to ROUNDED

  it("uses ROUNDED box by default", () => {
    const panel = new Panel("Hi");
    const lines = collectLines(panel, { maxWidth: 20 });
    expect(lines[0]).toContain("╭");
    expect(lines[0]).toContain("╮");
  });

  // --- Rendering: Simple content ---
  // Spec: Content wrapped in box border characters

  it("renders simple content in a box", () => {
    const panel = new Panel("Hello", { box: ASCII });
    const lines = collectLines(panel, { maxWidth: 20 });
    // Should have top border, content line(s), bottom border
    expect(lines.length).toBeGreaterThanOrEqual(3);
    // Top border uses ASCII characters
    expect(lines[0]).toContain("+");
    expect(lines[0]).toContain("-");
    // Content line has border sides and content
    expect(lines[1]).toContain("Hello");
    expect(lines[1]).toContain("|");
    // Bottom border
    expect(lines[lines.length - 1]).toContain("+");
  });

  // Spec: first argument can be a string (processed as markup)

  it("accepts string content", () => {
    const panel = new Panel("Hello", { box: ASCII });
    const lines = collectLines(panel, { maxWidth: 20 });
    expect(lines[1]).toContain("Hello");
  });

  // Spec: first argument can be RichText

  it("accepts RichText content", () => {
    const text = new RichText("Hello");
    text.stylize("bold");
    const panel = new Panel(text, { box: ASCII });
    const lines = collectLines(panel, { maxWidth: 20 });
    expect(lines[1]).toContain("Hello");
  });

  // Spec: first argument can be any Renderable

  it("accepts any Renderable as content", () => {
    const customRenderable: Renderable = {
      *render(_options: RenderOptions) {
        yield new Segment("Custom");
        yield Segment.line();
      },
    };
    const panel = new Panel(customRenderable, { box: ASCII });
    const lines = collectLines(panel, { maxWidth: 20 });
    expect(lines[1]).toContain("Custom");
  });

  // --- Box styles ---
  // Spec: ASCII box uses +, -, | characters

  it("renders with ASCII box style", () => {
    const panel = new Panel("Hi", { box: ASCII });
    const lines = collectLines(panel, { maxWidth: 20 });
    expect(lines[0]).toContain("+");
    expect(lines[0]).toContain("-");
    expect(lines[1]).toContain("|");
  });

  // Spec: DOUBLE box uses double-line characters

  it("renders with DOUBLE box style", () => {
    const panel = new Panel("Hi", { box: DOUBLE });
    const lines = collectLines(panel, { maxWidth: 20 });
    expect(lines[0]).toContain("╔");
    expect(lines[0]).toContain("═");
    expect(lines[0]).toContain("╗");
  });

  // --- Title and Subtitle ---
  // Spec: Title appears in the top border

  it("renders title in top border", () => {
    const panel = new Panel("Content", { title: "Title", box: ASCII });
    const lines = collectLines(panel, { maxWidth: 30 });
    expect(lines[0]).toContain("Title");
  });

  // Spec: Subtitle appears in the bottom border

  it("renders subtitle in bottom border", () => {
    const panel = new Panel("Content", { subtitle: "Sub", box: ASCII });
    const lines = collectLines(panel, { maxWidth: 30 });
    expect(lines[lines.length - 1]).toContain("Sub");
  });

  // Spec: title can be RichText

  it("renders RichText title in top border", () => {
    const title = new RichText("MyTitle");
    const panel = new Panel("Content", { title, box: ASCII });
    const lines = collectLines(panel, { maxWidth: 30 });
    expect(lines[0]).toContain("MyTitle");
  });

  // Spec: subtitle can be RichText

  it("renders RichText subtitle in bottom border", () => {
    const subtitle = new RichText("MySub");
    const panel = new Panel("Content", { subtitle, box: ASCII });
    const lines = collectLines(panel, { maxWidth: 30 });
    expect(lines[lines.length - 1]).toContain("MySub");
  });

  // --- Sizing ---
  // Spec: expand:true (default) — Panel fills maxWidth

  it("expand:true (default) fills maxWidth", () => {
    const panel = new Panel("Hi", { box: ASCII });
    const lines = collectLines(panel, { maxWidth: 20 });
    expect(lines[0]!.length).toBe(20);
  });

  // Spec: expand:false — Panel shrinks to content width (narrower than maxWidth)

  it("expand:false shrinks to content width", () => {
    const panel = new Panel("Hi", { box: ASCII, expand: false });
    const lines = collectLines(panel, { maxWidth: 40 });
    expect(lines[0]!.length).toBeLessThan(40);
  });

  // Spec: Panel.fit(renderable) — shorthand for non-expanded panel

  it("Panel.fit is shorthand for expand:false", () => {
    const panel = Panel.fit("Hi", { box: ASCII });
    const lines = collectLines(panel, { maxWidth: 40 });
    expect(lines[0]!.length).toBeLessThan(40);
  });

  // Spec: width option — fixed panel width

  it("custom width renders panel at specified width", () => {
    const panel = new Panel("Hi", { box: ASCII, width: 15 });
    const lines = collectLines(panel, { maxWidth: 40 });
    expect(lines[0]!.length).toBe(15);
  });

  // --- Options ---
  // Spec: borderStyle — style for border characters

  it("borderStyle applies style to border segments", () => {
    const panel = new Panel("Hi", { box: ASCII, borderStyle: "bold" });
    const segments = collectSegments(panel, { maxWidth: 20 });
    // Border segments (containing +, -, |) should have a style
    const borderSegments = segments.filter(
      (s) => !s.isControl && /[+\-|]/.test(s.text) && s.style !== undefined,
    );
    expect(borderSegments.length).toBeGreaterThan(0);
  });

  // Spec: style — style for panel content

  it("style applies style to content area segments", () => {
    const panel = new Panel("Hi", { box: ASCII, style: "bold" });
    const segments = collectSegments(panel, { maxWidth: 20 });
    // Content padding segments should have a style applied
    const styledPaddingSegments = segments.filter(
      (s) => !s.isControl && s.text.includes(" ") && s.style !== undefined && !/[+\-|]/.test(s.text),
    );
    expect(styledPaddingSegments.length).toBeGreaterThan(0);
  });

  // Spec: padding — internal padding

  it("padding adds extra lines inside the panel", () => {
    const panel = new Panel("Hi", { box: ASCII, padding: [1, 2, 1, 2] });
    const lines = collectLines(panel, { maxWidth: 20 });
    // top border + top pad + content + bottom pad + bottom border = at least 5
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });

  // --- bottomRightAccessory ---

  it("renders a string bottomRightAccessory just left of the bottom-right corner", () => {
    const panel = new Panel("Content", {
      bottomRightAccessory: "[14/102]",
      box: ASCII,
    });
    const lines = collectLines(panel, { maxWidth: 30 });
    const lastLine = lines[lines.length - 1]!;
    expect(lastLine).toContain("[14/102]");
    // Accessory hugs the right corner: " [14/102] " then the corner "+".
    expect(lastLine.endsWith(" [14/102] +")).toBe(true);
  });

  it("evaluates a function bottomRightAccessory at render time", () => {
    let frame = 0;
    const panel = new Panel("Content", {
      bottomRightAccessory: () => `frame=${++frame}`,
      box: ASCII,
    });
    const first = collectLines(panel, { maxWidth: 30 });
    const second = collectLines(panel, { maxWidth: 30 });
    // Function called per render — second frame sees a different value.
    expect(first[first.length - 1]).toContain("frame=1");
    expect(second[second.length - 1]).toContain("frame=2");
  });

  it("omits bottomRightAccessory when its thunk returns undefined", () => {
    const panel = new Panel("Content", {
      bottomRightAccessory: () => undefined,
      box: ASCII,
    });
    const lines = collectLines(panel, { maxWidth: 30 });
    const lastLine = lines[lines.length - 1]!;
    // Plain bottom border: rule chars from corner to corner.
    expect(lastLine.startsWith("+")).toBe(true);
    expect(lastLine.endsWith("+")).toBe(true);
    expect(lastLine).not.toContain("undefined");
  });

  it("coexists with subtitle: subtitle centered, accessory right-aligned", () => {
    const panel = new Panel("Content", {
      subtitle: "Sub",
      bottomRightAccessory: "[2/9]",
      box: ASCII,
    });
    const lines = collectLines(panel, { maxWidth: 30 });
    const lastLine = lines[lines.length - 1]!;
    expect(lastLine).toContain("Sub");
    expect(lastLine).toContain("[2/9]");
    // Accessory still on the right edge.
    expect(lastLine.endsWith(" [2/9] +")).toBe(true);
  });

  // --- Measurement ---
  // Spec: minimum > 0, maximum >= minimum

  it("measurement has minimum > 0 and maximum >= minimum", () => {
    const panel = new Panel("Hello");
    const m = panel.measure({ maxWidth: 40 });
    expect(m.minimum).toBeGreaterThan(0);
    expect(m.maximum).toBeGreaterThanOrEqual(m.minimum);
    expect(m.maximum).toBeLessThanOrEqual(40);
  });

  // --- Narrow widths ---
  // Spec: a panel never emits a line wider than the width it was given, and
  // never throws, at any width down to 1. A panel is a rectangle, so every
  // line it emits is the same width as every other.

  describe("at narrow widths", () => {
    // Every configuration that changes how a row is built: the two borders
    // (title, subtitle, accessory), the padding, and a content renderable
    // that ignores the width it is handed.
    const oversizedContent: Renderable = {
      *render(_options: RenderOptions) {
        yield new Segment("x".repeat(40));
        yield Segment.line();
      },
    };
    const configurations: Array<[string, Panel]> = [
      ["bare", new Panel("hello world")],
      ["titled", new Panel("hello world", { title: "Title" })],
      ["subtitled", new Panel("hello world", { subtitle: "Subtitle" })],
      [
        "titled + subtitled + accessory",
        new Panel("hello world", {
          title: "Title",
          subtitle: "Subtitle",
          bottomRightAccessory: "[14/102]",
        }),
      ],
      ["ascii box", new Panel("hello world", { box: ASCII })],
      ["double box", new Panel("hello world", { box: DOUBLE })],
      ["no padding", new Panel("hello world", { padding: 0 })],
      ["fat padding", new Panel("hello world", { padding: [1, 4] })],
      ["fit mode", Panel.fit("hello world")],
      ["explicit width", new Panel("hello world", { width: 30 })],
      ["wide characters", new Panel("日本語テキスト")],
      ["content that ignores its width", new Panel(oversizedContent)],
      ["empty content", new Panel("")],
    ];

    for (const [name, panel] of configurations) {
      it(`fits inside every width from 1 up: ${name}`, () => {
        for (let width = 1; width <= 40; width++) {
          const lines = collectLines(panel, { maxWidth: width });
          const widths = lines.map(cellLen);
          expect(
            Math.max(0, ...widths),
            `${name} overflowed at maxWidth ${width}: ${JSON.stringify(lines)}`,
          ).toBeLessThanOrEqual(width);
          expect(
            new Set(widths).size,
            `${name} emitted ragged lines at maxWidth ${width}: ${JSON.stringify(lines)}`,
          ).toBeLessThanOrEqual(1);
        }
      });
    }

    // The reported crash: with no title, the top border repeated its box
    // character by an inner width that had gone negative.
    it("does not throw at width 1", () => {
      expect(() => collectLines(new Panel("hello"), { maxWidth: 1 })).not.toThrow();
    });

    // Width 3 is the narrowest panel with a content cell between its frame
    // columns — the panel spends its cells on content before padding.
    it("keeps showing content down to width 3", () => {
      const lines = collectLines(new Panel("hello"), { maxWidth: 3 });
      expect(lines.join("")).toContain("h");
    });

    // A `bottomRightAccessory` thunk reads state that the wrapped renderable
    // populates during its own render, so the content has to render every
    // frame — including the widths where the frame leaves nowhere to show it.
    it("renders content every frame, so a stateful accessory sees this one", () => {
      let frames = 0;
      const counting: Renderable = {
        *render(_options: RenderOptions) {
          frames += 1;
          yield new Segment("content");
          yield Segment.line();
        },
      };
      const panel = new Panel(counting, {
        bottomRightAccessory: () => `#${frames}`,
      });

      for (let width = 1; width <= 6; width++) {
        const before = frames;
        collectLines(panel, { maxWidth: width });
        expect(frames, `content did not render at maxWidth ${width}`).toBe(before + 1);
      }

      const lines = collectLines(panel, { maxWidth: 30 });
      expect(lines[lines.length - 1]).toContain(`#${frames}`);
    });

    // Negative padding used to reach the renderer, where it produced content
    // rows wider than the panel's own border.
    it("treats negative padding as none", () => {
      const unpadded = collectLines(new Panel("hi", { padding: 0 }), { maxWidth: 20 });
      const cases: PaddingDimensions[] = [-1, [0, -1], [-2, -3, -4, -5]];
      for (const padding of cases) {
        expect(
          collectLines(new Panel("hi", { padding }), { maxWidth: 20 }),
          `padding ${JSON.stringify(padding)}`,
        ).toEqual(unpadded);
      }
    });

    // A measurement is a range, so its minimum cannot exceed its maximum —
    // which it did while the frame overhead was counted as a constant the
    // panel does not actually spend at these widths.
    it("measures a coherent range at every width", () => {
      for (const panel of [new Panel("hello world"), Panel.fit("hello world")]) {
        for (let width = 1; width <= 40; width++) {
          const m = panel.measure({ maxWidth: width });
          expect(m.minimum, `minimum exceeded maximum at maxWidth ${width}`)
            .toBeLessThanOrEqual(m.maximum);
          expect(m.maximum, `maximum exceeded maxWidth ${width}`).toBeLessThanOrEqual(width);
        }
      }
    });

    it("crops content that renders wider than the frame", () => {
      const lines = collectLines(new Panel(oversizedContent), { maxWidth: 10 });
      expect(lines[1]).toBe("│ xxxxxx │");
    });

    it("draws a frame around content that measures a negative width", () => {
      // Fit mode takes its width from `Measurement.get` on whatever it wraps,
      // and what it wraps is arbitrary — so the number reaching the panel's
      // division point is not one this file produced. A negative one used to
      // arrive unparsed and reach `String.repeat` as a negative count:
      // `RangeError: Invalid count value: -15`, out of the border.
      const negative: Renderable & Measurable = {
        *render(_options: RenderOptions) {
          yield new Segment("x");
          yield Segment.line();
        },
        measure: () => ({ minimum: -20, maximum: -20 }),
      };

      expect(() =>
        collectLines(new Panel(negative, { expand: false }), { maxWidth: 40 }),
      ).not.toThrow();
    });

    // The case above pins `render`, and the same content reached `measure` by a
    // different road: `Measurement.get` capped the maximum against the offer and
    // floored nothing, so `{-20, -20}` became a public `{-16, -16}` — a parent
    // sizing itself against this panel divided space from a negative range.
    // Fixed at `Measurement.get`, which is the declared single enforcer for
    // measuring a `Measurable` and now normalizes what it hands back, so a
    // second floor here would be a second enforcer for one rule.
    it("never measures a negative width around content that does", () => {
      const negative: Renderable & Measurable = {
        *render(_options: RenderOptions) {
          yield new Segment("x");
          yield Segment.line();
        },
        measure: () => ({ minimum: -20, maximum: -20 }),
      };

      const measured = new Panel(negative, { expand: false }).measure({ maxWidth: 40 });
      expect(measured.minimum).toBeGreaterThanOrEqual(0);
      expect(measured.maximum).toBeGreaterThanOrEqual(measured.minimum);
    });
  });
});
