/*
 * The Node the floor probe runs on, and what the consumer installs beside the
 * tarball: both derived from the checkout, neither typed.
 *
 * [LAW:one-source-of-truth] The floor is the lowest version `engines.node`
 * admits, judged with `semver`, the comparator `test/seam/node-floor.ts`
 * already judges that field with. A literal would be the fifth copy of a fact
 * that has gone stale four times (CLAUDE.md, "Only a package a consumer
 * receives sets the Node floor").
 *
 * [LAW:no-silent-failure] A range of several comparator sets — the
 * `^20.19.0 || >=22.12.0` shape — has one floor per set, and this job runs one
 * Node. Probing only the lowest would report a range it half checked, so that
 * shape is refused here rather than probed.
 *
 * An optional peer goes into the consumer install when the lockfile records it
 * as admitting the floor: a consumer on the floor can install it, so the
 * subpaths behind it are part of what must run there. A peer whose `engines`
 * excludes the floor is left out, and the probe reports its subpaths under
 * `needsPeer`. Which subpath may reach which peer is `test/seam/optional-peers.ts`'s
 * rule, not this file's.
 */

import { appendFileSync, readFileSync } from "node:fs";
import semver from "semver";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));

const range = new semver.Range(manifest.engines.node);
if (range.set.length !== 1) {
  throw new Error(
    `engines.node "${manifest.engines.node}" has ${range.set.length} comparator sets, ` +
      `so it has that many floors, and the node-floor job runs one Node`,
  );
}
const floor = semver.minVersion(range).version;

const optionalPeers = Object.entries(manifest.peerDependenciesMeta ?? {})
  .filter(([, meta]) => meta.optional === true)
  .map(([name]) => name);
const peers = optionalPeers.map((name) => {
  const locked = lockfile.packages[`node_modules/${name}`];
  if (locked === undefined) {
    throw new Error(`optional peer ${name} is not in package-lock.json, so its engines cannot be read`);
  }
  // A package that declares no `engines` admits every Node; npm reads it the same way.
  const engines = locked.engines?.node;
  return { name, engines, admitted: engines === undefined || semver.satisfies(floor, engines) };
});
const install = peers.filter((p) => p.admitted).map((p) => `${p.name}@${manifest.peerDependencies[p.name]}`);

// [LAW:nothing-unseen] Which floor was derived, and why each peer is or is not installed.
console.log(JSON.stringify({ event: "node-floor-plan", engines: manifest.engines.node, floor, peers }));
appendFileSync(process.env.GITHUB_OUTPUT, `version=${floor}\npeers=${install.join(" ")}\n`);
