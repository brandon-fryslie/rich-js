/*
 * [LAW:verifiable-goals] The library used to state "who owns node host access"
 * in four places at once — a module header in `src/widgets/`, two in
 * `src/node/`, and a sentence in `docs/widgets.md` — and no two of them agreed
 * on the scope. The docs sentence was simply false: it named `NodeTerminalHost`
 * as "the only thing that touches `process.stdin` and `process.stdout`" while
 * `src/node/prompt.ts` had been touching both since it was written. The others
 * survived only by narrowing until they no longer overlapped their
 * counterexamples.
 *
 * None of that was catchable by reading, which is the argument for a gate: the
 * claims are about the contents of a directory, and the prose has to be
 * re-derived by hand every time a file moves. `HOST_ACCESS` is now the one
 * place the fact lives, and these are the assertions that keep it true.
 *
 * [LAW:behavior-not-structure] The gate asserts what `src/` takes off the host,
 * not how it is arranged. Any file may hold any code as long as the host reads
 * in it are the ones the registry declares.
 */

import { describe, it, expect } from "vitest";
import ts from "typescript";
import path from "node:path";
import { REPO_ROOT, listTypeScriptFiles, repoRelative } from "../coverage/extract.js";
import { parseSourceFile } from "./graph.js";
import {
  HOST_ACCESS,
  ambientProcessReads,
  unregistered,
  unexercised,
  describeRead,
  describeSurface,
} from "./ambient-process.js";

const SRC_FILES = listTypeScriptFiles("src");

/**
 * Every read of the ambient host anywhere in `src/`, collected once. Both
 * gates below are views of this one list: the violations are the reads no
 * entry covers, the stale permissions are the entries no read matches.
 */
const READS = SRC_FILES.flatMap((file) => ambientProcessReads(parseSourceFile(file)));

describe("the src sweep", () => {
  it("reaches every subsystem", () => {
    // A directory scan that finds nothing passes every rule built on it. This
    // is the assertion that says the gates below looked at something.
    const relative = SRC_FILES.map(repoRelative);
    expect(relative).toContain("src/index.ts");
    expect(relative).toContain("src/core/console.ts");
    expect(relative).toContain("src/node/terminal-host.ts");
    expect(relative).toContain("src/widgets/screen.ts");
    expect(relative.length).toBeGreaterThan(40);
  });
});

describe("access to the ambient process global", () => {
  it("happens only where HOST_ACCESS permits it", () => {
    const failures = unregistered(READS, HOST_ACCESS).map(describeRead);
    expect(
      failures,
      `A file reaches node's ambient \`process\` for something HOST_ACCESS does ` +
        `not grant it. Take the capability as an argument instead — a ` +
        `\`TerminalHost\`, a \`ConsoleEnvironment\`, a \`PromptInput\` — the way ` +
        `every entry in that list does for its own default. Adding an entry is ` +
        `the last resort, and it means writing down what bounds the surface.` +
        `\n\n${failures.join("\n")}\n`,
    ).toEqual([]);
  });

  it("grants nothing that has stopped happening", () => {
    const stale = unexercised(READS, HOST_ACCESS).map(
      (entry) => `  ${entry.file} — ${describeSurface(entry.surface)}`,
    );
    expect(
      stale,
      `HOST_ACCESS permits a host read that is no longer there. The read was ` +
        `removed and its permission outlived it — narrow or delete the entry, ` +
        `and check whether any prose pointing at HOST_ACCESS now overstates ` +
        `what the package takes.\n\n${stale.join("\n")}\n`,
    ).toEqual([]);
  });

  it("states why each grant is allowed", () => {
    for (const entry of HOST_ACCESS) {
      expect(entry.why.length, `${entry.file} carries no reason`).toBeGreaterThan(40);
      expect(entry.surface.length, `${entry.file} grants nothing`).toBeGreaterThan(0);
    }
  });
});

