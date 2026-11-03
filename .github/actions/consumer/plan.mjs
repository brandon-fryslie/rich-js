/*
 * What one end of the supported range installs: the Node the probe runs on and
 * the peers beside the tarball, derived from the checkout, neither typed.
 *
 * [LAW:one-type-per-behavior] The floor and the ceiling are one check run on
 * two sets of data, so the end is an input and only this file reads it. Every
 * step after this one reads the plan it writes, never the end.
 *
 * FLOOR. The lowest version `engines.node` admits, judged with `semver`, the
 * comparator `test/seam/node-floor.ts` already judges that field with. A
 * literal would be the fifth copy of a fact that has gone stale four times
 * (CLAUDE.md, "Only a package a consumer receives sets the Node floor"). A
 * range of several comparator sets — the `^20.19.0 || >=22.12.0` shape — has
 * one floor per set, and this job runs one Node, so that shape is refused
 * rather than half checked. An optional peer is installed at its locked
 * version when the lockfile records it as admitting the floor, so the package
 * installed is the one whose `engines` was read; a peer that excludes the floor
 * is left out, and the probe allows its subpaths, and only those, to fail.
 *
 * CEILING. A consumer's `npm install` resolves the newest version each peer
 * range admits, and the floor, lint and the suite all run the bottom of it
 * (`test/seam/peer-floor.ts`). So every optional peer is named by its
 * `peerDependencies` range and npm resolves it, as it does for a consumer. The
 * Node is the newest `engines.node` admits, which the caller's
 * `node-version-file` setup-node already resolved; the plan names none, so the
 * action does not switch it. Blind spot: this is the newest peer on the day CI
 * runs, not one published after it.
 *
 * Which subpath may reach which peer is `test/seam/optional-peers.ts`'s rule,
 * not this file's.
 */

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import semver from "semver";

const end = process.env.END;
const planPath = process.env.PLAN_PATH;
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));

const optionalPeers = Object.entries(manifest.peerDependenciesMeta ?? {})
  .filter(([, meta]) => meta.optional === true)
  .map(([name]) => name);

function floorPlan() {
  const range = new semver.Range(manifest.engines.node);
  if (range.set.length !== 1) {
    throw new Error(
      `engines.node "${manifest.engines.node}" has ${range.set.length} comparator sets, ` +
        `so it has that many floors, and the floor job runs one Node`,
    );
  }
  const node = semver.minVersion(range).version;
  const peers = optionalPeers.map((name) => {
    const locked = lockfile.packages[`node_modules/${name}`];
    if (locked === undefined) {
      throw new Error(`optional peer ${name} is not in package-lock.json, so its engines cannot be read`);
    }
    // A package that declares no `engines` admits every Node; npm reads it the same way.
    const engines = locked.engines?.node;
    const admitted = engines === undefined || semver.satisfies(node, engines);
    return { name, spec: `${name}@${locked.version}`, installed: admitted, engines };
  });
  return { node, peers };
}

function ceilingPlan() {
  const peers = optionalPeers.map((name) => {
    const range = manifest.peerDependencies?.[name];
    if (range === undefined) {
      throw new Error(`optional peer ${name} has no peerDependencies range to resolve`);
    }
    return { name, spec: `${name}@${range}`, installed: true };
  });
  return { node: null, peers };
}

const plans = { floor: floorPlan, ceiling: ceilingPlan };
if (!(end in plans)) {
  throw new Error(`END is ${JSON.stringify(end)}; it must be one of ${Object.keys(plans).join(", ")}`);
}
const plan = { end, engines: manifest.engines.node, ...plans[end]() };
writeFileSync(planPath, JSON.stringify(plan, null, 2));

// [LAW:nothing-unseen] Which end, which Node, and why each peer is or is not installed.
console.log(JSON.stringify({ event: "consumer-plan", ...plan }));
const install = plan.peers.filter((p) => p.installed).map((p) => p.spec);
appendFileSync(process.env.GITHUB_OUTPUT, `node=${plan.node ?? ""}\npeers=${install.join(" ")}\n`);
