/*
 * Refuse to publish a version that origin does not carry a tag for.
 *
 * Eleven versions of this package are on npm and five have a git tag. The six
 * that do not — 0.1.0, 0.2.0, 0.5.0, 0.5.1, 0.5.2, 0.7.0 — cannot be given one
 * now, and that is why this is a gate and not a cleanup task. npm records a
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
 * can attach.
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
 * [LAW:one-source-of-truth] The question is asked of origin, not of the local ref
 * store, and the difference is the whole point rather than a detail. The six
 * versions are missing tags *on origin*; a tag that only ever existed on a laptop
 * reproduces that end state exactly, so a guard satisfied by one would not be
 * closing the hole it claims to. Asking origin also makes the answer independent
 * of what `actions/checkout` chose to fetch — it runs with `--no-tags` and a
 * single refspec, so the local ref store in a CI publish holds only the tag that
 * triggered the run. One question, one authority, the same answer on both roads.
 *
 * [LAW:no-silent-failure] The guard fails closed. A tree where git cannot answer
 * — no repository, no origin, no network — cannot prove a tag exists, so it is
 * refused rather than waved through. Failing open would have made this theatre:
 * `rm -rf .git` would be the documented bypass.
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
 * What git managed to say about this commit and the tags origin holds for it.
 *
 * The two arms are not interchangeable, and spelling them out is the point:
 * `originShas: []` means "origin carries no such tag", `unavailable` means
 * "nobody got an answer". Collapsing them would let a broken lookup read as a
 * clean absence, and the two refusals they produce should not say the same thing.
 * The `read` arm is only constructible once both reads have succeeded, so nothing
 * downstream has to ask again whether they did.
 *
 * @typedef {{ kind: "read", head: string, originShas: readonly string[] } | { kind: "unavailable", detail: string }} GitState
 */

/** @typedef {{ ok: boolean, message: string }} Verdict */

/**
 * [LAW:dataflow-not-control-flow] Always returns a verdict. Nothing here decides
 * whether the caller keeps running; the single branch is the state's own
 * discriminator, which is the entire reason that type has two arms.
 *
 * @param {string} version
 * @param {GitState} state
 * @returns {Verdict}
 */
function decide(version, state) {
  const wanted = `v${version}`;

  switch (state.kind) {
    case "unavailable":
      return {
        ok: false,
        message:
          `refusing to publish ${version}: could not ask origin about ${wanted} (${state.detail}).\n` +
          `A tree that cannot prove it is tagged is refused, not assumed.`,
      };
    case "read":
      return state.originShas.includes(state.head)
        ? { ok: true, message: `origin has ${wanted} on this commit — publishing ${version}` }
        : {
            ok: false,
            message:
              `refusing to publish ${version}: origin has no ${wanted} on this commit.\n` +
              `  this commit:       ${state.head}\n` +
              `  origin's ${wanted}: ${state.originShas.length > 0 ? state.originShas.join(", ") : "(no such tag)"}\n` +
              `Every published version must be reachable from a tag on origin — six of\n` +
              `this package's releases are not, and none of them can be fixed now. A tag\n` +
              `that exists only on this machine is the same gap.\n` +
              // The remedy is read off the same data as the refusal. Offering
              // `git tag` when origin already holds the name would hand the
              // reader a command that fails on the tag it just named.
              (state.originShas.length === 0
                ? `To release ${version}:\n` +
                  `    git tag ${wanted} && git push origin ${wanted}\n` +
                  `and let the publish workflow ship it.`
                : `origin already carries ${wanted} elsewhere, so ${version} is spoken for.\n` +
                  `Bump the version, then tag and push the new one.`),
          };
  }
}

/**
 * [LAW:effects-at-boundaries] The only contact with git in this file.
 *
 * Both reads have to succeed for the `read` arm to exist, so a failure in either
 * lands in `unavailable` carrying git's own stderr. The catch is not a silenced
 * failure: its only destination is a refusal that quotes what git said. Note that
 * a tag origin does not have is not an error — `ls-remote` exits zero and prints
 * nothing, which is an answer, and a true one.
 *
 * The peeled `^{}` pattern is required, not belt-and-braces: for an annotated tag
 * `ls-remote` reports the tag object's own sha under the plain ref, and only the
 * peeled ref carries the commit. Querying just the plain ref would reject every
 * annotated release tag.
 *
 * @param {string} cwd
 * @param {string} wanted
 * @returns {GitState}
 */
function readGitState(cwd, wanted) {
  const git = (/** @type {string[]} */ args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  try {
    const head = git(["rev-parse", "HEAD"]).trim();
    const refs = git(["ls-remote", "--tags", "origin", `refs/tags/${wanted}`, `refs/tags/${wanted}^{}`]);
    const originShas = refs
      .split("\n")
      .map((line) => line.split("\t")[0]?.trim() ?? "")
      .filter((sha) => sha !== "");

    return { kind: "read", head, originShas };
  } catch (error) {
    return { kind: "unavailable", detail: gitFailureDetail(error) };
  }
}

/**
 * What git printed when it failed.
 *
 * `execFileSync` wraps every non-zero exit in an Error whose message begins
 * "Command failed: <argv>" and whose real cause is on the lines after it, so the
 * first line alone reports the same string for every failure and names none of
 * them. `stderr` is the one that says "fatal: not a git repository".
 *
 * @param {unknown} error
 * @returns {string}
 */
function gitFailureDetail(error) {
  const stderr = error instanceof Error ? /** @type {{ stderr?: unknown }} */ (error).stderr : undefined;
  const text = typeof stderr === "string" && stderr.trim() !== "" ? stderr : String(error);
  return text.trim().split("\n").join("; ");
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  /** @type {{ version: string }} */
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

  const verdict = decide(manifest.version, readGitState(root, `v${manifest.version}`));

  // One channel and one exit for both verdicts: this is diagnostic output, and
  // npm surfaces stderr on success and failure alike.
  process.stderr.write(`release-tag: ${verdict.message}\n`);
  process.exit(verdict.ok ? 0 : 1);
}

main();
