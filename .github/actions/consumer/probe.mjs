/*
 * Run the published package the way a consumer at one end of the supported
 * range receives it: on that end's Node, beside that end's peers.
 *
 * `test/seam/node-floor.test.ts` checks that `engines.node` agrees with what
 * the install tree *declares*, and `test/seam/peer-floor.test.ts` pins the
 * suite to the lowest peer each range admits; neither executes the package a
 * consumer installs. So `src/` reaching for an API newer than the floor
 * (`Object.groupBy`, `Promise.withResolvers`), or a peer's newest in-range
 * release breaking what `src/` asks of it, leaves every assertion there green
 * while the package breaks for everyone at that end. This is the half that
 * runs. `action.yml` beside this file packs the tarball, installs it into an
 * empty project as `plan.mjs` planned, and runs this file from there, so what
 * is imported is the artifact a consumer receives, not the checkout.
 *
 * [LAW:no-silent-failure] It asserts on rendered text, not on "nothing threw".
 * An install that loads and renders nothing passes a did-not-throw probe.
 *
 * [LAW:one-source-of-truth] Which subpaths to load is read off the installed
 * manifest's `exports`; which Node and which peers this ought to be is
 * `install-plan.json`. Neither is listed here, and neither is a mode: a
 * subpath may fail to import only because the plan left its peer out.
 *
 * WHAT THIS CANNOT SEE. What executes is every loaded module's top level and
 * whatever the renders below reach; an API newer than the floor, or a peer
 * call, inside a function nothing here calls stays unseen.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const PACKAGE = "@promptctl/rich-js";

const plan = JSON.parse(readFileSync("install-plan.json", "utf8"));
// A probe that ran on whatever Node was on PATH would prove nothing about the floor.
if (plan.node !== null && process.version !== `v${plan.node}`) {
  throw new Error(`running on ${process.version}, but the plan's Node is v${plan.node}`);
}

const readManifest = (name) => JSON.parse(readFileSync(path.join("node_modules", name, "package.json"), "utf8"));
const manifest = readManifest(PACKAGE);
const leftOut = plan.peers.filter((p) => !p.installed).map((p) => p.name);
const installed = Object.fromEntries(
  plan.peers.filter((p) => p.installed).map((p) => [p.name, readManifest(p.name).version]),
);

/** The left-out peer whose absence made this import fail, if that is why it failed. */
function leftOutPeer(error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND") return undefined;
  return leftOut.find((peer) => error.message.includes(`'${peer}'`));
}

const subpaths = Object.keys(manifest.exports);
const imports = await Promise.allSettled(
  subpaths.map((subpath) => import(subpath === "." ? PACKAGE : `${PACKAGE}/${subpath.slice(2)}`)),
);
const loaded = {};
const needsPeer = {};
const failures = [];
imports.forEach((result, i) => {
  const subpath = subpaths[i];
  if (result.status === "fulfilled") return void (loaded[subpath] = result.value);
  const peer = leftOutPeer(result.reason);
  if (peer === undefined) return void failures.push(`${subpath}: ${result.reason?.stack ?? result.reason}`);
  needsPeer[subpath] = peer;
});
if (failures.length > 0) {
  throw new Error(`subpaths failed to load on ${process.version}:\n${failures.join("\n")}`);
}

const plain = { width: 60, colorSystem: null };
const { Panel, Table, renderToString } = loaded["."];

/**
 * One render per subpath whose own code is the thing at risk: the core, and
 * each subpath behind a peer, driven through that peer. Each returns the text
 * and the needles it must hold.
 */
const renders = {
  ".": () => {
    const table = new Table();
    table.addColumn("Runtime");
    table.addColumn("Status");
    table.addRow(process.version, "rendered");
    const text = renderToString(new Panel(table, { title: "consumer probe" }), plain);
    return [text, ["consumer probe", "Runtime", process.version, "─"]];
  },
  // A mobx action changes observable state and the next draw must show it, so
  // this reaches mobx's reactivity, not only its import.
  "./widgets": ({ Checkbox, WidgetKeyEvent }) => {
    const box = new Checkbox({ label: "peer probe" });
    const before = renderToString(box, plain);
    box.handleKey(new WidgetKeyEvent({ key: "space" }));
    const after = renderToString(box, plain);
    return [`${before}${after}`, ["[ ] peer probe", "[✓] peer probe"]];
  },
  // `renderTemplate` folds a template that fails into an `[error: …]` line
  // rather than throwing, so the text itself is the assertion.
  "./template-bindings": ({ createRichTextEngine, renderTemplate }) => {
    const segments = renderTemplate(createRichTextEngine(), '{{ fg "red" "peer probe" }}', {});
    const text = segments.map((s) => s.text).join("");
    return [text, text.startsWith("[error") ? ["a template that did not fail"] : ["peer probe"]];
  },
};

const checked = [];
for (const [subpath, draw] of Object.entries(renders)) {
  if (subpath in needsPeer) continue;
  if (!(subpath in loaded)) throw new Error(`the probe renders ${subpath}, which the package does not export`);
  const [text, needles] = draw(loaded[subpath]);
  process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
  const missing = needles.filter((needle) => !text.includes(needle));
  if (missing.length > 0) {
    throw new Error(`${subpath}'s render is missing ${missing.map((m) => JSON.stringify(m)).join(", ")}:\n${text}`);
  }
  checked.push(subpath);
}

// [LAW:nothing-unseen] One record per run: which end, which Node, which package and peers, what loaded, rendered and was skipped.
process.stdout.write(
  `${JSON.stringify({
    event: "consumer-probe",
    outcome: "ok",
    end: plan.end,
    node: process.version,
    engines: manifest.engines.node,
    package: `${manifest.name}@${manifest.version}`,
    peers: installed,
    loaded: Object.keys(loaded),
    needsPeer,
    rendered: checked,
  })}\n`,
);
