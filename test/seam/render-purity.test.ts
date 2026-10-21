/*
 * The gate in `./render-purity.ts`, run over `src/` against the debt in
 * `./render-purity-debt.ts`, and over a fixture that pins what it reports
 * from both sides.
 */

import { describe, it, expect } from "vitest";
import ts from "typescript";
import path from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { REPO_ROOT, listTypeScriptFiles, loadCompilerOptions, repoRelative } from "../../scripts/repo-facts.js";
import { writableLocations } from "./render-purity.js";
import { RENDER_PURITY_DEBT } from "./render-purity-debt.js";

function locations(files: readonly string[]) {
  const program = ts.createProgram({ rootNames: [...files], options: loadCompilerOptions() });
  return writableLocations(program, files);
}

describe("nothing a render can reach is writable but a State", () => {
  const found = locations(listTypeScriptFiles("src"));
  const owed = new Set(RENDER_PURITY_DEBT.flatMap((row) => row.names.map((name) => `${row.at}.${name}`)));

  it("every writable location in src/ is owed by a debt row", () => {
    const unowed = found.filter((l) => l.reason === "state in a Memo" || !owed.has(l.key)).map((l) => `${l.key}  (${l.reason})`);
    expect(unowed, "hold it in a State or a Memo, or type it readonly; the debt list only shrinks").toEqual([]);
  });

  it("every debt row still names a location the gate reports", () => {
    const reported = new Set(found.map((l) => l.key));
    expect([...owed].filter((key) => !reported.has(key)), "fixed: delete it from RENDER_PURITY_DEBT").toEqual([]);
  });

  it("every debt row says why", () => {
    expect(RENDER_PURITY_DEBT.filter((row) => row.why.trim() === "").map((row) => row.at)).toEqual([]);
  });
});

describe("the gate", () => {
  it("reports a field and a module let a render could write, and a State in a Memo, and nothing else", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "render-purity-"));
    const fixture = path.join(dir, "fixture.ts");
    const core = (module: string) => JSON.stringify(path.join(REPO_ROOT, "src/core", module));
    writeFileSync(
      fixture,
      [
        `import { observable } from "mobx";`,
        `import { State } from ${core("state.js")};`,
        `import { Memo, WeakMemo } from ${core("memo.js")};`,
        `export class Writes { private n = 0; render() { this.n += 1; return []; } }`,
        `export class Holds {`,
        `  readonly shape: Readonly<{ a: number }> = { a: 1 };`,
        `  readonly items: readonly number[] = [];`,
        `  readonly count = new State(0);`,
        `  readonly counts = new State<number[]>([]);`,
        `  render() { return []; }`,
        `}`,
        `export class Observes { @observable accessor x = 0; render() { return []; } }`,
        `let frames = 0;`,
        `export const bump = (): number => (frames += 1);`,
        `export const memo = new Memo<State<number>>();`,
        `let states = new Memo<State<number>>();`,
        `export const weak = new WeakMemo<State<number>, { n: number }>();`,
        `export const byKey = new WeakMemo<readonly number[], { n: number }>();`,
        `export const TABLE: Record<string, number> = {};`,
      ].join("\n"),
    );
    const fixtureFile = repoRelative(fixture);
    const reported = locations([fixture])
      .filter((l) => l.key.startsWith(`${fixtureFile} `))
      .map((l) => [l.key.slice(fixtureFile.length + 1), l.reason]);
    expect(reported).toEqual([
      ["Holds.counts", "mutable array"],
      ["module.frames", "module let"],
      ["module.memo", "state in a Memo"],
      // Both: a debt row could excuse the first, and nothing excuses the second.
      ["module.states", "module let"],
      ["module.states", "state in a Memo"],
      ["module.TABLE", "mutable index signature"],
      // A WeakMemo's key is never walked: its writable `n` is no location.
      ["module.weak", "state in a Memo"],
      // A mobx accessor is the widgets' carrier only under src/widgets/.
      ["Observes.x", "writable property"],
      ["Writes.n", "writable property"],
    ]);
  });
});
