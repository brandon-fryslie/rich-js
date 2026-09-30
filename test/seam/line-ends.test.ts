/*
 * Every exported renderable says which side of a line it sits on, and does
 * what it says. `line-ends.ts` owns the argument.
 */

import { describe, it, expect } from "vitest";
import { RichText } from "../../src/core/text.js";
import { ProgressBar } from "../../src/renderables/progressBar.js";
import { exportedRenderables } from "./exported-renderables.js";
import { LINE_ENDS, endsOwnLine, type LineEnd } from "./line-ends.js";

const UNIVERSE = exportedRenderables();

// A content of each kind, for a container that ends where its content does.
const ENDED = (): RichText => new RichText("x");
const OPEN = (): ProgressBar => new ProgressBar({ total: 10, completed: 5, width: 10 });

const sample = (entry: LineEnd) => (entry.ends === "content" ? entry.build(ENDED()) : entry.build());

describe("the line an exported renderable leaves", () => {
  it("is named once per class", () => {
    const names = UNIVERSE.map((cls) => cls.name);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  it("is declared for every exported renderable", () => {
    const missing = UNIVERSE.filter((cls) => !(cls.name in LINE_ENDS)).map((cls) => `  ${cls.name} (${cls.file})`);
    expect(missing, `add an entry to LINE_ENDS in test/seam/line-ends.ts:\n${missing.join("\n")}`).toEqual([]);
  });

  it("is declared for nothing that is no longer an exported renderable", () => {
    const names = new Set(UNIVERSE.map((cls) => cls.name));
    expect(Object.keys(LINE_ENDS).filter((name) => !names.has(name))).toEqual([]);
  });

  it.each(Object.entries(LINE_ENDS))("%s builds the class it is listed under", (name, entry) => {
    expect(sample(entry).constructor.name).toBe(name);
  });

  it.each(Object.entries(LINE_ENDS))("%s leaves the line it declares", (_name, entry) => {
    switch (entry.ends) {
      case "own-line":
      case "open":
        expect(endsOwnLine(entry.build(), 40)).toBe(entry.ends === "own-line");
        return;
      case "content":
        expect(endsOwnLine(entry.build(ENDED()), 40)).toBe(true);
        expect(endsOwnLine(entry.build(OPEN()), 40)).toBe(false);
    }
  });
});
