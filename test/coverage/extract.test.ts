// [LAW:verifiable-goals] `visitTypePositions` decides what the coverage
// floor counts as a demonstrated type, and both gaps found in it so far —
// private members counting as surface, method bodies counting as surface —
// were found by a reviewer rather than by a test. The only exercise it had
// was one aggregate pass over the real `src/` + `examples/` tree, which
// reports pass or fail and cannot say which position was mishandled.
//
// [LAW:behavior-not-structure] These fixtures assert the contract — a
// declaration's type surface is its signature, never its implementation —
// not the traversal that implements it. Any walk yielding the same names
// passes.

import { describe, it, expect } from "vitest";
import ts from "typescript";
import { visitTypePositions } from "./extract.js";

/** Names reached in type positions of the fixture's single declaration. */
function surfaceOf(source: string): string[] {
  // `setParentNodes` must be true: the walk prunes bodies and initializers
  // by asking a node what role it plays in its parent.
  const sf = ts.createSourceFile("f.ts", source, ts.ScriptTarget.ES2022, true);
  const found: string[] = [];
  visitTypePositions(sf, (id) => found.push(id.text));
  return [...new Set(found)].sort();
}

describe("visitTypePositions", () => {
  it("reaches signature positions: params, returns, properties, type args", () => {
    expect(
      surfaceOf(`
        class C {
          prop: PropType | null = null;
          method(p: ParamType): ReturnType<Wrapped> { return null as never; }
        }
      `),
    ).toEqual(["ParamType", "PropType", "ReturnType", "Wrapped"]);
  });

  it("reaches heritage clauses, type parameters and typeof queries", () => {
    expect(
      surfaceOf(`
        class C<T extends Bound> extends Base implements Contract {
          v: typeof Sentinel = Sentinel;
        }
      `),
    ).toEqual(["Base", "Bound", "Contract", "Sentinel"]);
  });

  it("reaches the qualifier of an import() type", () => {
    // src/core/color.ts declares TerminalTheme's palette this way, so a
    // walk that misses it misses real public surface.
    expect(
      surfaceOf(`class C { constructor(readonly p: import("./m.js").Qualified) {} }`),
    ).toEqual(["Qualified"]);
  });

  it("reaches through a qualified name to its leftmost identifier", () => {
    // `ns` is the binding an import statement introduces; `Inner` is not.
    expect(surfaceOf(`class C { v: ns.Inner | null = null; }`)).toEqual(["ns"]);
  });

  it("does not reach a type named only inside a private or #private member", () => {
    expect(
      surfaceOf(`
        class C {
          private hidden(p: PrivateOnly): void {}
          #alsoHidden(p: HashPrivateOnly): void {}
          public shown(p: PublicType): void {}
        }
      `),
    ).toEqual(["PublicType"]);
  });

  it("reaches a protected member — reachable by a subclass, so it is surface", () => {
    expect(
      surfaceOf(`class C { protected p(x: ProtectedType): void {} }`),
    ).toEqual(["ProtectedType"]);
  });

  it("does not reach a type named only inside a method body", () => {
    expect(
      surfaceOf(`
        class C {
          shown(p: ParamType): void {
            const local: BodyOnly = p as unknown as BodyOnly;
            use<GenericArgOnly>(local);
          }
        }
      `),
    ).toEqual(["ParamType"]);
  });

  it("does not reach a type named only inside an initializer", () => {
    expect(
      surfaceOf(`
        class C {
          prop: PropType = make<InitOnly>();
          method(p: ParamType = other<DefaultOnly>()): void {}
        }
      `),
    ).toEqual(["ParamType", "PropType"]);
  });

  it("reaches an interface's members, which are all surface", () => {
    expect(
      surfaceOf(`
        interface I extends BaseIface {
          field: FieldType;
          method(p: MethodParam): MethodReturn;
        }
      `),
    ).toEqual(["BaseIface", "FieldType", "MethodParam", "MethodReturn"]);
  });
});
