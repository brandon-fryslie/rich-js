/*
 * Which Node versions this package refuses, and on whose authority.
 *
 * `package.json#engines` is the one field that can turn a consumer away at
 * install time, and until this rule landed it held `^20.19.0 || >=22.12.0`
 * — character for character the range `vite` declares. `vite` is a
 * devDependency; no consumer receives it. So the published package was
 * refusing Node 20.0-20.18, all of 21.x, and 22.0-22.11 on the say-so of a
 * build tool those consumers never install, and nothing anywhere recorded
 * that it was doing so.
 *
 * The prose that was supposed to record it had already failed twice. CLAUDE.md
 * attributed the floor to `@promptctl/go-template-js` being transitively
 * required, which stopped being true the moment that engine became an optional
 * peer; `docs/introduction.md` said Node >= 18, which was never true at all.
 * Four copies of one fact, three different answers, and the field itself
 * agreeing with none of them — so this rule derives the answer instead of
 * restating it.
 *
 * [LAW:one-source-of-truth] The floor is *computed*, not declared. There is no
 * allow-list here and no `why` field, because there is no human claim left for
 * one to justify: a consumer's installer checks `engines` for every package it
 * puts on disk, so the versions that install cleanly are exactly the
 * intersection of what those packages declare, and `engines.node` has to name
 * that set. A table of reasons would be a fifth copy of the fact, kept by hand,
 * drifting on the same schedule as the four that got us here.
 *
 * [LAW:effects-at-boundaries] Nothing in this module reads a file. The install
 * tree arrives as data — the test next door lifts it off `package-lock.json`,
 * which is where npm itself records which packages are production and what
 * each one's `engines` says — so every verdict below is a pure function of
 * (what the tree declares, what the manifest declares), and the fixtures can
 * hand it trees this repository does not contain. `semver` is imported rather
 * than injected: range algebra is computation, not contact with the world, and
 * a rule that took its own comparison operator as a parameter would be
 * offering a seam nobody needs on the one question it exists to answer.
 *
 * WHAT THIS CANNOT SEE, and it is the same shape of blindness `optional-peers.ts`
 * names: a consumer does not install from our lockfile. They resolve `^8.2.0`
 * themselves and may land on a `string-width` newer than ours, declaring a
 * floor we have never read. This rule checks the tree *we* resolved, which is
 * the best available evidence and not the consumer's. What it therefore proves
 * is narrower than "the floor is right for everyone": it proves the floor was
 * not copied from somewhere outside the install tree, which is the failure that
 * actually happened. Treat a green run as that, and no more.
 *
 * The second blind spot is larger and easier to mistake for coverage, so say it
 * out loud too: every range here is something a package *declares*, and this
 * rule only ever compares declarations. It does not run anything. The day
 * `src/` reaches for an API that landed in Node 22, every assertion below stays
 * green while the package breaks for everyone on 20, because no dependency's
 * manifest changed and nothing here executes a line of `src/`. That half is
 * held by a different kind of evidence entirely — a tarball packed, installed
 * under the lowest admitted Node, imported and rendered — which was done by
 * hand on the commit that set this floor and is recorded in its PR. CI cannot
 * stand in for it: `node-version-file` resolves a range to its *newest*
 * satisfying version, so the CI job exercises the top of the range and never
 * the bottom. `.github/workflows/ci.yml` says so where it configures that step.
 */

import semver from "semver";

/**
 * A Node version range that has been checked for syntax.
 *
 * [LAW:parse-dont-validate] Handed a malformed range, `semver.subset` throws
 * `Invalid comparator: node` from inside its own parser — naming neither the
 * package the range came from nor the field it was read out of, which is the
 * whole of what a reader needs. The brand makes that call unreachable without
 * a crossing: `nodeRange` is the only way to obtain one,
 * it fails loudly at the point of reading, and every function below demands
 * the stamped type in its signature, so no caller can pass a raw manifest
 * string on the argument that would explode three frames down.
 */
export type NodeRange = string & { readonly __nodeRange: unique symbol };

