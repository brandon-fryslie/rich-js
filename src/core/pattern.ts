/**
 * pattern — `Pattern`: a regular expression held where every caller reaches
 * it — module scope, a class static, a renderable's field — with no cursor
 * for them to share.
 *
 * A `RegExp` carries `lastIndex`, and the `exec`, `test` and `replace` of a
 * global or sticky one write it, so a global regex held at module scope is
 * state that every caller moves. A regex with neither flag has a `lastIndex`
 * that `exec`, `test`, `match`, `replace` and `split` never write. `pattern`
 * is where that is checked: it refuses `g` and `y`, and hands back only
 * those, with `source` and `flags` to compose it into another. A cursor — a
 * sticky scan, a global replace — is made in the function that runs it, so
 * each call owns its own.
 */

declare const PATTERN: unique symbol;

/** A regex with no cursor: only `pattern` makes one. */
export type Pattern = Pick<
  RegExp,
  "exec" | "test" | "source" | "flags" | typeof Symbol.match | typeof Symbol.replace | typeof Symbol.split
> & { readonly [PATTERN]: true };

export function pattern(re: RegExp): Pattern {
  // [LAW:no-silent-failure] A held cursor is refused where it is made, not found later as a match that began mid-string.
  if (re.global || re.sticky) {
    throw new TypeError(`/${re.source}/${re.flags} keeps a cursor in lastIndex; make it in the function that runs it`);
  }
  return re as unknown as Pattern;
}
