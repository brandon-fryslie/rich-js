# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this project?

A TypeScript port of Python's [Rich](https://github.com/Textualize/rich) library — rich text and beautiful formatting in the terminal. ESM-only, targeting Node.js >= 20; `package.json#engines` is the authority on the exact floor.

## Commands

```bash
npm run build          # tsc → dist/
npm run test           # vitest run (all tests)
npx vitest run test/core/color.test.ts   # single test file
npx vitest run -t "test name"            # single test by name
npm run lint           # three type-check passes — see below
npm run docs:dev       # build demo bundles, then serve the VitePress site
npm run docs:build     # same, but produce the static site (dead-link gate)
npm run demo:build     # tsc -p tsconfig.demo.json → dist-demo/
npm run demos:build    # demo tsc + vite bundle of examples/ for the docs site
npm run test:demos     # playwright, e2e/demos.spec.ts, against the demo bundles
```

`npm run lint` is not one pass and not just `src/`. It is:

```
tsc --noEmit && tsc -p tsconfig.scripts.json && tsc -p tsconfig.test.json
```

Four tsconfigs exist — `tsconfig.json` (src), `tsconfig.scripts.json`, `tsconfig.test.json`, `tsconfig.demo.json` — and lint runs the first three. `test/` is type-checked, so a broken type in a test fails lint even when vitest is green. `tsconfig.demo.json` is driven by the demo scripts instead.

Individual demos each have their own script (`npm run demo`, `sessions`, `dash`, `strip`, `template-bindings`, `themes-and-color-studio`, …); `package.json` is the list.

## Architecture

### docs/ is the description of this library

`docs/` is a published VitePress site and the single place the library's surface is described in prose. There is no separate specification directory; there is no roadmap document. If you need to know what a subsystem does, read its page in `docs/`, then read the source — the source carries the design rationale in module-header comments and is the authority when the two disagree.

When you add a page, add it to `guideSidebar` in `docs/.vitepress/sidebar.ts` — not `config.ts`, which only imports the regions and derives the Guide nav's `activeMatch` from `guideSidebar`, so the sidebar entry is also what gives the page its nav highlight. The split exists because `config.ts` reads the gitignored `demos.json` at module load, which a unit test cannot do on a fresh clone; `sidebar.ts`'s header owns the rest of that argument.

That is the only list, and it is now checked. It used to be two hand-copied lists, and they had already drifted: `strip` was in neither, so a substantial page was reachable only by search. `test/docs/page-reachability.test.ts` fails when the regions and `docs/*.md` stop naming the same set.

The sidebar is split into one region per top-level nav tab (`guideSidebar`, `advancedSidebar`, Demos). A page belongs in the region whose tab should light up for it — `/protocol` is its own tab, so it lives outside `guideSidebar` and both tabs would highlight at once if it were folded in.

Run `npm run docs:build` before committing any documentation change. It is the dead-link gate and the Vue-interpolation gate; both failures are invisible in the source file and obvious in the build.

`test/docs/symbol-existence.test.ts` is the other gate, and it reads the pages rather than the site: every name a page imports from an entry point, and every member it calls on a class it constructed, has to exist. **When it goes red, the page is wrong, not the library.** Implementing a documented symbol to clear the bar lets an unreviewed sentence set the roadmap — `docs/logging.md` documented a `RichHandler` end to end across five snippets, and the resolution was to delete the page. If the symbol is genuinely wanted, file it on its own merits. That test's header owns the rest of the argument, including the three ways a page lies and which two of them this cannot catch.

The move to avoid: writing a second description of a subsystem — a design note, an interface sketch, a "spec" — somewhere outside `docs/`. This repository already paid for that once. A `spec/` directory of authoring briefs sat beside `docs/` describing the same surface, drifted, and then actively lied: it documented a named-colour function family (`red`, `on`, `hex`) that `src/template-bindings/` had deliberately replaced with `fg`/`bg`, and a `Screen` with no `TerminalHost` seam. An agent implementing from it would have written templates that fail with `FuncNotFound`. Two descriptions of one surface is one description and one trap, and you cannot tell by looking which is which.

