/*
 * The published tarball, built and packed from this checkout.
 *
 * [LAW:verifiable-goals] The claim is about an artifact, so the test makes one.
 * It does not read `dist/`, for two reasons. In CI there is none: the gate runs
 * `npm test` before anything builds. On a laptop, `dist/` is whatever the last
 * build left, so the answer would depend on history rather than on the tree.
 * Instead each test copies the checkout into a temp directory, runs the real
 * `npm run build` there, and asks `npm pack --dry-run --json` what it would
 * ship. The build script, `tsconfig.json`, `files` and the licence files are
 * all the ones under test, and nothing is modelled.
 *
 * The copy is every file git would commit: tracked files as they are on disk,
 * plus untracked files that are not ignored. So a `LICENSE` deleted but not yet
 * committed goes red here, before it goes red in CI. Ignored files stay behind,
 * `dist/` among them, which is why the stale-output test plants its own.
 * `node_modules` is a symlink back to the checkout, since installing it costs
 * far more than the build it is needed for.
 *
 * [LAW:behavior-not-structure] The second test is the ticket's acceptance
 * criterion run as a test: remove the licence files, turn maps back on, and the
 * rule must report it. That proves this gate still fails on the defects it
 * exists for, and a build per scenario is the price of proving it against a
 * real build rather than a fixture.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { REPO_ROOT } from "../coverage/extract.js";
import {
  describeViolation,
  parsePackListing,
  tarballViolations,
  type PackedFile,
} from "./tarball.js";

// Two builds of `src/` run in this file, each several seconds of tsc.
const BUILD_TIMEOUT_MS = 180_000;

/** Every file `git add -A` would commit, relative to the root. */
function committableFiles(): string[] {
  const listing = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  // A tracked file deleted in the working tree is still listed; the copy
  // mirrors the working tree, so it stays deleted.
  return listing
    .split("\0")
    .filter((file) => file !== "" && existsSync(path.join(REPO_ROOT, file)));
}

/**
 * Copy the checkout, let the test change the copy, build it, and return what
 * npm would pack from it.
 */
function packStaged(arrange: (stage: string) => void): PackedFile[] {
  const stage = mkdtempSync(path.join(tmpdir(), "tarball-"));
  try {
    for (const file of committableFiles()) {
      mkdirSync(path.dirname(path.join(stage, file)), { recursive: true });
      copyFileSync(path.join(REPO_ROOT, file), path.join(stage, file));
    }
    symlinkSync(path.join(REPO_ROOT, "node_modules"), path.join(stage, "node_modules"), "dir");
    arrange(stage);

    execFileSync("npm", ["run", "build"], { cwd: stage, stdio: ["ignore", "pipe", "pipe"] });
    const listing = parsePackListing(
      execFileSync("npm", ["pack", "--dry-run", "--json"], {
        cwd: stage,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
    return listing.map((file) => ({
      path: file,
      contents: readFileSync(path.join(stage, file), "utf8"),
    }));
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

/** Replace one exact fragment, failing loudly if the file no longer has it. */
function rewrite(file: string, from: string, to: string): void {
  const text = readFileSync(file, "utf8");
  if (!text.includes(from)) {
    throw new Error(`${file} no longer contains ${JSON.stringify(from)}; update this fixture`);
  }
  writeFileSync(file, text.replace(from, to));
}

describe("the published tarball", () => {
  it(
    "carries its licence files and no source maps, even over a stale build",
    () => {
      // Leftovers from an older build with maps turned on. `files` ships all
      // of `dist/`, so only the build's own clean step keeps these out.
      const files = packStaged((stage) => {
        mkdirSync(path.join(stage, "dist"));
        writeFileSync(path.join(stage, "dist", "stale.js"), "//# sourceMappingURL=stale.js.map\n");
        writeFileSync(path.join(stage, "dist", "stale.js.map"), "{}");
      });

      expect(tarballViolations(files).map(describeViolation)).toEqual([]);
      // A listing with nothing under dist/ would also pass the rule.
      expect(files.map((file) => file.path)).toContain("dist/index.js");
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    "is refused when the licence files are gone or maps are turned back on",
    () => {
      const files = packStaged((stage) => {
        rmSync(path.join(stage, "LICENSE"));
        rmSync(path.join(stage, "THIRD-PARTY-NOTICES"));
        const tsconfig = path.join(stage, "tsconfig.json");
        rewrite(tsconfig, `"sourceMap": false`, `"sourceMap": true`);
        rewrite(tsconfig, `"declarationMap": false`, `"declarationMap": true`);
      });

      expect(tarballViolations(files)).toEqual(
        expect.arrayContaining([
          { kind: "missing", path: "LICENSE" },
          { kind: "missing", path: "THIRD-PARTY-NOTICES" },
          { kind: "source-map", path: "dist/index.js.map" },
          { kind: "source-map", path: "dist/index.d.ts.map" },
          { kind: "map-reference", path: "dist/index.js" },
          { kind: "map-reference", path: "dist/index.d.ts" },
        ]),
      );
    },
    BUILD_TIMEOUT_MS,
  );
});

describe("tarballViolations", () => {
  const licences: PackedFile[] = [
    { path: "LICENSE", contents: "MIT License\n" },
    { path: "THIRD-PARTY-NOTICES", contents: "Rich\n" },
  ];

  it("refuses a map reference with no map beside it", () => {
    // What excluding `*.map` from `files` would ship: a smaller tarball, the
    // same dead reference.
    const files = [...licences, { path: "dist/index.js", contents: "x;\n//# sourceMappingURL=index.js.map\n" }];
    expect(tarballViolations(files)).toEqual([{ kind: "map-reference", path: "dist/index.js" }]);
  });

  it("refuses a licence file that ships empty", () => {
    const files = [{ path: "LICENSE", contents: "\n" }, licences[1]!];
    expect(tarballViolations(files)).toEqual([{ kind: "empty", path: "LICENSE" }]);
  });
});

describe("parsePackListing", () => {
  it("fails loudly on output it does not recognise", () => {
    expect(() => parsePackListing("[]")).toThrow(/expected one package/);
    expect(() => parsePackListing(`[{"name":"x"}]`)).toThrow(/no files array/);
  });
});
