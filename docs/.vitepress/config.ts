import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'rich-js',
  description: 'Rich text and beautiful formatting in the terminal — a TypeScript port of Python\'s Rich',
  base: process.env.VITEPRESS_BASE ?? '/rich-js/',

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
      { text: 'Guide', link: '/introduction', activeMatch: '^/(introduction|console|style|markup|text|highlighting|pretty|panel|tables|tree|columns|group|padding|progress|live|layout|syntax|markdown|traceback|logging|prompt)' },
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