### Subsystems (src/)

```
core → renderables                        (the main barrel — `.`)
  ↘ themes
  ↘ host/              → widgets          (subpaths: ./host, ./widgets)
  ↘ template-bindings                     (subpath: ./template-bindings)
  ↘ node/                                 (subpaths: ./node/*)
```

Only `core` and `renderables` are reachable from `.`. Everything below the first
line is reached through its own `package.json#exports` subpath, and that file is
the list — this diagram groups the subsystems, it does not enumerate the entry
points. Two of them exist because they carry a third-party runtime dependency
(`widgets` → `mobx`, `template-bindings` → `@promptctl/go-template-js`), one
because it reads node built-ins (`node/`), and one because it is what a
non-interactive program needs from the terminal without any of the above
(`host/`).

- **`src/core/`** — primitives. No upward calls, no renderable-specific logic.
- **`src/renderables/`** — composed renderables (Table, Panel, Tree, Layout, Progress, Live, …) built on core. Each implements the `Renderable` interface.
- **`src/host/`** — the terminal seam: the `TerminalHost` interface, `BrowserTerminalHost`, and `hostStream`. Depends on `core/` and on nothing else in `src/`; `widgets/` and `node/` both depend on it. It was carved out of `src/widgets/` because it is what a *non*-interactive program wants — writing bytes through a host should not cost the widget set or `mobx`.
- **`src/widgets/`** — interactive layer: focus, key/mouse routing, a `Screen` that mounts widgets against a `TerminalHost`, and the widget set (Button, Checkbox, Toggle, TextInput, Dropdown, Slider). Reached through the `./widgets` subpath, never the main barrel — this and `./template-bindings` are the two subsystems that carry a third-party runtime dependency of their own (`mobx`, `@promptctl/go-template-js`), and the subpath is what keeps it off a consumer who only wanted a Table. The header comment at the end of `src/index.ts` owns that argument. See `docs/widgets.md`.
- **`src/themes/`** — semantic palettes (`Palette`, `buildPalette`, colour refs), the bundled theme registry, OKLCH colour math, and light↔dark transposition. Distinct from `core/color`: a `ColorTable` is a quantization LUT, a `Palette` carries aesthetic intent.
- **`src/template-bindings/`** — the styling vocabulary exposed as `@promptctl/go-template-js` template functions. See `docs/template-bindings.md`.
- **`src/node/`** — the Node-only capability seam. One file per package subpath, and `package.json#exports` is the list: `node/save` (fs-backed export of recorded output), `node/prompt` (`nodeAsk`, readline-backed input for `Prompt`), `node/traceback` (`installTraceback`, the `process.on` crash handler), and `node/terminal-host` (`NodeTerminalHost`, the `TerminalHost` over `process.stdin`/`process.stdout`).

### Core primitives (src/core/)

Build order within `src/core/`. Each tier imports only from tiers above it:

```
0   cells · color · sanitize · subscription
1   oklch · style · wrap
2   segment
3   box · protocol
4   measure · emoji · text · strip · render
5   markup · highlighter
6   pretty · json
7   console                           (orchestrator)
```

Two edges leave `src/core/` and point *up* into higher subsystems. Both are deliberate, both are annotated where they sit, and they are the whole list:

- `color.ts` → `themes/palette.js`, for the internal default theme.
- `console.ts` → `renderables/rule.js`, the orchestrator reaching down for `Rule`.

Both are safe for the same reason — each points up without closing a runtime cycle back to the module it left. *Why* that holds differs per edge, and it is written in exactly one place: the required `why` field on each entry of `CORE_LAYER.sanctioned` in `test/seam/layering.ts`. Read it there rather than restating it here; a per-edge argument kept in two files is one argument and one thing that will quietly disagree with it.

Do not check this list by hand either. `test/seam/layering.test.ts` walks every file under `src/core/`, resolves every import, and fails three ways: when an edge leaves the layer without a sanction (naming the file, the line and the specifier); when a sanction outlives the import it was granted for, so the exemption list cannot accumulate permissions nobody needs; and when a sanctioned edge starts closing a runtime cycle — which is what keeps the shared safety property above a checked fact rather than prose. The two bullets and `CORE_LAYER.sanctioned` name the same two edges; change them together.

