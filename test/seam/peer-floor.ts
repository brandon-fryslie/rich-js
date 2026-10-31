/*
 * Which version of each peer this repository compiles against, and whether a
 * consumer may hold an older one.
 *
 * `package.json#peerDependencies` promises `src/` works with a range of each
 * peer, and npm raises no warning for a consumer holding an old version the
 * range still admits. So when `src/` starts importing something newer than
 * the bottom of the range, that consumer's `./template-bindings` fails at module
 * link on a missing export, while everything here is green against the newer
 * copy. That happened on rich-animation-27tq.0gd: `marked` arrived in
 * go-template-js 0.11.0, the range read `^0.10.0`, and only a code review saw it.
 * `optional-peers.ts` cannot: it asks which subpath reaches a peer, never which
 * versions of the peer that code compiles against.
 *
 * [LAW:single-enforcer] This rule compiles nothing, on purpose. `npm run lint`
 * already compiles `src/` against the peers on disk and `npm test` already runs
 * there, so all that was missing is the fact that what is on disk is the floor.
 * With that held, a failure to compile at the floor is an ordinary lint failure
 * with an ordinary first error, and the suite exercises the floor as well, where
 * a second compile in a temp tree could only have said that it type-checks. That
 * second compile was the first plan for this rule: rich-unfiled-791c.25dh records
 * why it lost.
 *
 * The version read is the one on disk and not the lockfile's, because disk is
 * what lint compiled. The incident above was a tarball installed by hand with
 * `--no-save`: the lockfile went on saying 0.10.0 while tsc read 0.11.0. In CI
 * `npm ci` makes the two equal.
 *
 * [LAW:types-are-the-program] The `devDependencies` spec must be the floor too,
 * written exactly. A caret there admits the trees this rule refuses, so `npm
 * update` would walk off the floor, and npm writes that caret back on any plain
 * `npm install -D`, so the pin is checked rather than assumed. It is also what
 * makes an `npm ci` tree say the floor is published: an exact version resolves
 * from the registry, where a `file:` spec holding the same version would not.
 *
 * [LAW:effects-at-boundaries] Nothing in this module reads a file. The versions
 * arrive as data from the test next door, so the fixtures can hand it states this
 * repository is not in.
 *
 * WHAT THIS CANNOT SEE. A consumer resolves the newest version a range admits,
 * and the floor is the one version this repository ever exercises, so a green run
 * says nothing about the top of the range. And this rule holds up only one end of
 * the claim: "src/ compiles at the floor" is true because lint ran on this same
 * tree, not because this passed.
 */

import semver from "semver";

/** One peer: what the manifest promises, what it pins here, and what is on disk. */
export interface InstalledPeer {
  readonly name: string;
  /** As `package.json#peerDependencies` writes it. */
  readonly range: string;
  /** As `package.json#devDependencies` writes it. */
  readonly pin: string | undefined;
  /** `node_modules/<name>/package.json#version`. */
  readonly installed: string;
}

/** A peer compiled at a version other than the oldest one a consumer may hold. */
export interface PeerFloorViolation extends InstalledPeer {
  readonly floor: string;
}

/**
 * The lowest version `range` admits.
 *
 * `minVersion` answers null for a range nothing satisfies, such as `>2 <1`, and
 * throws an unattributed TypeError on one that is not a range, such as `latest`.
 * Either is a broken manifest rather than a version to compare, so both stop here
 * with the peer's name.
 */
function floorOf(peer: InstalledPeer): string {
  const floor = semver.validRange(peer.range) === null ? null : semver.minVersion(peer.range);
  if (floor === null) {
    throw new Error(`package.json#peerDependencies admits no version of ${peer.name}: ${peer.range}`);
  }
  return floor.version;
}

/**
 * Every peer whose pin or install is not its floor.
 *
 * One rule, not two directions: above or below, the same statement is false,
 * that what lint compiled is the oldest thing a consumer may hold. The pin is
 * compared as a string because `^7.0.3` is the wrong spec for the right version.
 */
export function peerFloorViolations(peers: readonly InstalledPeer[]): PeerFloorViolation[] {
  return peers
    .map((peer) => ({ ...peer, floor: floorOf(peer) }))
    .filter((peer) => peer.pin !== peer.floor || semver.neq(peer.installed, peer.floor));
}

/**
 * One violation, as the line a reader of a red run sees. It names no version to
 * install, because the floor of a range may never have been published.
 */
export function describePeerFloorViolation(violation: PeerFloorViolation): string {
  const { name, range, pin, installed, floor } = violation;
  return (
    `  ${name}: src/ is compiled against ${installed} and devDependencies reads ${pin}, but ` +
    `peerDependencies reads ${range}, whose lowest version is ${floor}. Make them one version ` +
    `published on npm: the range's lower bound, installed with ` +
    `\`npm install -D -E ${name}@<version>\`.`
  );
}
