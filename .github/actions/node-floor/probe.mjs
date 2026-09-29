/*
 * Run the published package on the lowest Node its `engines.node` admits.
 *
 * `test/seam/node-floor.test.ts` checks that `engines.node` agrees with what
 * the install tree *declares*; it never executes a line of `src/`. So `src/`
 * reaching for an API newer than the floor — `Object.groupBy`,
 * `Promise.withResolvers` — leaves every assertion there green while the
 * package breaks for everyone installing on the floor. This is the half that
 * runs. `action.yml` beside this file packs the tarball, installs it into an
 * empty project under the floor Node, and runs this file from there, so what is
 * imported is the artifact a consumer receives, not the checkout.
 *
 * [LAW:no-silent-failure] It asserts on rendered text, not on "nothing threw".
 * An install that loads and renders nothing passes a did-not-throw probe.
 *
 * [LAW:one-source-of-truth] Which subpaths to load is read off the installed
 * manifest's `exports`, and which Node this ought to be is `FLOOR_NODE`, which
 * the workflow derives from `engines.node`. Neither is listed here.
 *
 * WHAT THIS CANNOT SEE. An optional peer whose own `engines` excludes the floor
 * is not installed (`floor.mjs` decides which), so a subpath that needs it is
 * reported under `needsPeer` in the record rather than executed. What executes
 * is every loaded module's top level and whatever the render below reaches; an
 * API newer than the floor inside a function nothing here calls stays unseen.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const PACKAGE = "@promptctl/rich-js";

const floor = process.env.FLOOR_NODE;
if (floor === undefined || floor === "") {
  throw new Error("FLOOR_NODE is not set; the workflow derives it from engines.node");
}
// A probe that ran on whatever Node was on PATH would prove nothing about the floor.
if (process.version !== `v${floor}`) {
  throw new Error(`running on ${process.version}, but the declared floor is v${floor}`);
}

const manifest = JSON.parse(
  readFileSync(path.join("node_modules", PACKAGE, "package.json"), "utf8"),
);
const optionalPeers = Object.entries(manifest.peerDependenciesMeta ?? {})
  .filter(([, meta]) => meta.optional === true)
  .map(([name]) => name);

/** The optional peer whose absence made this import fail, if that is why it failed. */
function missingPeer(error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND") return undefined;
  return optionalPeers.find((peer) => error.message.includes(`'${peer}'`));
}

const subpaths = Object.keys(manifest.exports);
const imports = await Promise.allSettled(
  subpaths.map((subpath) => import(subpath === "." ? PACKAGE : `${PACKAGE}/${subpath.slice(2)}`)),
);
const loaded = [];
const needsPeer = {};
const failures = [];
imports.forEach((result, i) => {
  const subpath = subpaths[i];
  if (result.status === "fulfilled") return void loaded.push(subpath);
  const peer = missingPeer(result.reason);
  if (peer === undefined) return void failures.push(`${subpath}: ${result.reason?.stack ?? result.reason}`);
  needsPeer[subpath] = peer;
});
if (failures.length > 0) {
  throw new Error(`subpaths failed to load on ${process.version}:\n${failures.join("\n")}`);
}

const { Panel, Table, renderToString } = await import(PACKAGE);
const table = new Table();
table.addColumn("Runtime");
table.addColumn("Status");
table.addRow(process.version, "rendered");
const text = renderToString(new Panel(table, { title: "floor probe" }), { width: 60, colorSystem: null });
process.stdout.write(text);

const expectations = [
  ["the panel title", "floor probe"],
  ["a column header", "Runtime"],
  ["a cell value", process.version],
  ["a box-drawing character", "─"],
];
const missing = expectations.filter(([, needle]) => !text.includes(needle)).map(([what]) => what);
if (missing.length > 0) {
  throw new Error(`the render is missing ${missing.join(", ")}:\n${text}`);
}

// [LAW:nothing-unseen] One record per run: which Node, which package, what loaded, what was skipped and why.
process.stdout.write(
  `${JSON.stringify({
    event: "node-floor-probe",
    outcome: "ok",
    node: process.version,
    engines: manifest.engines.node,
    package: `${manifest.name}@${manifest.version}`,
    loaded,
    needsPeer,
    checked: expectations.map(([what]) => what),
  })}\n`,
);
