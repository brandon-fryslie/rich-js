import { defineConfig } from 'vitepress'
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
      { text: 'Guide', link: '/introduction', activeMatch: '^/(introduction|console|style|markup|text|highlighting|pretty|panel|tables|tree|columns|group|padding|progress|live|layout|widgets|syntax|markdown|traceback|logging|prompt|transpose|contrast|template-bindings)' },
      { text: 'Demos', link: '/demos/', activeMatch: '^/demos' },
      { text: 'Protocol', link: '/protocol' },
    ],

    sidebar: [
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
        items: [
          { text: 'Widgets', link: '/widgets' },
        ],
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
          { text: 'Logging', link: '/logging' },
          { text: 'Prompts', link: '/prompt' },
        ],
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Renderable Protocol', link: '/protocol' },
        ],
      },
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
