/**
 * effects-playground — the program each playground opens on, made from the
 * library's own source for its effects, `src/renderables/effects.ts`.
 *
 * [LAW:one-source-of-truth] A program is not a copy of an effect: it is the
 * effect's function as `effects.ts` has it now, and every declaration of
 * `effects.ts` that function reaches, cut out of the file and set between a
 * header (its imports and its curve, at the library's defaults) and the one
 * line that plays it. An edit to `effects.ts` is an edit to the program; what
 * a playground runs before anyone touches it is what `npm run effects-feel`
 * runs.
 *
 * Runs in Node, where the playground's dev server makes the programs.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { EFFECTS, EFFECT_DEFAULTS, type EffectName } from "../effects-feel/vocabulary.js";
import { KIT_MODULE } from "./edits.js";

export const EFFECTS_FILE = fileURLToPath(new URL("../../src/renderables/effects.ts", import.meta.url));
export const NOISE_FILE = fileURLToPath(new URL("../../src/core/noise.ts", import.meta.url));
export const KIT_FILE = fileURLToPath(new URL("./kit.ts", import.meta.url));

/** What `effects.ts` imports from modules whose names the package exports, by the name a program imports them under instead. */
const IMPORTED_AS: Readonly<Record<string, string>> = {
  "../core/color.js": "@promptctl/rich-js",
  "../core/easing.js": "@promptctl/rich-js",
  "../core/oklch.js": "@promptctl/rich-js",
  "./effect.js": "@promptctl/rich-js",
};

/**
 * What `effects.ts` imports from a module the package does not export: a
 * program carries what it reaches there too, cut from that file as the
 * effect's own declarations are cut from `effects.ts`.
 */
const CUT_FROM: Readonly<Record<string, string>> = { "../core/noise.js": NOISE_FILE };

/** The files a program is cut from, by path: `effects.ts` and each one `CUT_FROM` names. */
export type Sources = Readonly<Record<string, string>>;

/**
 * Each effect's function in `effects.ts`, and the line that plays it on the
 * demo's subjects as the demo does (`scene` and `view` in app.ts). A
 * transition starts over a quarter of its duration after it settles.
 */
const PLAYED: Readonly<Record<EffectName, { readonly fn: string; readonly play: string }>> = {
  shimmer: { fn: "shimmer", play: `play("shimmer", (s, { theme, magnitude }) => subjectUnder(s, shimmer(magnified(CURVE, magnitude), s.span, SHIMMER_WIDTH, EFFECT_LIGHTS.sun, s.z), theme));` },
  pulse: { fn: "pulse", play: `play("pulse", (s, { theme, magnitude }) => pulsedOn(s, (z) => pulse(magnified(CURVE, magnitude), EFFECT_LIGHTS.sun, z), theme));` },
  sparkle: { fn: "sparkle", play: `play("sparkle", (s, { theme, magnitude }) => subjectUnder(s, sparkle(magnified(CURVE, magnitude), s.span, EFFECT_LIGHTS.firefly, s.z), theme));` },
  wheel: { fn: "wheel", play: `play("wheel", (s, { magnitude }) => wheel(magnified(CURVE, magnitude), s.colors, fills(s), s.z));` },
  fade: { fn: "fadeIn", play: `play("fade", (s, { theme, start }) => fadeIn(CURVE, start, s.z, theme.backgroundColor).effect, CURVE.seconds * 1.25);` },
  dissolve: {
    fn: "dissolveOut",
    play: `play("dissolve", (s, { theme, start }) => dissolveOut(CURVE, start, s.z, theme.backgroundColor).effect, CURVE.seconds * 1.25);`,
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

/** The program `effect`'s playground opens on, from `sources`, the text of `effects.ts` and of every file `CUT_FROM` names. */
export function effectProgram(effect: EffectName, sources: Sources): string {
  const parse = (path: string): ts.SourceFile => {
    const source = sources[path];
    if (source === undefined) throw new Error(`no source given for ${path}`);
    return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  };
  const file = parse(EFFECTS_FILE);
  // [LAW:one-source-of-truth] Every file's declarations, `effects.ts`'s first, so what a program carries is what the library has.
  const files = [file, ...Object.values(CUT_FROM).map(parse)];
  const statements = files.flatMap((f) => f.statements.filter((s) => !ts.isImportDeclaration(s)).map((s): [ts.SourceFile, ts.Statement] => [f, s]));
  const byName = new Map(statements.flatMap(([, s]) => declared(s).map((name): [string, ts.Statement] => [name, s])));
  const { fn, play } = PLAYED[effect];
  const root = byName.get(fn);
  if (root === undefined) throw new Error(`${EFFECTS_FILE}: no top-level ${fn} for the ${effect} playground`);

  // Everything the function and the play line reach, transitively.
  const reached = new Set<ts.Statement>([root]);
  const pending = [...namesIn(root), ...namesIn(ts.createSourceFile("play.ts", play, ts.ScriptTarget.Latest, true))];
  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    const statement = byName.get(name);
    if (statement === undefined || reached.has(statement)) continue;
    reached.add(statement);
    pending.push(...namesIn(statement));
  }

  const imports = files.flatMap((f) =>
    f.statements.filter(ts.isImportDeclaration).flatMap((statement) => {
      const from = (statement.moduleSpecifier as ts.StringLiteral).text;
      if (f === file && Object.hasOwn(CUT_FROM, from)) return [];
      const as = IMPORTED_AS[from];
      if (as === undefined) throw new Error(`${f.fileName}: imports ${from}, which a playground program has no name for`);
      return [f.text.slice(statement.getStart(), statement.getEnd()).replace(JSON.stringify(from), JSON.stringify(as))];
    }),
  );
  const d = EFFECT_DEFAULTS[effect];
  return [
    ...imports,
    // `EASES`, which the curve below names, comes with `effects.ts`'s own imports.
    `import { fills, magnified, play, pulsedOn, subjectUnder } from "${KIT_MODULE}";`,
    "",
    `// ${effect}: its curve, at the library's defaults (EFFECT_CURVES).`,
    `const CURVE: Curve = { seconds: ${d.seconds}, ease: EASES["${d.ease}"], swing: ${d.swing} };`,
    "",
    // The function first, then what it reaches in the order the library has it.
    text(file, root),
    "",
    "// ─── What it reaches in the library ───",
    "",
    ...statements.filter(([, s]) => s !== root && reached.has(s)).map(([f, s]) => `${text(f, s)}\n`),
    play,
    "",
  ].join("\n");
}

/** Every effect's program, from the library's files as they stand on disk. */
export function effectPrograms(): Record<EffectName, string> {
  const sources = Object.fromEntries([EFFECTS_FILE, ...Object.values(CUT_FROM)].map((path) => [path, readFileSync(path, "utf-8")]));
  return Object.fromEntries(EFFECTS.map((effect) => [effect, effectProgram(effect, sources)])) as Record<EffectName, string>;
}
