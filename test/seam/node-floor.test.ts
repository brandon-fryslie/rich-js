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
  productionKeys,
  admittedByFlags,
  reachableFromRoot,
  describeProductionSet,
  packageNameFromKey,
  type InstalledPackage,
  type NodeRange,
  type LockEntry,
  type LockPackages,
} from "./node-floor.js";

interface Lockfile {
  readonly packages: LockPackages;
}

const LOCKFILE: Lockfile = JSON.parse(
  readFileSync(path.join(REPO_ROOT, "package-lock.json"), "utf-8"),
) as Lockfile;

const PRODUCTION = productionKeys(LOCKFILE.packages);

/**
 * Every package a consumer's default `npm install` puts on disk that declares
 * a Node range.
 *
 * Which packages those are is `productionKeys`' question and is answered twice
 * over there; this only turns the agreed keys into ranges. A package declaring
 * no `engines` is simply absent — it constrains nothing, and modelling it as
 * `*` would put a range in the list that no package actually asked for.
 */
function treeFrom(keys: readonly string[]): InstalledPackage[] {
  const tree: InstalledPackage[] = [];
  for (const key of keys) {
    const declared = LOCKFILE.packages[key]?.engines?.["node"];
    if (declared === undefined) continue;
    const name = packageNameFromKey(key);
    tree.push({ name, range: nodeRange(declared, name) });
  }
  return tree;
}

const TREE = treeFrom(PRODUCTION.kind === "agreed" ? PRODUCTION.keys : []);

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
   * [LAW:no-silent-failure] `TREE` is empty when the two derivations disagree,
   * and an empty tree makes `treeFloor` return `unconstrained` — every floor
   * assertion below would then pass by having nothing to check. So the
   * disagreement is asserted first and on its own, where it reads as the
   * failure it is rather than as a suspiciously quiet success.
   */
  it("is the same set whether read off npm's flags or walked from the root", () => {
    expect(PRODUCTION.kind, describeProductionSet(PRODUCTION)).toBe("agreed");
  });

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
        .map(([key]) => packageNameFromKey(key)),
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
 *
 * CLAUDE.md is on the list, and the reason it was once left off is worth
 * keeping: the argument was that it "points at the field rather than naming a
 * version." It does point at the field — and it names the version in the same
 * breath ("targeting Node.js >= 20; `package.json#engines` is the authority").
 * Naming the authority is better practice and buys exactly nothing here, because
 * the stale literal is still a literal. Three copies were checked and the fourth
 * was excused on a premise anyone could have read and disproved, which is how
 * this fact came to have three different answers in the first place.
 */
const DOCUMENTED_IN = ["README.md", "docs/introduction.md", "CLAUDE.md"];

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
 * The install-set derivation, pinned against lockfiles this repository does not
 * have — and in one case cannot have. Our own `package-lock.json` carries `dev`
 * 252 times, `optional` 76, `peer` once, and `devOptional` not at all. The flag
 * whose absence from the exclusion list was the entire review finding is the one
 * flag the live tree can never exercise, so every assertion about it lives here
 * or nowhere.
 *
 * [LAW:one-source-of-truth] Each derivation is pinned on its own as well as
 * through `productionKeys`, because asking twice only buys anything if the two
 * answers can differ. Fixtures that went exclusively through the agreed question
 * would pass just as happily with both halves computing the same mistake, which
 * is the failure the pair exists to rule out.
 */
