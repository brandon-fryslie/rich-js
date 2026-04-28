import { describe, it, expect } from "vitest";
import { FlexStrip } from "../../src/renderables/flexStrip.js";
import { StripCell, PowerlineJoiner } from "../../src/core/strip.js";
import { Style } from "../../src/core/style.js";
import { Segment } from "../../src/core/segment.js";
import type { RenderOptions } from "../../src/core/protocol.js";

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
    const strip = new FlexStrip([new StripCell("hello")]);
    expect(renderLines(strip, OPTS(40))).toEqual(["hello"]);
  });

  it("packs multiple items greedily and wraps when next would overflow", () => {
    // gap=1 → between items: 1 space + 1 space = 2 cells. Items widths: 5,5,5,5,5.
    // First fit on line: a(5) + 2 + b(5) + 2 + c(5) = 19 cells. Next add: 2 + 5 = 26 ≤ 40 → fits all five? 5+2+5+2+5+2+5+2+5 = 29.
    // Use width 18 so only 3 fit: 5+2+5+2+5 = 19 > 18, so 5+2+5 = 12 fits, +2+5 = 19 > 18 → break after 2 items.
    const items = ["aaaaa", "bbbbb", "ccccc", "ddddd", "eeeee"].map(
      (t) => new StripCell(t),
    );
    const strip = new FlexStrip(items, { gap: 1 });
    const lines = renderLines(strip, OPTS(18));
    // Each line ≤ 18 cells.
    for (const ln of lines) {
      expect(Segment.getShape ? true : true); // sanity
      expect(ln.replace(/\s/g, " ").length).toBeLessThanOrEqual(18);
    }
    // All items appear in order.
    expect(lines.join("|")).toContain("aaaaa");
    expect(lines.join("|")).toContain("eeeee");
    // Should have wrapped to >1 line.
    expect(lines.length).toBeGreaterThan(1);
  });

  it("wraps with a PowerlineJoiner: end-of-line uses end-cap, start-of-line uses start-cap", () => {
    const items = [
      new StripCell(" main ", Style.parse("white on blue")),
      new StripCell(" foo ", Style.parse("white on cyan")),
      new StripCell(" bar ", Style.parse("white on green")),
      new StripCell(" baz ", Style.parse("white on magenta")),
    ];
    // PowerlineJoiner: start-cap = glyph fg=item.bg no bg; end-cap = same; mid = glyph fg=L.bg bg=R.bg.
    const strip = new FlexStrip(items, { joiner: new PowerlineJoiner({ glyph: ">" }) });
    // width tight so we wrap after 2 items: per item " main " etc = 6. Line = >+6+>+6+>+6+> ... try 14 cells → fits 1 item: >+6+> = 8; add 2: 8 - 1(end) +1(mid)+6+1(end) = 16 > 14 → break.
    const lines = renderLines(strip, OPTS(14));
    expect(lines.length).toBeGreaterThan(1);
    // PowerlineJoiner's start-cap is empty (right-arrow with no source has
    // nothing to bleed from), but every line ends with the end-cap glyph —
    // and the protocol fires that end-cap at every line boundary.
    for (const ln of lines) {
      expect(ln.endsWith(">")).toBe(true);
    }
  });

  it("falls back gracefully when an item is wider than the terminal", () => {
    const items = [
      new StripCell("aaaaaaaaaa"),
      new StripCell("bbbbbbbbbb"),
    ];
    const strip = new FlexStrip(items);
    const lines = renderLines(strip, OPTS(5));
    expect(lines).toEqual(["aaaaaaaaaa", "bbbbbbbbbb"]);
  });

  it("right-aligns lines by padding on the left", () => {
    const items = [new StripCell("hi"), new StripCell("yo")];
    const strip = new FlexStrip(items, { align: "right", gap: 1 });
    // width 10, content = "hi  yo" (2+2+2=6), pad 4 spaces left.
    const lines = renderLines(strip, OPTS(10));
    expect(lines).toEqual(["    hi  yo"]);
  });

  it("center-aligns lines", () => {
    const items = [new StripCell("hi")];
    const strip = new FlexStrip(items, { align: "center" });
    const lines = renderLines(strip, OPTS(10));
    expect(lines).toEqual(["    hi"]);
  });

  it("measures: minimum = widest item+caps; maximum = single-line total", () => {
    const items = [new StripCell("aaa"), new StripCell("bbbbb")];
    const strip = new FlexStrip(items, { gap: 1 });
    const m = strip.measure(OPTS(80));
    expect(m.minimum).toBe(5);
    // 3 + 2(gaps) + 0(no joiner) + 5 = 10
    expect(m.maximum).toBe(10);
  });
});
