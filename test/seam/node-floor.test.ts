/*
 * [LAW:verifiable-goals] "This package installs on the Node versions it says it
 * does" was established the way it had to be — `npm pack`, then the tarball
 * installed into an empty project under a Node the old range excluded, and the
 * result imported and rendered. That check ran once, by hand, on the commit
 * that made it true, and it needs a machine to still hold next year. This is
 * that claim, in the form the unit suite can keep.
 *
 * [LAW:behavior-not-structure] What is asserted is the fact a consumer meets at
 * `npm install`: which Node versions this package turns away. Nothing here
 * cares how `src/` is arranged, and no rearrangement of it can go red.
 *
 * [LAW:effects-at-boundaries] The two reads live here, at the edge, and the
 * judgement lives in `node-floor.ts`. `package-lock.json` is the read that
 * matters: it is npm's own record of which packages a default install puts on
 * disk and what each one's `engines` says, so the tree arrives already
 * resolved rather than re-derived from `dependencies` by walking
 * `node_modules` and hoping the walk matches npm's.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { readFileSync } from "node:fs";
import semver from "semver";
import { REPO_ROOT, PACKAGE_MANIFEST } from "../coverage/extract.js";
import {
  nodeRange,
  treeFloor,
  floorViolations,
  describeFloorViolation,
  nodeClaims,
  claimViolations,
  describeClaimViolation,
  type InstalledPackage,
  type NodeRange,
} from "./node-floor.js";

/** The fields of `package-lock.json` this rule reads. */
interface Lockfile {
  readonly lockfileVersion: number;
  readonly packages: Readonly<
    Record<
      string,
      {
        readonly dev?: boolean;
        readonly peer?: boolean;
        readonly optional?: boolean;
        readonly engines?: Readonly<Record<string, string>>;
      }
    >
  >;
}

const LOCKFILE: Lockfile = JSON.parse(
  readFileSync(path.join(REPO_ROOT, "package-lock.json"), "utf-8"),
) as Lockfile;

/**
 * Every package a consumer's default `npm install` puts on disk that declares
 * a Node range.
 *
 * The three exclusions are the three ways npm records "on disk here, but not
 * for them": `dev` is this checkout's tooling, `peer` is what the consumer
 * opts into by installing it themselves, and `optional` is what npm will skip
 * without failing. A package declaring no `engines` is simply absent — it
 * constrains nothing, and modelling it as `*` would put a range in the list
 * that no package actually asked for.
 */
function productionTree(): InstalledPackage[] {
  const tree: InstalledPackage[] = [];
  for (const [key, entry] of Object.entries(LOCKFILE.packages)) {
    if (key === "") continue; // the root: this package, not something it installs
    if (entry.dev === true || entry.peer === true || entry.optional === true) continue;
    const declared = entry.engines?.["node"];
    if (declared === undefined) continue;
    const name = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
    tree.push({ name, range: nodeRange(declared, name) });
  }
  return tree;
}

const TREE = productionTree();

const DECLARED: NodeRange = nodeRange(
  PACKAGE_MANIFEST.engines?.["node"] ?? "",
  "package.json#engines.node",
);

/**
 * The floor as a bare major, which is the form prose states it in.
 *
 * [LAW:parse-dont-validate] Resolved once, here, into a `number` rather than
 * asserted non-null at the one place it is used. Every range that reaches this
 * line has already been through `nodeRange`, so a null minimum means something
 * has gone wrong in a way no assertion downstream could describe better.
 */
const FLOOR_MAJOR: number = ((): number => {
  const minimum = semver.minVersion(DECLARED);
  if (minimum === null) {
    throw new Error(`package.json#engines.node (${DECLARED}) has no minimum version`);
  }
  return minimum.major;
})();

describe("the install tree this rule reasons about", () => {
  /**
   * [LAW:no-silent-failure] A lockfile that has not caught up with
   * `package.json` yields a tree missing the very dependency someone just
   * added, and every assertion below would pass by checking a smaller world.
   * The gap is invisible from inside the derivation, so it is closed from
   * outside it.
   */
  it("accounts for every hard dependency package.json declares", () => {
    const lockedNames = new Set(
      Object.entries(LOCKFILE.packages)
        .filter(([key, entry]) => key !== "" && entry.dev !== true)
        .map(([key]) => key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length)),
    );
    const missing = Object.keys(PACKAGE_MANIFEST.dependencies ?? {}).filter(
      (name) => !lockedNames.has(name),
    );
    expect(
      missing,
      `package-lock.json has no production entry for ${missing.join(", ")}, so it ` +
        `is behind package.json and the Node floor below was derived from an ` +
        `install tree that is missing them. Run \`npm install\` and commit the ` +
        `lockfile.`,
    ).toEqual([]);
  });
});

