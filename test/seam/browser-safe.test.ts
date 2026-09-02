/*
 * [LAW:verifiable-goals] The browser-safe barrel was, until this file, a
 * claim in `README.md` and `CLAUDE.md` plus a hand-run grep recorded in a
 * ticket. The only automated guard was indirect — vite bundles `examples/`
 * and Playwright boots them in Chromium — which catches a leak after a full
 * docs build and a browser install, and reports it as "a demo failed to
 * boot" rather than naming the import that caused it. This runs in the unit
 * suite and names the file.
 *
 * [LAW:behavior-not-structure] The gate asserts the contract — nothing a
 * consumer imports without opting into `./node/*` pulls in a Node builtin
 * or touches a Node global on load. It asserts nothing about which modules
 * exist or how the graph is shaped; any arrangement of `src/` that keeps
 * the guarantee passes.
 */

import { describe, it, expect } from "vitest";
import ts from "typescript";
import path from "node:path";
import { REPO_ROOT, ENTRY_MODULES } from "../coverage/extract.js";
import { reachableSourceModules, parseSourceFile } from "./graph.js";
import {
  browserSafetyViolations,
  describeViolation,
  visitModuleScopeReads,
  type SeamViolation,
} from "./browser-safe.js";

/**
 * [LAW:one-source-of-truth] Derived from `package.json#exports` via
 * `ENTRY_MODULES`, never listed by hand. `src/node/` is the airlock — a
 * subpath under it is the consumer's explicit opt-in to Node — so every
 * other entry carries the browser-safe guarantee, and a new one added to
 * `package.json` is covered the moment it lands.
 */
const BROWSER_SAFE_ENTRIES = ENTRY_MODULES.filter((entry) => !entry.startsWith("src/node/"));

const REACHED = reachableSourceModules(
  BROWSER_SAFE_ENTRIES.map((entry) => path.join(REPO_ROOT, entry)),
);

describe("the browser-safe entry set", () => {
  it("is every public subpath outside the node airlock", () => {
    expect(BROWSER_SAFE_ENTRIES).toContain("src/index.ts");
    expect(BROWSER_SAFE_ENTRIES.length).toBeGreaterThan(1);
    expect(ENTRY_MODULES.some((entry) => entry.startsWith("src/node/"))).toBe(true);
  });
});

describe("reachableSourceModules", () => {
  const files = REACHED.map((m) => path.relative(REPO_ROOT, m.file));

  it("follows imports transitively rather than stopping at the entry modules", () => {
    // `src/core/segment.ts` is three hops down from the barrel and reachable
    // through no direct export of it; if the walk stopped early it would be
    // absent, and every rule built on the walk would pass by seeing nothing.
    expect(files).toContain("src/core/segment.ts");
    expect(files).toContain("src/widgets/screen.ts");
    expect(files.length).toBeGreaterThan(50);
  });

  it("stops at the node airlock", () => {
    expect(files.filter((f) => f.startsWith("src/node/"))).toEqual([]);
  });

  it("records the import chain that reached each module", () => {
    const segment = REACHED.find((m) => m.file.endsWith("/core/segment.ts"));
    expect(segment?.via[0]).toBe("src/index.ts");
    expect(segment?.via.at(-1)).toBe("src/core/segment.ts");
  });
});

describe("the main barrel stays browser-safe", () => {
  it("reaches no module that imports a node builtin or reads a node global on load", () => {
    const failures = REACHED.flatMap((module) =>
      browserSafetyViolations(parseSourceFile(module.file)).map((violation) =>
        describeViolation(violation, module.via),
      ),
    );
    expect(
      failures,
      `The browser-safe guarantee is broken. Either move the capability behind a ` +
        `\`src/node/\` subpath and have the caller pass it in, or — for an ambient ` +
        `global — move the read into a function body the way ` +
        `\`Console\`'s ambientEnvironment() does.\n\n${failures.join("\n")}\n`,
    ).toEqual([]);
  });
});

/**
 * The scan, pinned against sources written to break it. The gate above is
 * green today and a green check nobody has broken is not evidence: these
 * fixtures are what say the scan can go red at all, and which shapes it
 * distinguishes.
 */
function scan(source: string): SeamViolation[] {
  return browserSafetyViolations(
    ts.createSourceFile(
      path.join(REPO_ROOT, "src", "fixture.ts"),
      source,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS,
    ),
  );
}

