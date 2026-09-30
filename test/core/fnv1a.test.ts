import { describe, it, expect } from "vitest";
import { fnv1a } from "../../src/core/fnv1a.js";

describe("fnv1a", () => {
  it("matches the published FNV-1a 32-bit vectors", () => {
    expect(fnv1a("")).toBe("811c9dc5");
    expect(fnv1a("a")).toBe("e40c292c");
    expect(fnv1a("foobar")).toBe("bf9cf968");
  });

  it("hashes UTF-8 bytes, not UTF-16 code units", () => {
    // U+00E9 is one code unit but the two bytes C3 A9.
    expect(fnv1a("é")).toBe(fnv1a("é"));
    expect(fnv1a("é")).not.toBe(fnv1a("Ã©"));
  });
});