describe("package.json#engines.node", () => {
  it("turns away no consumer its own dependencies would have accepted", () => {
    const failures = floorViolations(DECLARED, TREE).map(describeFloorViolation);
    expect(
      failures,
      `The declared Node floor has drifted from the one a consumer's install ` +
        `actually requires.\n\n  ${failures.join("\n\n  ")}\n`,
    ).toEqual([]);
  });

  /**
   * The contract, written out rather than derived, for the reason
   * `optional-peers.test.ts` writes its install costs out: derived from the
   * same source as the gate it sits under, it would restate that gate instead
   * of recording what the gate protects. This is the sentence the README and
   * the docs are allowed to repeat, and the one that goes red if it stops
   * being true.
   */
  it("is the floor string-width holds up, and string-width is the only thing holding it", () => {
    const floor = treeFloor(TREE);
    expect(floor.kind).toBe("bound");
    expect(floor.kind === "bound" && floor.by).toEqual(["string-width"]);
    expect(DECLARED).toBe(">=20");
  });
});

/**
 * The documents that tell a human which Node they need.
 *
 * [LAW:one-source-of-truth] Four copies of this fact is how the field came to
 * be wrong: `package.json` said `^20.19.0 || >=22.12.0`, README.md said 20,
 * `docs/introduction.md` said 18, and CLAUDE.md said 20 while naming the field
 * as the authority. Nothing read any of them, so the three that disagreed with
 * each other disagreed for four releases.
 *
 * They are not deduplicated away, because a reader looking for the floor opens
 * the README. They are demoted instead: still written out, no longer trusted.
 * CLAUDE.md is absent from the list on purpose — it points at the field rather
 * than naming a version, which is the better pattern and the one that needs no
 * checking.
 */
const DOCUMENTED_IN = ["README.md", "docs/introduction.md"];

describe("the documented floor", () => {
  it("names the version package.json actually declares", () => {
    const claims = DOCUMENTED_IN.flatMap((file) =>
      nodeClaims(file, readFileSync(path.join(REPO_ROOT, file), "utf-8")),
    );
    const failures = claimViolations(claims, FLOOR_MAJOR, DOCUMENTED_IN).map(
      describeClaimViolation,
    );
    expect(
      failures,
      `Prose that tells a reader which Node to run has come loose from the ` +
        `field that decides it.\n\n  ${failures.join("\n\n  ")}\n`,
    ).toEqual([]);
  });
});

/**
 * The rule, pinned from both sides against trees this repository does not have.
 *
 * The fixtures matter more here than in most seams, because the real tree
 * exercises exactly one shape — four packages, simple `>=` ranges, one of them
 * strictest. Every interesting way this can be wrong is a shape npm produces
 * routinely and our lockfile happens not to contain today.
 */