That check counts type-only imports, and the choice is deliberate: `import type { Panel } from "../renderables/panel.js"` is `core/` knowing the shape of `renderables/` whether or not it emits a byte. This is where it diverges from `test/seam/browser-safe.ts` next door, which skips erased edges because a browser cannot trip over one. Same graph, two questions, two answers.

The reason it is a test and not a grep: a grep here is per-module and hand-run, it reports specifiers without judging which of them are sanctioned, and it can say nothing at all about an exemption that outlived the import it was granted for. It is a map only a human redraws. That this section's own grep was wrong once is the evidence the distinction matters — PR #66 paired the no-back-edges claim with `from "\./[a-z]+\.js"`, which matches same-directory imports only and so could not have found either edge above. Review caught that pattern before it landed; nothing else would have.

A third upward edge is not a fact to append here. It is the signal to stop and reconsider the seam.

- **cells** — terminal cell-width (wraps `string-width`). Provides `cellLen`, `setCellSize`, `splitText`, `chopCells`.
- **color** — colour as immutable *values*. `ColorRgba` (RGBA), `ColorSpec` (a parsed style colour; `ColorSpec.parse` is cached), `ColorTable` (quantization LUT), `ColorDepth`, `TerminalTheme`, and the downgrade/detection pipeline (`detectColorSystem`, `resolveColorSystem`). There is no `Color` class.
- **wrap** — where a line may break. `divideLine` reports the cell offsets one
  logical line is cut at to fit a budget, for `Segment.divide` to apply to the
  styled line. Separate from `cells` because that module answers geometry and
  this one answers word structure; separate from `text` because the pieces it
  finds are what every renderable showing a string is cut into, and its output
  is pinned against the reference in `test/core/text-wrap.golden.txt`.
- **oklch** — perceptually-uniform polar colour space. sRGB ↔ OKLab ↔ OKLCH, reversible but for the final 0–255 quantization. This is where equal numeric deltas mean equal perceptual deltas, which is what transposition needs.
- **style** — immutable `Style` descriptors (colours + text attributes + links). `Style.parse` (cached), `Style.add`. Includes `StyleStack`, `Theme`, `DEFAULT_STYLES`.
- **segment** — atomic render unit `(text, style?, control?)`. Static methods (`applyStyle`, `splitLines`, `adjustLineLength`, `simplify`, `divide`) operate on `Segment[]` / `Segment[][]`.
- **sanitize** — `stripOscTerminators`. One rule, one home: the bytes that would break out of an OSC 8 hyperlink wrap. Imported by both the data-model boundary and the wire-byte boundaries.
- **subscription** — `Unsubscribe`, the return type of every `on…()` in the library. It sits this low because `host/` and `widgets/` both need it and neither may depend on the other.
- **box** — box-drawing character sets. One `Box` type, many pre-built instances (ASCII, SQUARE, ROUNDED, HEAVY, DOUBLE, …).
- **protocol** — `Renderable` and `Measurable` interfaces. `Renderable.render(options) → Iterable<Segment>`. `Measurable.measure(options) → {minimum, maximum}`. Single authority for the rendering contract.
- **measure** — `Measurement` value type (min/max cell width). `Measurement.get()` is the single enforcer for measuring a `Measurable`.
- **markup** — parses Rich markup strings (`[bold red]text[/]`) into `RichText`.
- **text** — `RichText`: styled text with `Span[]` annotations. Primary text type for the library; implements `Renderable` and `Measurable`.
- **pretty** — `Pretty`: a JavaScript value formatted as `RichText`. It lives in `core/` rather than `renderables/`, and the argument for that is in its module header — read it there. Sharing the "implements `Renderable`" trait with `Table` is not what decides the directory; `RichText` implements it too.
- **json** — `JSONRenderable`: JSON data or a JSON string, re-serialized with an indent and highlighted, held as a `RichText`. It lives in `core/` for the same reason `pretty` does, and its module header points at that argument — read it there.
- **highlighter** — `Highlighter` base + built-ins (`RegexHighlighter`, `ReprHighlighter`, `JSONHighlighter`, `ISO8601Highlighter`). Mutates a `RichText` by adding style spans.
- **strip** — `Strip` + `Joiner`: edge-aware horizontal layout, where each transition between adjacent items (including the two endpoints) is an explicit position the joiner names.
- **render** — `renderToString` and `segmentsToString`. Pure, one-shot Segment→ANSI emission with no `Console` and no writes to stdout. Every path to wire bytes delegates here.
- **emoji** — emoji shortcode substitution (`emojiReplace`).
- **console** — `Console`: central orchestrator. Detects colour support, owns the render loop, converts items → `RichText`/`Renderable` → `Segment[]` → ANSI → stdout/stderr. Supports recording and HTML/text export.

