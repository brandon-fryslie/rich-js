/*
 * Every exported renderable says which side of a line it sits on, and does
 * what it says. `line-ends.ts` owns the argument.
 */

import { describe, it, expect } from "vitest";
import { LINE_ENDS, endsOwnLine, exportedRenderables } from "./line-ends.js";

const UNIVERSE = exportedRenderables();

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
    expect(entry.build().constructor.name).toBe(name);
  });

  it.each(Object.entries(LINE_ENDS))("%s leaves the line it declares", (_name, entry) => {
    expect(endsOwnLine(entry.build(), 40)).toBe(entry.ends === "own-line");
  });
});
