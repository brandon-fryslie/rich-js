import { describe, it, expect } from "vitest";
import { FlexStrip } from "../../src/renderables/flexStrip.js";
import { PowerlineJoiner } from "../../src/core/strip.js";
import { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import type { RenderOptions } from "../../src/core/protocol.js";

function cell(text: string, style?: string | Style): RichText {
  return new RichText(text, { style, end: "", noWrap: true });
}

// [LAW:behavior-not-structure] Tests assert what callers observe — packed
// lines, line widths, joiner placement at line boundaries — not the packer's
// internals.

const OPTS = (maxWidth: number): RenderOptions => ({ maxWidth });

function renderLines(strip: FlexStrip, opts: RenderOptions): string[] {
  const segs = [...strip.render(opts)];
  const lines: string[] = [];
  let buf = "";
  for (const s of segs) {
    if (s.text === "\n" && !s.style && !s.control) {
      lines.push(buf);
      buf = "";
    } else {
      buf += s.text;
    }
  }
  if (buf.length > 0) lines.push(buf);
  return lines;
}

describe("FlexStrip", () => {
  it("emits nothing for an empty strip", () => {
    const strip = new FlexStrip([]);
    expect([...strip.render(OPTS(40))]).toEqual([]);
  });

  it("packs a single item onto one line", () => {
    const strip = new FlexStrip([cell("hello")]);
    expect(renderLines(strip, OPTS(40))).toEqual(["hello"]);
  });

  it("packs multiple items greedily and wraps when next would overflow", () => {
    // gap=1 → between items: 1 space + 1 space = 2 cells. Items widths: 5,5,5,5,5.
    // First fit on line: a(5) + 2 + b(5) + 2 + c(5) = 19 cells. Next add: 2 + 5 = 26 ≤ 40 → fits all five? 5+2+5+2+5+2+5+2+5 = 29.
    // Use width 18 so only 3 fit: 5+2+5+2+5 = 19 > 18, so 5+2+5 = 12 fits, +2+5 = 19 > 18 → break after 2 items.
    const items = ["aaaaa", "bbbbb", "ccccc", "ddddd", "eeeee"].map(
      (t) => cell(t),
    );
    const strip = new FlexStrip(items, { gap: 1 });
    const lines = renderLines(strip, OPTS(18));
    // Each line ≤ 18 cells.
    for (const ln of lines) {
      expect(ln.replace(/\s/g, " ").length).toBeLessThanOrEqual(18);
    }
    // All items appear in order.
    expect(lines.join("|")).toContain("aaaaa");
    expect(lines.join("|")).toContain("eeeee");
    // Should have wrapped to >1 line.
    expect(lines.length).toBeGreaterThan(1);
  });

  it("wraps with a PowerlineJoiner: every line opens with the lead and closes with the tail", () => {
    const items = [
      cell(" main ", "white on blue"),
      cell(" foo ", "white on cyan"),
      cell(" bar ", "white on green"),
      cell(" baz ", "white on magenta"),
    ];
    // PowerlineJoiner: start-cap = lead fg=item.bg no bg; end-cap = tail fg=item.bg no bg;
    // mid = glyph fg=L.bg bg=R.bg. Caps distinct from the arrow so each is seen.
    const strip = new FlexStrip(items, { joiner: new PowerlineJoiner({ glyph: ">", divider: "|", lead: "(", tail: ")" }) });
    // Each item is 6 wide. One item per line is (+6+) = 8; a second adds
    // >+6 = 7 → 15 > 14, so every line holds exactly one item.
    const lines = renderLines(strip, OPTS(14));
    expect(lines.length).toBeGreaterThan(1);
    // The protocol fires both caps at every line boundary, so every wrapped
    // line opens with the lead and closes with the tail.
    for (const ln of lines) {
      expect(ln.startsWith("(")).toBe(true);
      expect(ln.endsWith(")")).toBe(true);
    }
  });

  it("falls back gracefully when an item is wider than the terminal", () => {
    const items = [
      cell("aaaaaaaaaa"),
      cell("bbbbbbbbbb"),
    ];
    const strip = new FlexStrip(items);
    const lines = renderLines(strip, OPTS(5));
    expect(lines).toEqual(["aaaaaaaaaa", "bbbbbbbbbb"]);
  });

  it("right-aligns lines by padding on the left", () => {
    const items = [cell("hi"), cell("yo")];
    const strip = new FlexStrip(items, { align: "right", gap: 1 });
    // width 10, content = "hi  yo" (2+2+2=6), pad 4 spaces left.
    const lines = renderLines(strip, OPTS(10));
    expect(lines).toEqual(["    hi  yo"]);
  });

  it("center-aligns lines", () => {
    const items = [cell("hi")];
    const strip = new FlexStrip(items, { align: "center" });
    const lines = renderLines(strip, OPTS(10));
    expect(lines).toEqual(["    hi"]);
  });

  it("measures: minimum = widest item+caps; maximum = single-line total", () => {
    const items = [cell("aaa"), cell("bbbbb")];
    const strip = new FlexStrip(items, { gap: 1 });
    const m = strip.measure(OPTS(80));
    expect(m.minimum).toBe(5);
    // 3 + 2(gaps) + 0(no joiner) + 5 = 10
    expect(m.maximum).toBe(10);
  });
});
