import { defineConfig } from 'vitepress'
import { guideSidebar, pageSidebarRegions } from './sidebar.js'
import { docsExamplesPlugin } from './example-runner.js'
import { HTML_FRAGMENT_CSS } from '../../src/core/export-html.js'
import { demoNames } from './demo-entry.js'

// [LAW:one-source-of-truth] The Demos sidebar is `demoNames()`, the list the
// demo routes and the Demos index read too.
const demoSidebarItems = demoNames().map((name) => ({
  text: name,
  link: `/demos/${name}`,
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
// The page-backed regions live in `./sidebar.js`; see that file's header.
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
    // What a generated example's output needs and an inline style cannot say.
    ['style', {}, HTML_FRAGMENT_CSS],
  ],

  themeConfig: {
    siteTitle: 'rich-js',

    nav: [
      { text: 'Guide', link: '/introduction', activeMatch: guideActiveMatch },
      { text: 'Demos', link: '/demos/', activeMatch: '^/demos' },
      { text: 'Protocol', link: '/protocol' },
      { text: 'Playground', link: '/playground' },
    ],

    // [LAW:one-source-of-truth] The page-backed regions arrive composed, from
    // the same export the reachability gate reads. Re-spreading them here would
    // be a second composition, and a third region added to one of them would
    // silently leave the site and the gate checking different sidebars.
    sidebar: [
      ...pageSidebarRegions,
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

  vite: {
    // Runs each page's examples and writes their output under them;
    // `example-runner.ts`'s header owns why it is a pre-transform.
    plugins: [docsExamplesPlugin()],
    resolve: {
      alias: {
        // The playground's import of Sucrase's parser names its CommonJS build,
        // the one Node can load; the page takes the ES build `sucrase` itself
        // resolves to, so it carries one parser, not two
        // (theme/playground-program.ts).
        'sucrase/dist/parser/index.js': 'sucrase/dist/esm/parser/index.js',
      },
    },
  },

  markdown: {
    theme: {
      // One Light beside One Dark Pro: the example output is drawn in the Atom
      // One terminal themes, so code and output share one palette either way.
      light: 'one-light',
      dark: 'one-dark-pro',
    },
    lineNumbers: false,
  },
})
