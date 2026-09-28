/// <reference types="vite/client" />
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { defineAsyncComponent } from 'vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Async, so a page without a live example never loads the live terminal.
    app.component('RichLive', defineAsyncComponent(() => import('./RichLive.js')))
  },
} satisfies Theme
