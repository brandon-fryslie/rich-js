/*
 * The rule behind "installing this package does not install mobx": which
 * third-party packages each public entry point obliges a consumer to have,
 * checked against what `package.json` actually promises them.
 *
 * A dependency moved to an optional peer is off the install path for
 * everyone, which is the whole point and also the whole hazard. The package
 * stays in `devDependencies`, so it resolves perfectly in this checkout —
 * every test passes, every demo runs, the docs build — and the first import
 * of it from `src/core/` breaks nobody here and everybody downstream, at
 * `npm install` time, in a project whose author has never heard of this
 * file. That is a failure no suite in this repository could otherwise see,
 * because the thing that would fail is the absence of a package we have.
 *
 * So the rule asks the question the consumer's installer asks, and answers
 * it from the module graph rather than from the manifest's own say-so:
 *
 *   - a package reachable from any entry point and declared nowhere is
 *     broken for every consumer, optional or not;
 *   - a package `package.json` marks an optional peer is reachable only
 *     from the entry points listed as requiring it, and reaching it from
 *     any other is a default-path consumer importing something they were
 *     never asked to install;
 *   - a listed entry point that cannot in fact reach the package has
 *     outlived the import it was granted for, so the list cannot quietly
 *     accumulate permissions nobody needs.
 *
 * [LAW:effects-at-boundaries] Nothing here reads a file. The reachability
 * arrives as data — `graph.ts` gathers it at the edge — so the verdict is a
 * pure function of (what the graph found, what the manifest says, what the
 * table allows), and the fixtures next door can hand it a graph this
 * repository does not contain.
 */

import { type PackageManifest } from "../coverage/extract.js";

/**
 * The entry points that may reach one optional peer, and why it is theirs.
 *
 * [LAW:one-source-of-truth] This table does not say *which* packages are
 * optional peers — `package.json` says that, and the gate next door asserts
 * these two name the same set. npm has no field for the other half of the
 * fact, the subpath a consumer opts into to get the package, so that half
 * is declared here and checked against the graph. Split this way there is
 * one authority per fact rather than two lists that agree until they don't.
 *
 * `why` is required for the reason `CORE_LAYER.sanctioned` and `HOST_ACCESS`
 * require theirs: an exemption whose argument is not written next to it gets
 * copied by the next person who needs one.
 */
export interface PeerProvider {
  /** Published specifiers, as `ENTRY_BY_SPECIFIER` keys them. */
  readonly entries: readonly string[];
  readonly why: string;
}

export const PEER_PROVIDERS: Readonly<Record<string, PeerProvider>> = {
  "@promptctl/go-template-js": {
    entries: ["@promptctl/rich-js/template-bindings"],
    why:
      "The engine is the grammar this subsystem binds styling functions into, " +
      "and nothing outside `src/template-bindings/` imports it. It costs a " +
      "consumer more than its own weight — `@noble/hashes` arrives with it — " +
      "and buys nothing at all for a program that never authored a template.",
  },
  mobx: {
    entries: ["@promptctl/rich-js/widgets"],
    why:
      "The widget layer's observable state is mobx's, and nothing outside " +
      "`src/widgets/` imports it. A consumer who only wanted a Table pays " +
      "neither the bundle nor the install; one who mounts a Screen installs " +
      "mobx alongside this package, which is what the `./widgets` subpath " +
      "already asks of them.",
  },
};

/** One package an entry point's module graph requires at runtime. */
export interface PackageReach {
  /** The published specifier the walk started from. */
  readonly entry: string;
  readonly package: string;
  /** Repo-relative path of the module that names it. */
  readonly file: string;
  readonly line: number;
  /** The import chain from `entry` to `file`, inclusive of both ends. */
  readonly via: readonly string[];
}

/**
 * One way the manifest's promise and the module graph disagree.
 *
 * [LAW:types-are-the-program] `stale-provider-entry` carries no file and no
 * line, and could not: it reports the *absence* of an import, so there is no
 * site to name. Making it a variant rather than a record with optional
 * position fields means a reader of a failure gets the fields that exist and
 * cannot print `undefined:undefined` for the one shape that has no position.
 */
