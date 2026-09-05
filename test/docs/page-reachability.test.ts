/*
 * The sweep behind `page-reachability.ts`: read the pages on disk, compare
 * them against the site's own sidebar regions.
 *
 * A page a reader cannot reach is a page that does not exist, whatever the
 * file tree says. `docs/strip.md` proved it for four commits.
 */

import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../coverage/extract.js";
import { pageSidebarRegions } from "../../docs/.vitepress/sidebar.js";
import {
  UNLINKED_PAGES,
  danglingLinks,
  duplicateLinks,
  linkedSlugs,
  unreachablePages,
} from "./page-reachability.js";

const DOCS_ROOT = path.join(REPO_ROOT, "docs");

function listPageSlugs(): string[] {
  return readdirSync(DOCS_ROOT)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.slice(0, -".md".length))
    .sort();
}

describe("docs pages are reachable from the sidebar", () => {
  const pageSlugs = listPageSlugs();

  // [LAW:verifiable-goals] Every rule below is a statement about a set this
  // sweep built. A sweep that silently found nothing satisfies all of them and
  // reports green forever, and that failure mode is indistinguishable from
  // success — so the sweep is checked before anything is concluded from it.
  it("finds the docs pages it is meant to check", () => {
    expect(pageSlugs).toContain("index");
    expect(pageSlugs).toContain("strip");
    expect(pageSlugs).toContain("protocol");
    expect(pageSlugs.length).toBeGreaterThanOrEqual(20);
  });

  it("finds the sidebar regions it is meant to check", () => {
    expect(linkedSlugs(pageSidebarRegions).length).toBeGreaterThanOrEqual(20);
  });

  it("links every page except the ones reached another way", () => {
    expect(unreachablePages(pageSidebarRegions, pageSlugs)).toEqual([]);
  });

  it("links no page that does not exist", () => {
    expect(danglingLinks(pageSidebarRegions, pageSlugs)).toEqual([]);
  });

  it("gives every page exactly one home", () => {
    expect(duplicateLinks(pageSidebarRegions)).toEqual([]);
  });

  // The arm that is always forgotten: an exemption that outlived what it was
  // granted for. `UNLINKED_PAGES` suppresses a real failure, so an entry that
  // names a deleted page is an unnoticed hole in the check, not a harmless
  // leftover.
  it("exempts only pages that exist", () => {
    expect(UNLINKED_PAGES.filter((slug) => !pageSlugs.includes(slug))).toEqual([]);
  });

  it("exempts only pages the sidebar does not link", () => {
    const linked = new Set(linkedSlugs(pageSidebarRegions));
    expect(UNLINKED_PAGES.filter((slug) => linked.has(slug))).toEqual([]);
  });
});