describe("browserSafetyViolations", () => {
  it("catches a node builtin import and names the specifier", () => {
    expect(scan(`import { readFileSync } from "node:fs";`)).toEqual([
      { rule: "node-import", file: "src/fixture.ts", line: 1, specifier: "node:fs" },
    ]);
  });

  it("catches node builtins behind re-exports and dynamic imports", () => {
    expect(scan(`export * from "node:util";`)[0]).toMatchObject({ specifier: "node:util" });
    expect(scan(`const f = () => import("node:os");`)[0]).toMatchObject({ specifier: "node:os" });
  });

  it("catches a builtin imported without the node: prefix", () => {
    // An IDE auto-import defaults to the bare form, which type-checks here
    // and is exactly as unresolvable in a browser as the prefixed one.
    expect(scan(`import { readFileSync } from "fs";`)[0]).toMatchObject({ specifier: "fs" });
    expect(scan(`import { readFile } from "fs/promises";`)[0]).toMatchObject({
      specifier: "fs/promises",
    });
    expect(scan(`import { x } from "string-width";`)).toEqual([]);
    expect(scan(`import { x } from "./sibling.js";`)).toEqual([]);
  });

  it("ignores a type-only node import, which is erased before the module runs", () => {
    expect(scan(`import type { Buffer } from "node:buffer";`)).toEqual([]);
    expect(scan(`export type { Stats } from "node:fs";`)).toEqual([]);
  });

  it("ignores per-specifier type-only bindings, which erase the statement too", () => {
    // The form `isolatedModules` encourages: the declaration-level flag stays
    // false, so only the elements say the statement is erased.
    expect(scan(`import { type Stats } from "node:fs";`)).toEqual([]);
    expect(scan(`export { type Stats } from "node:fs";`)).toEqual([]);
    // One surviving binding keeps the whole statement, braces notwithstanding.
    expect(scan(`import { type Stats, readFileSync } from "node:fs";`)[0]).toMatchObject({
      specifier: "node:fs",
    });
    expect(scan(`import fs, { type Stats } from "node:fs";`)[0]).toMatchObject({
      specifier: "node:fs",
    });
  });

  it("catches a module-scope read of an ambient node global", () => {
    expect(scan(`export const width = process.stdout.columns;`)).toEqual([
      { rule: "ambient-global", file: "src/fixture.ts", line: 1, global: "process" },
    ]);
    expect(scan(`export const empty = Buffer.alloc(0);`)[0]).toMatchObject({ global: "Buffer" });
  });

  it("allows a read inside a function body, which runs only when called", () => {
    expect(scan(`export function env() { return process.env; }`)).toEqual([]);
    expect(scan(`export const env = () => process.env;`)).toEqual([]);
    expect(scan(`class C { m() { return process.env; } }`)).toEqual([]);
  });

  it("catches a class field initializer, which runs the moment anything is built", () => {
    expect(scan(`export class Host { out = process.stdout; }`)[0]).toMatchObject({
      global: "process",
    });
  });

  it("catches a class extends clause, which evaluates to the superclass on load", () => {
    // `ts.isTypeNode` calls the extends expression a type node; it is not.
    expect(scan(`export class Host extends Buffer {}`)[0]).toMatchObject({ global: "Buffer" });
    expect(scan(`interface I extends Buffer { x: 1 }`)).toEqual([]);
    expect(scan(`export class Host implements Buffer {}`)).toEqual([]);
  });

  it("catches a read of the node-only `global`", () => {
    expect(scan(`export const g = global.setTimeout;`)[0]).toMatchObject({ global: "global" });
    expect(scan(`export const g = globalThis.setTimeout;`)).toEqual([]);
  });

  it("catches an immediately-invoked function, which defers nothing", () => {
    expect(scan(`export const w = (() => process.stdout.columns)();`)[0]).toMatchObject({
      global: "process",
    });
    expect(scan(`export const w = (function () { return process.env; })();`)[0]).toMatchObject({
      global: "process",
    });
    expect(scan(`export const w = (function (o = process.stdout) { return o; })();`)[0]).toMatchObject(
      { global: "process" },
    );
    // A constructor is never the callee — its class is.
    expect(
      scan(`export const h = new (class { constructor(o = process.stdout) { void o; } })();`)[0],
    ).toMatchObject({ global: "process" });
    expect(scan(`class C { constructor(o = process.stdout) { void o; } }`)).toEqual([]);
  });

  it("allows a parameter default, which evaluates only on a call that omits it", () => {
    expect(scan(`export function ask(out = process.stdout) { return out; }`)).toEqual([]);
    expect(scan(`export const ask = (out = process.stdout) => out;`)).toEqual([]);
  });

  it("catches a shorthand property, which reads the binding it names", () => {
    expect(scan(`export const o = { process };`)[0]).toMatchObject({ global: "process" });
  });

  it("reads a local export specifier and does not read a re-exported one", () => {
    // Without `from`, both spellings reference the local binding; with it,
    // the same two names index the other module's export table.
    expect(scan(`export { process };`)[0]).toMatchObject({ global: "process" });
    expect(scan(`export { process as p };`)[0]).toMatchObject({ global: "process" });
    expect(scan(`export { process } from "./m.js";`)).toEqual([]);
    expect(scan(`export { process as p } from "./m.js";`)).toEqual([]);
  });

  it("does not mistake a name for a read", () => {
    expect(scan(`export const o = { process: 1, Buffer: 2 };`)).toEqual([]);
    expect(scan(`export const p = self.process;`)).toEqual([]);
    expect(scan(`export function f(process: number) { return process; }`)).toEqual([]);
    expect(scan(`export let out: Buffer;`)).toEqual([]);
    expect(scan(`export type T = typeof process;`)).toEqual([]);
    expect(scan(`const { process: local } = config; export const e = local;`)).toEqual([]);
    expect(scan(`import { process as p } from "./pipeline.js"; export const y = p;`)).toEqual([]);
  });

  it("does not mistake a module's own binding for the ambient global", () => {
    // `ambient` means unbound here, not merely spelled `process` — a module
    // that names its own is reading its own.
    expect(scan(`const process = { step() {} };\nexport const y = process.step();`)).toEqual([]);
    expect(scan(`import { process } from "./pipeline.js";\nexport const y = process();`)).toEqual(
      [],
    );
    expect(scan(`class Buffer {}\nexport const b = new Buffer();`)).toEqual([]);
    expect(scan(`const { process } = deps;\nexport const y = process;`)).toEqual([]);
  });

  it("does not let a type-space binding shadow a runtime global", () => {
    // The false negative a shadowing rule buys by accident: an interface
    // shadows the type and leaves the value exactly where it was.
    expect(scan(`interface Buffer { magic: true }\nexport const b = Buffer.alloc(0);`)[0]).toMatchObject(
      { global: "Buffer" },
    );
    expect(scan(`type Buffer = 1;\nexport const b = Buffer.alloc(0);`)[0]).toMatchObject({
      global: "Buffer",
    });
    expect(
      scan(`import type { process } from "./x.js";\nexport const y = process.env;`)[0],
    ).toMatchObject({ global: "process" });
    expect(
      scan(`import { type process } from "./x.js";\nexport const y = process.env;`)[0],
    ).toMatchObject({ global: "process" });
  });

  it("does not exempt a module-scope typeof guard", () => {
    // Harmless at runtime, but the repo has no such site and the fix is
    // always the same — put the read in a function — so the rule stays one
    // rule rather than one rule plus an exemption.
    expect(scan(`export const isNode = typeof process !== "undefined";`)[0]).toMatchObject({
      global: "process",
    });
  });

  it("reports every offence in a file, in source order", () => {
    expect(
      scan(`import { readFileSync } from "node:fs";\nexport const e = process.env;`).map(
        (v) => v.line,
      ),
    ).toEqual([1, 2]);
  });
});

describe("visitModuleScopeReads", () => {
  it("yields reads at module scope and nothing from inside a function body", () => {
    const sf = ts.createSourceFile(
      "f.ts",
      `const a = outer;\nfunction f() { return inner; }\nclass C { field = built; m() { return hidden; } }`,
      ts.ScriptTarget.ES2022,
      true,
    );
    const seen: string[] = [];
    visitModuleScopeReads(sf, (id) => seen.push(id.text));
    expect(seen.sort()).toEqual(["built", "outer"]);
  });
});