/**
 * The crossing. Takes the range as written and the source to blame if it is
 * garbage.
 *
 * The empty string gets its own arm rather than falling through to
 * `validRange`, which answers `*` for it — so a manifest that declares no
 * `engines.node` at all would otherwise be read as one declaring it accepts
 * every Node ever released. That is an answer-shaped void: the wrong fact, in
 * the shape of a right one, and it would surface three checks later as a floor
 * disagreement rather than here as a missing field.
 */
export function nodeRange(text: string, source: string): NodeRange {
  if (text === "") {
    throw new Error(`${source} declares no Node range at all`);
  }
  if (semver.validRange(text) === null) {
    throw new Error(
      `${source} declares a Node range npm cannot parse: ${JSON.stringify(text)}`,
    );
  }
  return text as NodeRange;
}

/** One package a consumer's default install puts on disk, and the Node it asks for. */
export interface InstalledPackage {
  /** As the lockfile keys it, e.g. `string-width`. */
  readonly name: string;
  readonly range: NodeRange;
}

/** The fields of one `package-lock.json` entry this rule reads. */
export interface LockEntry {
  readonly dev?: boolean;
  readonly devOptional?: boolean;
  readonly optional?: boolean;
  readonly engines?: Readonly<Record<string, string>>;
  readonly dependencies?: Readonly<Record<string, string>>;
}

/** `package-lock.json#packages`, keyed by install path; `""` is the root. */
export type LockPackages = Readonly<Record<string, LockEntry>>;

/**
 * The flags npm uses to mark an entry as something a consumer's default install
 * does not require.
 *
 * `devOptional` is the one that was missing, and its absence is the reason this
 * list is now a named constant with the semantics written down rather than a
 * condition inline. npm sets it *instead of* setting `dev` and `optional`
 * together, for a package reachable only as an optional dependency of a
 * development one — so an entry carrying it alone passes a check that looks for
 * the other three and finds none.
 *
 * `peer` is deliberately *not* here, and it was until review caught it. npm 7
 * and later install a required peer dependency as part of a default install, so
 * an entry marked only `peer` is on the consumer's disk and its `engines` binds
 * the floor like any other. Excluding it would drop that range silently, which
 * is the same bug as admitting a devDependency's, pointed the other way: the
 * declared floor comes out lower than the tree actually permits and the gate
 * stays green. An optional peer is a different animal and needs no flag here —
 * npm does not install one, so it has no entry unless something else pulled it
 * in, and that something else carries its own flag.
 *
 * Note what this list cannot promise: that it is complete. It is a claim about
 * npm's schema, which npm changes without asking, and the sentence that used to
 * sit here asserted a count ("the three ways npm records...") that was simply
 * wrong. `productionKeys` exists so the claim does not have to be right —
 * see the argument there.
 */
const EXCLUDED_BY_FLAG = ["dev", "devOptional", "optional"] as const;

/**
 * The package name inside a lockfile key.
 *
 * [LAW:single-enforcer] npm keys entries by install path, so the name is
 * whatever follows the last `node_modules/` — `node_modules/a/node_modules/b`
 * is `b`. One rule, one home: the slice was written out twice, and two copies
 * of a parse are two answers to "what is this package called" the day either
 * one learns about a lockfile shape the other has not met.
 */
export function packageNameFromKey(key: string): string {
  return key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
}

/** Entries npm has not flagged as excluded from a consumer's default install. */
export function admittedByFlags(packages: LockPackages): string[] {
  return Object.entries(packages)
    .filter(([key, entry]) => key !== "" && !EXCLUDED_BY_FLAG.some((flag) => entry[flag] === true))
    .map(([key]) => key);
}

/**
 * Entries reachable from the root's `dependencies`, following required edges.
 *
 * `optionalDependencies` are deliberately not followed. npm skips an optional
 * package whose `engines` the host fails rather than failing the install, so it
 * cannot bind a floor — which is the same judgement the `optional` flag encodes,
 * arrived at from the other side.
 */
