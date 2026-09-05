/*
 * Which documentation pages the sidebar reaches.
 *
 * `docs/strip.md` was a substantial page describing a subsystem built across
 * four merged commits, and for all of them it was reachable only by the site's
 * local search: the sidebar enumerated its links by hand, and `strip` was in
 * none of them. Nobody could have noticed by reading either file, because the
 * fact that had drifted — "these two lists name the same pages" — was written
 * down nowhere.
 *
 * So it is written down here, as a set equality with no exclusions:
 * every `docs/*.md` except `index.md` appears in exactly one page-backed
 * sidebar region, and every region link names a page on disk. `index.md` is
 * the site's home page, reached by the title and by `/`, and it is the only
 * page a sidebar entry would be wrong to add.
 *
 * [LAW:one-source-of-truth] The regions come from `docs/.vitepress/sidebar.ts`
 * — the site's own list, imported, not a copy. The Guide nav's `activeMatch`
 * is derived from `guideSidebar` in `config.ts`, so this one check covers the
 * nav highlight too; it used to be a second hand-written regex and that is the
 * pair of lists this replaced.
 *
 * WHY `pageSidebarRegions` AND NOT EVERY REGION. The Demos region is derived
 * from the build manifest and its links are dynamic routes, not `docs/*.md`
 * files. Comparing it against pages on disk would be comparing two different
 * kinds of thing, and the exclusion predicate that fixed it up would be one
 * more claim nobody rechecks. `/protocol` is the case that makes this concrete:
 * it deliberately sits in `advancedSidebar` and outside `guideSidebar`, because
 * it is its own nav tab and folding it into the Guide would light up two tabs
 * at once. Both regions are page-backed, so both are here, and the check needs
 * to know nothing about which tab either one feeds.
 *
 * Parsing only — the caller hands in the page list it read.
 * [LAW:effects-at-boundaries]
 */

import type { SidebarGroup } from "../../docs/.vitepress/sidebar.js";

/** The one page reached without a sidebar entry: the site's home. */
export const UNLINKED_PAGES: readonly string[] = ["index"];

/** A sidebar link that names no page under `docs/`. */
export interface DanglingLink {
  readonly group: string;
  readonly text: string;
  readonly link: string;
}

/** A sidebar link named by more than one region or group. */
export interface DuplicateLink {
  readonly link: string;
  readonly groups: readonly string[];
}

/**
 * Every page slug the given regions link to, in the order they appear.
 *
 * Slugs rather than paths, because that is the form both sides can be compared
 * in: a link is `/strip` and a file is `docs/strip.md`.
 */
export function linkedSlugs(regions: readonly SidebarGroup[]): string[] {
  return regions.flatMap((group) => group.items.map((item) => item.link.slice(1)));
}

/** Slugs linked from a region but backed by no `docs/*.md`. */
export function danglingLinks(
  regions: readonly SidebarGroup[],
  pageSlugs: readonly string[],
): DanglingLink[] {
  const pages = new Set(pageSlugs);
  return regions.flatMap((group) =>
    group.items
      .filter((item) => !pages.has(item.link.slice(1)))
      .map((item) => ({ group: group.text, text: item.text, link: item.link })),
  );
}

/**
 * Pages on disk that no region links, minus the pages reached another way.
 *
 * This is the `strip` failure, and the reason it names the page rather than
 * counting: a count tells you the sidebar is wrong, and the point of the check
 * is to say which page a reader cannot find.
 */
export function unreachablePages(
  regions: readonly SidebarGroup[],
  pageSlugs: readonly string[],
): string[] {
  const linked = new Set([...linkedSlugs(regions), ...UNLINKED_PAGES]);
  return pageSlugs.filter((slug) => !linked.has(slug));
}

/**
 * Slugs linked from more than one place.
 *
 * The set equality alone would pass a sidebar that listed one page twice and
 * another never, since both sets would still have matching contents. "Exactly
 * one region" is the property the site actually wants — a page shown in two
 * groups gives a reader two different homes for one thing.
 */
export function duplicateLinks(regions: readonly SidebarGroup[]): DuplicateLink[] {
  const groupsBySlug = new Map<string, string[]>();
  for (const group of regions) {
    for (const item of group.items) {
      const slug = item.link.slice(1);
      groupsBySlug.set(slug, [...(groupsBySlug.get(slug) ?? []), group.text]);
    }
  }
  return [...groupsBySlug]
    .filter(([, groups]) => groups.length > 1)
    .map(([link, groups]) => ({ link, groups }));
}
