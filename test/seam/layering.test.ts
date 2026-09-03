/*
 * [LAW:verifiable-goals] CLAUDE.md says `src/core/` has "no upward calls",
 * names the two edges that leave it anyway, and — until this file — told the
 * reader to verify all of it by hand with a grep. That instruction has
 * already been wrong once: PR #66 paired the no-back-edges claim with the
 * pattern `from "\./[a-z]+\.js"`, which matches same-directory imports only
 * and so could not have found either real edge. A reader following it would
 * have got a clean result from a check incapable of returning anything else —
 * worse than no check at all, an unverified claim wearing the costume of a
 * verified one. Review caught it; nothing else would have, which is the
 * argument for a gate that runs on every commit rather than a better grep.
 *
 * [LAW:behavior-not-structure] The gate asserts the dependency direction, not
 * an inventory. Any arrangement of files under `src/core/` passes as long as
 * none of them reaches out of the layer except through a sanctioned edge.
 */

import { describe, it, expect } from "vitest";
import ts from "typescript";
import path from "node:path";
import {
  REPO_ROOT,
  listTypeScriptFiles,
  loadCompilerOptions,
  repoRelative,
} from "../coverage/extract.js";
import { parseSourceFile } from "./graph.js";
import {
  CORE_LAYER,
  outboundEdges,
  unsanctioned,
  unexercised,
  cyclicSanctionedEdges,
  describeOutboundEdge,
  type Layer,
} from "./layering.js";

const OPTIONS = loadCompilerOptions();
const CORE_FILES = listTypeScriptFiles(CORE_LAYER.dir);

/**
 * Every edge leaving `src/core/`, sanctioned or not, collected once. Both
 * gates below are views of this one list: the violations are the edges no
 * sanction covers, the stale sanctions are the ones no edge matches.
 */
const CORE_EDGES = CORE_FILES.flatMap((file) =>
  outboundEdges(parseSourceFile(file), CORE_LAYER.dir, OPTIONS),
);

describe("the core layer sweep", () => {
  it("reaches every file under src/core", () => {
    // A directory scan that finds nothing passes every rule built on it. This
    // is the assertion that says the gates below looked at something.
    const relative = CORE_FILES.map(repoRelative);
    expect(relative).toContain("src/core/console.ts");
    expect(relative).toContain("src/core/color.ts");
    expect(relative).toContain("src/core/segment.ts");
    expect(relative.length).toBeGreaterThan(10);
    expect(relative.every((f) => f.endsWith(".ts"))).toBe(true);
  });
});

describe("src/core does not depend on anything above it", () => {
  it("has no upward import outside the sanctioned pair", () => {
    const failures = unsanctioned(CORE_EDGES, CORE_LAYER).map(describeOutboundEdge);
    expect(
      failures,
      `An import leaves \`src/core/\` that CLAUDE.md does not sanction. Move ` +
        `the shared concern down into \`src/core/\`, or invert it so the upper ` +
        `subsystem hands what it has to core rather than core reaching up for ` +
        `it. Adding a third entry to CORE_LAYER.sanctioned is the last resort, ` +
        `and CLAUDE.md calls a third edge the signal to reconsider the seam.` +
        `\n\n${failures.join("\n")}\n`,
    ).toEqual([]);
  });

  it("sanctions no edge that has stopped existing", () => {
    const stale = unexercised(CORE_EDGES, CORE_LAYER).map((s) => `  ${s.from} -> ${s.to}`);
    expect(
      stale,
      `CORE_LAYER.sanctioned permits an import that is no longer there. The ` +
        `edge was removed and its exemption outlived it — delete the entry, and ` +
        `delete its bullet from CLAUDE.md's "edges leave src/core/" list.` +
        `\n\n${stale.join("\n")}\n`,
    ).toEqual([]);
  });

  it("sanctions no edge that closes a runtime cycle", () => {
    const cycles = cyclicSanctionedEdges(CORE_EDGES, CORE_LAYER).map(
      (s) => `  ${s.from} -> ${s.to}`,
    );
    expect(
      cycles,
      `A sanctioned upward edge now loads its way back to the module it left ` +
        `from. Every entry in CORE_LAYER.sanctioned argues it closes no cycle; ` +
        `this one no longer does, so the module-initialisation order it relies ` +
        `on is whatever the bundler happens to pick.\n\n${cycles.join("\n")}\n`,
    ).toEqual([]);
  });

  it("states why each sanctioned edge is allowed", () => {
    for (const edge of CORE_LAYER.sanctioned) {
      expect(edge.why.length, `${edge.from} -> ${edge.to} carries no reason`).toBeGreaterThan(40);
    }
  });
});

