/// <reference lib="dom" />
/**
 * A docs example's live output: its program running in a live terminal under
 * the code, the same terminal a static example's output is rendered in.
 *
 * This is where the docs decide when a program runs. It runs while its
 * terminal is on screen, from the start each time it scrolls into view, and
 * stops when it scrolls away. A reader who asked their system for reduced
 * motion gets one still frame instead, and a button to run it live. It wears
 * the theme of the site's colour mode, as static output does.
 *
 * The page gives it `load`, which imports the program the example runner
 * bundled from the block above; that program, and the worker it runs in, are
 * fetched only when the terminal first scrolls into view.
 */
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import { useData } from "vitepress";
import { EXAMPLE_TERMINAL, EXAMPLE_THEMES } from "../example-terminal.js";
import { LiveTerminal, elementFont, type LiveState } from "./live-terminal.js";

/** What the button does, said for each state the terminal can be in. */
const BUTTON: Record<LiveState["kind"], string> = {
  idle: "Run",
  running: "Restart",
  still: "Play",
  stopped: "Run",
  exited: "Run again",
};

export default defineComponent({
  name: "RichLive",
  props: {
    load: { type: Function as PropType<() => Promise<{ default: string }>>, required: true },
  },
  setup(props) {
    const screen = ref<HTMLElement | null>(null);
    const state = ref<LiveState>({ kind: "idle" });
    const { isDark } = useData();
    const theme = () => (isDark.value ? EXAMPLE_THEMES.dark : EXAMPLE_THEMES.light);
    const failure = ref<string | null>(null);
    let ready: Promise<{ live: LiveTerminal; script: string; unwatch: () => void }> | undefined;
    let observer: IntersectionObserver | undefined;
    let resized: ResizeObserver | undefined;

    // The program, then its terminal, made the first time either is needed. A
    // terminal is only made for a program that loaded: one made beside a failed
    // load would stay in the card, and the next try would stack another on it.
    // A failure is shown, and forgotten so the button can try again.
    const made = (element: HTMLElement) =>
      (ready ??= Promise.all([props.load(), import("virtual:rich-live/runtime")])
        .then(async ([program, runtime]) => {
          const live = await LiveTerminal.create(element, {
            runtime: runtime.default,
            terminal: EXAMPLE_TERMINAL,
            theme: theme(),
            font: elementFont(element),
          });
          live.onState((next) => (state.value = next));
          const unwatch = watch(isDark, () => live.setTheme(theme()));
          failure.value = null;
          return { live, script: program.default, unwatch };
        })
        .catch((error: unknown) => {
          ready = undefined;
          failure.value = `The live terminal could not start: ${error instanceof Error ? error.message : String(error)}`;
          throw error;
        }));
    const terminal = (element: HTMLElement, then: (made: { live: LiveTerminal; script: string }) => void) =>
      void made(element).then(then, () => {});

    onMounted(() => {
      const element = screen.value!;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      // A fast scroll can deliver an enter and a leave in one batch; the last
      // entry is where the terminal is now.
      observer = new IntersectionObserver((entries) => {
        if (entries.at(-1)!.isIntersecting) terminal(element, ({ live, script }) => live.run(script, reduced ? "still" : "live"));
        else void ready?.then(({ live }) => live.stop());
      });
      observer.observe(element);
      // The font's size follows the card's width (custom.css), so a terminal
      // made at one width is refitted when the card is resized.
      resized = new ResizeObserver(() => void ready?.then(({ live }) => live.setFont(elementFont(element)), () => {}));
      resized.observe(element);
    });

    // A terminal still being made when the page is left is disposed once made:
    // its worker must not run on behind a page nobody is reading.
    onBeforeUnmount(() => {
      observer?.disconnect();
      resized?.disconnect();
      void ready?.then(({ live, unwatch }) => {
        unwatch();
        live.dispose();
      }, () => {});
    });

    const run = () => terminal(screen.value!, ({ live, script }) => live.run(script, "live"));
    return () =>
      h("div", { class: "rich-live" }, [
        h("div", { class: "rich-live-screen", ref: screen }),
        h("div", { class: "rich-live-bar" }, [
          ...(failure.value === null ? [] : [h("span", { class: "rich-live-failure", role: "alert" }, failure.value)]),
          h("button", { type: "button", class: "rich-live-button", onClick: run }, BUTTON[state.value.kind]),
        ]),
      ]);
  },
});
