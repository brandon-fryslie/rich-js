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
  // Some aliases re-alias; loop until we hit a non-alias symbol. An alias
  // that resolves to nothing comes back as the checker's `unknown` symbol,
  // which is not an alias, so the chain always ends.
  while ((s.flags & ts.SymbolFlags.Alias) !== 0) {
    const aliased = checker.getAliasedSymbol(s);
    if (aliased === s) break;
    s = aliased;
  }
  return s;
}