export type PeerViolation =
  | {
      readonly rule: "undeclared-package";
      readonly package: string;
      readonly entry: string;
      readonly file: string;
      readonly line: number;
      readonly via: readonly string[];
    }
  | {
      readonly rule: "optional-peer-on-default-path";
      readonly package: string;
      readonly entry: string;
      readonly file: string;
      readonly line: number;
      readonly via: readonly string[];
    }
  | {
      readonly rule: "stale-provider-entry";
      readonly package: string;
      readonly entry: string;
    };

/** The packages `package.json` says a consumer may not have installed. */
export function optionalPeers(manifest: PackageManifest): ReadonlySet<string> {
  const meta = manifest.peerDependenciesMeta ?? {};
  return new Set(
    Object.keys(manifest.peerDependencies ?? {}).filter((name) => meta[name]?.optional === true),
  );
}

/**
 * Every package name the manifest promises a consumer will have on hand.
 *
 * The package's own name is one of them, and not as an exemption: a module
 * here that imports `@promptctl/rich-js/host` is resolved by node through
 * this package's own `exports` map, so there is nothing for a consumer to
 * install and nothing for the manifest to declare.
 */
function declaredPackages(manifest: PackageManifest): ReadonlySet<string> {
  return new Set([
    ...(manifest.name === undefined ? [] : [manifest.name]),
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
}

/**
 * Every disagreement between what `reaches` found and what `manifest` and
 * `providers` promise, in one pass over each.
 *
 * [LAW:dataflow-not-control-flow] All three arms are computed on every call
 * and concatenated; an empty result is what "nothing wrong" looks like, not
 * a branch that skipped the work.
 */
export function peerViolations(
  reaches: readonly PackageReach[],
  manifest: PackageManifest,
  providers: Readonly<Record<string, PeerProvider>>,
): PeerViolation[] {
  const declared = declaredPackages(manifest);
  const optional = optionalPeers(manifest);
  // A package with no row is allowed nowhere. Absence maps onto the
  // strictest answer rather than a permissive one, so forgetting the row
  // reports every reach and names the fix instead of passing silently.
  const allowedEntries = (name: string): readonly string[] => providers[name]?.entries ?? [];

  const undeclared = reaches
    .filter((reach) => !declared.has(reach.package))
    .map((reach): PeerViolation => ({ rule: "undeclared-package", ...reach }));

  const onDefaultPath = reaches
    .filter(
      (reach) => optional.has(reach.package) && !allowedEntries(reach.package).includes(reach.entry),
    )
    .map((reach): PeerViolation => ({ rule: "optional-peer-on-default-path", ...reach }));

  const stale = Object.entries(providers).flatMap(([name, provider]) =>
    provider.entries
      .filter((entry) => !reaches.some((r) => r.package === name && r.entry === entry))
      .map((entry): PeerViolation => ({ rule: "stale-provider-entry", package: name, entry })),
  );

  return [...undeclared, ...onDefaultPath, ...stale];
}

/** A failure line naming the offence, the site, and how the site was reached. */
export function describePeerViolation(violation: PeerViolation): string {
  if (violation.rule === "stale-provider-entry") {
    return (
      `  ${violation.package}: PEER_PROVIDERS lists ${violation.entry}, which no ` +
      `longer imports it — drop the entry, or the whole row if nothing reaches it.`
    );
  }
  const offence =
    violation.rule === "undeclared-package"
      ? `imports ${JSON.stringify(violation.package)}, which package.json declares nowhere`
      : `imports the optional peer ${JSON.stringify(violation.package)}, which a ` +
        `consumer of ${violation.entry} is never asked to install`;
  return `  ${violation.file}:${violation.line} — ${offence}\n      reached by: ${violation.via.join(" → ")}`;
}
