/*
 * The consumer probe (`.github/actions/consumer/probe.mjs`) drives each
 * peer-backed subpath through its peer with a hand-written render. A subpath
 * with no render there imports and passes without the peer ever running, so the
 * ceiling end would report a newest peer it never exercised. This holds the
 * probe's render keys to the subpaths `PEER_PROVIDERS` names.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../scripts/repo-facts.js";
import { PEER_PROVIDERS } from "./optional-peers.js";

function probeRenderKeys(): Set<string> {
  const source = readFileSync(path.join(REPO_ROOT, ".github/actions/consumer/probe.mjs"), "utf8");
  const body = /const renders = \{([\s\S]*?)\n\};/.exec(source)?.[1];
  if (body === undefined) throw new Error("probe.mjs has no `const renders = { … };` block to read");
  return new Set([...body.matchAll(/^ {2}"(\.[^"]*)":/gm)].map((m) => m[1] ?? ""));
}

describe("consumer probe", () => {
  it("renders every subpath that provides an optional peer", () => {
    const rendered = probeRenderKeys();
    const peerSubpaths = Object.values(PEER_PROVIDERS).flatMap((p) =>
      // The package name, scope included, is the entry up to its subpath.
      p.entries.map((entry) => entry.replace(/^(@[^/]+\/)?[^/]+/, ".")),
    );
    expect(peerSubpaths.filter((subpath) => !rendered.has(subpath))).toEqual([]);
  });
});
