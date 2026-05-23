// [LAW:verifiable-goals] "Every public export is demonstrated in
// `examples/`" is a machine check, not eyeballing. This file is that
// check, and it is the keystone of epic rich-demos-l2x: adding a new
// public export with no demo and no allowlist entry must fail CI.
//
// [LAW:behavior-not-structure] The test asserts three invariants over
// the (universe, references, allowlist) tuple — not a specific list of
// names, not a count. The allowlist itself is data and changes over
// time; the *invariants* are stable.

import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  makeProgram,
  collectPublicExports,
  collectReferencedOrigins,
  groupByOrigin,
  canonicalNameFor,
  originKey,
  REPO_ROOT,
  type OriginInfo,
} from "./extract.js";
import { ALLOWLIST } from "./coverage-allowlist.js";

describe("API → demo coverage", () => {
  // One Program / TypeChecker is reused across the three invariants
  // below — building it is the expensive step, and the three checks
  // partition the same (universe, references) tuple. `exampleFiles`
  // is the list `makeProgram()` actually constructed the program
  // from — we use the same list for reference-collection so a single
  // directory walk underlies both halves of the check.
  const { program, checker, exampleFiles } = makeProgram();
  const publicRows = collectPublicExports(program, checker);
  const universe = groupByOrigin(publicRows);
  const referenced = collectReferencedOrigins(exampleFiles, program, checker);

  // Partition the universe into covered vs uncovered by origin.
  const covered = new Map<string, OriginInfo>();
  const uncovered = new Map<string, OriginInfo>();
  for (const [key, info] of universe) {
    if (referenced.has(key)) covered.set(key, info);
    else uncovered.set(key, info);
  }

  // Allowlist lookup: canonical exposed name → origin info.
  const universeByCanonicalName = new Map<string, OriginInfo>();
  for (const info of universe.values()) {
    universeByCanonicalName.set(canonicalNameFor(info), info);
  }

  it("collects a non-empty public export universe (sanity)", () => {
    // If this fails, the program failed to load the entry modules and
    // the rest of the suite is meaningless. Fail loudly with that
    // specific cause instead of with "everything is uncovered".
    expect(universe.size).toBeGreaterThan(0);
  });

  it("every uncovered public export is allowlisted with a justification", () => {
    const gaps: string[] = [];
    for (const [, info] of uncovered) {
      const name = canonicalNameFor(info);
      if (!Object.hasOwn(ALLOWLIST, name)) {
        gaps.push(formatGap(name, info));
      }
    }
    if (gaps.length > 0) {
      throw new Error(
        `Public exports without demo coverage or allowlist entry:\n${gaps.join("\n")}\n\n` +
          `Either reference the symbol from a file under examples/, ` +
          `or add an entry to test/coverage/coverage-allowlist.ts ` +
          `(burndown: tag a flagship; permanent: explain why a demo cannot exercise it).`,
      );
    }
  });

  it("every allowlist entry points to a real public export", () => {
    const dead: string[] = [];
    for (const name of Object.keys(ALLOWLIST)) {
      if (!universeByCanonicalName.has(name)) dead.push(name);
    }
    if (dead.length > 0) {
      throw new Error(
        `Dead allowlist entries (no longer exported anywhere): ${dead.join(", ")}\n\n` +
          `Remove these entries from test/coverage/coverage-allowlist.ts.`,
      );
    }
  });

  it("no allowlist entry is already covered by a demo", () => {
    const redundant: string[] = [];
    for (const [name, entry] of Object.entries(ALLOWLIST)) {
      const info = universeByCanonicalName.get(name);
      if (!info) continue; // dead-entry case is handled by the previous test
      if (referenced.has(originKey(info.origin))) {
        const detail =
          entry.kind === "burndown"
            ? `burndown → ${entry.flagship}`
            : `permanent: ${entry.reason}`;
        redundant.push(`${name} (${detail})`);
      }
    }
    if (redundant.length > 0) {
      throw new Error(
        `Allowlist entries that are already covered by a demo:\n  ${redundant.join("\n  ")}\n\n` +
          `Remove these entries from test/coverage/coverage-allowlist.ts — ` +
          `they are now redundant.`,
      );
    }
  });
});

function formatGap(canonicalName: string, info: OriginInfo): string {
  const exposures = info.exposures
    .map((e) => `${e.exposedAs} (from ${e.entry})`)
    .join(", ");
  // Render relative to REPO_ROOT so error output is portable across
  // checkout locations and machines (CI vs local agent worktrees etc.).
  const relFile = path.relative(REPO_ROOT, info.origin.file);
  return `  - ${canonicalName}: exposed as ${exposures}; declared in ${relFile}`;
}