describe("the claims that survive under the narrowed ones", () => {
  // These are the sentences `docs/widgets.md` and the `src/node/` headers are
  // allowed to make. They are here, against the scan, rather than in prose
  // beside the code they describe — which is the arrangement that let the old
  // version of each go stale without anybody noticing.
  const readersOf = (name: string): string[] => [
    ...new Set(
      READS.filter((r) => r.surface.kind === "member" && r.surface.name === name).map(
        (r) => r.file,
      ),
    ),
  ].sort();

  it("reads process.stdin only from behind a node subpath", () => {
    // Two readers, not one. Every narrowed version of the old sole-owner
    // sentence was reaching for "NodeTerminalHost is the only thing that
    // reads stdin", and that was never true — `nodeAsk` reads it too. What
    // is true is where both live: behind `package.json#exports` subpaths a
    // consumer has to name.
    expect(readersOf("stdin")).toEqual(["src/node/prompt.ts", "src/node/terminal-host.ts"]);
    expect(readersOf("stdin").every((f) => f.startsWith("src/node/"))).toBe(true);
  });

  it("keeps every host read out of src/widgets and src/renderables", () => {
    const upper = READS.filter(
      (r) => r.file.startsWith("src/widgets/") || r.file.startsWith("src/renderables/"),
    ).map(describeRead);
    expect(
      upper,
      `The interactive and renderable layers take their I/O as a capability — ` +
        `a \`TerminalHost\`, a \`PromptInput\`, a \`ConsoleEnvironment\`. A read ` +
        `here is that seam being bypassed.\n\n${upper.join("\n")}\n`,
    ).toEqual([]);
  });
});

/**
 * The scan, pinned against sources written to break it. A gate that is green
 * today and has never been seen red is not evidence of anything; these
 * fixtures are what say it can fail, and on which shapes.
 */
function scan(source: string) {
  const sf = ts.createSourceFile(
    path.join(REPO_ROOT, "src", "core", "fixture.ts"),
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  return ambientProcessReads(sf);
}

describe("ambientProcessReads", () => {
  it("names the property a read takes", () => {
    expect(scan("export const w = () => process.stdout.columns;")).toEqual([
      { file: "src/core/fixture.ts", line: 1, surface: { kind: "member", name: "stdout" } },
    ]);
  });

  it("reports a read at any depth, not only at module scope", () => {
    const found = scan(
      "class C {\n  go() {\n    return { get x() { return process.env; } };\n  }\n}",
    );
    expect(found).toEqual([
      { file: "src/core/fixture.ts", line: 3, surface: { kind: "member", name: "env" } },
    ]);
  });

  it("reports the whole object when it escapes unnamed", () => {
    expect(scan("export const host = () => process;")).toEqual([
      { file: "src/core/fixture.ts", line: 1, surface: { kind: "object" } },
    ]);
  });

  it("reports a computed access as the whole object", () => {
    expect(scan("export const f = (k: string) => process[k as 'env'];")).toEqual([
      { file: "src/core/fixture.ts", line: 1, surface: { kind: "object" } },
    ]);
  });

  it("resolves a literal element access to its member", () => {
    expect(scan('export const e = () => process["env"];')).toEqual([
      { file: "src/core/fixture.ts", line: 1, surface: { kind: "member", name: "env" } },
    ]);
  });

  it("does not count a typeof probe, in either position", () => {
    expect(scan("export const there = typeof process !== 'undefined';")).toEqual([]);
    expect(scan("export type P = typeof process;")).toEqual([]);
  });

  it("counts the read a typeof probe guards", () => {
    expect(
      scan("export const e = () => (typeof process === 'undefined' ? {} : process.env);"),
    ).toEqual([
      { file: "src/core/fixture.ts", line: 1, surface: { kind: "member", name: "env" } },
    ]);
  });

  it("does not count the name of somebody else's property", () => {
    expect(scan("export const o = { process: 1 };")).toEqual([]);
    expect(scan("export const p = (x: { process: number }) => x.process;")).toEqual([]);
  });

  it("counts a shadowing binding rather than excusing it", () => {
    // Strict by design: the scan does not resolve scopes, so a local named
    // `process` reports and has to be argued for in HOST_ACCESS.
    expect(scan("export const f = () => { const process = 1; return process; };")).toEqual([
      { file: "src/core/fixture.ts", line: 1, surface: { kind: "object" } },
    ]);
  });
});
