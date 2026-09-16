/*
 * The sweep behind `readme-demos.ts`: read `README.md` and `package.json`, and
 * require the demo table to name the same script → demo pairs the manifest runs.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../coverage/extract.js";
import { readmeDemos, scriptedDemos } from "./readme-demos.js";

const readme = readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
const { scripts } = JSON.parse(
  readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
) as { scripts: Record<string, string> };

describe("the README's demo table matches the demo scripts", () => {
  // [LAW:verifiable-goals] Two empty lists agree. Check that each side found
  // what it is meant to find before trusting their agreement.
  it("finds the demos on both sides", () => {
    expect(scriptedDemos(scripts)).toContain("demo → rich-explore");
    expect(readmeDemos(readme)).toContain("demo → rich-explore");
  });

  it("lists every demo script once, with the demo it runs", () => {
    expect(readmeDemos(readme)).toEqual(scriptedDemos(scripts));
  });
});

describe("readme-demos rule", () => {
  const table = (...rows: string[]): string =>
    ["# pkg", "## Demos", "| Script | Demo | What it shows |", "|---|---|---|", ...rows, "## Next", "| `npm run other` | elsewhere | not a demo row |"].join("\n");

  it("reads only the rows under the Demos heading", () => {
    expect(readmeDemos(table("| `npm run strip` | rich-strip | Joiners. |"))).toEqual(["strip → rich-strip"]);
  });

  it("throws when the Demos heading is gone", () => {
    expect(() => readmeDemos("# pkg\n## Usage\n")).toThrow(/no `## Demos` section/);
  });

  it("pairs each demo script with the directory its command runs, and skips other scripts", () => {
    expect(
      scriptedDemos({
        build: "npm run clean && tsc",
        strip: "tsc -p tsconfig.demo.json && node dist-demo/examples/rich-strip/index.js",
        demo: "tsc -p tsconfig.demo.json && node dist-demo/examples/rich-explore/index.js --flag",
      }),
    ).toEqual(["demo → rich-explore", "strip → rich-strip"]);
  });
});
