/*
 * The guard that makes an untagged publish impossible, exercised against real
 * repositories.
 *
 * [LAW:verifiable-goals] Six of this package's eleven published versions have no
 * git tag, and none of the six can be given one now: npm's recorded `gitHead`
 * names a commit that no longer exists for five of them, and three of the
 * versions never appear in master's history at all. That history is
 * unrecoverable, so the only thing left to establish is that it cannot happen
 * again — a claim about `scripts/verify-release-tag.mjs`, and this is the form
 * the unit suite can hold it in.
 *
 * [LAW:behavior-not-structure] What is asserted is the contract npm meets at
 * publish time: given a tree in some state, does the guard exit zero. Nothing
 * here reaches inside the script, so it may be rewritten in any shape that still
 * refuses the same trees. The fixtures are real git repositories in a temp
 * directory rather than a mocked `git`, because half of what is under test is
 * the question the guard asks git, and a mock would answer a question of this
 * test's own invention.
 *
 * The fixture runs a byte copy of the script rather than the file in place, and
 * that is forced by the design being tested: the guard resolves its package root
 * from its own module URL so that it always governs the repository it ships in,
 * whichever directory invoked it. A root parameter would make it testable in
 * place and would exist for no other reason — a seam cut for a test's
 * convenience, in the one file whose whole job is to be un-bypassable.
 *
 * WHAT THIS CANNOT SEE. That npm still runs `prepublishOnly`, and still aborts on
 * a non-zero exit, is npm's behavior rather than this repository's. It was
 * established by running a throwaway package against npm 11.19.0 — `npm publish
 * --dry-run` fired `prepublishOnly` and a non-zero exit stopped the publish,
 * while `npm pack` and `npm install` did not fire it at all — and it is assumed
 * from here. An npm that dropped the hook would leave this suite green and the
 * gate gone. The last test is the only part of that chain this suite can hold:
 * that the manifest still points the hook at the script.
 */

import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { REPO_ROOT, PACKAGE_MANIFEST } from "../coverage/extract.js";

const GUARD_RELATIVE = "scripts/verify-release-tag.mjs";
const GUARD_PATH = path.join(REPO_ROOT, GUARD_RELATIVE);

interface GuardResult {
  readonly status: number;
  readonly output: string;
}

/**
 * Build a throwaway package around a byte copy of the guard and run it.
 *
 * Each entry of `tagCommands` is the argument list for one `git tag` — the
 * variability lives in those values rather than in flags on this helper, so a
 * lightweight tag, an annotated one, and several at once are the same code path
 * with different data. `git: false` skips repository creation, which is the tree
 * the guard must refuse rather than assume.
 */
function runGuard(
  version: string,
  tagCommands: readonly (readonly string[])[],
  options: { readonly git: boolean } = { git: true },
): GuardResult {
  const root = mkdtempSync(path.join(tmpdir(), "release-tag-"));
  try {
    mkdirSync(path.join(root, "scripts"));
    copyFileSync(GUARD_PATH, path.join(root, GUARD_RELATIVE));
    writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture", version }));

    const git = (...args: readonly string[]): void => {
      execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", ...args], {
        cwd: root,
        stdio: ["ignore", "ignore", "pipe"],
      });
    };

    if (options.git) {
      git("init", "-q", "-b", "main");
      git("add", "-A");
      git("commit", "-qm", "fixture");
      for (const command of tagCommands) git("tag", ...command);
    }

    const run = spawnSync(process.execPath, [path.join(root, GUARD_RELATIVE)], { encoding: "utf8" });
    return { status: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("release-tag guard", () => {
  it("publishes a version whose tag is on the commit", () => {
    const result = runGuard("1.2.3", [["v1.2.3"]]);

    expect(result.status).toBe(0);
    expect(result.output).toContain("v1.2.3");
  });

  it("accepts an annotated tag, which a release may reasonably use", () => {
    const result = runGuard("1.2.3", [["-a", "v1.2.3", "-m", "release 1.2.3"]]);

    expect(result.status).toBe(0);
  });

  it("refuses a commit carrying no tags, and says which tag it wanted", () => {
    const result = runGuard("1.2.3", []);

    expect(result.status).toBe(1);
    expect(result.output).toContain("git tag v1.2.3");
  });

  /*
   * This is the case that keeps a deliberately mismatched tag a safe way to
   * exercise the release path end to end: the run reaches the registry step and
   * stops there, so the whole workflow can be exercised with no chance of an
   * artifact being published. The `publish.yml` step that used to own that
   * property was deleted when the guard landed, and this is where it now lives.
   */
  it("refuses a commit whose only tag names a different version, and names what it found", () => {
    const result = runGuard("1.2.3", [["v9.9.9"]]);

    expect(result.status).toBe(1);
    expect(result.output).toContain("v9.9.9");
  });

  it("publishes when the right tag shares the commit with unrelated ones", () => {
    const result = runGuard("1.2.3", [["v1.2.3"], ["nightly"]]);

    expect(result.status).toBe(0);
  });

  it("refuses a tree that is not a repository rather than assuming it is tagged", () => {
    const result = runGuard("1.2.3", [], { git: false });

    expect(result.status).toBe(1);
    expect(result.output).toContain("could not read");
  });

  /*
   * [LAW:single-enforcer] The rule above is enforced in exactly one place, and
   * this is the wiring that puts it there. It is the one assertion here that
   * reads the manifest instead of a behavior, and it earns that: every test above
   * would stay green if `prepublishOnly` were dropped from package.json in a
   * refactor, leaving a guard that works perfectly and is never run.
   */
  it("is the script npm runs on prepublishOnly", () => {
    expect(PACKAGE_MANIFEST.scripts?.["prepublishOnly"]).toContain(GUARD_RELATIVE);
    expect(existsSync(GUARD_PATH)).toBe(true);
  });
});
