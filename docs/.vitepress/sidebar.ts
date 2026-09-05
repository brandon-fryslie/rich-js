/*
 * The sidebar regions that are backed by a `docs/*.md` file.
 *
 * These live apart from `config.ts` because two readers need them and only one
 * of them can afford that file. `config.ts` reads `demos.json` — a gitignored
 * build artifact written by `demos:build` — at module load, so importing it
 * from the unit suite would throw on a fresh clone. The regions themselves are
 * data and read nothing, so the reachability gate can import them directly.
 * [LAW:effects-at-boundaries] The manifest read stays in `config.ts`; what is
 * merely data moves to where both callers can reach it.
 *
 * [LAW:one-source-of-truth] This is the site's only list of guide pages.
 * `config.ts` composes these regions into the sidebar and derives the Guide
 * nav's `activeMatch` from `guideSidebar`; `test/docs/page-reachability.test.ts`
 * asserts they name exactly the pages on disk. Nothing re-states the list.
 *
 * The Demos region is deliberately not here. It is derived from the build
 * manifest, its links are dynamic routes rather than `docs/*.md` files, and
 * keeping it in `config.ts` is what lets the reachability check compare two
 * sets of pages with no exclusion predicate to explain or to go stale.
 */

export interface SidebarItem {
  readonly text: string
  readonly link: string
}

export interface SidebarGroup {
  readonly text: string
  // Mutable, because VitePress's own `DefaultTheme.SidebarItem` declares it
  // that way and `config.ts` spreads these groups straight into the theme
  // config. A `readonly` array here would be a shape VitePress cannot accept.
  readonly items: SidebarItem[]
}

export const guideSidebar: SidebarGroup[] = [
  {
    text: 'Getting Started',
    items: [
      { text: 'Introduction', link: '/introduction' },
      { text: 'Console', link: '/console' },
      { text: 'Styles', link: '/style' },
      { text: 'Markup', link: '/markup' },
    ],
  },
  {
    text: 'Text & Data',
    items: [
      { text: 'Rich Text', link: '/text' },
      { text: 'Highlighting', link: '/highlighting' },
      { text: 'Pretty Printing', link: '/pretty' },
    ],
  },
  {
    text: 'Renderables',
    items: [
      { text: 'Panel', link: '/panel' },
      { text: 'Tables', link: '/tables' },
      { text: 'Tree', link: '/tree' },
      { text: 'Columns', link: '/columns' },
      { text: 'Strip + Joiner', link: '/strip' },
      { text: 'Group', link: '/group' },
      { text: 'Padding', link: '/padding' },
    ],
  },
  {
    text: 'Live & Animation',
    items: [
      { text: 'Progress Bars', link: '/progress' },
      { text: 'Live Display', link: '/live' },
      { text: 'Layout', link: '/layout' },
    ],
  },
  {
    text: 'Interactive',
    items: [{ text: 'Widgets', link: '/widgets' }],
  },
  {
    text: 'Color & Theming',
    items: [
      { text: 'Theme Transposition', link: '/transpose' },
      { text: 'Contrast & Accessibility', link: '/contrast' },
    ],
  },
  {
    text: 'Source & Files',
    items: [
      { text: 'Syntax Highlighting', link: '/syntax' },
      { text: 'Markdown', link: '/markdown' },
      { text: 'Tracebacks', link: '/traceback' },
    ],
  },
  {
    text: 'Integrations',
    items: [
      { text: 'Template Bindings', link: '/template-bindings' },
      { text: 'Prompts', link: '/prompt' },
    ],
  },
]

// Protocol is its own nav tab, not a Guide page, so it sits outside
// `guideSidebar` and stays out of the derived `activeMatch` pattern. Folding it
// in would light up both tabs at once on `/protocol`.
export const advancedSidebar: SidebarGroup[] = [
  {
    text: 'Advanced',
    items: [{ text: 'Renderable Protocol', link: '/protocol' }],
  },
]

/** Every page-backed sidebar region, in the order the sidebar shows them. */
export const pageSidebarRegions: readonly SidebarGroup[] = [
  ...guideSidebar,
  ...advancedSidebar,
]
