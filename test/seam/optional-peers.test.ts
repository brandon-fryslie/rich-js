/*
 * [LAW:verifiable-goals] "Installing this package does not install mobx" was
 * established the way it had to be — a tarball packed, installed into an
 * empty project, and the resulting `node_modules` read — and that check ran
 * once, by hand, on the commit that made it true. This is the same claim as
 * something the unit suite can lose.
 *
 * [LAW:behavior-not-structure] The gate asserts the contract a consumer
 * experiences: what they must install to import each published subpath. It
 * asserts nothing about how `src/` is arranged — move mobx's importers
 * anywhere under `src/widgets/`, split the widget set into twenty files, and
 * it stays green.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import { REPO_ROOT, ENTRY_BY_SPECIFIER, PACKAGE_MANIFEST } from "../coverage/extract.js";
import { reachableSourceModules, parseSourceFile, runtimeModuleSpecifiers } from "./graph.js";
import { classifySpecifier } from "./specifiers.js";
import {
  PEER_PROVIDERS,
  optionalPeers,
  peerViolations,
  describePeerViolation,
  type PackageReach,
} from "./optional-peers.js";

/**
 * Every (entry, package) pair the published surface requires, with the
 * import that requires it.
 *
 * One walk *per entry*, deliberately. `reachableSourceModules` dedupes on
 * first arrival, so a single walk seeded with all ten entries would credit
 * `src/core/style.ts` to whichever entry reached it first and report the
 * other nine as reaching nothing — which is precisely the attribution this
 * rule is about. Ten small walks answer ten separate questions; one big walk
 * answers a different question that looks like the same one.
 */
function gatherReaches(): PackageReach[] {
  const reaches: PackageReach[] = [];
  for (const [entry, source] of ENTRY_BY_SPECIFIER) {
    for (const module of reachableSourceModules([path.join(REPO_ROOT, source)])) {
      const sf = parseSourceFile(module.file);
      for (const specifier of runtimeModuleSpecifiers(sf)) {
        const kind = classifySpecifier(specifier.text);
        if (kind.kind !== "package") continue;
        reaches.push({
          entry,
          package: kind.name,
          file: path.relative(REPO_ROOT, module.file),
          line: sf.getLineAndCharacterOfPosition(specifier.getStart(sf)).line + 1,
          via: module.via,
        });
      }
    }
  }
  return reaches;
}

const REACHES = gatherReaches();

/** The distinct packages one published specifier obliges a consumer to have. */
function packagesFor(entry: string): string[] {
  return [...new Set(REACHES.filter((r) => r.entry === entry).map((r) => r.package))].sort();
}

describe("PEER_PROVIDERS", () => {
  it("names exactly the optional peers package.json declares", () => {
    // [LAW:one-source-of-truth] `package.json` owns which packages are
    // optional; this table owns which subpath provides each. The two halves
    // are only one fact while they cover the same set of packages — a row
    // with no manifest entry exempts nothing, and a manifest entry with no
    // row would leave the graph check with no allow-list to check against.
    expect(Object.keys(PEER_PROVIDERS).sort()).toEqual(
      [...optionalPeers(PACKAGE_MANIFEST)].sort(),
    );
  });

  it("gives every row a reason", () => {
    for (const [name, provider] of Object.entries(PEER_PROVIDERS)) {
      expect(provider.why.length, `PEER_PROVIDERS.${name} needs a why`).toBeGreaterThan(40);
      expect(provider.entries.length, `PEER_PROVIDERS.${name} needs an entry`).toBeGreaterThan(0);
    }
  });
});

describe("the published surface declares what it needs", () => {
  it("obliges a consumer to install nothing package.json does not promise them", () => {
    const failures = peerViolations(REACHES, PACKAGE_MANIFEST, PEER_PROVIDERS).map(
      describePeerViolation,
    );
    expect(
      failures,
      `What this package makes a consumer install has drifted from what it ` +
        `declares. An optional peer belongs to the subpath that imports it — ` +
        `move the import back under that subtree, or, if the dependency really ` +
        `is needed on the default path, promote it to \`dependencies\` and drop ` +
        `its \`peerDependenciesMeta\` row.\n\n${failures.join("\n")}\n`,
    ).toEqual([]);
  });
});

/**
 * The install contract, stated as the facts a consumer can observe. These
 * are what the gate above is protecting; written out, they also say what
 * breaking it would look like.
 */
describe("what each published subpath costs to install", () => {
  it("charges the main barrel nothing but its hard dependencies", () => {
    expect(packagesFor("@promptctl/rich-js")).toEqual(["string-width"]);
  });

  /**
   * Written out literally rather than read off `PEER_PROVIDERS`, which would
   * turn this into a restatement of the gate above instead of the contract
   * that gate protects. The two subpaths owe their package for the same
   * reason, so they are two values of one test rather than two copies of it.
   */
  const SUBPATH_PEERS = [
    { entry: "@promptctl/rich-js/widgets", pkg: "mobx" },
    { entry: "@promptctl/rich-js/template-bindings", pkg: "@promptctl/go-template-js" },
  ];

  it.each(SUBPATH_PEERS)("charges $pkg to $entry and to nothing else", ({ entry, pkg }) => {
    expect(packagesFor(entry)).toContain(pkg);
    const elsewhere = REACHES.filter((r) => r.package === pkg && r.entry !== entry);
    expect(elsewhere).toEqual([]);
  });

  /**
   * Hand-written values, checked coverage. Deriving `SUBPATH_PEERS` from
   * `PEER_PROVIDERS` would make the cases above restate the gate instead of
   * stating the contract, but a list nobody checks is a list that falls
   * behind — so a third optional peer has to arrive with its contract
   * written out rather than silently going undescribed.
   */
  it("states a contract for every optional peer the manifest declares", () => {
    expect(SUBPATH_PEERS.map((s) => s.pkg).sort()).toEqual(
      [...optionalPeers(PACKAGE_MANIFEST)].sort(),
    );
  });

  it("keeps the node airlock an opt-in to builtins, not to new installs", () => {
    const barrel = packagesFor("@promptctl/rich-js");
    const nodeEntries = [...ENTRY_BY_SPECIFIER.keys()].filter((e) => e.includes("/node/"));
    expect(nodeEntries.length).toBeGreaterThan(0);
    for (const entry of nodeEntries) {
      const beyondBarrel = packagesFor(entry).filter((pkg) => !barrel.includes(pkg));
      expect(beyondBarrel, `${entry} costs a consumer more than the barrel does`).toEqual([]);
    }
  });
});

