/// <reference lib="dom" />
/**
 * A program running in a live terminal on a page: a live card's output
 * (theme/RichExample.ts), and the landing page's hero, one with its code
 * hidden (theme/RichShowcase.ts).
 *
 * This is where the site decides when such a program runs. It runs while its
 * terminal is on screen, from the start each time it scrolls into view, and
 * stops when it scrolls away. A reader who asked their system for reduced
 * motion gets one still frame instead, and a button to run it live. It wears
 * the theme of the site's colour mode, as static output does.
 *
 * `program` makes the program to run, and is asked afresh for each run: the
 * terminal, and the worker it runs in, are fetched only when it first scrolls
 * into view. A new `program` is an edit: on screen it runs at once, in place
 * of the running one if that one accepts it (`LiveTerminal.edit`), and off
 * screen when it next scrolls into view.
 *
 * Its `terminal` and `contrast` are its program's (example-card.ts);
 * everything else about the terminal is `EXAMPLE_TERMINAL`'s. While it has focus every
 * key is the program's, so it says so: a ring round it, and the way out
 * (`LEAVE_HINT`) in its bar.
 */
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import { useData } from "vitepress";
import { EXAMPLE_TERMINAL, EXAMPLE_THEMES } from "../example-terminal.js";
import type { Contrast } from "../example-card.js";
import type { TerminalSize } from "../terminal-size.js";
import { LEAVE_HINT, LiveTerminal, MINIMUM_CONTRAST, elementFont, type LiveProgram, type LiveState, type RunMode } from "./live-terminal.js";

/** What the button does, said for each state the terminal can be in. */
const BUTTON: Record<LiveState["kind"], string> = {
  idle: "Run",
  running: "Restart",
  still: "Play",
  stopped: "Run",
  exited: "Run again",
};

export default defineComponent({
  name: "LiveScreen",
  props: {
    program: { type: Function as PropType<() => Promise<LiveProgram>>, required: true },
    terminal: { type: Object as PropType<TerminalSize>, required: true },
    contrast: { type: String as PropType<Contrast>, required: true },
  },
  setup(props) {
    const screen = ref<HTMLElement | null>(null);
    const state = ref<LiveState>({ kind: "idle" });
    const { isDark } = useData();
    const theme = () => (isDark.value ? EXAMPLE_THEMES.dark : EXAMPLE_THEMES.light);
    const failure = ref<string | null>(null);
    const focused = ref(false);
    let ready: Promise<{ readonly live: LiveTerminal; readonly unwatch: () => void }> | undefined;
    let observer: IntersectionObserver | undefined;
    let resized: ResizeObserver | undefined;
    let onScreen = false;
    let motion: RunMode = "live";

    // The terminal, made the first time a program has loaded to run in it: one
    // made beside a failed load would stay in the card, and the next try would
    // stack another on it. One that failed to be made is forgotten, so the
    // next run tries again.
    const made = (element: HTMLElement) =>
      (ready ??= import("virtual:rich-live/runtime")
        .then((runtime) =>
          LiveTerminal.create(element, {
            runtime: runtime.default,
            terminal: { ...EXAMPLE_TERMINAL, columns: props.terminal.columns, rows: props.terminal.rows },
            theme: theme(),
            font: elementFont(element),
            minimumContrast: MINIMUM_CONTRAST[props.contrast],
          }),
        )
        .then(
        (live) => {
          live.onState((next) => (state.value = next));
          return { live, unwatch: watch(isDark, () => live.setTheme(theme())) };
        },
        (error: unknown) => {
          ready = undefined;
          throw error;
        },
      ));

    // [LAW:no-ambient-temporal-coupling] Each start or stop is an ask, and
    // only the newest ask may start a program: a program that loads after the
    // terminal has scrolled away, or after a newer program, is no one's.
    let asked = 0;
    /** Run the program from the start, or as an edit of the one running. */
    const start = (mode: RunMode, how: "run" | "edit") => {
      const mine = ++asked;
      const current = () => mine === asked;
      // A terminal is made, and what went wrong cleared, only for the newest ask.
      void props
        .program()
        .then(async (program) => {
          if (!current()) return;
          const { live } = await made(screen.value!);
          if (!current()) return;
          failure.value = null;
          if (how === "edit") live.edit(program, mode);
          else live.run(program.script, mode);
        })
        .catch((error: unknown) => {
          if (current()) failure.value = `The live terminal could not start: ${error instanceof Error ? error.message : String(error)}`;
        });
    };
    const stop = () => {
      asked += 1;
      void ready?.then(({ live }) => live.stop(), () => {});
    };

    watch(
      () => props.program,
      () => onScreen && start(motion, "edit"),
    );

    onMounted(() => {
      const element = screen.value!;
      motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? "still" : "live";
      // A fast scroll can deliver an enter and a leave in one batch; the last
      // entry is where the terminal is now.
      observer = new IntersectionObserver((entries) => {
        onScreen = entries.at(-1)!.isIntersecting;
        if (onScreen) start(motion, "run");
        else stop();
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
      asked += 1;
      observer?.disconnect();
      resized?.disconnect();
      void ready?.then(({ live, unwatch }) => {
        unwatch();
        live.dispose();
      }, () => {});
    });

    return () =>
      h("div", { class: "rich-live" }, [
        h("div", {
          class: "rich-live-screen",
          ref: screen,
          onFocusin: () => (focused.value = true),
          onFocusout: () => (focused.value = false),
        }),
        h("div", { class: "rich-live-bar" }, [
          ...(focused.value ? [h("span", { class: "rich-live-hint" }, LEAVE_HINT)] : []),
          ...(failure.value === null ? [] : [h("span", { class: "rich-live-failure", role: "alert" }, failure.value)]),
          h("button", { type: "button", class: "rich-live-button", onClick: () => start("live", "run") }, BUTTON[state.value.kind]),
        ]),
      ]);
  },
});