/**
 * The scan, pinned against sources written to break it. A gate that is green
 * today and has never been seen red is not evidence of anything; these
 * fixtures are what say it can fail, and on which shapes.
 *
 * Specifiers name real modules because `resolveEdge` throws on a relative
 * import it cannot resolve — the fixture file itself is the only fiction.
 */
function scan(source: string, layer: Layer = CORE_LAYER) {
  const sf = ts.createSourceFile(
    path.join(REPO_ROOT, "src", "core", "fixture.ts"),
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  return outboundEdges(sf, layer.dir, OPTIONS);
}

describe("repoRelative", () => {
  it("spells a path the way the sanctioned-edge literals are written", () => {
    // Every rule below compares a computed path against a forward-slash
    // literal, so the two must agree on separators or the gate reports both
    // real edges as unsanctioned and stale while nothing has changed.
    //
    // Be honest about what this pins: on a POSIX host `path.sep` is already
    // `/` and the assertion holds with or without the canonicalization, so it
    // is a live gate only on Windows — the platform whose failure it exists to
    // catch. Green here is not evidence the canonicalization survived.
    expect(repoRelative(path.join(REPO_ROOT, "src", "core", "console.ts"))).toBe(
      "src/core/console.ts",
    );
  });
});

describe("outboundEdges", () => {
  it("reports an import that leaves the layer, with where it lands", () => {
    expect(scan(`import { Panel } from "../renderables/panel.js";`)).toEqual([
      {
        file: "src/core/fixture.ts",
        line: 1,
        specifier: "../renderables/panel.js",
        target: "src/renderables/panel.ts",
        erased: false,
      },
    ]);
  });

  it("reports a type-only import, which is an architectural edge that emits nothing", () => {
    // The deliberate disagreement with `browser-safe.ts`: it skips erased
    // edges because a browser cannot trip over one, and this rule counts them
    // because `core/` naming a `renderables/` type is `core/` knowing about
    // `renderables/`. Reusing the runtime collector unchanged would have
    // exempted exactly the edges CLAUDE.md finds worth discussing.
    expect(scan(`import type { Panel } from "../renderables/panel.js";`)[0]).toMatchObject({
      target: "src/renderables/panel.ts",
      erased: true,
    });
    expect(scan(`import { type Panel } from "../renderables/panel.js";`)[0]).toMatchObject({
      erased: true,
    });
    expect(scan(`export type { Panel } from "../renderables/panel.js";`)[0]).toMatchObject({
      erased: true,
    });
  });

  it("reports re-exports and dynamic imports that leave the layer", () => {
    expect(scan(`export * from "../widgets/screen.js";`)[0]).toMatchObject({
      target: "src/widgets/screen.ts",
    });
    expect(scan(`const f = () => import("../node/save.js");`)[0]).toMatchObject({
      target: "src/node/save.ts",
      erased: false,
    });
  });

  it("reports a reach for the barrel, which would close a cycle", () => {
    expect(scan(`import { Console } from "../index.js";`)[0]).toMatchObject({
      target: "src/index.ts",
    });
  });

  it("ignores an import that stays inside the layer", () => {
    expect(scan(`import { Style } from "./style.js";`)).toEqual([]);
    expect(scan(`import type { Renderable } from "./protocol.js";`)).toEqual([]);
  });

  it("ignores specifiers this repository does not own", () => {
    // `core/` depending on a package or a builtin says nothing about the
    // direction of `src/` — that is the browser-safe rule's question, asked
    // next door and answered differently.
    expect(scan(`import stringWidth from "string-width";`)).toEqual([]);
    expect(scan(`import { readFileSync } from "node:fs";`)).toEqual([]);
  });

  it("does not read a sibling directory as inside the layer", () => {
    // The string-prefix bug this rule would otherwise have: `src/core/…`
    // begins with `src/cor`, so a `startsWith` containment test would call
    // every core module part of that layer and report nothing at all.
    const truncated: Layer = { dir: "src/cor", sanctioned: [] };
    expect(scan(`import { Style } from "./style.js";`, truncated)[0]).toMatchObject({
      target: "src/core/style.ts",
    });
  });

  it("reports every offence in a file, in source order", () => {
    expect(
      scan(
        `import { Panel } from "../renderables/panel.js";\n` +
          `import { Style } from "./style.js";\n` +
          `import type { Screen } from "../widgets/screen.js";`,
      ).map((e) => e.line),
    ).toEqual([1, 3]);
  });
});

describe("unsanctioned", () => {
  const edges = scan(`import { Rule } from "../renderables/rule.js";`).map((e) => ({
    ...e,
    file: "src/core/console.ts",
  }));

  it("clears an edge the layer sanctions", () => {
    expect(unsanctioned(edges, CORE_LAYER)).toEqual([]);
  });

  it("reports the same edge from a file the sanction does not name", () => {
    // A sanction is a permission for one module pair, not a permission for
    // the target module — otherwise sanctioning `console.ts -> rule.ts` would
    // quietly let every file in `core/` import `Rule`.
    expect(unsanctioned(edges.map((e) => ({ ...e, file: "src/core/text.ts" })), CORE_LAYER))
      .toHaveLength(1);
  });

  it("reports every edge when the layer sanctions nothing", () => {
    expect(unsanctioned(edges, { dir: "src/core", sanctioned: [] })).toHaveLength(1);
  });
});

describe("cyclicSanctionedEdges", () => {
  /** The `color.ts -> panel.ts` sanction, and an observed import to match it. */
  const COLOR_TO_PANEL: Layer = {
    dir: "src/core",
    sanctioned: [
      { from: "src/core/color.ts", to: "src/renderables/panel.ts", why: "invented for this test" },
    ],
  };
  const asColorImport = (source: string) =>
    scan(source).map((edge) => ({ ...edge, file: "src/core/color.ts" }));

  it("clears the sanctioned edges, whose targets do not load back to them", () => {
    expect(cyclicSanctionedEdges(CORE_EDGES, CORE_LAYER)).toEqual([]);
  });

  it("reports an edge whose target loads its way back at runtime", () => {
    // `renderables/rule.ts` imports `core/cells.ts` directly, so sanctioning
    // the reverse edge would close a real two-module cycle. This is the fixture
    // that says the gate above can fail — the sanctioned pair is safe today,
    // and a check that has only ever been green proves nothing about itself.
    const cyclic: Layer = {
      dir: "src/core",
      sanctioned: [
        { from: "src/core/cells.ts", to: "src/renderables/rule.ts", why: "invented for this test" },
      ],
    };
    const edges = scan(`import { Rule } from "../renderables/rule.js";`).map((edge) => ({
      ...edge,
      file: "src/core/cells.ts",
    }));
    expect(cyclicSanctionedEdges(edges, cyclic).map((s) => s.from)).toEqual(["src/core/cells.ts"]);
  });

  it("reports a cycle that closes through an intermediate module", () => {
    // `panel.ts` never names `color.ts`; it reaches it through `core/style.ts`.
    // A walk reduced to one hop would call this edge clean.
    const edges = asColorImport(`import { Panel } from "../renderables/panel.js";`);
    expect(cyclicSanctionedEdges(edges, COLOR_TO_PANEL)).toHaveLength(1);
  });

  it("clears that same edge when the sanction is type-only", () => {
    // The paired arm. Identical modules, identical return path, differing in
    // nothing but `erased` — and the answer inverts, because an edge that
    // emits no import never loads the target, so what the target reaches
    // cannot close a cycle through it. Checking only the return path would
    // fail a legitimate type-only seam.
    const edges = asColorImport(`import type { Panel } from "../renderables/panel.js";`);
    expect(edges.map((e) => e.erased)).toEqual([true]);
    expect(cyclicSanctionedEdges(edges, COLOR_TO_PANEL)).toEqual([]);
  });

  it("leaves a sanction with no matching import to the staleness arm", () => {
    // Reporting it here as well would say two things are wrong when one is.
    expect(cyclicSanctionedEdges([], COLOR_TO_PANEL)).toEqual([]);
    expect(unexercised([], COLOR_TO_PANEL)).toHaveLength(1);
  });
});

describe("unexercised", () => {
  it("clears a sanction whose edge is present", () => {
    expect(unexercised(CORE_EDGES, CORE_LAYER)).toEqual([]);
  });

  it("reports a sanction that matches no edge", () => {
    const invented: Layer = {
      dir: "src/core",
      sanctioned: [
        ...CORE_LAYER.sanctioned,
        { from: "src/core/text.ts", to: "src/widgets/screen.ts", why: "invented for this test" },
      ],
    };
    expect(unexercised(CORE_EDGES, invented).map((s) => s.from)).toEqual(["src/core/text.ts"]);
  });
});
