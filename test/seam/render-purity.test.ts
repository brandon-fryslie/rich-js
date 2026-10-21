/*
 * The gate in `./render-purity.ts`, run over `src/`, and over a fixture that
 * pins what it reports from both sides.
 */

import { describe, it, expect } from "vitest";
import ts from "typescript";
import path from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { REPO_ROOT, listTypeScriptFiles, loadCompilerOptions, repoRelative } from "../../scripts/repo-facts.js";
import { writableLocations } from "./render-purity.js";

function locations(files: readonly string[]) {
  const program = ts.createProgram({ rootNames: [...files], options: loadCompilerOptions() });
  return writableLocations(program, files);
}

describe("nothing a render can reach is writable but a State", () => {
  it("no writable location in src/", () => {
    const found = locations(listTypeScriptFiles("src")).map((l) => `${l.key}  (${l.reason})`);
    expect(found, "hold it in a State (a ListState for a list appended to) or a Memo, or type it readonly").toEqual([]);
  });
});

describe("the gate", () => {
  it("reports a field and a module let a render could write, and a State in a Memo, and nothing else", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "render-purity-"));
    const fixture = path.join(dir, "fixture.ts");
    const core = (module: string) => JSON.stringify(path.join(REPO_ROOT, "src/core", module));
    const widgets = (module: string) => JSON.stringify(path.join(REPO_ROOT, "src/widgets", module));
    writeFileSync(
      fixture,
      [
        `import { observable } from "mobx";`,
        `import { observableRef } from ${widgets("observable.js")};`,
        `import { ListState, State } from ${core("state.js")};`,
        `import { Memo, WeakMemo } from ${core("memo.js")};`,
        `export class Writes { private n = 0; render() { this.n += 1; return []; } }`,
        `export class Holds {`,
        `  readonly shape: Readonly<{ a: number }> = { a: 1 };`,
        `  readonly items: readonly number[] = [];`,
        `  readonly count = new State(0);`,
        `  readonly counts = new State<number[]>([]);`,
        `  readonly rows = new ListState<number>();`,
        `  readonly grids = new ListState<number[]>();`,
        `  render() { return []; }`,
        `}`,
        `export class Observes { @observable accessor x = 0; render() { return []; } }`,
        `export class Refuses {`,
        `  @observableRef accessor x = 0;`,
        `  @observableRef accessor names: readonly string[] = [];`,
        `  @observableRef accessor items: number[] = [];`,
        `  render() { return []; }`,
        `}`,
        `let frames = 0;`,
        `export const bump = (): number => (frames += 1);`,
        `export const memo = new Memo<State<number>>();`,
        `export const lists = new Memo<ListState<number>>();`,
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
      ["Holds.grids", "mutable array"],
      ["module.frames", "module let"],
      ["module.lists", "state in a Memo"],
      ["module.memo", "state in a Memo"],
      ["module.states", "module let"],
      ["module.states", "state in a Memo"],
      ["module.TABLE", "mutable index signature"],
      // A WeakMemo's key is never walked: its writable `n` is no location.
      ["module.weak", "state in a Memo"],
      // mobx's own decorator refuses nothing; the widgets' observables hold, and their value is walked.
      ["Observes.x", "writable property"],
      ["Refuses.items", "mutable array"],
      ["Writes.n", "writable property"],
    ]);
  });
});
