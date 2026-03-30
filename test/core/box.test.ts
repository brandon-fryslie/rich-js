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
import { Style } from "../../src/core/style.js";

// Helper: extracts the concatenated text from a Segment array
function segmentText(segments: { text: string }[]): string {
  return segments.map((s) => s.text).join("");
}

describe("Box", () => {
  describe("construction", () => {
    it("exposes all character properties from BoxChars", () => {
      const chars = {
        topLeft: "A",
        top: "B",
        topDivider: "C",
        topRight: "D",
        headLeft: "E",
        headVertical: "F",
        headRight: "G",
        midLeft: "H",
        mid: "I",
        midVertical: "J",
        midRight: "K",
        bottomLeft: "L",
        bottom: "M",
        bottomDivider: "N",
        bottomRight: "O",
        left: "P",
        right: "Q",
        vertical: "R",
      };
      const box = new Box(chars);

      expect(box.topLeft).toBe("A");
      expect(box.top).toBe("B");
      expect(box.topDivider).toBe("C");
      expect(box.topRight).toBe("D");
      expect(box.headLeft).toBe("E");
      expect(box.headVertical).toBe("F");
      expect(box.headRight).toBe("G");
      expect(box.midLeft).toBe("H");
      expect(box.mid).toBe("I");
      expect(box.midVertical).toBe("J");
      expect(box.midRight).toBe("K");
      expect(box.bottomLeft).toBe("L");
      expect(box.bottom).toBe("M");
      expect(box.bottomDivider).toBe("N");
      expect(box.bottomRight).toBe("O");
      expect(box.left).toBe("P");
      expect(box.right).toBe("Q");
      expect(box.vertical).toBe("R");
    });
  });

  describe("pre-built styles have correct characters", () => {
    it("ASCII uses +, -, |", () => {
      expect(ASCII.topLeft).toBe("+");
      expect(ASCII.top).toBe("-");
      expect(ASCII.topRight).toBe("+");
      expect(ASCII.left).toBe("|");
      expect(ASCII.right).toBe("|");
      expect(ASCII.vertical).toBe("|");
      expect(ASCII.bottomLeft).toBe("+");
      expect(ASCII.bottom).toBe("-");
      expect(ASCII.bottomRight).toBe("+");
    });

    it("SQUARE uses light box-drawing characters", () => {
      expect(SQUARE.topLeft).toBe("\u250c"); // ┌
      expect(SQUARE.top).toBe("\u2500"); // ─
      expect(SQUARE.topRight).toBe("\u2510"); // ┐
      expect(SQUARE.left).toBe("\u2502"); // │
      expect(SQUARE.right).toBe("\u2502"); // │
      expect(SQUARE.bottomLeft).toBe("\u2514"); // └
      expect(SQUARE.bottomRight).toBe("\u2518"); // ┘
    });

    it("ROUNDED uses rounded corner characters", () => {
      expect(ROUNDED.topLeft).toBe("\u256d"); // ╭
      expect(ROUNDED.topRight).toBe("\u256e"); // ╮
      expect(ROUNDED.bottomLeft).toBe("\u2570"); // ╰
      expect(ROUNDED.bottomRight).toBe("\u256f"); // ╯
    });

    it("HEAVY uses heavy box-drawing characters", () => {
      expect(HEAVY.topLeft).toBe("\u250f"); // ┏
      expect(HEAVY.top).toBe("\u2501"); // ━
      expect(HEAVY.topRight).toBe("\u2513"); // ┓
      expect(HEAVY.left).toBe("\u2503"); // ┃
      expect(HEAVY.right).toBe("\u2503"); // ┃
      expect(HEAVY.bottomLeft).toBe("\u2517"); // ┗
      expect(HEAVY.bottomRight).toBe("\u251b"); // ┛
    });

    it("DOUBLE uses double-line box-drawing characters", () => {
      expect(DOUBLE.topLeft).toBe("\u2554"); // ╔
      expect(DOUBLE.top).toBe("\u2550"); // ═
      expect(DOUBLE.topRight).toBe("\u2557"); // ╗
      expect(DOUBLE.left).toBe("\u2551"); // ║
      expect(DOUBLE.right).toBe("\u2551"); // ║
      expect(DOUBLE.bottomLeft).toBe("\u255a"); // ╚
      expect(DOUBLE.bottomRight).toBe("\u255d"); // ╝
    });
  });

  describe("getTop()", () => {
    it("renders top border with edge for single column", () => {
      const result = segmentText(ASCII.getTop([5]));
      expect(result).toBe("+-----+\n");
    });

    it("renders top border with edge for multiple columns", () => {
      const result = segmentText(ASCII.getTop([3, 4]));
      expect(result).toBe("+---+----+\n");
    });

    it("renders top border without edge", () => {
      const result = segmentText(ASCII.getTop([3, 4], undefined, false));
      expect(result).toBe("---+----\n");
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
      expect(result).toBe("+--+---+----+\n");
    });
  });

  describe("getRow()", () => {
    it("renders head-level separator with edge", () => {
      // For ASCII, head level: left=headLeft="|", horizontal=mid="-", cross=headVertical="|", right=headRight="|"
      const result = segmentText(ASCII.getRow([3, 4], "head"));
      expect(result).toBe("|---|----|\n");
    });

    it("renders row-level separator with edge", () => {
      const result = segmentText(ASCII.getRow([3, 4], "row"));
      expect(result).toBe("|---+----|\n");
    });

    it("renders mid-level separator with edge", () => {
      const result = segmentText(ASCII.getRow([3, 4], "mid"));
      expect(result).toBe("|---+----|\n");
    });

    it("renders foot-level separator with edge", () => {
      const result = segmentText(ASCII.getRow([3, 4], "foot"));
      expect(result).toBe("|---+----|\n");
    });

    it("renders separator without edge", () => {
      const result = segmentText(ASCII.getRow([3, 4], "head", undefined, false));
      expect(result).toBe("---|----\n");
    });

    it("renders SQUARE head separator correctly", () => {
      // SQUARE head: left="│", horizontal="─", cross="│", right="│"
      const result = segmentText(SQUARE.getRow([3, 2], "head"));
      expect(result).toBe("│───│──│\n");
    });

    it("renders SQUARE row separator correctly", () => {
      // SQUARE row: left="├", horizontal="─", cross="┼", right="┤"
      const result = segmentText(SQUARE.getRow([3, 2], "row"));
      expect(result).toBe("├───┼──┤\n");
    });

    it("renders HEAVY head separator correctly", () => {
      // HEAVY head: left="┃", horizontal="━", cross="┃", right="┃"
      const result = segmentText(HEAVY.getRow([2, 3], "head"));
      expect(result).toBe("┃━━┃━━━┃\n");
    });
  });

  describe("getBottom()", () => {
    it("renders bottom border with edge for single column", () => {
      const result = segmentText(ASCII.getBottom([5]));
      expect(result).toBe("+-----+\n");
    });

    it("renders bottom border with edge for multiple columns", () => {
      const result = segmentText(ASCII.getBottom([3, 4]));
      expect(result).toBe("+---+----+\n");
    });

    it("renders bottom border without edge", () => {
      const result = segmentText(ASCII.getBottom([3, 4], undefined, false));
      expect(result).toBe("---+----\n");
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
    it("returns ASCII box when asciiOnly is true", () => {
      const result = ROUNDED.substitute({ asciiOnly: true });
      expect(result).toBe(ASCII);
    });

    it("safe replaces rounded corners with square equivalents", () => {
      const result = ROUNDED.substitute({ safe: true });
      // Rounded corners replaced with square equivalents
      expect(result.topLeft).toBe("┌");
      expect(result.topRight).toBe("┐");
      expect(result.bottomLeft).toBe("└");
      expect(result.bottomRight).toBe("┘");
      // Non-rounded characters preserved as-is
      expect(result.top).toBe("─");
      expect(result.left).toBe("│");
      expect(result.right).toBe("│");
      expect(result.vertical).toBe("│");
      expect(result.midVertical).toBe("┼");
    });

    it("safe on a box without problematic characters returns equivalent box", () => {
      const result = SQUARE.substitute({ safe: true });
      // SQUARE has no rounded corners, so all characters stay the same
      expect(result.topLeft).toBe("┌");
      expect(result.topRight).toBe("┐");
      expect(result.bottomLeft).toBe("└");
      expect(result.bottomRight).toBe("┘");
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

  describe("MARKDOWN character verification", () => {
    it("uses | for left, right, and vertical", () => {
      expect(MARKDOWN.left).toBe("|");
      expect(MARKDOWN.right).toBe("|");
      expect(MARKDOWN.vertical).toBe("|");
    });

    it("uses | for head columns and - for mid", () => {
      expect(MARKDOWN.headLeft).toBe("|");
      expect(MARKDOWN.headVertical).toBe("|");
      expect(MARKDOWN.headRight).toBe("|");
      expect(MARKDOWN.mid).toBe("-");
      expect(MARKDOWN.midLeft).toBe("|");
      expect(MARKDOWN.midVertical).toBe("|");
      expect(MARKDOWN.midRight).toBe("|");
    });

    it("uses spaces for top/bottom borders", () => {
      expect(MARKDOWN.topLeft).toBe(" ");
      expect(MARKDOWN.top).toBe(" ");
      expect(MARKDOWN.topRight).toBe(" ");
      expect(MARKDOWN.bottomLeft).toBe(" ");
      expect(MARKDOWN.bottom).toBe(" ");
      expect(MARKDOWN.bottomRight).toBe(" ");
    });
  });

  describe("additional pre-built style character assertions", () => {
    it("ASCII_DOUBLE_HEAD uses = for mid separator", () => {
      expect(ASCII_DOUBLE_HEAD.mid).toBe("=");
      expect(ASCII_DOUBLE_HEAD.midVertical).toBe("+");
      expect(ASCII_DOUBLE_HEAD.top).toBe("-");
      expect(ASCII_DOUBLE_HEAD.bottom).toBe("-");
      expect(ASCII_DOUBLE_HEAD.left).toBe("|");
      expect(ASCII_DOUBLE_HEAD.right).toBe("|");
    });

    it("MINIMAL uses spaces for corners and edges", () => {
      expect(MINIMAL.topLeft).toBe(" ");
      expect(MINIMAL.topRight).toBe(" ");
      expect(MINIMAL.bottomLeft).toBe(" ");
      expect(MINIMAL.bottomRight).toBe(" ");
      expect(MINIMAL.left).toBe(" ");
      expect(MINIMAL.right).toBe(" ");
      // But mid uses box-drawing
      expect(MINIMAL.mid).toBe("─");
      expect(MINIMAL.midVertical).toBe("─");
    });

    it("DOUBLE_EDGE uses double lines for outer edges and single for inner", () => {
      expect(DOUBLE_EDGE.topLeft).toBe("╔");
      expect(DOUBLE_EDGE.topRight).toBe("╗");
      expect(DOUBLE_EDGE.left).toBe("║");
      expect(DOUBLE_EDGE.right).toBe("║");
      expect(DOUBLE_EDGE.vertical).toBe("│");
      expect(DOUBLE_EDGE.headVertical).toBe("│");
      expect(DOUBLE_EDGE.midVertical).toBe("┼");
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