/**
 * The rule, pinned against graphs written to break it. The gate above is
 * green today, and a green check nobody has broken is not evidence that it
 * can go red — these fixtures are.
 */
const MANIFEST = {
  name: "@scope/lib",
  dependencies: { "string-width": "^8.0.0" },
  peerDependencies: { mobx: "^6.0.0", react: "^19.0.0" },
  peerDependenciesMeta: { mobx: { optional: true } },
};

const PROVIDERS = { mobx: { entries: ["@scope/lib/widgets"], why: "the widget layer's state" } };

function reach(entry: string, pkg: string): PackageReach {
  return { entry, package: pkg, file: "src/x.ts", line: 3, via: ["src/e.ts", "src/x.ts"] };
}

/**
 * The reach that makes `PROVIDERS`' one row current. Every fixture below
 * that is testing some *other* arm carries it, because a provider row and
 * the import it was granted for are two halves of a healthy state: drop the
 * import and the row is stale, which is a finding in its own right and would
 * otherwise show up as noise in the arm actually under test.
 */
const WIDGETS_MOBX = reach("@scope/lib/widgets", "mobx");

describe("peerViolations", () => {
  it("passes an optional peer reached from the entry that provides it", () => {
    expect(peerViolations([WIDGETS_MOBX], MANIFEST, PROVIDERS)).toEqual([]);
  });

  it("catches an optional peer reached from the default path", () => {
    expect(peerViolations([WIDGETS_MOBX, reach("@scope/lib", "mobx")], MANIFEST, PROVIDERS)).toEqual(
      [
        {
          rule: "optional-peer-on-default-path",
          package: "mobx",
          entry: "@scope/lib",
          file: "src/x.ts",
          line: 3,
          via: ["src/e.ts", "src/x.ts"],
        },
      ],
    );
  });

  it("catches a package declared nowhere, optional or not", () => {
    expect(
      peerViolations([WIDGETS_MOBX, reach("@scope/lib", "lodash")], MANIFEST, PROVIDERS)[0],
    ).toMatchObject({ rule: "undeclared-package", package: "lodash", entry: "@scope/lib" });
  });

  it("allows a non-optional peer anywhere, since every consumer gets it", () => {
    // npm installs a peer that is not marked optional, so reaching `react`
    // from the barrel costs a consumer nothing they were not already given.
    expect(
      peerViolations([WIDGETS_MOBX, reach("@scope/lib", "react")], MANIFEST, PROVIDERS),
    ).toEqual([]);
  });

  it("allows the package's own name, which resolves through its own exports", () => {
    expect(
      peerViolations([WIDGETS_MOBX, reach("@scope/lib", "@scope/lib")], MANIFEST, PROVIDERS),
    ).toEqual([]);
  });

  it("catches a provider entry that no longer reaches the package", () => {
    expect(peerViolations([], MANIFEST, PROVIDERS)).toEqual([
      { rule: "stale-provider-entry", package: "mobx", entry: "@scope/lib/widgets" },
    ]);
  });

  it("reports every reach of an optional peer that has no row at all", () => {
    // The forgotten row is the shape that must not pass quietly: with no
    // allow-list, every entry is the wrong entry.
    const orphaned = peerViolations([WIDGETS_MOBX], MANIFEST, {});
    expect(orphaned).toEqual([
      {
        rule: "optional-peer-on-default-path",
        package: "mobx",
        entry: "@scope/lib/widgets",
        file: "src/x.ts",
        line: 3,
        via: ["src/e.ts", "src/x.ts"],
      },
    ]);
  });

  it("reports a deep import under the package that owns it", () => {
    // What a consumer installs is the package, so `mobx/dist/…` is `mobx`.
    expect(classifySpecifier("mobx/dist/mobx.esm.js")).toEqual({ kind: "package", name: "mobx" });
    expect(classifySpecifier("@scope/lib/widgets")).toEqual({
      kind: "package",
      name: "@scope/lib",
    });
  });
});

describe("classifySpecifier", () => {
  it("sorts the three kinds a specifier can be", () => {
    expect(classifySpecifier("./sibling.js")).toEqual({ kind: "relative" });
    expect(classifySpecifier("../core/style.js")).toEqual({ kind: "relative" });
    expect(classifySpecifier("node:fs")).toEqual({ kind: "builtin" });
    // A builtin spelled without the scheme is the shape an IDE auto-import
    // produces, and it is exactly as much a builtin.
    expect(classifySpecifier("fs")).toEqual({ kind: "builtin" });
    expect(classifySpecifier("fs/promises")).toEqual({ kind: "builtin" });
    expect(classifySpecifier("string-width")).toEqual({ kind: "package", name: "string-width" });
  });
});
