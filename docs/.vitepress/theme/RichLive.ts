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
 * bundled from the block above; nothing is fetched until the terminal first
 * scrolls into view.
 */
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import { useData } from "vitepress";
import { EXAMPLE_TERMINAL, EXAMPLE_THEMES } from "../example-terminal.js";
import { LiveTerminal, type LiveState } from "./live-terminal.js";

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

    // The terminal and its program, made the first time either is needed. A
    // failure is shown, and forgotten so the button can try again.
    const made = (element: HTMLElement) =>
      (ready ??= Promise.all([props.load(), LiveTerminal.create(element, { terminal: EXAMPLE_TERMINAL, theme: theme(), font: font(element) })]).then(
        ([program, live]) => {
          live.onState((next) => (state.value = next));
          const unwatch = watch(isDark, () => live.setTheme(theme()));
          failure.value = null;
          return { live, script: program.default, unwatch };
        },
        (error: unknown) => {
          ready = undefined;
          failure.value = `The live terminal could not start: ${error instanceof Error ? error.message : String(error)}`;
          throw error;
        },
      ));
    const terminal = (element: HTMLElement, then: (made: { live: LiveTerminal; script: string }) => void) =>
      void made(element).then(then, () => {});

    onMounted(() => {
      const element = screen.value!;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      observer = new IntersectionObserver(([entry]) => {
        if (entry!.isIntersecting) terminal(element, ({ live, script }) => live.run(script, reduced ? "still" : "live"));
        else void ready?.then(({ live }) => live.stop());
      });
      observer.observe(element);
    });

    // A terminal still being made when the page is left is disposed once made:
    // its worker must not run on behind a page nobody is reading.
    onBeforeUnmount(() => {
      observer?.disconnect();
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

/**
 * The font static output is drawn in: custom.css gives the screen element the
 * same `--rich-fragment-font`, and xterm takes it as numbers.
 */
function font(element: HTMLElement): { family: string; size: number; lineHeight: number } {
  const style = getComputedStyle(element);
  const size = parseFloat(style.fontSize);
  return { family: style.fontFamily, size, lineHeight: parseFloat(style.lineHeight) / size };
}