### The main barrel stays browser-safe

Nothing reachable from `src/index.ts` may import `node:fs`, `node:readline`, or any other Node built-in. That is why `src/node/` exists: it is the airlock, and importing from it is the consumer's explicit opt-in.

You will be deep in `console.ts` or a renderable, you will need to write a file or read a line, and you will think *"one `import { writeFileSync } from 'node:fs'` here, it's a Node library anyway."* That is the moment. Don't. Put the capability in `src/node/`, give it a subpath in `package.json#exports`, and have the caller pass it in — the way `Prompt.ask(question, nodeAsk)` takes its input capability as an argument rather than reaching for readline itself.

The counter-argument is real and worth naming: this *is* a terminal library, and browsers are not its main target. Granted. But the widget layer ships a `BrowserTerminalHost` and the demo site runs `examples/` in a browser under `npm run demos:build` — that bundle is a real consumer, and it breaks at bundle time with an unresolvable `fs`, in CI, far from the import that caused it.

`test/seam/browser-safe.test.ts` is what stops that failure from landing on someone other than the person who wrote the import: it walks the runtime import graph from every `package.json#exports` entry outside `src/node/` and fails in the unit suite, naming the file, the line, and the chain that reached it. A Node builtin on a runtime edge breaks it, and so does a module-scope read of any name in `AMBIENT_GLOBALS`. `test/seam/browser-safe.ts`'s header owns the rest — what module scope means here, and why there is no `typeof` exemption.

### Installing this package installs neither of its optional peers

`string-width` aside, every third-party package `src/` imports at runtime is an optional peer — `package.json` declares it under `peerDependencies` with a `peerDependenciesMeta` row marking it `optional` — so a consumer's `npm install` adds it for nobody and warns nobody about it. There are two of them and the shape is the same both times: the dependency sits in the one subsystem that needs it and is reachable only through that subsystem's subpath, which fails at import with `ERR_MODULE_NOT_FOUND` until the consumer installs it themselves. `string-width` is reachable from the main barrel, so it stays a hard `dependency`.

`test/seam/optional-peers.test.ts` walks the runtime import graph from each `package.json#exports` entry *separately* and asks what that one entry obliges a consumer to install. `PEER_PROVIDERS` in `test/seam/optional-peers.ts` is the allow-list, one row per optional peer with a required `why`; it goes red three ways — a package declared nowhere, an optional peer reached from an entry that does not provide it, and a listed entry that can no longer reach it, so the list cannot accumulate permissions nobody needs. `package.json` owns *which* packages are optional peers, `PEER_PROVIDERS` owns *which subpath provides* each, and npm has no field for that second half. Do not restate either list here.

The trap is worse than the browser-safe one above, and it is the same trap for both peers, because both are still in `devDependencies` and so resolve perfectly in this checkout. You will be in `src/core/` or a renderable; you will want observable state, or you will want to evaluate a template string; `mobx` or `@promptctl/go-template-js` will be right there in `node_modules`, and you will think *"the import resolves, the tests are green — this is fine."* It is green because we have the package; the thing that would fail is its **absence**, in a stranger's project, at `npm install` time. Nothing here can see that by construction — the browser-safe leak at least broke the demo build. Keep the import inside the subsystem that already carries that dependency, behind its own subpath; if the dependency genuinely belongs on the default path, promote it to `dependencies` and drop its `peerDependenciesMeta` row as a change made on its own merits. `test/seam/optional-peers.ts`'s header owns the rest of the argument.

