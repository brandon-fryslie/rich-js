/**
 * effects-playground — the program each playground opens on, made from the
 * effects-feel demo's own source.
 *
 * [LAW:one-source-of-truth] A program is not a copy of an effect: it is the
 * effect's function as `curves.ts` has it now, and every declaration of
 * `curves.ts` that function reaches, cut out of the file and set between a
 * header (its imports and its curve, at the demo's defaults) and the one line
 * that plays it. An edit to `curves.ts` is an edit to the program; what a
 * playground runs before anyone touches it is what `npm run effects-feel`
 * runs.
 *
 * Runs in Node, where the playground's dev server makes the programs.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { EFFECTS, EFFECT_DEFAULTS, type EffectName } from "../effects-feel/vocabulary.js";

export const CURVES_FILE = fileURLToPath(new URL("../effects-feel/curves.ts", import.meta.url));
export const KIT_FILE = fileURLToPath(new URL("./kit.ts", import.meta.url));

/** The name a program imports the kit by. */
export const KIT_MODULE = "effects-kit";

/** What `curves.ts` imports, by the name a program imports it under instead. */
const IMPORTED_AS: Readonly<Record<string, string>> = { "../../src/index.js": "@promptctl/rich-js", "./noise.js": KIT_MODULE };

/**
 * Each effect's function in `curves.ts`, and the line that plays it on the
 * demo's subjects as the demo does (`scene` and `view` in app.ts). A
 * transition starts over a quarter of its duration after it settles.
 */
const PLAYED: Readonly<Record<EffectName, { readonly fn: string; readonly play: string }>> = {
  shimmer: { fn: "shimmer", play: `play("shimmer", (s, { theme }) => subjectUnder(s, shimmer(CURVE, s.span, SHIMMER_WIDTH, LIGHTS.sun, s.z), theme));` },
  pulse: { fn: "pulse", play: `play("pulse", (s, { theme }) => pulsedOn(s, (z) => pulse(CURVE, LIGHTS.sun, z), theme));` },
  sparkle: { fn: "sparkle", play: `play("sparkle", (s, { theme }) => subjectUnder(s, sparkle(CURVE, s.span, LIGHTS.firefly, s.z), theme));` },
  wheel: { fn: "wheel", play: `play("wheel", (s) => wheel(CURVE, s.colors, fills(s), s.z));` },
  fade: { fn: "fadeIn", play: `play("fade", (s, { theme, start }) => fadeIn(CURVE, start, s.z, theme.backgroundColor), settledAt(CURVE, 0) * 1.25);` },
  dissolve: {
    fn: "dissolveOut",
    play: `play("dissolve", (s, { theme, start }) => dissolveOut(CURVE, start, s.z, theme.backgroundColor), settledAt(CURVE, 0) * 1.25);`,
  },
};

/** Every name a node mentions, its own declarations' included. */
function namesIn(node: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n)) names.add(n.text);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return names;
}

/** The names a top-level statement declares. */
function declared(statement: ts.Statement): string[] {
  if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) ? [d.name.text] : []));
  const name = (statement as { name?: ts.Node }).name;
  return name !== undefined && ts.isIdentifier(name) ? [name.text] : [];
}

/** `statement` as the file spells it, its leading comment included and its `export` dropped. */
function text(file: ts.SourceFile, statement: ts.Statement): string {
  return file.text.slice(statement.getFullStart(), statement.getEnd()).replace(/^(\s*(?:\/\*\*[\s\S]*?\*\/\s*)?)export /, "$1").trim();
}

/** The program `effect`'s playground opens on, from `source`, the text of `curves.ts`. */
export function effectProgram(effect: EffectName, source: string): string {
  const file = ts.createSourceFile(CURVES_FILE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const statements = file.statements.filter((s) => !ts.isImportDeclaration(s));
  const byName = new Map(statements.flatMap((s) => declared(s).map((name): [string, ts.Statement] => [name, s])));
  const { fn, play } = PLAYED[effect];
  const root = byName.get(fn);
  if (root === undefined) throw new Error(`${CURVES_FILE}: no top-level ${fn} for the ${effect} playground`);

  // Everything the function and the play line reach, transitively.
  const reached = new Set<ts.Statement>([root]);
  const pending = [...namesIn(root), ...namesIn(ts.createSourceFile("play.ts", play, ts.ScriptTarget.Latest, true))];
  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    const statement = byName.get(name);
    if (statement === undefined || reached.has(statement)) continue;
    reached.add(statement);
    pending.push(...namesIn(statement));
  }

  const imports = file.statements.filter(ts.isImportDeclaration).map((statement) => {
    const from = (statement.moduleSpecifier as ts.StringLiteral).text;
    const as = IMPORTED_AS[from];
    if (as === undefined) throw new Error(`${CURVES_FILE}: imports ${from}, which a playground program has no name for`);
    return file.text.slice(statement.getStart(), statement.getEnd()).replace(JSON.stringify(from), JSON.stringify(as));
  });
  const d = EFFECT_DEFAULTS[effect];
  return [
    ...imports,
    `import { EASES } from "@promptctl/rich-js";`,
    `import { LIGHTS, SHIMMER_WIDTH, fills, play, pulsedOn, subjectUnder } from "${KIT_MODULE}";`,
    "",
    `// ${effect}: its curve, at the demo's defaults (vocabulary.ts EFFECT_DEFAULTS).`,
    `const CURVE: Curve = { seconds: ${d.seconds}, ease: EASES["${d.ease}"], swing: ${d.swing} };`,
    "",
    // The function first, then what it reaches in the order curves.ts has it.
    text(file, root),
    "",
    "// ─── What it reaches in curves.ts ───",
    "",
    ...statements.filter((s) => s !== root && reached.has(s)).map((s) => `${text(file, s)}\n`),
    play,
    "",
  ].join("\n");
}

/** Every effect's program, from `curves.ts` as it stands on disk. */
export function effectPrograms(): Record<EffectName, string> {
  const source = readFileSync(CURVES_FILE, "utf-8");
  return Object.fromEntries(EFFECTS.map((effect) => [effect, effectProgram(effect, source)])) as Record<EffectName, string>;
}
