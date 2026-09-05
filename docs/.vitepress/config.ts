import { defineConfig } from 'vitepress'
import { guideSidebar, advancedSidebar } from './sidebar.js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// [LAW:one-source-of-truth] The Demos sidebar is derived from the same
// manifest the bundle pipeline writes and the dynamic-route paths file
// reads — exactly one list of demos for the entire docs site.
// [LAW:dataflow-not-control-flow] No branch on "manifest may or may not
// exist"; demos:build is a prerequisite of docs:build/docs:dev (wired in
// package.json). A missing manifest fails loudly here with a clear path,
// which is the verifiable build constraint we want. [LAW:verifiable-goals]
interface DemoManifest {
  readonly demos: ReadonlyArray<{ readonly name: string }>
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const manifestPath = resolve(__dirname, 'demos.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as DemoManifest
const demoSidebarItems = manifest.demos.map((d) => ({
  text: d.name,
  link: `/demos/${d.name}`,
}))

// The sidebar is split into one region per top-level nav tab: Guide, Protocol,
// Demos. Each tab's active-matching derives from its own region, so which tab
// lights up follows from which region a group sits in.
//
// [LAW:one-source-of-truth] The Guide nav's activeMatch is derived from
// `guideSidebar` rather than hand-copied beside it. The two used to be separate
// lists of one fact and had already drifted: `strip` was in neither, so a
// substantial page was reachable only by search.
//
// The page-backed regions live in `./sidebar.js` so `test/docs/` can read them
// without executing the `demos.json` read above; see that file's header.
const guideActiveMatch = `^/(${guideSidebar
  .flatMap((group) => group.items.map((item) => item.link.slice(1)))
  .join('|')})`

export default defineConfig({
  title: 'rich-js',
  description: 'Rich text and beautiful formatting in the terminal — a TypeScript port of Python\'s Rich',
  base: process.env['VITEPRESS_BASE'] ?? '/rich-js/',

  cleanUrls: true,

  head: [
    ['meta', { name: 'theme-color', content: '#7c3aed' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'rich-js' }],
    ['meta', { property: 'og:description', content: 'Rich text and beautiful formatting in the terminal' }],
  ],

  themeConfig: {
    siteTitle: 'rich-js',

    nav: [
      { text: 'Guide', link: '/introduction', activeMatch: guideActiveMatch },
      { text: 'Demos', link: '/demos/', activeMatch: '^/demos' },
      { text: 'Protocol', link: '/protocol' },
    ],

    sidebar: [
      ...guideSidebar,
      ...advancedSidebar,
      {
        text: 'Demos',
        items: [
          { text: 'All demos', link: '/demos/' },
          ...demoSidebarItems,
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/brandon-fryslie/rich-js' },
    ],

    footer: {
      message: 'A TypeScript port of Python\'s <a href="https://github.com/Textualize/rich">Rich</a> library.',
      copyright: 'Released under the MIT License.',
    },

    search: {
      provider: 'local',
    },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'one-dark-pro',
    },
    lineNumbers: false,
  },
})
