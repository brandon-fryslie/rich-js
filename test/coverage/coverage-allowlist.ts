// [LAW:no-silent-failure] The allowlist is the only place a public export
// may go undemonstrated without breaking the build. Every entry is explicit
// and carries a written reason for the absence.
//
// [LAW:one-source-of-truth] Keys are canonical exposed names — see
// `canonicalNameFor()` in `extract.ts`. The verifier additionally rejects
// (a) entries pointing at no real export (dead), and (b) entries already
// demonstrated (redundant) — both shapes of drift the allowlist itself
// would otherwise hide.
//
// What "demonstrated" means depends on the export, and `coverage.test.ts`
// decides from the origin's `kind`: a value is demonstrated by a demo's
// import statement naming it; a type is demonstrated by being reachable
// through type positions from such a value. So a type almost never belongs
// here — demonstrate the function or class that uses it and the type
// follows. An entry is for the export nothing runnable can reach at all.
//
// This file used to carry 102 entries against a plan that never landed. It
// carries one. Keep it that way: reach for an entry only when the export
// genuinely cannot appear in a runtime demo, and say why in a sentence that
// names the obstacle.

/** Why one public export is absent from `examples/` without failing the build. */
export interface AllowlistEntry {
  readonly reason: string;
}

/** Keyed by canonical exposed name (see `extract.ts: canonicalNameFor`). */
export const ALLOWLIST: Readonly<Record<string, AllowlistEntry>> = {
  nodeAsk: {
    reason:
      "readline-backed PromptInput implementation. Demonstrable only by a demo " +
      "that accepts interactive line input; every TUI demo here reads raw-mode stdin.",
  },
  PrintOptions: {
    reason:
      "Console.print takes `...args: unknown[]` and sniffs the options object " +
      "off the last argument, so the type is named only inside print's body — " +
      "no public signature carries it. Reaching it would mean giving print a " +
      "typed signature, which is an API decision, not a coverage chore.",
  },
  ThemePaletteData: {
    reason:
      "`THEMES` is declared without an annotation so `ThemeName = keyof typeof " +
      "THEMES` stays a literal union, and the per-theme annotations sit on " +
      "module-private consts in themes/data/*.ts. Public as a shape to write " +
      "a custom theme against; named by no public signature.",
  },
};
