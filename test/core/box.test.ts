import { describe, it, expect } from "vitest";
import {
  Box,
  ASCII,
  ASCII2,
  ASCII_DOUBLE_HEAD,
  SQUARE,
  SQUARE_DOUBLE_HEAD,
  MINIMAL,
  MINIMAL_HEAVY_HEAD,
  MINIMAL_DOUBLE_HEAD,
  SIMPLE,
  SIMPLE_HEAD,
  SIMPLE_HEAVY,
  HORIZONTALS,
  ROUNDED,
  HEAVY,
  HEAVY_EDGE,
  HEAVY_HEAD,
  DOUBLE,
  DOUBLE_EDGE,
  MARKDOWN,
} from "../../src/core/box.js";
import type { RowLevel } from "../../src/core/box.js";
import { Style } from "../../src/core/style.js";

// Helper: extracts the concatenated text from a Segment array
function segmentText(segments: { text: string }[]): string {
  return segments.map((s) => s.text).join("");
}

describe("Box", () => {
  describe("construction", () => {
    it("reads each grid line as the row a table draws it for", () => {
      const box = new Box(
        "ABCD\n" +
        "E FG\n" +
        "HIJK\n" +
        "L MN\n" +
        "OPQR\n" +
        "STUV\n" +
        "W XY\n" +
        "Z123",
      );

      expect(box.top).toEqual({ left: "A", horizontal: "B", cross: "C", right: "D" });
      expect(box.getContentChars("head")).toEqual({ left: "E", vertical: "F", right: "G" });
      expect(segmentText(box.getRow([1, 1], "head"))).toBe("HIJIK\n");
      expect(box.getContentChars("row")).toEqual({ left: "L", vertical: "M", right: "N" });
      expect(segmentText(box.getRow([1, 1], "row"))).toBe("OPQPR\n");
      expect(segmentText(box.getRow([1, 1], "foot"))).toBe("STUTV\n");
      expect(box.getContentChars("foot")).toEqual({ left: "W", vertical: "X", right: "Y" });
      expect(box.bottom).toEqual({ left: "Z", horizontal: "1", cross: "2", right: "3" });
    });

    it("refuses a grid that is not eight lines of four characters", () => {
      expect(() => new Box("+-+\n| |\n+-+")).toThrow(/8 lines of 4 single-cell/);
      expect(() => new Box(Array(8).fill("+--").join("\n"))).toThrow(/8 lines of 4 single-cell/);
    });

    // A grid column is one drawn glyph position, so four characters is only
    // half the requirement — four *cells* is the other half. A wide glyph
    // satisfies the count and silently widens every frame the box draws.
    it("refuses a row of four characters that draws more than four cells", () => {
      expect(() => new Box(Array(8).fill("🌟─┬┐").join("\n")))
        .toThrow(/8 lines of 4 single-cell/);
      expect(() => new Box(Array(8).fill("┌─┬┐").join("\n"))).not.toThrow();
    });

    // The mirror of the case above: four cells drawn by five characters. The
    // frame would look right and every position after the combining mark would
    // be read from the wrong index.
    it("refuses a row of four cells that spends more than four characters", () => {
      expect(() => new Box(Array(8).fill("┌─┬┐\u0301").join("\n")))
        .toThrow(/8 lines of 4 single-cell/);
    });
  });

  describe("pre-built styles draw the frames the reference draws", () => {
    it("ASCII uses +, -, |", () => {
      expect(segmentText(ASCII.getTop([3, 2]))).toBe("+------+\n");
      expect(segmentText(ASCII.getBottom([3, 2]))).toBe("+------+\n");
      expect(ASCII.getContentChars("row")).toEqual({ left: "|", vertical: "|", right: "|" });
    });

    it("SQUARE uses light box-drawing characters", () => {
      expect(segmentText(SQUARE.getTop([3, 2]))).toBe("┌───┬──┐\n");
      expect(segmentText(SQUARE.getBottom([3, 2]))).toBe("└───┴──┘\n");
      expect(SQUARE.getContentChars("row")).toEqual({ left: "│", vertical: "│", right: "│" });
    });

    it("ROUNDED uses rounded corner characters", () => {
      expect(segmentText(ROUNDED.getTop([3, 2]))).toBe("╭───┬──╮\n");
      expect(segmentText(ROUNDED.getBottom([3, 2]))).toBe("╰───┴──╯\n");
    });

    it("HEAVY uses heavy box-drawing characters", () => {
      expect(segmentText(HEAVY.getTop([3, 2]))).toBe("┏━━━┳━━┓\n");
      expect(segmentText(HEAVY.getBottom([3, 2]))).toBe("┗━━━┻━━┛\n");
      expect(HEAVY.getContentChars("row")).toEqual({ left: "┃", vertical: "┃", right: "┃" });
    });

    it("DOUBLE uses double-line box-drawing characters", () => {
      expect(segmentText(DOUBLE.getTop([3, 2]))).toBe("╔═══╦══╗\n");
      expect(segmentText(DOUBLE.getBottom([3, 2]))).toBe("╚═══╩══╝\n");
      expect(DOUBLE.getContentChars("row")).toEqual({ left: "║", vertical: "║", right: "║" });
    });
  });

  describe("getTop()", () => {
    it("renders top border with edge for single column", () => {
      const result = segmentText(ASCII.getTop([5]));
      expect(result).toBe("+-----+\n");
    });

    it("renders top border with edge for multiple columns", () => {
      const result = segmentText(ASCII.getTop([3, 4]));
      expect(result).toBe("+--------+\n");
    });

    it("renders top border without edge", () => {
      const result = segmentText(ASCII.getTop([3, 4], undefined, false));
      expect(result).toBe("--------\n");
    });

    it("renders top border with box-drawing characters", () => {
      const result = segmentText(SQUARE.getTop([3, 2]));
      expect(result).toBe("┌───┬──┐\n");
    });

    it("handles single column width of 1", () => {
      const result = segmentText(ASCII.getTop([1]));
      expect(result).toBe("+-+\n");
    });

    it("handles three columns", () => {
      const result = segmentText(ASCII.getTop([2, 3, 4]));
      expect(result).toBe("+-----------+\n");
    });
  });

  describe("getRow()", () => {
    it("joins the header to the body with the separator glyphs, not the header verticals", () => {
      const result = segmentText(HEAVY_HEAD.getRow([3, 3], "head"));
      expect(result).toBe("┡━━━╇━━━┩\n");
    });

    it("draws each level from its own line of the grid", () => {
      const levels: RowLevel[] = ["head", "row", "foot"];
      const rendered = levels.map((level) => segmentText(HEAVY_HEAD.getRow([3, 2], level)));
      expect(rendered).toEqual(["┡━━━╇━━┩\n", "├───┼──┤\n", "├───┼──┤\n"]);
    });

    it("draws `mid` as a blank spacer carrying the body verticals, not a rule", () => {
      expect(segmentText(SQUARE.getRow([3, 2], "mid"))).toBe("│   │  │\n");
    });

    it("renders ASCII separators with edge", () => {
      const result = segmentText(ASCII.getRow([3, 4], "head"));
      expect(result).toBe("|---+----|\n");
    });

    it("renders separator without edge", () => {
      const result = segmentText(ASCII.getRow([3, 4], "head", undefined, false));
      expect(result).toBe("---+----\n");
    });

    it("renders HEAVY separators correctly", () => {
      const result = segmentText(HEAVY.getRow([2, 3], "head"));
      expect(result).toBe("┣━━╋━━━┫\n");
    });
  });

  describe("getContentChars()", () => {
    it("frames the head row with the head verticals, not the body's", () => {
      expect(HEAVY_HEAD.getContentChars("head")).toEqual({
        left: "┃",
        vertical: "┃",
        right: "┃",
      });
    });

    it("frames every other level with the body verticals", () => {
      const levels: RowLevel[] = ["row", "mid", "foot"];
      const framed = levels.map((level) => HEAVY_HEAD.getContentChars(level));
      expect(framed).toEqual([
        { left: "│", vertical: "│", right: "│" },
        { left: "│", vertical: "│", right: "│" },
        { left: "│", vertical: "│", right: "│" },
      ]);
    });

    it("gives every level one set on a box whose head matches its body", () => {
      const levels: RowLevel[] = ["head", "row", "mid", "foot"];
      const framed = levels.map((level) => SQUARE.getContentChars(level));
      expect(framed).toEqual(Array(4).fill({ left: "│", vertical: "│", right: "│" }));
    });
  });

  describe("getBottom()", () => {
    it("renders bottom border with edge for single column", () => {
      const result = segmentText(ASCII.getBottom([5]));
      expect(result).toBe("+-----+\n");
    });

    it("renders bottom border with edge for multiple columns", () => {
      const result = segmentText(ASCII.getBottom([3, 4]));
      expect(result).toBe("+--------+\n");
    });

    it("renders bottom border without edge", () => {
      const result = segmentText(ASCII.getBottom([3, 4], undefined, false));
      expect(result).toBe("--------\n");
    });

    it("renders bottom border with box-drawing characters", () => {
      const result = segmentText(SQUARE.getBottom([3, 2]));
      expect(result).toBe("└───┴──┘\n");
    });

    it("renders DOUBLE bottom border", () => {
      const result = segmentText(DOUBLE.getBottom([4, 3]));
      expect(result).toBe("╚════╩═══╝\n");
    });
  });

  describe("substitute()", () => {
    // Both arms across the whole shipped set, because the claim is about which
    // boxes need replacing and that is only checkable by naming all of them.
    // These four are exactly the four the reference constructs with
    // `ascii=True`; nothing here declares that — the grids do.
    it.each([
      ["ASCII", ASCII],
      ["ASCII2", ASCII2],
      ["ASCII_DOUBLE_HEAD", ASCII_DOUBLE_HEAD],
      ["MARKDOWN", MARKDOWN],
    ])("%s is already drawable, so asciiOnly leaves it alone", (_name, box) => {
      expect(box.substitute({ asciiOnly: true })).toBe(box);
    });

    it.each([
      ["SQUARE", SQUARE],
      ["SQUARE_DOUBLE_HEAD", SQUARE_DOUBLE_HEAD],
      ["MINIMAL", MINIMAL],
      ["MINIMAL_HEAVY_HEAD", MINIMAL_HEAVY_HEAD],
      ["MINIMAL_DOUBLE_HEAD", MINIMAL_DOUBLE_HEAD],
      ["SIMPLE", SIMPLE],
      ["SIMPLE_HEAD", SIMPLE_HEAD],
      ["SIMPLE_HEAVY", SIMPLE_HEAVY],
      ["HORIZONTALS", HORIZONTALS],
      ["ROUNDED", ROUNDED],
      ["HEAVY", HEAVY],
      ["HEAVY_EDGE", HEAVY_EDGE],
      ["HEAVY_HEAD", HEAVY_HEAD],
      ["DOUBLE", DOUBLE],
      ["DOUBLE_EDGE", DOUBLE_EDGE],
    ])("%s spends unicode glyphs, so asciiOnly gives it up for ASCII", (_name, box) => {
      expect(box.substitute({ asciiOnly: true })).toBe(ASCII);
    });

    // [LAW:one-source-of-truth] A box is its grid, so a grid-equal box answers
    // alike. `safe` on a box with no rounded corners is the route that builds
    // one — a fresh instance, an unchanged grid — and it is a box no per-
    // constant `ascii` flag could have spoken for. Declared rather than
    // derived, this box would lose the markdown frame it still draws fine.
    it("keeps an already-ASCII box that is not the shipped constant", () => {
      const copy = MARKDOWN.substitute({ safe: true });
      expect(copy).not.toBe(MARKDOWN);
      expect(copy.substitute({ asciiOnly: true })).toBe(copy);
    });

    it("safe replaces rounded corners with square equivalents", () => {
      const result = ROUNDED.substitute({ safe: true });
      // Corners squared off; every other glyph of the grid is carried through.
      expect(segmentText(result.getTop([3, 2]))).toBe("┌───┬──┐\n");
      expect(segmentText(result.getBottom([3, 2]))).toBe("└───┴──┘\n");
      expect(segmentText(result.getRow([3, 2], "head"))).toBe("├───┼──┤\n");
      expect(result.getContentChars("row")).toEqual({ left: "│", vertical: "│", right: "│" });
    });

    it("safe on a box without problematic characters returns equivalent box", () => {
      const result = SQUARE.substitute({ safe: true });
      // SQUARE has no rounded corners, so all characters stay the same
      expect(segmentText(result.getTop([3, 2]))).toBe("┌───┬──┐\n");
      expect(segmentText(result.getBottom([3, 2]))).toBe("└───┴──┘\n");
    });

    it("returns self when no options are set", () => {
      const result = ROUNDED.substitute();
      expect(result).toBe(ROUNDED);
    });

    it("returns self when options are all false", () => {
      const result = HEAVY.substitute({ asciiOnly: false, safe: false });
      expect(result).toBe(HEAVY);
    });

    it("asciiOnly takes precedence over safe when both true", () => {
      const result = SQUARE.substitute({ asciiOnly: true, safe: true });
      expect(result).toBe(ASCII);
    });
  });

  describe("plainHeaded()", () => {
    // The reference's own `PLAIN_HEADED_SUBSTITUTIONS`, and the whole of it.
    it.each([
      ["HEAVY_HEAD", HEAVY_HEAD, SQUARE],
      ["SQUARE_DOUBLE_HEAD", SQUARE_DOUBLE_HEAD, SQUARE],
      ["MINIMAL_HEAVY_HEAD", MINIMAL_HEAVY_HEAD, MINIMAL],
      ["MINIMAL_DOUBLE_HEAD", MINIMAL_DOUBLE_HEAD, MINIMAL],
      ["ASCII_DOUBLE_HEAD", ASCII_DOUBLE_HEAD, ASCII2],
    ])("%s gives up its header glyphs", (_name, headed, plain) => {
      expect(headed.plainHeaded()).toBe(plain);
    });

    it.each([
      ["SQUARE", SQUARE],
      ["ROUNDED", ROUNDED],
      ["MARKDOWN", MARKDOWN],
    ])("%s already draws a plain head, so it answers with itself", (_name, style) => {
      expect(style.plainHeaded()).toBe(style);
    });

    // [LAW:types-are-the-program] A box is its grid, so an equal box answers
    // alike. `safe` on a box with no rounded corners is the route that produces
    // one: a fresh instance, an unchanged grid. Keyed on identity rather than
    // on the grid, this box would keep the heavy header it was asked to drop.
    it("substitutes a grid-equal box that is not the shipped constant", () => {
      const copy = HEAVY_HEAD.substitute({ safe: true });
      expect(copy).not.toBe(HEAVY_HEAD);
      expect(copy.plainHeaded()).toBe(SQUARE);
    });
  });

  describe("style parameter forwarding", () => {
    it("getTop() segments carry the provided style", () => {
      const style = new Style({ bold: true });
      const segments = SQUARE.getTop([3], style);
      // Every segment except the trailing newline should have the style
      const styled = segments.filter((s) => s.text !== "\n");
      expect(styled.length).toBeGreaterThan(0);
      for (const seg of styled) {
        expect(seg.style).toBe(style);
      }
    });

    it("getRow() segments carry the provided style", () => {
      const style = new Style({ italic: true });
      const segments = ASCII.getRow([4, 3], "head", style);
      const styled = segments.filter((s) => s.text !== "\n");
      expect(styled.length).toBeGreaterThan(0);
      for (const seg of styled) {
        expect(seg.style).toBe(style);
      }
    });

    it("getBottom() segments carry the provided style", () => {
      const style = new Style({ underline: true });
      const segments = HEAVY.getBottom([2, 5], style);
      const styled = segments.filter((s) => s.text !== "\n");
      expect(styled.length).toBeGreaterThan(0);
      for (const seg of styled) {
        expect(seg.style).toBe(style);
      }
    });
  });

  describe("pre-built styles carry the reference's own grid", () => {
    it("MARKDOWN pipes its cells and rules its header with dashes", () => {
      expect(segmentText(MARKDOWN.getTop([3, 2]))).toBe("        \n");
      expect(segmentText(MARKDOWN.getBottom([3, 2]))).toBe("        \n");
      expect(segmentText(MARKDOWN.getRow([3, 2], "head"))).toBe("|---|--|\n");
      expect(MARKDOWN.getContentChars("head")).toEqual({ left: "|", vertical: "|", right: "|" });
      expect(MARKDOWN.getContentChars("row")).toEqual({ left: "|", vertical: "|", right: "|" });
    });

    it("ASCII_DOUBLE_HEAD rules its header with = and its rows with -", () => {
      expect(segmentText(ASCII_DOUBLE_HEAD.getRow([3, 2], "head"))).toBe("+===+==+\n");
      expect(segmentText(ASCII_DOUBLE_HEAD.getRow([3, 2], "row"))).toBe("+---+--+\n");
      expect(segmentText(ASCII_DOUBLE_HEAD.getTop([3, 2]))).toBe("+---+--+\n");
    });

    it("MINIMAL draws its rules with no outer edge glyphs", () => {
      expect(segmentText(MINIMAL.getTop([3, 2]))).toBe("    ╷   \n");
      expect(segmentText(MINIMAL.getBottom([3, 2]))).toBe("    ╵   \n");
      expect(segmentText(MINIMAL.getRow([3, 2], "head"))).toBe("╶───┼──╴\n");
      expect(MINIMAL.getContentChars("row")).toEqual({ left: " ", vertical: "│", right: " " });
    });

    it("DOUBLE_EDGE doubles the outer edge and keeps the inner rules single", () => {
      expect(segmentText(DOUBLE_EDGE.getTop([3, 2]))).toBe("╔═══╤══╗\n");
      expect(segmentText(DOUBLE_EDGE.getBottom([3, 2]))).toBe("╚═══╧══╝\n");
      expect(segmentText(DOUBLE_EDGE.getRow([3, 2], "head"))).toBe("╟───┼──╢\n");
      expect(DOUBLE_EDGE.getContentChars("row")).toEqual({ left: "║", vertical: "│", right: "║" });
    });

    it("SIMPLE rules only under the header and above the footer", () => {
      expect(segmentText(SIMPLE.getTop([3, 2]))).toBe("        \n");
      expect(segmentText(SIMPLE.getBottom([3, 2]))).toBe("        \n");
      expect(segmentText(SIMPLE.getRow([3, 2], "head"))).toBe(" ────── \n");
      expect(segmentText(SIMPLE.getRow([3, 2], "row"))).toBe("        \n");
    });
  });

  describe("all pre-built constants are instances of Box", () => {
    const prebuilt = {
      ASCII,
      ASCII2,
      ASCII_DOUBLE_HEAD,
      SQUARE,
      SQUARE_DOUBLE_HEAD,
      MINIMAL,
      MINIMAL_HEAVY_HEAD,
      MINIMAL_DOUBLE_HEAD,
      SIMPLE,
      SIMPLE_HEAD,
      SIMPLE_HEAVY,
      HORIZONTALS,
      ROUNDED,
      HEAVY,
      HEAVY_EDGE,
      HEAVY_HEAD,
      DOUBLE,
      DOUBLE_EDGE,
      MARKDOWN,
    };

    for (const [name, box] of Object.entries(prebuilt)) {
      it(`${name} is an instance of Box`, () => {
        expect(box).toBeInstanceOf(Box);
      });
    }
  });
});
