/// <reference types="vite/client" />
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { defineAsyncComponent } from 'vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Async, so a page without a live example or the playground never loads the
    // live terminal, and only the playground loads the editor.
    app.component('RichLive', defineAsyncComponent(() => import('./RichLive.js')))
    app.component('RichPlayground', defineAsyncComponent(() => import('./RichPlayground.js')))
  },
} satisfies Theme
