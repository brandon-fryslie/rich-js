// [LAW:verifiable-goals] "Every public export is demonstrated in
// `examples/`" is a machine check, not eyeballing. This file is that
// check: adding a new public export with no demo and no allowlist entry
// must fail CI.
//
// What this file verifies is a coverage *floor* — that every public
// export is reachable from something a user can run. Whether the demo
// that references it is any good is judgment, and no assertion here can
// stand in for it.
//
// [LAW:verifiable-goals] The floor must be a bar a demo can actually
// clear. Demo coverage means "named in an import statement under
// examples/", which only a value declaration can satisfy: idiomatic
// TypeScript consumes an options interface as an object literal and an
// alias as a bare value, so requiring a demo to *name* them would be
// satisfied only by annotations written for this check and read by
// nobody. Types are therefore held to the question they can answer —
// reachability from a demonstrated value — and the origin's `kind`
// decides which evidence applies. See `ExportKind` in extract.ts.
//
// [LAW:behavior-not-structure] The test asserts three invariants over
// the (universe, evidence, allowlist) tuple — not a specific list of
// names, not a count. The allowlist itself is data and changes over
// time; the *invariants* are stable.

import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  makeProgram,
  assertProgramClean,
  collectPublicExports,
  collectReferencedOrigins,
  collectTypeClosure,
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
  // [LAW:no-silent-fallbacks] Precondition: the program compiles cleanly.
  // Otherwise `getSymbolAtLocation` can quietly return undefined and the
  // coverage results become misleading — a TS error masquerading as a
  // missing demo.
  assertProgramClean(program);
  const publicRows = collectPublicExports(program, checker);
  const universe = groupByOrigin(publicRows);
  const referenced = collectReferencedOrigins(exampleFiles, program, checker);

  // [LAW:types-are-the-program] Two kinds of export, two kinds of
  // evidence — and the origin's `kind` says which one counts, so the
  // decision is made once here rather than branched in each invariant
  // below. A value is demonstrated when a demo's import statement names
  // it. A type is demonstrated when it is reachable through type
  // positions from a demonstrated value, because that is what makes a
  // change to it break `examples/` — no demo can name a type without
  // writing an annotation that exists only to be seen by this check.
  const demonstratedValues = new Set(
    [...universe]
      .filter(([key, info]) => info.origin.kind === "value" && referenced.has(key))
      .map(([key]) => key),
  );
  const typeClosure = collectTypeClosure(publicRows, demonstratedValues, checker);

  const demonstrated = new Map<string, OriginInfo>();
  const undemonstrated = new Map<string, OriginInfo>();
  for (const [key, info] of universe) {
    const evidence = info.origin.kind === "value" ? demonstratedValues : typeClosure;
    (evidence.has(key) ? demonstrated : undemonstrated).set(key, info);
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

  it("every undemonstrated public export is allowlisted with a justification", () => {
    const gaps: string[] = [];
    for (const [, info] of undemonstrated) {
      const name = canonicalNameFor(info);
      if (!Object.hasOwn(ALLOWLIST, name)) {
        gaps.push(formatGap(name, info));
      }
    }
    if (gaps.length > 0) {
      throw new Error(
        `Public exports without demo coverage or allowlist entry:\n${gaps.join("\n")}\n\n` +
          `A value is demonstrated by naming it in an import statement in a ` +
          `file under examples/. A type is demonstrated by being reachable ` +
          `through type positions from such a value — so demonstrate the ` +
          `function or class that uses it, and the type follows. Failing ` +
          `either, add an entry to test/coverage/coverage-allowlist.ts ` +
          `explaining why no demo can exercise it.`,
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

  it("no allowlist entry is already demonstrated", () => {
    const redundant: string[] = [];
    for (const [name, entry] of Object.entries(ALLOWLIST)) {
      const info = universeByCanonicalName.get(name);
      if (!info) continue; // dead-entry case is handled by the previous test
      if (demonstrated.has(originKey(info.origin))) {
        redundant.push(`${name} (${entry.reason})`);
      }
    }
    if (redundant.length > 0) {
      throw new Error(
        `Allowlist entries that are already demonstrated:\n  ${redundant.join("\n  ")}\n\n` +
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
  return `  - ${canonicalName} (${info.origin.kind}): exposed as ${exposures}; declared in ${relFile}`;
}
