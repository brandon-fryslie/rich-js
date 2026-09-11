/*
 * [LAW:one-source-of-truth] `package.json` declares `"sideEffects": false`.
 * That is a claim about every file this package ships, and until this test it
 * was held by a scan somebody ran once — a map of `src/` that starts drifting
 * the moment the next module lands. The field and the code are two
 * representations of one fact, and this is what keeps them the same fact.
 *
 * [LAW:verifiable-goals] The failure the field can cause never surfaces here.
 * A bundler that drops a module doing work at import time produces a consumer
 * build that is smaller, green, and quietly missing a behaviour, with nothing
 * pointing back at the module. This runs in the unit suite and names the line.
 *
 * [LAW:behavior-not-structure] The gate asserts the contract — importing
 * anything this package ships does no work — and nothing about how `src/` is
 * arranged. Any shape of the tree that keeps the guarantee passes.
 */

import { describe, it, expect } from "vitest";
import ts from "typescript";
import path from "node:path";
import { readFileSync } from "node:fs";
import { REPO_ROOT, listTypeScriptFiles } from "../coverage/extract.js";
import { parseSourceFile } from "./graph.js";
import { importTimeEffects, describeEffect, type ImportTimeEffect } from "./import-time-effects.js";

/**
 * Every file under `src/`, not merely the ones reachable from an entry point.
 * `sideEffects: false` is read per-module by the bundler and `files: ["dist"]`
 * ships the whole tree, so a module nothing imports today is still covered by
 * the field — and is the one most likely to grow a registration nobody
 * reviews for this.
 */
const SOURCE_FILES = listTypeScriptFiles("src");

describe("the sideEffects declaration is true", () => {
  it("covers the whole source tree", () => {
    // A sweep that enumerates a directory passes by seeing nothing.
    const relative = SOURCE_FILES.map((file) => path.relative(REPO_ROOT, file));
    expect(relative).toContain("src/index.ts");
    expect(relative).toContain("src/core/color.ts");
    expect(relative).toContain("src/node/traceback.ts");
    expect(relative.length).toBeGreaterThan(50);
  });

  it("is declared in package.json", () => {
    const manifest: unknown = JSON.parse(
      readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"),
    );
    expect((manifest as { sideEffects?: unknown }).sideEffects).toBe(false);
  });

  it("finds no module that does work when it is imported", () => {
    const failures = SOURCE_FILES.flatMap((file) =>
      importTimeEffects(parseSourceFile(file)).map(describeEffect),
    );
    expect(
      failures,
      `\`package.json\` declares "sideEffects": false, which lets a bundler drop ` +
        `any module of this package whose exports go unused. A module that works ` +
        `at import time is dropped with them, and the consumer's build loses the ` +
        `behaviour with nothing naming the cause.\n\n` +
        `Move the work into a function the caller runs, or fold it into the ` +
        `initialiser of the thing it was patching — \`withGrayAliases\` in ` +
        `\`src/core/color.ts\` is the shape to copy.\n\n${failures.join("\n")}\n`,
    ).toEqual([]);
  });
});

/**
 * The scan, pinned against sources written to break it. The gate above is
 * green today and a green check nobody has broken is not evidence: these
 * fixtures are what say the scan can go red at all, and which shapes it
 * distinguishes.
 */
function scan(source: string, name = "fixture.ts"): ImportTimeEffect[] {
  return importTimeEffects(
    ts.createSourceFile(
      path.join(REPO_ROOT, "src", name),
      source,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS,
    ),
  );
}

