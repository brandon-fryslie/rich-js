import { describe, it, expect } from "vitest";
import { pyRstrip, pyStrip } from "../../src/renderables/python-space.js";

describe("python-space", () => {
  it("strips Python's whitespace, not JavaScript's: NEL and U+001F go, U+FEFF stays", () => {
    expect(pyRstrip("x \u0085\u001f\n")).toBe("x");
    expect(pyRstrip("x﻿")).toBe("x﻿");
    expect(pyStrip("\u0085 x \u001c")).toBe("x");
    expect(pyRstrip(" \t ")).toBe("");
  });

  it("strips in one pass however long a run of whitespace sits inside the text", () => {
    // A `[…]+$` pattern retries from every cell of the run: at this length, minutes.
    const text = " ".repeat(1_000_000) + "x";
    expect(pyRstrip(text + "  ")).toBe(text);
    expect(pyStrip(text)).toBe("x");
  });
});
