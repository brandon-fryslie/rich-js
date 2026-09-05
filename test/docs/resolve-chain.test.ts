/*
 * Chain resolution against surfaces `docs/` does not contain.
 *
 * Every arm exercised here is one the real corpus never takes: it holds no
 * ambiguous class name and no chain that dead-ends, so `symbol-existence`'s
 * sweep runs these conditions with a value that is always false. An inverted
 * `> 1`, an origins map compared the wrong way, or a `lookupType` stubbed to
 * always succeed would leave that whole file green. [LAW:verifiable-goals]
 *
 * The failure that matters is not a wrong error message. It is that the sweep
 * concludes "every documented member exists" from a resolver that quietly
 * stopped rejecting anything — the ghost check downstream treats an unresolved
 * receiver as nothing to check, so a broken resolver reads exactly like a clean
 * corpus. [LAW:no-silent-failure]
 */

import { describe, expect, it } from "vitest";

import type { MemberUse } from "./code-blocks.js";
import {
  lookupType,
  resolveChain,
  type MemberSet,
  type Surface,
  type SurfaceType,
} from "./resolve-chain.js";

function memberSet(members: string[], yields: Record<string, string>): MemberSet {
  return { members: new Set(members), yields: new Map(Object.entries(yields)) };
}

function surfaceType(options: {
  members?: string[];
  statics?: string[];
  origins?: Record<string, string>;
  yields?: Record<string, string>;
  staticYields?: Record<string, string>;
}): SurfaceType {
  return {
    instance: memberSet(options.members ?? [], options.yields ?? {}),
    statics: memberSet(options.statics ?? [], options.staticYields ?? {}),
    origins: new Map(Object.entries(options.origins ?? { self: "src/index.ts" })),
  };
}

function use(
  rootClass: string,
  path: string[],
  member: string,
  rootIsClassObject = false,
): MemberUse {
  return {
    page: "fixture.md",
    line: 1,
    rootClass,
    path,
    member,
    rootIsClassObject,
    text: [rootClass, ...path, member].join("."),
  };
}

/**
 * `Layout.getByName()` yields a `Layout`; `Console` is a plain leaf; `Style` has
 * a static `parse` yielding a `Style` and an instance `add` that is not static.
 */
const SURFACE: Surface = new Map<string, SurfaceType>([
  ["Layout", surfaceType({ members: ["update", "getByName"], yields: { getByName: "Layout" } })],
  ["Console", surfaceType({ members: ["print"] })],
  [
    "Style",
    surfaceType({ members: ["add"], statics: ["parse"], staticYields: { parse: "Style" } }),
  ],
]);

describe("lookupType", () => {
  it("resolves a name the surface has exactly one of", () => {
    const found = lookupType(SURFACE, "Console");
    expect("unresolved" in found).toBe(false);
  });

  it("reports a name the surface does not have", () => {
    expect(lookupType(SURFACE, "RichHandler")).toEqual({
      unresolved: "RichHandler is not a class this package exports",
    });
  });

  // Two entry points exporting *different* classes under one name. A page
  // writes a bare class name and nothing else, so this cannot be disambiguated
  // from the input — resolving it to whichever module was walked last would be
  // a coin flip reported as a fact.
  it("reports a name two entry points export different classes under", () => {
    const ambiguous: Surface = new Map([
      [
        "Console",
        surfaceType({
          members: ["print"],
          origins: { a: "src/index.ts", b: "src/widgets/index.ts" },
        }),
      ],
    ]);
    expect(lookupType(ambiguous, "Console")).toEqual({
      unresolved: "'Console' is exported by src/index.ts and src/widgets/index.ts",
    });
  });

  // The counterpart, and the reason `origins` is keyed by declaration identity
  // rather than counting modules: this repo re-exports symbols from several
  // entry points on purpose, and one class reachable two ways is not ambiguous.
  it("resolves one class re-exported from two entry points", () => {
    const reexported: Surface = new Map([
      ["ThemeName", surfaceType({ members: [], origins: { onlyDeclaration: "src/index.ts" } })],
    ]);
    expect("unresolved" in lookupType(reexported, "ThemeName")).toBe(false);
  });
});

describe("resolveChain", () => {
  it("lands a chain with no hops on its root class", () => {
    const resolution = resolveChain(SURFACE, use("Console", [], "print"));
    expect("className" in resolution && resolution.className).toBe("Console");
  });

  it("follows a hop through what that member yields", () => {
    const resolution = resolveChain(SURFACE, use("Layout", ["getByName"], "update"));
    expect("className" in resolution && resolution.className).toBe("Layout");
  });

  it("reports a hop whose member yields no class to follow", () => {
    expect(resolveChain(SURFACE, use("Console", ["print"], "anything"))).toEqual({
      unresolved: "Console.print yields no class to follow",
    });
  });

  it("reports a root the surface does not have, before walking any hop", () => {
    expect(resolveChain(SURFACE, use("RichHandler", ["setLevel"], "emit"))).toEqual({
      unresolved: "RichHandler is not a class this package exports",
    });
  });

  // `Style.parse("bold")`. The member is read off the class object, so the
  // terminus has to be looked up on the static side — the instance side would
  // report the page's most common static call as a ghost.
  it("reads a terminal member off the class object when the root is one", () => {
    const resolution = resolveChain(SURFACE, use("Style", [], "parse", true));
    expect("side" in resolution && resolution.side.members.has("parse")).toBe(true);
  });

  // `Style.parse("bold").add(…)`. The static side yields the class, and what it
  // yielded is an instance.
  it("follows a static hop and lands back on the instance side", () => {
    const resolution = resolveChain(SURFACE, use("Style", ["parse"], "add", true));
    expect("className" in resolution && resolution.className).toBe("Style");
    expect("side" in resolution && resolution.side.members.has("add")).toBe(true);
  });

  // Only step zero can be static; staticness does not travel down the chain.
  // A rule applied per-hop instead of to the origin would resolve this, and
  // every instance member reachable from a factory would be checked against the
  // wrong half of its class.
  it("stops treating a chain as static after its first step", () => {
    expect(resolveChain(SURFACE, use("Style", ["parse", "parse"], "add", true))).toEqual({
      unresolved: "Style.parse yields no class to follow",
    });
  });

  // The mirror: an instance-rooted chain never reads the static side, so a page
  // writing `style.parse(…)` on an instance is the ghost it looks like.
  it("does not offer statics to a chain rooted in an instance", () => {
    const resolution = resolveChain(SURFACE, use("Style", [], "parse"));
    expect("side" in resolution && resolution.side.members.has("parse")).toBe(false);
  });

  // The terminus is asked the same question as every hop. It used to be asked a
  // weaker one — ambiguity only — so a chain ending in a name this package does
  // not export came back resolved, and the ghost check treated the missing
  // class as a pass. [LAW:single-enforcer]
  it("reports a terminus the surface does not have", () => {
    const danglingYield: Surface = new Map([
      ["Layout", surfaceType({ members: ["getByName"], yields: { getByName: "Ghost" } })],
    ]);
    expect(resolveChain(danglingYield, use("Layout", ["getByName"], "update"))).toEqual({
      unresolved: "Ghost is not a class this package exports",
    });
  });
});