export function reachableFromRoot(packages: LockPackages): string[] {
  const root = packages[""];
  const reached = new Set<string>();
  const queue = Object.keys(root?.dependencies ?? {}).map((name) => resolveFrom("", name, packages));

  while (queue.length > 0) {
    const key = queue.pop();
    if (key === undefined || reached.has(key)) continue;
    reached.add(key);
    for (const name of Object.keys(packages[key]?.dependencies ?? {})) {
      queue.push(resolveFrom(key, name, packages));
    }
  }
  return [...reached];
}

/**
 * Where npm would find `name` when `fromKey` asks for it: the dependent's own
 * nested tree first, then each enclosing one, ending at the top level.
 */
function resolveFrom(
  fromKey: string,
  name: string,
  packages: LockPackages,
): string | undefined {
  let scope = fromKey === "" ? "" : `${fromKey}/`;
  for (;;) {
    const candidate = `${scope}node_modules/${name}`;
    if (candidate in packages) return candidate;
    if (scope === "") return undefined;
    const enclosing = scope.lastIndexOf("node_modules/", scope.length - 2);
    scope = enclosing <= 0 ? "" : scope.slice(0, enclosing);
  }
}

/**
 * The install set, or the reason two derivations of it disagree.
 *
 * [LAW:one-source-of-truth] Asked twice, on purpose, because the honest answer
 * to "which packages does a consumer receive" is not available from either
 * question alone. Reading npm's flags trusts a list of flag names to be
 * complete, and it was not — `devOptional` was missing, which is a devDependency's
 * Node requirement leaking into the published floor, character for character the
 * bug this whole rule exists to prevent. Walking the dependency edges trusts this
 * rule's model of npm's resolution instead. Neither is worth trusting alone; the
 * pair is, because the failure that matters — an entry that should not be in the
 * floor ending up in it — has to fool both at once, and a flag npm invents
 * tomorrow fools only the first.
 *
 * So disagreement is a variant rather than a tie broken in favour of one side.
 * A rule that picked a winner here would be asserting exactly the completeness
 * it cannot establish.
 */
export type ProductionSet =
  | { readonly kind: "agreed"; readonly keys: readonly string[] }
  | {
      readonly kind: "disagreement";
      readonly onlyByFlags: readonly string[];
      readonly onlyByReachability: readonly string[];
    };

export function productionKeys(packages: LockPackages): ProductionSet {
  const byFlags = new Set(admittedByFlags(packages));
  const byReach = new Set(reachableFromRoot(packages));

  const onlyByFlags = [...byFlags].filter((key) => !byReach.has(key)).sort();
  const onlyByReachability = [...byReach].filter((key) => !byFlags.has(key)).sort();

  if (onlyByFlags.length > 0 || onlyByReachability.length > 0) {
    return { kind: "disagreement", onlyByFlags, onlyByReachability };
  }
  return { kind: "agreed", keys: [...byFlags].sort() };
}

/** A disagreement, as the line a reader of a red run sees. */
export function describeProductionSet(set: ProductionSet): string {
  if (set.kind === "agreed") return "";
  return (
    `Two derivations of "what a consumer's install puts on disk" disagree, so ` +
    `neither can be trusted to decide the Node floor.\n` +
    set.onlyByFlags
      .map(
        (key) =>
          `    ${key} carries no exclusion flag this rule knows, but nothing in ` +
          `package.json#dependencies reaches it. Either npm has a flag beyond ` +
          `${EXCLUDED_BY_FLAG.join(", ")} and it belongs on that list, or the ` +
          `entry really is installed and got there along an edge this walk does ` +
          `not follow — a required peer dependency is the one to check first.`,
      )
      .concat(
        set.onlyByReachability.map(
          (key) =>
            `    ${key} is reached from package.json#dependencies but npm flagged ` +
            `it as excluded. Either this rule's model of npm's resolution is ` +
            `wrong, or the lockfile is inconsistent.`,
        ),
      )
      .join("\n")
  );
}

/**
 * What the install tree permits, taken together.
 *
 * [LAW:types-are-the-program] Three variants because the domain has three
 * states, and the two that are not `bound` are the ones a weaker type would
 * lose. An intersection of ranges is not always expressible as any one of
 * them: `>=20` and `^18 || ^22` constrain each other without either
 * containing the other, and a rule that returned a bare string would have to
 * pick one and be wrong. Naming that state is what lets the gate stop and say
 * so rather than assert a floor nobody's tree agrees with.
 */
