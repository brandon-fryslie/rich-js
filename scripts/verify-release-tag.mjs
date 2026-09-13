/*
 * Refuse to publish a version that no git tag names.
 *
 * Eleven versions of this package are on npm and five of them have a tag. The
 * six that do not — 0.1.0, 0.2.0, 0.5.0, 0.5.1, 0.5.2, 0.7.0 — cannot be given
 * one now, and that is why this is a gate and not a cleanup task. npm records a
 * `gitHead` with every publish; for five of those six the commit it names no
 * longer exists in this repository, and for 0.7.0 it survives only as an orphan
 * off master. They were branch tips, squash-merged and deleted. Three of the six
 * versions never appear in master's history at all — master steps 0.0.1 → 0.2.0
 * and 0.4.0 → 0.5.2 — so for those there is not even an approximate commit to
 * point at. Nothing can be recovered. The only move left is to make the seventh
 * impossible.
 *
 * WHY HERE AND NOT IN THE WORKFLOW. `publish.yml` triggers on `v*`, so a release
 * that goes through CI carries a tag by construction: the tag is the trigger.
 * Every untagged version therefore arrived by the other road — `npm publish` run
 * by hand, which no workflow can observe. 0.8.0 is the recorded instance,
 * appearing on the registry 26 seconds after CI failed on that same version, and
 * neither it nor 0.7.0 carries a provenance attestation, which only the OIDC path
 * can attach. A check living in a workflow guards the road that was never the
 * problem.
 *
 * [LAW:single-enforcer] So the check stands where both roads meet. npm runs
 * `prepublishOnly` for every `npm publish` — from CI, from a laptop, `--dry-run`
 * included — and for nothing else: `npm pack` and `npm install` do not fire it,
 * so a consumer never runs this and a tarball build never trips over it. It runs
 * before `prepack`, so a refusal lands before the tarball is even built. That
 * made `publish.yml`'s own "Verify tag matches package.json version" step a
 * second belt on one of the two roads; it was deleted in the same change rather
 * than left to drift against this file.
 *
 * [LAW:no-silent-failure] The guard fails closed. A tree where git cannot answer
 * — no repository, no git on PATH — is not a tree that can prove a tag exists, so
 * it is refused rather than waved through. Failing open would have made this
 * theatre: `rm -rf .git` would be the documented bypass.
 *
 * [LAW:effects-at-boundaries] `decide` is a pure function of (version, whatever
 * git said). The contact with git and the process exit are `main`, at the bottom.
 *
 * Plain ESM with JSDoc types rather than TypeScript because the publish job runs
 * this with no `node_modules` on disk — deliberately, so no third-party install
 * script executes beside the OIDC credential — which leaves bare `node` as the
 * only interpreter available. `tsconfig.scripts.json` type-checks it anyway, so
 * `npm run lint` still covers it.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * What git managed to say about the commit being published.
 *
 * The two arms are not interchangeable, and that is the point of spelling them
 * out: `tags: []` means "this commit carries no tags", `unavailable` means
 * "nobody got an answer". Collapsing them into an empty list would let a broken
 * lookup read as a clean absence, and both roads out of here end in a refusal
 * that should say which one it was.
 *
 * @typedef {{ kind: "tags", tags: readonly string[] } | { kind: "unavailable", detail: string }} TagLookup
 */

/** @typedef {{ ok: boolean, message: string }} Verdict */

/**
 * [LAW:dataflow-not-control-flow] Always returns a verdict. Nothing here decides
 * whether the caller keeps running; the single branch is the lookup's own
 * discriminator, which is the entire reason that type has two arms.
 *
 * @param {string} version
 * @param {TagLookup} lookup
 * @returns {Verdict}
 */
function decide(version, lookup) {
  const wanted = `v${version}`;

  switch (lookup.kind) {
    case "unavailable":
      return {
        ok: false,
        message:
          `refusing to publish ${version}: could not read this commit's tags (${lookup.detail}).\n` +
          `A tree that cannot prove it is tagged is refused, not assumed.`,
      };
    case "tags":
      return lookup.tags.includes(wanted)
        ? { ok: true, message: `${wanted} is on this commit — publishing ${version}` }
        : {
            ok: false,
            message:
              `refusing to publish ${version}: no tag ${wanted} on this commit.\n` +
              `tags on this commit: ${lookup.tags.length > 0 ? lookup.tags.join(", ") : "(none)"}\n` +
              `Every published version must be reachable from a tag — six of this\n` +
              `package's releases are not, and none of them can be fixed now.\n` +
              `To release ${version}:\n` +
              `    git tag ${wanted} && git push origin ${wanted}\n` +
              `and let the publish workflow ship it.`,
          };
  }
}

/**
 * [LAW:effects-at-boundaries] The only contact with git in this file.
 *
 * The catch is not a silenced failure: it turns a thrown error into the
 * `unavailable` arm, whose only destination is a refusal that quotes the error.
 * The failure gets louder here, not quieter.
 *
 * @param {string} cwd
 * @returns {TagLookup}
 */
function readTagsAtHead(cwd) {
  try {
    const out = execFileSync("git", ["tag", "--points-at", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { kind: "tags", tags: out.split("\n").map((line) => line.trim()).filter((line) => line !== "") };
  } catch (error) {
    const detail = error instanceof Error ? error.message.split("\n")[0] : String(error);
    return { kind: "unavailable", detail: detail ?? "git failed" };
  }
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  /** @type {{ version: string }} */
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

  const verdict = decide(manifest.version, readTagsAtHead(root));

  // One channel and one exit for both verdicts: this is diagnostic output, and
  // npm surfaces stderr on success and failure alike.
  process.stderr.write(`release-tag: ${verdict.message}\n`);
  process.exit(verdict.ok ? 0 : 1);
}

main();