### Only a package a consumer receives sets the Node floor

`package.json#engines.node` is the one field that can turn someone away at install time. Until recently it read `^20.19.0 || >=22.12.0` — character for character the range `vite` declares. `vite` is a devDependency; no consumer is handed it. So the published package refused Node 20.0–20.18, all of 21.x, and 22.0–22.11 on the authority of a build tool those consumers never install, and nothing recorded that it was doing so. It now reads `>=20`, what `string-width` — the only hard runtime dependency — declares. Four copies of this fact existed and gave three answers: the field as above, `README.md` 20, `docs/introduction.md` 18, and this file 20 while correctly naming the field as the authority.

`test/seam/node-floor.test.ts` keeps that from happening again, and is built unlike the gates around it: no allow-list and no `why` field, because the floor is *computed* rather than declared. It reads `package-lock.json` — npm's own record of what a default install puts on disk and what each one's `engines` says — finds the strictest range in that tree, and requires `engines.node` to denote exactly that set. A consumer's installer checks `engines` on every package it lands, so the versions that install cleanly *are* that intersection; no human claim is left for a `why` to justify. It goes red when the declared range admits a Node a dependency refuses, when it excludes versions every installed package permits — the bug above — when no single dependency range contains all the others so the intersection is not any one of them — a stop-and-decide, not a field to retype — and when the lockfile is behind `package.json`, so the tree came from a smaller world. The prose half reads `README.md`, `docs/introduction.md` and `CLAUDE.md` back and checks the version they name against the field, this file now inside its own gate. `test/seam/node-floor.ts` names each of those and owns the rest of the argument; do not restate them here.

The comparison is `semver.subset`, not a check on minimum versions, and that is not incidental. `subset(">=20.19.0", "^20.19.0 || >=22.12.0")` is **false** — 21.x satisfies the first and not the second. A rule comparing minimums calls them equivalent and passes — on exactly the disjoint range shape that caused the bug.

You will be adding a dependency, or a toolchain will announce the Node it wants, and a range will be sitting right there in a file you already have open. Copying it will feel like diligence — *"this is the version our tooling needs, so this is the version we need."* That is the moment. The number you are copying is evidence about your own laptop; the field it goes into is a promise to someone who will never have that package. The counter-argument is real: CI does run `vite` and its Node must satisfy it. Granted, and it dissolves on the mechanism rather than on a division of labour — CI takes its Node from this very field, and setup-node resolves a range to the *newest* version satisfying it, not the oldest; on the old range it took 24.20.0. Widening the floor to `>=20` does not drag CI down to Node 20, so CI only ever exercises the top of the supported range and never the declared floor, which nothing verifies — the gate compares declarations and never runs `src/`. Let the gate compute the published floor, and if `src/` itself genuinely needs a newer Node than any dependency does, say so in the field and in the commit, because this rule deliberately has no allow-list to hide that claim in.

Say the blind spot out loud whenever you cite this gate; it is the optional-peers blind spot in another shape. A consumer does not install from our lockfile. They resolve `^8.2.0` themselves and may land on a `string-width` newer than ours, declaring a floor we have never read. This checks the tree *we* resolved. A green run proves something narrower than "the floor is right for everyone" — it proves the floor was not copied from outside the install tree, the failure that actually happened. Treat it as that and no more; a blind spot read as coverage is worse than no guard.

### One list says who reaches the host

`HOST_ACCESS` in `test/seam/ambient-process.ts` names every file in `src/` that reads node's ambient `process`, the property names it takes, and a required `why`. `test/seam/ambient-process.test.ts` fails when a file joins the list without an entry and when an entry outlives the read it was granted for.

