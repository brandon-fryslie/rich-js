/*
 * [LAW:verifiable-goals] rich-workflows-ui0d: deploy.yml ran every docs deploy
 * in one concurrency group, GitHub keeps one pending run per group, and a PR
 * run queued behind a deploy cancelled the pending master one. Merged docs
 * never shipped and nothing failed. The fix is the group keyed by the slot the
 * run publishes to; this keeps it keyed by that slot.
 *
 * [LAW:behavior-not-structure] The property is "the group names the slot the
 * multiplexer is handed as `version:`", whatever expression computes it. A
 * constant group, or a group keyed by a different derivation than the one
 * `version:` reads, fails.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { readFileSync } from "node:fs";
import { REPO_ROOT } from "../../scripts/repo-facts.js";

/** The one value a `key:` line holds in `text`; throws unless exactly one. */
function soleValue(text: string, key: string): string {
  const values = [...text.matchAll(new RegExp(`^\\s*${key}:\\s*(\\S.*)$`, "gm"))].map(
    (m) => m[1]!.trim(),
  );
  if (values.length !== 1) {
    throw new Error(`expected one \`${key}:\` line, found ${values.length}`);
  }
  return values[0]!;
}

/** Why `text`'s concurrency group is not keyed by its deploy slot, or null. */
function slotKeyViolation(text: string): string | null {
  const version = soleValue(text, "version");
  const group = soleValue(text, "group");
  if (!/^\$\{\{.*\}\}$/.test(version)) {
    return `\`version: ${version}\` is not an expression, so no group can be keyed by it`;
  }
  return group.includes(version)
    ? null
    : `\`group: ${group}\` does not contain the slot \`version: ${version}\` publishes to`;
}

describe("deploy.yml's concurrency group", () => {
  it("is keyed by the slot the run publishes to", () => {
    const text = readFileSync(path.join(REPO_ROOT, ".github/workflows/deploy.yml"), "utf8");
    expect(slotKeyViolation(text)).toBeNull();
  });

  it("fails a group shared by every slot — the ui0d shape", () => {
    const text = "group: pages-deploy\nversion: ${{ needs.slot.outputs.slot }}\n";
    expect(slotKeyViolation(text)).toMatch(/does not contain the slot/);
  });

  it("fails a group keyed by a second derivation of the slot", () => {
    const text =
      "group: pages-deploy-${{ github.event.pull_request.number || github.ref_name }}\n" +
      "version: ${{ needs.slot.outputs.slot }}\n";
    expect(slotKeyViolation(text)).toMatch(/does not contain the slot/);
  });
});
