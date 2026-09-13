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
 * publish time: given a repository and an origin in some state, does the guard
 * exit zero. Nothing here reaches inside the script, so it may be rewritten in
 * any shape that still refuses the same trees. The fixtures are real
 * repositories pushing to a real bare origin on disk rather than a mocked `git`,
 * because most of what is under test is the question the guard asks git, and a
 * mock would answer a question of this test's own invention. No network: a bare
 * repository in a temp directory is a perfectly good origin.
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

/** The repository a test arranges, and the one call that makes it ordinary. */
interface Arena {
  /** Run git in the work tree. */
  readonly git: (...args: string[]) => void;
  /** Create the work repository, wire `origin` to a bare repo, make one commit. */
  readonly scaffold: () => void;
}

/**
 * Build a throwaway package around a byte copy of the guard, let the test arrange
 * the repository around it, and run it.
 *
 * `arrange` receives the whole arena rather than a set of flags, so each test
 * states the world it means in git's own vocabulary — pushed or not pushed,
 * annotated or lightweight, origin present or removed — instead of this helper
 * growing a boolean per scenario. A test that never calls `scaffold` is testing
 * the tree that is not a repository at all.
 */
function runGuard(version: string, arrange: (arena: Arena) => void): GuardResult {
  const root = mkdtempSync(path.join(tmpdir(), "release-tag-"));
  try {
    const work = path.join(root, "work");
    const origin = path.join(root, "origin.git");
    mkdirSync(work);
    mkdirSync(path.join(work, "scripts"), { recursive: true });
    copyFileSync(GUARD_PATH, path.join(work, GUARD_RELATIVE));
    writeFileSync(path.join(work, "package.json"), JSON.stringify({ name: "fixture", version }));

    const git = (...args: string[]): void => {
      execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", ...args], {
        cwd: work,
        stdio: ["ignore", "ignore", "pipe"],
      });
    };

    const scaffold = (): void => {
      execFileSync("git", ["init", "-q", "--bare", origin], { stdio: ["ignore", "ignore", "pipe"] });
      git("init", "-q", "-b", "main");
      git("remote", "add", "origin", origin);
      git("add", "-A");
      git("commit", "-qm", "fixture");
    };

    arrange({ git, scaffold });

    const run = spawnSync(process.execPath, [path.join(work, GUARD_RELATIVE)], { encoding: "utf8" });
    return { status: run.status ?? -1, output: `${run.stdout}${run.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("release-tag guard", () => {
  it("publishes a version whose tag origin carries on this commit", () => {
    const result = runGuard("1.2.3", ({ git, scaffold }) => {
      scaffold();
      git("tag", "v1.2.3");
      git("push", "-q", "origin", "main", "--tags");
    });

    expect(result.status).toBe(0);
    expect(result.output).toContain("v1.2.3");
  });

  /*
   * An annotated tag reports its own object sha under `refs/tags/<name>` and the
   * commit only under the peeled `refs/tags/<name>^{}`. Querying just the plain
   * ref would refuse every annotated release, so this is the case that keeps the
   * peeled pattern in the ls-remote call.
   */
  it("publishes when the tag on origin is annotated rather than lightweight", () => {
    const result = runGuard("1.2.3", ({ git, scaffold }) => {
      scaffold();
      git("tag", "-a", "v1.2.3", "-m", "release 1.2.3");
      git("push", "-q", "origin", "main", "--tags");
    });

    expect(result.status).toBe(0);
  });

  it("refuses a commit no tag names, and says which tag it wanted", () => {
    const result = runGuard("1.2.3", ({ git, scaffold }) => {
      scaffold();
      git("push", "-q", "origin", "main");
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain("git tag v1.2.3");
  });

  /*
   * The case that decides where the guard asks its question. A tag sitting only
   * in the local ref store leaves npm holding a version that origin cannot
   * describe — which is the exact end state of the six releases this gate exists
   * to prevent a seventh of. A guard that read `git tag --points-at HEAD` would
   * pass this happily; that is why it reads origin instead.
   */
  it("refuses a tag that exists locally but was never pushed", () => {
    const result = runGuard("1.2.3", ({ git, scaffold }) => {
      scaffold();
      git("push", "-q", "origin", "main");
      git("tag", "v1.2.3");
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain("no such tag");
  });

  /*
   * This is what keeps a deliberately mismatched tag a safe way to exercise the
   * release path end to end: the run reaches the registry step and stops there,
   * so the whole workflow can be exercised with no chance of an artifact being
   * published. The `publish.yml` step that used to own that property was deleted
   * when the guard landed, and this is where it now lives.
   */
  it("refuses when origin's only tag names a different version", () => {
    const result = runGuard("1.2.3", ({ git, scaffold }) => {
      scaffold();
      git("tag", "v9.9.9");
      git("push", "-q", "origin", "main", "--tags");
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain("no such tag");
  });

  it("refuses when origin's tag for this version points at a different commit", () => {
    const result = runGuard("1.2.3", ({ git, scaffold }) => {
      scaffold();
      git("tag", "v1.2.3");
      git("push", "-q", "origin", "main", "--tags");
      git("commit", "-qm", "moved on", "--allow-empty");
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain("this commit");
  });

  it("refuses a repository with no origin rather than assuming it is tagged", () => {
    const result = runGuard("1.2.3", ({ git, scaffold }) => {
      scaffold();
      git("tag", "v1.2.3");
      git("remote", "remove", "origin");
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain("could not ask origin");
  });

  /*
   * The failure detail has to be git's own words. `execFileSync` wraps every
   * non-zero exit in "Command failed: <argv>", which names no cause and reads
   * identically for each of them, so this pins that the refusal quotes stderr.
   */
  it("refuses a tree that is not a repository, quoting what git said", () => {
    const result = runGuard("1.2.3", () => {});

    expect(result.status).toBe(1);
    expect(result.output).toContain("not a git repository");
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