describe("the floor derivation", () => {
  const fixture = (name: string, range: string): InstalledPackage => ({
    name,
    range: nodeRange(range, name),
  });
  const declare = (range: string): NodeRange => nodeRange(range, "fixture");

  it("names the strictest range, and everything that ties for it", () => {
    const floor = treeFloor([fixture("a", ">=20"), fixture("b", ">=18"), fixture("c", ">=20")]);
    expect(floor).toEqual({ kind: "bound", range: ">=20", by: ["a", "c"] });
  });

  it("reports a tree whose ranges do not contain one another", () => {
    // Neither contains the other: 21.x satisfies `>=20` alone, 18.x the other alone.
    const floor = treeFloor([fixture("a", ">=20"), fixture("b", "^18 || ^22")]);
    expect(floor.kind).toBe("incomparable");
  });

  it("says nothing about a tree that declares nothing", () => {
    expect(treeFloor([])).toEqual({ kind: "unconstrained" });
  });

  /**
   * The bug this rule was written for, reproduced: a range lifted from a
   * package that is not in the tree. `vite` declares exactly this, `vite` is a
   * devDependency, and for four releases `engines.node` said it too.
   */
  it("catches a floor copied from outside the install tree", () => {
    const violations = floorViolations(
      declare("^20.19.0 || >=22.12.0"),
      [fixture("string-width", ">=20")],
    );
    expect(violations.map((v) => v.kind)).toEqual(["overRestrictive"]);
    expect(violations.map(describeFloorViolation).join("\n")).toContain("nobody's authority");
  });

  /**
   * The opposite failure, which no hand-written floor comparison catches: the
   * declared range has the *lower* minimum and is still not a subset, because
   * the dependency's range has a hole in it. Comparing minimum versions would
   * call `>=20.19.0` the stricter of the two and pass.
   */
  it("catches a floor that admits a version a dependency refuses", () => {
    const violations = floorViolations(
      declare(">=20.19.0"),
      [fixture("picky", "^20.19.0 || >=22.12.0")],
    );
    expect(violations.map((v) => v.kind)).toContain("unsound");
  });

  it("accepts a floor that is exactly what the tree permits", () => {
    expect(
      floorViolations(declare(">=20"), [fixture("a", ">=20"), fixture("b", ">=12")]),
    ).toEqual([]);
  });

  it("refuses a range npm could not parse, naming where it came from", () => {
    expect(() => nodeRange("node 20 or later", "some-package")).toThrow(
      /some-package declares a Node range npm cannot parse/,
    );
  });

  it("refuses a manifest that declares no range, separately from a bad one", () => {
    expect(() => nodeRange("", "package.json#engines.node")).toThrow(
      /declares no Node range at all/,
    );
  });
});

/**
 * The prose half, pinned the same way — and it needs the fixtures more than the
 * derivation does.
 *
 * The two live documents can only ever exercise the passing path, because a
 * document that has lost its claim is the thing being guarded against and is
 * never what is checked in. So `noClaim` — the arm that fires precisely when
 * this gate has stopped watching the sentence it was pointed at — would
 * otherwise ship having never run.
 */
describe("the documented-floor derivation", () => {
  it("reads the shapes both documents actually use", () => {
    expect(nodeClaims("README.md", "Requires Node.js >= 20. ESM-only.")).toEqual([
      { file: "README.md", line: 1, text: "Node.js >= 20", major: 20 },
    ]);
    expect(nodeClaims("docs/introduction.md", "It requires **Node.js ≥ 20** and is ESM-only.")).toEqual(
      [{ file: "docs/introduction.md", line: 1, text: "Node.js ≥ 20", major: 20 }],
    );
  });

  it("reports the line, so a red run says where to edit", () => {
    const claims = nodeClaims("a.md", "intro\n\nNode >= 18\n");
    expect(claims).toEqual([{ file: "a.md", line: 3, text: "Node >= 18", major: 18 }]);
  });

  it("catches a claim that disagrees with the field", () => {
    const claims = nodeClaims("docs/introduction.md", "It requires **Node.js ≥ 18**.");
    const violations = claimViolations(claims, 20, ["docs/introduction.md"]);
    expect(violations.map((v) => v.kind)).toEqual(["wrongVersion"]);
    expect(violations.map(describeClaimViolation).join("\n")).toContain("the field is the authority");
  });

  /**
   * The arm the live documents cannot reach. A reworded sentence — "requires at
   * least version 20 of Node.js" — carries the right number and still leaves
   * this rule watching nothing, so silence has to be a failure rather than a
   * pass.
   */
  it("fails on a document whose claim it can no longer find", () => {
    const claims = nodeClaims("README.md", "Requires at least version 20 of Node.js.");
    expect(claims).toEqual([]);
    const violations = claimViolations(claims, 20, ["README.md"]);
    expect(violations.map((v) => v.kind)).toEqual(["noClaim"]);
    expect(violations.map(describeClaimViolation).join("\n")).toContain(
      "silently stopped checking",
    );
  });

  it("passes a document that names the declared floor", () => {
    const claims = nodeClaims("README.md", "Requires Node.js >= 20.");
    expect(claimViolations(claims, 20, ["README.md"])).toEqual([]);
  });
});
