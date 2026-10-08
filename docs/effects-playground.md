---
title: Effects playground
aside: false
---

<script setup>
import { data as cards } from './effects-playground.data.ts'
</script>

# Effects playground

Each card below runs one of the library's [effects](/effects) on a powerline strip and a line of text. The code is the effect's own, cut from `src/renderables/effects.ts` along with everything it uses there, so the code you see is the code the library runs.

The sliders under the code are the named numbers in it: each effect's `CURVE`, the constants it is built from, and how it plays. Moving a slider edits that number in the code, and the program restarts on the edit, as it does when you type. Reset puts both back.

A curve's `seconds` are curve time. Each frame moves curve time by `STEP`, whatever `FPS` is, so `FPS` sets only how often a frame comes. The terminal shows every colour exactly as the effect draws it, so a cell fading into the background really does lose its contrast.

<template v-for="{ effect, card } in cards" :key="effect">
  <h2 :id="effect">{{ effect }}</h2>
  <RichDemo :card="card" />
</template>

<style scoped>
/* Each program is a couple of hundred lines; the sliders and the terminal stay near its top. */
:deep(.rich-example-editor .cm-editor) {
  max-height: 24rem;
}
</style>