describe("importTimeEffects", () => {
  it("catches the registration call, the shape this rule exists for", () => {
    expect(scan(`registry.register(Widget);`)).toEqual([
      { rule: "effectful-statement", file: "src/fixture.ts", line: 1, kind: "ExpressionStatement" },
    ]);
  });

  it("catches a loop that patches a table after it is built", () => {
    // The one this repo actually had: `ANSI_COLOR_NAMES` grew its gray aliases
    // in a top-level `for`, which is module-local and therefore harmless to a
    // bundler — and is still a module doing work when you import it.
    expect(
      scan(`const t: Record<string, number> = { a: 1 };\nfor (const k of Object.keys(t)) t[k + "!"] = 0;`),
    ).toEqual([
      { rule: "effectful-statement", file: "src/fixture.ts", line: 2, kind: "ForOfStatement" },
    ]);
  });

  it("catches every other way a statement runs at module scope", () => {
    expect(scan(`if (globalThis.x) install();`)[0]).toMatchObject({ kind: "IfStatement" });
    expect(scan(`try { install(); } catch {}`)[0]).toMatchObject({ kind: "TryStatement" });
    expect(scan(`{ install(); }`)[0]).toMatchObject({ kind: "Block" });
    expect(scan(`while (x) install();`)[0]).toMatchObject({ kind: "WhileStatement" });
  });

  it("catches a static block, which runs when the class declaration does", () => {
    // The one form that smuggles arbitrary statements past a scan over
    // top-level statements: `class` is a declaration, and this is not.
    expect(scan(`export class C { static { register(C); } }`)).toEqual([
      {
        rule: "effectful-statement",
        file: "src/fixture.ts",
        line: 1,
        kind: "ClassStaticBlockDeclaration",
      },
    ]);
    expect(scan(`export class C { static x = 1; m() { register(C); } }`)).toEqual([]);
  });

  it("catches a statement inside a namespace, whose body runs as an IIFE", () => {
    // The other place a declaration carries a statement list. A scan that
    // stopped at top-level statements would be bypassed by writing the same
    // call one nesting level down, and the failure names the inner line
    // rather than the namespace wrapping it.
    expect(scan(`export namespace Reg {\n  install();\n}`)).toEqual([
      { rule: "effectful-statement", file: "src/fixture.ts", line: 2, kind: "ExpressionStatement" },
    ]);
    // `namespace A.B { … }` carries a ModuleDeclaration as its body rather
    // than a block, so the dotted spelling is its own way through.
    expect(scan(`namespace A.B {\n  install();\n}`)[0]).toMatchObject({ line: 2 });
    expect(scan(`namespace Reg { export const x = 1; }`)).toEqual([]);
  });

  it("ignores an ambient declaration, which emits no code to run", () => {
    expect(scan(`declare namespace Reg { const x: number; }`)).toEqual([]);
    expect(scan(`declare module "x" { const y: number; }`)).toEqual([]);
    expect(scan(`declare namespace A { namespace B { const x: number; } }`)).toEqual([]);
    // The whole-file form of the same fact, and the one a `declare` modifier
    // cannot carry: a `.d.ts` emits nothing and marks nothing `declare`.
    // `listTypeScriptFiles("src")` matches `.d.ts`, so one added to the tree
    // is swept in and must not be reported for code it never emits. The
    // second line is the same source in a `.ts`, so the file is doing the
    // work rather than the fixture being inert.
    expect(scan(`namespace B {\n  install();\n}`, "fixture.d.ts")).toEqual([]);
    expect(scan(`namespace B {\n  install();\n}`)[0]).toMatchObject({ line: 2 });
  });

  it("catches an import taken for its effects alone and names the specifier", () => {
    expect(scan(`import "./polyfill.js";`)).toEqual([
      {
        rule: "effect-only-import",
        file: "src/fixture.ts",
        line: 1,
        specifier: "./polyfill.js",
      },
    ]);
    // A binding is what makes an import a declaration rather than an errand.
    expect(scan(`import { x } from "./sibling.js";`)).toEqual([]);
    expect(scan(`import type { T } from "./sibling.js";`)).toEqual([]);
    expect(scan(`import * as ns from "./sibling.js";`)).toEqual([]);
  });

  it("allows every form whose job is to bind a name", () => {
    expect(scan(`export const x = 1;`)).toEqual([]);
    expect(scan(`export function f() { register(f); }`)).toEqual([]);
    expect(scan(`export interface I { a: number }`)).toEqual([]);
    expect(scan(`export type T = number;`)).toEqual([]);
    expect(scan(`export enum E { A }`)).toEqual([]);
    expect(scan(`const t = 1;\nexport default t;`)).toEqual([]);
    expect(scan(`export * from "./sibling.js";`)).toEqual([]);
    expect(scan(`export { x } from "./sibling.js";`)).toEqual([]);
  });

  it("does not judge what an expression evaluated on import calls", () => {
    // The documented limit, pinned so it stays a known blind spot rather than
    // becoming a surprise: every line here evaluates when the module is
    // imported and is accepted anyway, and a reader of the rule should find
    // that out here rather than from a broken consumer build.
    expect(scan(`export const T = defineTheme(base);`)).toEqual([]);
    expect(scan(`export const frozen = Object.freeze({});`)).toEqual([]);
  });

  it("does not judge the expressions a class evaluates when it is declared", () => {
    // The rest of that limit, and the part most likely to be mistaken for
    // coverage: a `static {}` block reports because it is a statement list,
    // and a reader can reasonably expect its neighbours to report too. They
    // do not. Sorting these from the harmless ones means judging the
    // expression — and `src/widgets/` decorates with mobx's `@observable`
    // while `src/core/highlighter.ts` declares `static baseStyle = ""`, so a
    // rule over these positions is red on working code the day it lands.
    expect(scan(`export class C { static y = register(C); }`)).toEqual([]);
    expect(scan(`@register export class C {}`)).toEqual([]);
    expect(scan(`export class C { @observable accessor x = 1; }`)).toEqual([]);
    expect(scan(`export class C extends base() {}`)).toEqual([]);
    expect(scan(`export class C { [key()] = 1; }`)).toEqual([]);
  });

  it("reports every effect in a file, in source order", () => {
    expect(scan(`import "./a.js";\nconst x = 1;\ninstall();`)).toEqual([
      { rule: "effect-only-import", file: "src/fixture.ts", line: 1, specifier: "./a.js" },
      { rule: "effectful-statement", file: "src/fixture.ts", line: 3, kind: "ExpressionStatement" },
    ]);
  });
});

describe("describeEffect", () => {
  it("names the file, the line, and the offence", () => {
    expect(scan(`install();`).map(describeEffect)).toEqual([
      "  src/fixture.ts:1 — ExpressionStatement runs when the module is imported",
    ]);
    expect(scan(`import "./a.js";`).map(describeEffect)).toEqual([
      '  src/fixture.ts:1 — imports "./a.js" for its side effects alone',
    ]);
  });
});
