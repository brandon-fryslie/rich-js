/*
 * The gate in `./render-calls.ts`, run over `src/` and over a fixture that
 * pins what it reports from both sides.
 */

import { describe, it, expect } from "vitest";
import ts from "typescript";
import path from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { REPO_ROOT, listTypeScriptFiles, loadCompilerOptions } from "../../scripts/repo-facts.js";
import { directRenderCalls } from "./render-calls.js";

function program(files: readonly string[]): ts.Program {
  return ts.createProgram({ rootNames: [...files], options: loadCompilerOptions() });
}

describe("every render and measure goes through protocol's render and measure", () => {
  it("src/ calls no Renderable's render, and no Measurable's measure, directly", () => {
    const files = listTypeScriptFiles("src");
    const calls = directRenderCalls(program(files), files).map((c) => `${c.file}:${c.line}  ${c.text}`);
    expect(calls, "call `render(renderable, options)` or `measure(measurable, options)` from src/core/protocol.ts").toEqual([]);
  });

  it("reports a direct call on a Renderable or a Measurable and nothing else", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "render-calls-"));
    const fixture = path.join(dir, "fixture.ts");
    const core = (module: string) => JSON.stringify(path.join(REPO_ROOT, "src/core", module));
    writeFileSync(
      fixture,
      [
        `import { measure, render, type Measurable, type Renderable, type RenderOptions } from ${core("protocol.js")};`,
        `import { Style } from ${core("style.js")};`,
        `export function direct(child: Renderable, options: RenderOptions) { return child.render(options); }`,
        `export function through(child: Renderable, options: RenderOptions) { return render(child, options); }`,
        `export function sgr(style: Style) { return style.render("x"); }`,
        `export function optional(child: Renderable | undefined, options: RenderOptions) { return child?.render(options); }`,
        `export function measured(child: Measurable, options: RenderOptions) { return child.measure(options); }`,
        `export function measuredThrough(child: Measurable, options: RenderOptions) { return measure(child, options); }`,
        `export function unrelated(ruler: { measure(n: number): number }) { return ruler.measure(1); }`,
      ].join("\n"),
    );
    const protocol = path.join(REPO_ROOT, "src/core/protocol.ts");
    const calls = directRenderCalls(program([fixture, protocol]), [fixture, protocol]);
    expect(calls.map((c) => [path.basename(c.file), c.line, c.text])).toEqual([
      ["fixture.ts", 3, "child.render(options)"],
      ["fixture.ts", 6, "child?.render(options)"],
      ["fixture.ts", 7, "child.measure(options)"],
    ]);
  });
});
