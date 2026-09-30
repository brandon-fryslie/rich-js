/*
 * The guard that refuses a publish missing its own entry points, run against
 * real throwaway packages.
 *
 * [LAW:behavior-not-structure] As in release-tag.test.ts, the fixture runs a byte
 * copy of the script inside a package the test arranges, because the guard
 * resolves its package root from its own module URL. What is asserted is the
 * exit status and what it names, against what real `npm pack` would pack.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { REPO_ROOT, PACKAGE_MANIFEST } from "../../scripts/repo-facts.js";

const GUARD_RELATIVE = "scripts/verify-entry-points.mjs";
const GUARD_PATH = path.join(REPO_ROOT, GUARD_RELATIVE);

interface Fixture {
  readonly manifest: Record<string, unknown>;
  /** Files written into the package, relative to its root. */
  readonly files: readonly string[];
  /** Invoke the guard through a symlink to the package directory. */
  readonly viaSymlink?: boolean;
}

function runGuard({ manifest, files, viaSymlink = false }: Fixture): { status: number; output: string } {
  const root = mkdtempSync(path.join(tmpdir(), "entry-points-"));
  try {
    const pkg = path.join(root, "pkg");
    mkdirSync(path.join(pkg, "scripts"), { recursive: true });
    copyFileSync(GUARD_PATH, path.join(pkg, GUARD_RELATIVE));
    writeFileSync(path.join(pkg, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0", ...manifest }));
    for (const file of files) {
      mkdirSync(path.dirname(path.join(pkg, file)), { recursive: true });
      writeFileSync(path.join(pkg, file), "export {};\n");
    }
    const invokedRoot = viaSymlink ? path.join(root, "link") : pkg;
    if (viaSymlink) symlinkSync(pkg, invokedRoot, "dir");

    const run = spawnSync(process.execPath, [path.join(invokedRoot, GUARD_RELATIVE)], { encoding: "utf8" });
    return { status: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const MANIFEST = {
  files: ["dist"],
  main: "dist/index.js",
  types: "dist/index.d.ts",
  exports: {
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
    "./sub": { types: "./dist/sub.d.ts", import: "./dist/sub.js" },
  },
};
const BUILT = ["dist/index.js", "dist/index.d.ts", "dist/sub.js", "dist/sub.d.ts"];

describe("entry-points guard", () => {
  it("publishes when every declared entry point is in the tarball", () => {
    const result = runGuard({ manifest: MANIFEST, files: BUILT });
    expect(result.status).toBe(0);
    expect(result.output).toContain("all 4 declared entry points");
  });

  // 0.18.0: a clean checkout with no build.
  it("refuses an unbuilt package and names every missing entry point", () => {
    const result = runGuard({ manifest: MANIFEST, files: [] });
    expect(result.status).toBe(1);
    for (const file of BUILT) expect(result.output).toContain(file);
  });

  it("refuses when only a nested export target is missing", () => {
    const result = runGuard({ manifest: MANIFEST, files: BUILT.filter((f) => f !== "dist/sub.d.ts") });
    expect(result.status).toBe(1);
    expect(result.output).toContain("dist/sub.d.ts");
  });

  // Present on disk is not in the tarball: `files` decides what ships. (An export
  // target, since npm packs `main` whatever `files` says — a rule a disk check
  // would have had to model.)
  it("refuses an entry point that exists but `files` does not pack", () => {
    const result = runGuard({
      manifest: { ...MANIFEST, exports: { ...MANIFEST.exports, "./lib": "./lib/index.js" } },
      files: [...BUILT, "lib/index.js"],
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain("lib/index.js");
  });

  it("still refuses when invoked through a symlinked checkout", () => {
    const result = runGuard({ manifest: MANIFEST, files: [], viaSymlink: true });
    expect(result.status).toBe(1);
  });

  /*
   * [LAW:single-enforcer] The wiring, as in release-tag.test.ts: every test above
   * stays green if the hook stops calling the script.
   */
  it("is a script npm runs on prepublishOnly", () => {
    expect(PACKAGE_MANIFEST.scripts?.["prepublishOnly"]).toContain(GUARD_RELATIVE);
    expect(existsSync(GUARD_PATH)).toBe(true);
  });

  // Trusted publishing matches the provenance claim against `repository`; without
  // it the CI publish fails E422 at release time and nothing earlier notices.
  it("declares the repository trusted publishing verifies against", () => {
    expect(PACKAGE_MANIFEST.repository).toEqual({
      type: "git",
      url: "https://github.com/brandon-fryslie/rich-js",
    });
  });
});
