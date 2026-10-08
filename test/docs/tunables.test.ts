import { describe, expect, it } from "vitest";
import { effectPrograms } from "../../examples/effects-playground/programs.js";
import { range, spelled, tunables } from "../../docs/.vitepress/tunables.js";

describe("tunables", () => {
  it("finds a capitalised constant, an object's properties and an ease, each where its literal stands", () => {
    const source = [
      `const CURVE: Curve = { seconds: 30, ease: EASES["ease-in-out"], swing: 1 };`,
      "const OWN = 0.45;",
      "const SLOT = P / 2;",
      "const lower = 3;",
      "const SHAPE: Shape = { own: OWN, depth: 0.4,",
      "  late: .6 };",
    ].join("\n");
    const found = tunables(source);
    expect(found.map((t) => [t.name, t.value])).toEqual([
      ["CURVE.seconds", 30],
      ["CURVE.ease", "ease-in-out"],
      ["CURVE.swing", 1],
      ["OWN", 0.45],
      ["SHAPE.depth", 0.4],
      ["SHAPE.late", 0.6],
    ]);
    for (const t of found) expect(source.slice(t.from, t.to)).toBe(t.kind === "ease" ? t.value : source.slice(t.from, t.to));
    expect(found.filter((t) => t.kind === "number").map((t) => Number(source.slice(t.from, t.to)))).toEqual([30, 1, 0.45, 0.4, 0.6]);
  });

  it("reaches the values that shape the dissolve's rebound", () => {
    const names = tunables(effectPrograms().dissolve).map((t) => t.name);
    for (const name of ["DISSOLVE_SHAPE.depth", "DISSOLVE_SHAPE.from", "DISSOLVE_SHAPE.to", "DISSOLVE_SHAPE.maskFrom", "DISSOLVE_SHAPE.maskTo", "DISSOLVE_SHAPE.late", "OWN"]) {
      expect(names).toContain(name);
    }
  });

  it("spans a share 0–1 and a larger number out to four times itself", () => {
    expect(range(0.4)).toEqual({ min: 0, max: 1, step: 0.01 });
    expect(range(30)).toEqual({ min: 0, max: 120, step: 1 });
    expect(spelled(0.1 + 0.2)).toBe("0.3");
  });
});
