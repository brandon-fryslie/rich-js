/**
 * effects-playground — the program each effect's card on the docs' effects
 * playground page opens on, made from the library's own source for its
 * effects, `src/renderables/effects.ts`.
 *
 * [LAW:one-source-of-truth] A program is not a copy of an effect: it is the
 * effect's function as `effects.ts` has it now, and every declaration of
 * `effects.ts` that function reaches, cut out of the file and set between a
 * header (its imports, its curve at the library's defaults, and its pace at
 * the effects-feel demo's) and the one line that plays it. An edit to
 * `effects.ts` is an edit to the program; what a card runs before anyone
 * touches it is what `npm run effects-feel` runs. The header's numbers are
 * named constants, so the card's sliders are over them (tunables.ts in
 * docs/.vitepress).
 *
 * Runs in Node, where the docs build makes the cards (docs/.vitepress/effect-cards.ts).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { EFFECTS, EFFECT_DEFAULTS, RUN_DEFAULTS, STEP, type EffectName } from "../effects-feel/vocabulary.js";

export const EFFECTS_FILE = fileURLToPath(new URL("../../src/renderables/effects.ts", import.meta.url));
export const NOISE_FILE = fileURLToPath(new URL("../../src/core/noise.ts", import.meta.url));

/** The module a program imports the kit (kit.ts) by: a file of its card beside it. */
const KIT_MODULE = "./kit.js";

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

/** How a loop plays: never starting over. */
const LOOPING = "{ fps: FPS, step: STEP, every: Infinity }";

/** How a transition plays: starting over a quarter of its duration after it settles. */
const REPLAYING = "{ fps: FPS, step: STEP, every: CURVE.seconds * 1.25 }";

/**
 * Each effect's function in `effects.ts`, and the line that plays it on the
 * demo's subjects as the demo does (`scene` and `view` in app.ts).
 */
const PLAYED: Readonly<Record<EffectName, { readonly fn: string; readonly play: string }>> = {
  shimmer: { fn: "shimmer", play: `play((s) => subjectUnder(s, shimmer(CURVE, s.span, SHIMMER_WIDTH, EFFECT_LIGHTS.sun, s.z), THEME), ${LOOPING});` },
  pulse: { fn: "pulse", play: `play((s) => pulsedOn(s, (z) => pulse(CURVE, EFFECT_LIGHTS.sun, z), THEME), ${LOOPING});` },
  sparkle: { fn: "sparkle", play: `play((s) => subjectUnder(s, sparkle(CURVE, s.span, EFFECT_LIGHTS.firefly, s.z), THEME), ${LOOPING});` },
  wheel: { fn: "wheel", play: `play((s) => wheel(CURVE, s.colors, fills(s), s.z), ${LOOPING});` },
  fade: { fn: "fadeIn", play: `play((s, start) => fadeIn(CURVE, start, s.z, THEME.backgroundColor).effect, ${REPLAYING});` },
  dissolve: { fn: "dissolveOut", play: `play((s, start) => dissolveOut(CURVE, start, s.z, THEME.backgroundColor).effect, ${REPLAYING});` },
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

/**
 * `statement` as the file spells it, its doc comment included and its `export`
 * dropped. From the doc comment, not the full start: a file's header leads its
 * first statement, and is about the file, not the declaration.
 */
function text(file: ts.SourceFile, statement: ts.Statement): string {
  const doc = ts.getJSDocCommentsAndTags(statement).filter(ts.isJSDoc).at(-1);
  return file.text.slice((doc ?? statement).getStart(file), statement.getEnd()).replace(/^(\s*(?:\/\*\*[\s\S]*?\*\/\s*)?)export /, "$1").trim();
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
    `import { THEME, fills, play, pulsedOn, subjectUnder } from "${KIT_MODULE}";`,
    "",
    `// ${effect}: its curve, at the library's defaults (EFFECT_CURVES).`,
    `const CURVE: Curve = { seconds: ${d.seconds}, ease: EASES["${d.ease}"], swing: ${d.swing} };`,
    "",
    "// How it plays: frames a second, and how far each moves curve time, what CURVE.seconds is measured in.",
    `const FPS = ${RUN_DEFAULTS.fps};`,
    `const STEP = ${STEP};`,
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