describe("the install set, derived twice", () => {
  /**
   * A lockfile as npm writes one, which is wider than what the rule reads.
   *
   * `LockEntry` deliberately omits `peer` and `optionalDependencies` — omission
   * is how the rule refuses to consult them — so a fixture proving they are
   * ignored has to hand them back in. The widening belongs here, at the fixture,
   * and not in the type under test.
   */
  type RawLockPackages = Readonly<
    Record<
      string,
      LockEntry & {
        readonly peer?: boolean;
        readonly optionalDependencies?: Readonly<Record<string, string>>;
      }
    >
  >;

  it("agrees on a tree where the flags and the edges tell the same story", () => {
    const simple: LockPackages = {
      "": { dependencies: { a: "*" } },
      "node_modules/a": { dependencies: { b: "*" } },
      "node_modules/b": {},
      "node_modules/some-bundler": { dev: true },
    };
    expect(productionKeys(simple)).toEqual({
      kind: "agreed",
      keys: ["node_modules/a", "node_modules/b"],
    });
  });

  /**
   * Every flag on the list, one entry each, because a list is only as good as
   * its least-known member. `devOptional` is npm's mark for a package reachable
   * only as an optional dependency of a development one, and npm sets it
   * *instead of* `dev` and `optional` together — so an entry carrying it alone
   * sailed through a filter that looked for the other three and found none. That
   * is a devDependency's Node requirement reaching the published floor, which is
   * the bug this whole rule was written to prevent, arriving through the rule
   * itself.
   */
  it("excludes an entry npm marked with any listed flag", () => {
    const flagged: LockPackages = {
      "": {},
      "node_modules/shipped": {},
      "node_modules/a": { dev: true },
      "node_modules/b": { devOptional: true },
      "node_modules/c": { optional: true },
    };
    expect(admittedByFlags(flagged)).toEqual(["node_modules/shipped"]);
  });

  /**
   * `peer` is the flag deliberately *not* on the list, and it has to be written
   * into a fixture to stay off it — `LockEntry` no longer declares the field, so
   * an entry saying `{}` would pass whether or not the exclusion came back.
   *
   * npm 7 and later install a required peer dependency during a default install,
   * so its `engines` binds the floor. Excluding it would quietly lower the
   * computed floor beneath what the tree permits and leave the gate green about
   * it — the same leak as admitting a devDependency's range, pointed the other
   * way.
   */
  it("admits an entry npm marked only as a peer", () => {
    const peered: RawLockPackages = {
      "": {},
      "node_modules/required-peer": { peer: true },
      "node_modules/dev-peer": { peer: true, dev: true },
    };
    expect(admittedByFlags(peered)).toEqual(["node_modules/required-peer"]);
  });

  /**
   * The other half of that change, and the reason the two are one change. npm
   * records a peer under `peerDependencies`, never under `dependencies`, so a
   * walk reading only the latter would admit a required peer by flag and be
   * structurally incapable of reaching it — `disagreement` on every run for
   * every tree with a required peer, which is a gate nobody can satisfy rather
   * than a question anybody can answer.
   */
  it("follows a required peer edge, so both derivations see it", () => {
    const withRequiredPeer: RawLockPackages = {
      "": { dependencies: { a: "*" }, peerDependencies: { host: "^1" } },
      "node_modules/a": {},
      "node_modules/host": { peer: true },
    };
    expect(reachableFromRoot(withRequiredPeer).sort()).toEqual([
      "node_modules/a",
      "node_modules/host",
    ]);
    expect(productionKeys(withRequiredPeer)).toEqual({
      kind: "agreed",
      keys: ["node_modules/a", "node_modules/host"],
    });
  });

  /**
   * And stops at an optional one, read off `peerDependenciesMeta` — npm's own
   * record of which peers it installs. This is the shape our own root entry has:
   * `mobx` and `@promptctl/go-template-js` are both declared there as optional,
   * which is exactly why neither binds the published floor.
   */
  it("does not follow an optional peer edge", () => {
    const withOptionalPeer: RawLockPackages = {
      "": {
        dependencies: { a: "*" },
        peerDependencies: { engine: "^1" },
        peerDependenciesMeta: { engine: { optional: true } },
      },
      "node_modules/a": {},
      "node_modules/engine": { dev: true },
    };
    expect(reachableFromRoot(withOptionalPeer)).toEqual(["node_modules/a"]);
  });

  /**
   * Why there are two derivations rather than a longer flag list. A flag npm
   * invents next year is, to this rule, no flag at all, and an entry carrying
   * only that flag passes `admittedByFlags` untouched. It still has to be
   * *reached*, and it is not — so the pair goes red where the flag list alone
   * would have handed the entry to the floor with a straight face.
   */
  it("refuses to guess when an unflagged entry is reached by nothing", () => {
    const ghost: LockPackages = {
      "": { dependencies: { a: "*" } },
      "node_modules/a": {},
      "node_modules/marked-by-some-future-npm": {},
    };
    const set = productionKeys(ghost);
    expect(set.kind).toBe("disagreement");
    expect(set.kind === "disagreement" && set.onlyByFlags).toEqual([
      "node_modules/marked-by-some-future-npm",
    ]);
    expect(describeProductionSet(set)).toContain("devOptional");
  });

  /**
   * The other direction, which is this rule's model of npm being wrong rather
   * than npm's schema moving. It reports separately because the fix is
   * different: nothing about the flag list would help.
   */
  it("refuses to guess when a flag excludes an entry the edges reach", () => {
    const inconsistent: LockPackages = {
      "": { dependencies: { a: "*" } },
      "node_modules/a": { dev: true },
    };
    const set = productionKeys(inconsistent);
    expect(set.kind).toBe("disagreement");
    expect(set.kind === "disagreement" && set.onlyByReachability).toEqual(["node_modules/a"]);
    expect(describeProductionSet(set)).toContain("npm flagged");
  });

  /**
   * npm hoists what it can and nests what it cannot, so one name routinely sits
   * at two paths holding two versions. A walk that read the hoisted copy for a
   * dependent npm gave the nested one would take its `engines` off the wrong
   * package — a floor derived from a version nobody installs.
   */
  it("resolves a nested copy before the hoisted one", () => {
    const nested: LockPackages = {
      "": { dependencies: { a: "*" } },
      "node_modules/a": { dependencies: { shared: "*" } },
      "node_modules/a/node_modules/shared": {},
      "node_modules/shared": {},
    };
    expect(reachableFromRoot(nested).sort()).toEqual([
      "node_modules/a",
      "node_modules/a/node_modules/shared",
    ]);
  });

  /**
   * Optional edges are not followed, and the fixture has to widen
   * `optionalDependencies` back in to say so — `LockEntry` does not declare the
   * field, which is how the rule refuses to read it in the first place. The
   * claim is worth checking anyway, because "the type has no such field" stops
   * being the guarantee the moment someone adds one.
   *
   * npm installs an optional package where the host permits it and skips it
   * where the host does not, rather than failing the install. A package that can
   * be absent and leave the install working cannot bind the floor — the same
   * judgement the `optional` flag encodes, reached from the edge side.
   */
  it("does not follow an optional edge out of the root", () => {
    const optionalEdge: RawLockPackages = {
      "": { dependencies: { a: "*" }, optionalDependencies: { fsevents: "*" } },
      "node_modules/a": {},
      "node_modules/fsevents": {},
    };
    expect(reachableFromRoot(optionalEdge)).toEqual(["node_modules/a"]);
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

  /**
   * And it reports only the ranges that disagree. A tree of two is the shape
   * where this cannot be got wrong — every package is in the conflict by
   * definition — so the bug of listing the whole tree was invisible in the only
   * fixture that existed. `c` declares `*`, contains everything, holds up
   * nothing, and belongs nowhere near a message telling someone which two
   * manifests to go read.
   */
  it("names only the conflicting ranges, not every package beside them", () => {
    const floor = treeFloor([
      fixture("a", ">=20"),
      fixture("b", "^18 || ^22"),
      fixture("c", "*"),
    ]);
    expect(floor.kind === "incomparable" && floor.packages.map((p) => p.name)).toEqual([
      "a",
      "b",
    ]);
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
