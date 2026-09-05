/*
 * The sweep behind `page-reachability.ts`: read the pages on disk, compare
 * them against the site's own sidebar regions.
 *
 * A page a reader cannot reach is a page that does not exist, whatever the
 * file tree says. `docs/strip.md` proved it for four commits.
 */

import { describe, it, expect } from "vitest";
import { pageSidebarRegions } from "../../docs/.vitepress/sidebar.js";
import { docsPages } from "./pages.js";
import {
  UNLINKED_PAGES,
  danglingLinks,
  duplicateLinks,
  linkedSlugs,
  unreachablePages,
} from "./page-reachability.js";

describe("docs pages are reachable from the sidebar", () => {
  const pageSlugs = docsPages().map((page) => page.slug);

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

/*
 * The detectors, against a sidebar built to be wrong.
 *
 * Every assertion above reads `[]` off the real, currently-correct data, so all
 * three would keep passing if a detector were inverted, broken, or stubbed to
 * return `[]` — the sweep is checked, but nothing checks the things that read
 * it. That is the same trap one level up from where this file already guards
 * against it. [LAW:verifiable-goals]
 *
 * The fixture is deliberately not the real sidebar: a detector must report a
 * fault that exists, and the only way to know it does is to hand it one.
 */
describe("the reachability rules report what they are meant to catch", () => {
  const regions = [
    { text: "Guide", items: [{ text: "Console", link: "/console" }, { text: "Strip", link: "/strip" }] },
    { text: "Advanced", items: [{ text: "Ghost", link: "/ghost" }, { text: "Strip again", link: "/strip" }] },
  ];
  const pageSlugs = ["console", "strip", "orphan"];

  it("names a link with no page behind it", () => {
    expect(danglingLinks(regions, pageSlugs)).toEqual([
      { group: "Advanced", text: "Ghost", link: "/ghost" },
    ]);
  });

  it("names a page linked from two regions", () => {
    expect(duplicateLinks(regions)).toEqual([{ link: "strip", groups: ["Guide", "Advanced"] }]);
  });

  it("names a page no region links", () => {
    expect(unreachablePages(regions, pageSlugs)).toEqual(["orphan"]);
  });

  // The exemption is data, so it has to be shown working rather than assumed:
  // `index` is unlinked on purpose and must not surface as a fault.
  it("does not name a page the exemption covers", () => {
    expect(unreachablePages(regions, [...pageSlugs, "index"])).toEqual(["orphan"]);
  });
});
