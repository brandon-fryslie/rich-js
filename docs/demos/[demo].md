---
layout: page
---

<script setup>
import { useData } from 'vitepress'
import { computed } from 'vue'

// [LAW:dataflow-not-control-flow] The page does not branch on which demo it
// is — params is data flowing through one fixed template, the demo's card
// (docs/.vitepress/demo-card.ts).
const { params } = useData()

const sourceHref = computed(
  () => `https://github.com/brandon-fryslie/rich-js/tree/master/examples/${params.value.demo}`,
)
</script>

<div class="rich-demo-wrap">
  <h1 class="rich-demo-title"><code>{{ $params.demo }}</code></h1>

  <p class="rich-demo-meta">
    <a :href="sourceHref" target="_blank" rel="noopener">View source on GitHub ↗</a>
  </p>

  <div class="vp-doc"><RichDemo :card="$params.card" /></div>
</div>

<style scoped>
.rich-demo-wrap {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 24px 48px;
}
.rich-demo-title {
  font-size: 20px;
  margin: 0 0 4px;
}
.rich-demo-title code {
  background: transparent;
  padding: 0;
}
.rich-demo-meta {
  font-size: 13px;
  margin: 0 0 16px;
  color: var(--vp-c-text-2);
}
</style>