export type TreeFloor =
  /** Every declared range contains the one named here, so it *is* the intersection. */
  | { readonly kind: "bound"; readonly range: NodeRange; readonly by: readonly string[] }
  /** No package in the tree declares `engines.node`; nothing constrains the floor. */
  | { readonly kind: "unconstrained" }
  /**
   * No single declared range is contained in all the others.
   *
   * `packages` is the conflicting subset, not the whole tree. A package whose
   * range contains or is contained in every other one is comparable to all of
   * them and holds up nothing — listing it beside the pair that actually
   * disagree sends whoever is reading a red run to read manifests that were
   * never part of the problem.
   */
  | { readonly kind: "incomparable"; readonly packages: readonly InstalledPackage[] };

/**
 * The strictest range in the tree, when one range is strictest.
 *
 * Ties are the normal case rather than an edge one — two packages both asking
 * `>=20` are each contained in the other — so the answer is every package whose
 * range is contained in all of them, not the first such package. They all
 * denote one set by construction, and `by` reports the whole group because
 * "who is holding the floor up" is the question a reader has when the gate is
 * red.
 */
export function treeFloor(packages: readonly InstalledPackage[]): TreeFloor {
  if (packages.length === 0) return { kind: "unconstrained" };

  const strictest = packages.filter((candidate) =>
    packages.every((other) => semver.subset(candidate.range, other.range)),
  );
  const first = strictest[0];
  if (first === undefined) {
    // Only the ranges that disagree with something. When no range is strictest,
    // at least one pair must be mutually non-containing — that pair is the
    // finding, and a `*` sitting quietly in the same tree is not.
    const conflicting = packages.filter((candidate) =>
      packages.some(
        (other) =>
          !semver.subset(candidate.range, other.range) &&
          !semver.subset(other.range, candidate.range),
      ),
    );
    return { kind: "incomparable", packages: conflicting };
  }

  return { kind: "bound", range: first.range, by: strictest.map((p) => p.name) };
}

/**
 * A way `engines.node` and the install tree disagree.
 *
 * The two directions are separate variants because they are separate bugs with
 * separate fixes, and collapsing them into one "mismatch" would report the
 * dangerous one and the merely-rude one in the same words. `unsound` promises
 * consumers a Node their tree will refuse to install under; `overRestrictive`
 * turns away consumers nobody objected to — the one this rule was written for.
 */
export type FloorViolation =
  | {
      readonly kind: "unsound";
      readonly declared: NodeRange;
      readonly package: string;
      readonly range: NodeRange;
    }
  | {
      readonly kind: "overRestrictive";
      readonly declared: NodeRange;
      readonly permitted: NodeRange;
      readonly by: readonly string[];
    }
  | { readonly kind: "incomparable"; readonly packages: readonly InstalledPackage[] };

/** Every way the declared floor disagrees with the tree that has to honour it. */
export function floorViolations(
  declared: NodeRange,
  packages: readonly InstalledPackage[],
): FloorViolation[] {
  const violations: FloorViolation[] = [];

  // Reported per package rather than against the intersection alone: when the
  // declared range is too low it is one specific dependency that will refuse
  // the install, and naming it is the difference between a fix and a hunt.
  for (const pkg of packages) {
    if (!semver.subset(declared, pkg.range)) {
      violations.push({
        kind: "unsound",
        declared,
        package: pkg.name,
        range: pkg.range,
      });
    }
  }

  const floor = treeFloor(packages);
  if (floor.kind === "incomparable") {
    violations.push({ kind: "incomparable", packages: floor.packages });
  }
  if (floor.kind === "bound" && !semver.subset(floor.range, declared)) {
    violations.push({
      kind: "overRestrictive",
      declared,
      permitted: floor.range,
      by: floor.by,
    });
  }

  return violations;
}

