/// <reference lib="dom" />
/**
 * A card's sliders (theme/RichExample.ts): one over each value in the code of
 * the file on screen that tunables.ts finds, a number by a slider and a box,
 * an ease by a list of every curve the library names.
 *
 * [LAW:one-source-of-truth] It holds nothing. What each control shows is read
 * off `source`, the file's code as it stands, and moving one hands `write` the
 * edit of that literal, which the card makes in its editor like any other: the
 * output follows as it follows typing, and reset puts the sliders back with
 * the code. A slider spans what its value's range is in the code the card
 * opened (`opened`), so dragging it does not move its own ends. A box is left
 * alone while it has focus, so a number half typed is not put back under the
 * reader by a render, and an entry that is no number is put back, not written.
 */
import { defineComponent, h, type PropType, type VNode } from "vue";
import { EASES } from "../../../src/core/easing.js";
import { range, spelled, tunables, type Tunable } from "../tunables.js";

/** Every curve an ease control offers, by the name `EASES` gives it. */
const EASE_NAMES = Object.keys(EASES);

export default defineComponent({
  name: "CardSliders",
  props: {
    source: { type: String, required: true },
    opened: { type: String, required: true },
    /** Make the edit putting `spelling` over the literal at `from`–`to` in `source`. */
    write: { type: Function as PropType<(from: number, to: number, spelling: string) => void>, required: true },
  },
  setup(props) {
    // The code the card opened never changes under a card's sliders: each file has its own.
    const spanned = new Map(tunables(props.opened).map((t) => [t.name, t.value]));

    const control = (t: Tunable) => {
      const label = h("span", { class: "rich-sliders-name", title: t.name }, t.name);
      const set = (spelling: string) => props.write(t.from, t.to, spelling);
      if (t.kind === "ease") {
        return h("label", { class: "rich-sliders-control", key: t.name }, [
          label,
          h(
            "select",
            { value: t.value, onChange: (event: Event) => set((event.target as HTMLSelectElement).value) },
            EASE_NAMES.map((name) => h("option", { value: name }, name)),
          ),
        ]);
      }
      const from = spanned.get(t.name);
      const { min, max, step } = range(typeof from === "number" ? from : t.value);
      const shown = String(t.value);
      const number = (event: Event) => {
        const input = event.target as HTMLInputElement;
        // [LAW:parse-dont-validate] An empty or unreadable box reads as NaN, and the literal is left as it is.
        if (Number.isNaN(input.valueAsNumber)) input.value = shown;
        else set(spelled(input.valueAsNumber));
      };
      // The box has no `value` prop: Vue would put it back on every render, typing or not.
      const show = (vnode: VNode) => {
        const box = vnode.el as HTMLInputElement;
        if (box !== document.activeElement) box.value = shown;
      };
      return h("label", { class: "rich-sliders-control", key: t.name }, [
        label,
        h("input", { type: "range", min, max, step, value: t.value, "aria-label": t.name, onInput: number }),
        h("input", { type: "number", step, "aria-label": `${t.name}, typed`, onChange: number, onVnodeMounted: show, onVnodeUpdated: show }),
      ]);
    };

    return () => h("div", { class: "rich-sliders", role: "group", "aria-label": "Values in the code" }, tunables(props.source).map(control));
  },
});
