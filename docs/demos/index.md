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

Each demo runs the rich-js library directly in your browser via [xterm.js](https://xtermjs.org/) — the same code that runs as a node CLI, mounted against a browser `TerminalHost`. No screenshots, no recordings: every page below is a real, interactive terminal.

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
