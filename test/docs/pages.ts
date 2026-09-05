/*
 * Which files under `docs/` are pages — the one answer both docs suites read.
 *
 * `page-reachability.test.ts` asks it to compare the pages on disk against the
 * sidebar; `symbol-existence.test.ts` asks it so it can read every page's code
 * blocks. They used to ask separately, and both asked
 * `readdirSync(DOCS_ROOT)` without recursion, so a page in a subdirectory was
 * absent from both sets — not excluded, invisible. Nothing said so, and the
 * bar stayed green because the thing that was skipped was also the thing that
 * would have reported it. [LAW:one-source-of-truth]
 *
 * The distinction that matters is between an exclusion and an oversight. A
 * future `docs/advanced/foo.md` linked from no sidebar region is exactly the
 * silent orphan `docs/strip.md` was for four commits, and a non-recursive scan
 * cannot report it, because the page never enters the set being checked.
 *
 * So the scan recurses and `demos/` is turned away by name, below, with its
 * reason attached — the same way `sidebar.ts` turns away the Demos region
 * rather than leaving it out and hoping the omission reads as deliberate.
 */

import { readdirSync } from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "../coverage/extract.js";

const DOCS_ROOT = path.join(REPO_ROOT, "docs");

/**
 * `docs/demos/` is not guide pages.
 *
 * It holds the Demos tab's routes: an index and `[demo].md`, a VitePress
 * dynamic route whose pages come from the gitignored `demos.json` build
 * manifest rather than from files. They have no slug of their own to be
 * reachable at, and the sidebar region that links them is excluded from the
 * reachability comparison for the same reason — `sidebar.ts`'s header owns that
 * argument.
 */
const NOT_PAGES = ["demos"];

/** One `docs/` page. */
export interface DocsPage {
  /** Path relative to `docs/`, e.g. `strip.md` — how a failure names the page. */
  readonly file: string;
  /** The route slug: `file` without its extension, e.g. `strip`. */
  readonly slug: string;
  /** Absolute path, for reading the page. */
  readonly absolutePath: string;
}

/** Every page under `docs/`, at any depth, in slug order. */
export function docsPages(): DocsPage[] {
  return readdirSync(DOCS_ROOT, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith(".md"))
    .filter((file) => !NOT_PAGES.includes(file.split(path.sep)[0] ?? ""))
    .map((file) => ({
      file,
      slug: file.slice(0, -".md".length),
      absolutePath: path.join(DOCS_ROOT, file),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
