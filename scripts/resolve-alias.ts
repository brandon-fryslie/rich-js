import ts from "typescript";

/**
 * Follow an alias chain to the symbol that actually declares the thing.
 *
 * [LAW:one-source-of-truth] The coverage verifier, the docs symbol check and
 * the docs build all resolve these chains. A second, shallower copy in
 * `test/docs/` once dropped any class re-exported through two hops — and
 * dropped it silently, which is worse than the miss.
 */
export function resolveAlias(sym: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  let s = sym;
  // Some aliases re-alias; loop until we hit a non-alias symbol or a
  // symbol the checker refuses to dereference further.
  while ((s.flags & ts.SymbolFlags.Alias) !== 0) {
    try {
      const aliased = checker.getAliasedSymbol(s);
      if (aliased === s) break;
      s = aliased;
    } catch {
      break;
    }
  }
  return s;
}
