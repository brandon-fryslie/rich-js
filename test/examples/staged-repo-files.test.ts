/**
 * The cards of rich-explore and rich-dash show files of this repository as
 * copies scripts/stage-repo-files.ts wrote, since a card cannot read the disk.
 * A copy is a second description of its file, so this holds each one to the
 * file as it is now: an edit to the original turns this red until the script
 * is re-run (`node scripts/stage-repo-files.ts`).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { MemoryDirectory } from "../../examples/_capabilities/memory-file-system.js";
import { README } from "../../examples/rich-dash/staging/readme.js";
import { RICH_JS } from "../../examples/rich-explore/staging/rich-js.js";
import { REPO_ROOT } from "../../scripts/repo-facts.js";

/** Every file under `dir`, by its path from it, with what the copy holds. */
function files(dir: MemoryDirectory, at = ""): Array<readonly [string, string]> {
  return Object.entries(dir.children).flatMap(([name, node]) =>
    node.kind === "directory" ? files(node, `${at}${name}/`) : [[`${at}${name}`, node.content] as const],
  );
}

describe("staged repository files", () => {
  it("rich-explore's copies are the files as they are", () => {
    const staged = files(RICH_JS);
    expect(staged.length).toBeGreaterThan(0);
    for (const [file, content] of staged) {
      const data = readFileSync(path.join(REPO_ROOT, file));
      expect(content, `${file} changed since it was staged; run node scripts/stage-repo-files.ts`).toBe(
        file.endsWith(".png") ? data.toString("latin1") : data.toString("utf-8"),
      );
    }
  });

  it("rich-dash's README is the README as it is", () => {
    expect(README, "README.md changed since it was staged; run node scripts/stage-repo-files.ts").toBe(
      readFileSync(path.join(REPO_ROOT, "README.md"), "utf-8"),
    );
  });
});