Do not restate that list anywhere. It replaced four hand-written claims about who owns node TTY access — two in `src/node/terminal-host.ts`, one in `src/widgets/terminal-host.ts`, one in `docs/widgets.md` — which had narrowed themselves into mutual disagreement, and the docs one was outright false: it named `NodeTerminalHost` as the only thing touching `process.stdin`/`process.stdout` while `src/node/prompt.ts` reads both. Two `stdin` readers is the honest count, and the checked claim is where they live rather than how many there are.

The `AMBIENT_GLOBALS` scan next door looks for the same identifier and is not this rule. That one asks whether a module-scope read would throw when a browser evaluates the barrel; this one asks what the package takes off the host, in any scope, reachable or not. A read inside a function body passes there and fails here — pinned from both sides, by a fixture in each suite. Same identifier, two questions — do not unify them.

### Importing a module from src/ does nothing

`package.json` declares `"sideEffects": false`, and that field is a promise to every bundler that reads it: any module of this package whose exports go unused may be dropped whole. A module that does its job at import time — a registration call, a loop that patches a just-built table, a polyfill install — breaks that promise in the one place nobody here will look, the consumer's build, where the symptom is a behaviour that quietly went missing and the cause is a module a bundler was told it could delete. `test/seam/import-time-effects.test.ts` is what keeps the promise true: it fails on any module that runs a statement when it is imported — the statement lists a declaration can carry and the imports that bind no name included. Which grammar forms those are is `test/seam/import-time-effects.ts`'s header and not this paragraph, because the list that stood here named one of the two declarations that carry a statement list, and one of the three imports that bind no name.

You will have just built a table at module scope, you will need four more entries on it, and the loop that adds them will sit three lines under the literal. You will think *"this only touches a `const` in this file — no bundler can tell."* You are right, and it is still the thing to refuse. `src/core/color.ts` was exactly that: `ANSI_COLOR_NAMES` built as a literal and then mutated by a top-level `for` loop adding a `grayNN` alias for every `greyNN` name — module-local, and genuinely harmless. It is now `withGrayAliases({…})`, a pure initialiser, so the table has one shape from its first observation. That is the shape to copy: move the work into a function the caller runs, or fold it into the initialiser of the thing it was patching. A rule carrying a "but it's module-local" exemption licenses the registration call that isn't, and nothing syntactic tells the two apart.

The scan walks every `.ts` file under `src/`, not only the ones an entry point reaches, because `files: ["dist"]` ships the whole tree and a bundler applies the field to all of it. Its accept list is written as the declaration kinds, with everything else reporting, so a grammar form nobody anticipated fails loudly instead of passing quietly.

What it cannot see is an expression's contents. `export const T = defineTheme(…)` is accepted on its shape alone; whether `defineTheme` writes to something outside the module is a question about a callee's body that no syntactic rule answers. A class declaration is that same limit in a shape that invites the opposite reading: the gate reports a top-level `static {}` block because a static block is a statement list, and accepts every other expression the declaration evaluates when it is declared — its decorators, its `extends` clause, its computed member names, its static field initialisers. It does not extend there, and cannot: `src/widgets/checkbox.ts` and `src/widgets/widget-base.ts` decorate with mobx's `@observable` and `@action`, `src/core/highlighter.ts` declares `static baseStyle = ""`, and every one of those evaluates on import and does nothing — sorting them from an expression that works is the purity judgement this gate refuses everywhere else, and the rule would have been red on working code the day it landed. Say that limit out loud whenever you cite this gate — a blind spot read as coverage is worse than no guard. That half of the claim is held by a different kind of evidence: a consumer bundle built with the field on, run, and compared byte-for-byte against the same program built without it, recorded on ticket `rich-packaging-1xv.4`. `test/seam/import-time-effects.ts`'s header owns the rest of the argument.

### test/coverage/ gates every new public export

`test/coverage/coverage.test.ts` derives the public-export universe from `package.json#exports` by type-checking the barrels, then asserts three invariants: every undemonstrated export is allowlisted with a justification, every allowlist entry points at a real export, and no allowlist entry is already demonstrated. "All functionality is demonstrated" is a build, not a claim — and what it builds is a floor: the symbol is reachable from something a user can run. Whether the demo does anything interesting with it is judgment, and the gate does not claim to have exercised anything.

