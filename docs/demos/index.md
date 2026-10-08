---
title: Demos
---

<script setup>
import { withBase } from 'vitepress'
// [LAW:one-source-of-truth] The list of demos shown here is the manifest the
// bundle pipeline wrote at demos:build — same file the dynamic-route paths
// reads. There is no second list to maintain.
import manifest from '../.vitepress/demos.json'

const demos = manifest.demos
const demoHref = (name) => withBase(`/demos/${name}`)
</script>

# Live Demos

Each demo runs the rich-js library directly in your browser via [xterm.js](https://xtermjs.org/). No screenshots, no recordings: every page below is a real, interactive terminal.

A demo is a Node program, and its page runs that same program. Its entry is `main.ts`, which builds its own terminal with `NodeTerminalHost` or prints through a `Console`; on the page it runs in a terminal the page gives it, the way the [live examples](/widgets) do, so nothing in it asks where it is running. It imports the library by its published names, `@promptctl/rich-js` and its subpaths, and its own files by relative paths. Its page shows each file as a tab you can edit, and the program re-runs on the edit; "Open in playground" takes every file with it. The demos that do not have a `main.ts` yet run in a frame of their own.

To run these in your own terminal instead, see the [Demos section of the README](https://github.com/brandon-fryslie/rich-js#demos) — it gives the npm script for each demo and a line on what it shows.

<div class="rich-demo-grid">
  <a
    v-for="demo in demos"
    :key="demo.name"
    :href="demoHref(demo.name)"
    class="rich-demo-card"
  >
    <code>{{ demo.name }}</code>
  </a>
</div>

<style scoped>
.rich-demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin: 24px 0;
}
.rich-demo-card {
  display: block;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  text-decoration: none;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  transition: border-color 0.15s, background 0.15s;
}
.rich-demo-card:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-mute);
}
.rich-demo-card code {
  background: transparent;
  padding: 0;
  font-size: 14px;
}
</style>
