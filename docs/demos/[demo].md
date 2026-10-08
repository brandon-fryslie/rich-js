---
layout: page
---

<script setup>
import { useData, withBase } from 'vitepress'
import { computed } from 'vue'

// [LAW:dataflow-not-control-flow] The page does not branch on which demo it
// is — params is data flowing through one fixed template. A demo with a card
// (docs/.vitepress/demo-card.ts) shows it; one without is shown in the iframe
// of its bundle until it moves to a card.
const { params } = useData()

const srcHref = computed(() => withBase(`/demos-app/${params.value.demo}/`))
const sourceHref = computed(
  () => `https://github.com/brandon-fryslie/rich-js/tree/master/examples/${params.value.demo}`,
)
</script>

<div class="rich-demo-wrap">
  <h1 class="rich-demo-title"><code>{{ $params.demo }}</code></h1>

  <p class="rich-demo-meta">
    <template v-if="!$params.card">
      <a :href="srcHref" target="_blank" rel="noopener">Open standalone ↗</a>
      ·
    </template>
    <a :href="sourceHref" target="_blank" rel="noopener">View source on GitHub ↗</a>
  </p>

  <div v-if="$params.card" class="vp-doc"><RichDemo :card="$params.card" /></div>
  <iframe
    v-else
    :src="srcHref"
    :title="`rich-js live demo: ${$params.demo}`"
    class="rich-demo-frame"
    loading="eager"
  ></iframe>
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
.rich-demo-frame {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  width: 100%;
  height: min(78vh, 760px);
  background: #1e1e1e;
  display: block;
}
</style>