Two kinds of export get two kinds of evidence, and the decision is made in exactly one place in `coverage.test.ts`, from the `kind` on the resolved origin — `ExportKind` in `extract.ts`, derived from `ts.SymbolFlags.Value`, so classes and enums are values and interfaces and type aliases are types. A **value** is demonstrated when a file under `examples/` names it in an import statement; only import statements count (`visitImports`), and `import * as ns` is excluded by design, because a namespace binding would mark a whole module covered. A **type** is demonstrated when it is reachable through type positions — annotations, heritage clauses, type arguments, `typeof` queries — transitively from a demonstrated value. That walk is `collectTypeClosure`.

The split exists because idiomatic TypeScript never names a type-only export. Options arrive as object literals (`new Panel(content, { box: HEAVY })`), aliases arrive as bare values, structural interfaces are satisfied inline. The only way to make such an export answer "is it named in an import?" is `import type { PanelOptions }` plus an annotation that exists to be seen by this check and is read by nobody — decorating the metric, not demonstrating the API. The old gate asked types a question they could not answer, and 74 of the allowlist's 102 entries were types sitting there as the receipt — every one of them cleared by the split, with no new demo written for it.

So adding a **value** export is two changes, not one: add it, and it is undemonstrated; the suite goes red until you reference it from a demo under `examples/`. Adding a **type** export is usually one change — if it is the options type of a function or class a demo already uses, it comes along for free. It goes red only when it is genuinely orphaned, reachable from no demonstrated value, and the fix then is to demonstrate the value that uses it, never to name the type. Coverage keys on declaration origin, not import path, so a deep import (`../../src/widgets/text-input.js`) counts exactly as much as a barrel import; clearing an entry never requires touching a barrel.

You will be finishing a feature, the suite will fail on a name you added ten minutes ago, and the fast path will look like *"drop it in the allowlist and move on."* Resist that. The 102 entries that once sat in `coverage-allowlist.ts` were a queue nobody worked down; what replaced them is a permanent exemption list, and an entry on it claims no demo can reach the export at all. Make that claim deliberately — it should feel like a big deal to add and read like one in the diff.

The corollary, which is the useful direction: **absence from `test/coverage/coverage-allowlist.ts` means demonstrated.** Before writing any prose claim that something is or isn't demonstrated, check it rather than reasoning about it:

```bash
grep -qE '^  <ExportName>: ' test/coverage/coverage-allowlist.ts
```

A hand-maintained list of what a machine already computes will be wrong, and it will read as authoritative while it is wrong. The README once carried a "not yet exercised" table next to this check; every row in it was false.

### Key patterns

- **Immutable + cached**: `ColorRgba`, `ColorSpec`, `Style`, and `Segment` are immutable. `ColorSpec.parse` and `Style.parse` are cached, as are `ColorSpec` downgrades and nearest-colour matches.
- **Data-driven instances**: box styles and spinners are instances of one type differing only by character/frame data, not separate types.
- **Segment pipelines**: rendering is a pipeline of `Segment[]` transformations (`applyStyle`, `splitLines`, `adjustLineLength`, `simplify`, …).
- **Protocol-first renderables**: every renderable implements `Renderable` (and often `Measurable`) from `protocol.ts`. Console calls `render(options)` uniformly.
- **Capabilities are passed, not imported**: anything that touches the host — fs, readline, the terminal itself — arrives as an argument (`nodeAsk`, `TerminalHost`) so the module that uses it stays portable and testable.

<!-- BEGIN LIT INTEGRATION -->
## lit Agent-Native Workflow

This repository uses `lit` for agent-native issue tracking.

Start by running `lit quickstart` to load the workflow instructions. It prints how tickets are found, created, updated, and closed here, so running it first means the rest of your work follows the conventions this repo expects. It's a quick, read-only command — no need to check in before running it.

<!-- END LIT INTEGRATION -->
