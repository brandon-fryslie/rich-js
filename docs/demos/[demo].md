---
layout: page
---

<script setup>
import { useData } from 'vitepress'
import { computed, shallowRef, watch } from 'vue'
import { decodeProgram } from '../.vitepress/playground-hash.ts'

// [LAW:dataflow-not-control-flow] The page does not branch on which demo it
// is — params is data flowing through one fixed template, the demo's card
// (docs/.vitepress/demo-card.ts).
const { params } = useData()

// The card arrives as JSON without its program, which it carries packed in
// its playground link ([demo].paths.ts says why); the card shows once that is
// unpacked, and a page left before then never shows it.
const card = shallowRef(null)
watch(
  () => params.value.card,
  (json, _, onCleanup) => {
    let current = true
    onCleanup(() => { current = false })
    card.value = null
    const sent = JSON.parse(json)
    decodeProgram(sent.tryIt.program).then((program) => {
      if (current) card.value = { ...sent, program }
    })
  },
  { immediate: true },
)

const sourceHref = computed(
  () => `https://github.com/brandon-fryslie/rich-js/tree/master/examples/${params.value.demo}`,
)
</script>

<div class="rich-demo-wrap">
  <h1 class="rich-demo-title"><code>{{ $params.demo }}</code></h1>

  <p class="rich-demo-meta">
    <a :href="sourceHref" target="_blank" rel="noopener">View source on GitHub ↗</a>
  </p>

  <div class="vp-doc"><RichDemo v-if="card" :card="card" /></div>
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
