/// <reference types="vite/client" />
import DefaultTheme from 'vitepress/theme'
import { inBrowser, type Theme } from 'vitepress'
import { defineAsyncComponent, h } from 'vue'
import './code-font.css'
import './custom.css'
import { trackDevicePixelRatio } from './device-pixel-ratio.js'

const RichShowcase = defineAsyncComponent(() => import('./RichShowcase.js'))

export default {
  extends: DefaultTheme,
  // The landing page's hero shows rich-js running, under its text and buttons.
  // `home-hero-after` is filled only by the home layout, so no other page draws it.
  Layout: () => h(DefaultTheme.Layout, null, { 'home-hero-after': () => h(RichShowcase) }),
  enhanceApp({ app }) {
    if (inBrowser) trackDevicePixelRatio(document.documentElement)
    // Async, so a page without a live example, the playground or the showcase
    // never loads the live terminal, and only the playground loads the editor.
    app.component('RichLive', defineAsyncComponent(() => import('./RichLive.js')))
    app.component('RichPlayground', defineAsyncComponent(() => import('./RichPlayground.js')))
  },
} satisfies Theme
