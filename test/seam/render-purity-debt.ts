/*
 * Every writable location `./render-purity.ts` finds today, grouped by the
 * declaration that holds it, and where each is going: into a `State` or a
 * `ListState` (`"state"`, state that changes after construction), or to a
 * readonly type (`"readonly"`, a value nothing writes once it is built). What
 * is left is the state a render still commits, which rich-protocol-9xcs.o76
 * moves out of render.
 *
 * Shrink-only. `test/seam/render-purity.test.ts` fails on a location no row
 * names, and on a name that no longer reports — so a row is deleted, never
 * left behind, when its location is fixed. A new location does not belong
 * here: write it as a `State` (a `ListState` for a list appended to), a `Memo`
 * (`WeakMemo` for an object key) or a readonly type instead.
 */

export interface DebtRow {
  /** `<file> <Owner>`: the file, and the class, interface or `module` that declares the locations. */
  readonly at: string;
  /** The locations under `at`, as the gate names them after `<Owner>.`. */
  readonly names: readonly string[];
  readonly becomes: "state" | "readonly";
  readonly why: string;
}

export const RENDER_PURITY_DEBT: readonly DebtRow[] = [
  {
    at: "src/widgets/text-input.ts TextInput",
    names: ["_drawn", "_killBuffer", "_preferredColumn", "_scrollStart", "_singleLineViewportStart", "_visualRows"],
    becomes: "state",
    why: "edit and scroll state, part of it committed in render today; rich-protocol-9xcs.o76 moves that commit to the host",
  },
];