/**
 * A sentence in human-facing prose that tells a reader which Node they need.
 *
 * These exist because a reader looking for the floor reads the README, not
 * `package.json`, and there is no way to serve them without stating the number
 * somewhere a machine did not derive it. So the copies stay, and this rule
 * makes them derived in the only sense available: they are read back and
 * checked against the field, rather than trusted because someone updated them
 * once.
 */
export interface ProseClaim {
  readonly file: string;
  readonly line: number;
  /** The whole matched phrase, for a message that shows what to edit. */
  readonly text: string;
  /** The major version the phrase names. */
  readonly major: number;
}

/**
 * Every "Node >= N" claim in one document.
 *
 * [LAW:no-silent-failure] The pattern is deliberately narrow, and the gate
 * that consumes it therefore insists each listed file yield at least one
 * match. A scan that quietly found nothing is the failure mode that makes a
 * text gate worse than no gate: it reads as coverage while the sentence it was
 * meant to hold has been reworded out of its reach. Zero matches means this
 * rule lost the claim, not that the claim is fine.
 */
export function nodeClaims(file: string, content: string): ProseClaim[] {
  const claims: ProseClaim[] = [];
  content.split("\n").forEach((line, index) => {
    for (const match of line.matchAll(/Node(?:\.js)?\**\s*(?:>=|≥)\s*\**(\d+)/g)) {
      claims.push({
        file,
        line: index + 1,
        text: match[0],
        major: Number(match[1]),
      });
    }
  });
  return claims;
}

/** A prose claim that has come loose from the field it describes. */
export type ClaimViolation =
  | { readonly kind: "wrongVersion"; readonly claim: ProseClaim; readonly major: number }
  | { readonly kind: "noClaim"; readonly file: string };

/** Every way the documented floor and the declared floor disagree. */
export function claimViolations(
  claims: readonly ProseClaim[],
  major: number,
  files: readonly string[],
): ClaimViolation[] {
  const violations: ClaimViolation[] = files
    .filter((file) => !claims.some((claim) => claim.file === file))
    .map((file) => ({ kind: "noClaim", file }) as const);

  for (const claim of claims) {
    if (claim.major !== major) violations.push({ kind: "wrongVersion", claim, major });
  }
  return violations;
}

/** One prose violation, as the line a reader of a red run sees. */
export function describeClaimViolation(violation: ClaimViolation): string {
  switch (violation.kind) {
    case "wrongVersion":
      return (
        `${violation.claim.file}:${violation.claim.line} tells a reader ` +
        `"${violation.claim.text}", but package.json#engines.node admits Node ` +
        `${violation.major} and up. Fix the sentence; the field is the authority.`
      );
    case "noClaim":
      return (
        `${violation.file} states no Node requirement this rule can find. Either ` +
        `the sentence was reworded past the pattern in \`nodeClaims\` — in which ` +
        `case this gate has silently stopped checking it — or the file no longer ` +
        `carries the claim and belongs off the list.`
      );
  }
}

/** One violation, as the line a reader of a red run sees. */
export function describeFloorViolation(violation: FloorViolation): string {
  switch (violation.kind) {
    case "unsound":
      return (
        `package.json#engines.node is ${violation.declared}, which admits a Node ` +
        `that ${violation.package} refuses (it declares ${violation.range}). A ` +
        `consumer on such a version installs this package and then fails on a ` +
        `dependency. Raise the declared floor to match.`
      );
    case "overRestrictive":
      return (
        `package.json#engines.node is ${violation.declared}, but every package a ` +
        `consumer's default install puts on disk permits ${violation.permitted} ` +
        `(held there by ${violation.by.join(", ")}). The versions in the gap are ` +
        `turned away on nobody's authority. Declare ${violation.permitted}, or — ` +
        `if src/ itself now needs a newer Node than any dependency does — say so ` +
        `here, because this rule deliberately has no allow-list to hide it in.`
      );
    case "incomparable":
      return (
        `No single dependency range is contained in all the others, so the set of ` +
        `Node versions a consumer's install permits is not any one of them:\n` +
        violation.packages.map((p) => `    ${p.name} declares ${p.range}`).join("\n") +
        `\n  Work out the intersection by hand, declare it, and teach this rule ` +
        `how to check it.`
      );
  }
}
