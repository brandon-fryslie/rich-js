/// <reference lib="dom" />
/**
 * The playground: an editor, a Run button and a terminal. A visitor edits a
 * program and runs it on the live library, in the live terminal the docs' live
 * examples run in (live-terminal.ts), as the script playground-program.ts
 * makes of it. Running again replaces the run before.
 *
 * The program lives in the URL's hash (playground-hash.ts). An edit is written
 * there once typing pauses, so the address bar is a link to what the editor
 * holds, and a page opened on a hash opens on its program. With no hash it
 * opens on the docs example `PLAYGROUND_MODULE` serves (example-runner.ts).
 * Either way it runs the program once on opening, so the terminal shows what
 * it does; a reader who asked for reduced motion gets one still frame, as a
 * docs live example gives them.
 */
import { defineComponent, h, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useData } from "vitepress";
import { EXAMPLE_TERMINAL, EXAMPLE_THEMES } from "../example-terminal.js";
import { decodeProgram, encodeProgram } from "../playground-hash.js";
import { LiveTerminal, READABLE_CONTRAST, elementFont, type LiveState, type RunMode } from "./live-terminal.js";
import { playgroundScript } from "./playground-program.js";
import { PROGRAM_PANE, createEditor } from "./playground-editor.js";

/**
 * How long typing must pause before the link is written. Browsers refuse
 * (Safari, Firefox) or quietly drop (Chrome) a burst of history writes, and
 * one a keystroke is such a burst.
 */
const WRITE_AFTER_MS = 300;

/** A running playground: its terminal, and how to run what its editor holds. */
interface Opened {
  readonly live: LiveTerminal;
  run(mode: RunMode): void;
  close(): void;
}

/** Where the playground stands. One that failed to open opens again when Run is pressed. */
type Phase = { readonly kind: "opening" } | { readonly kind: "open"; readonly made: Opened } | { readonly kind: "failed" };

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export default defineComponent({
  name: "RichPlayground",
  setup() {
    const editorParent = ref<HTMLElement | null>(null);
    const screen = ref<HTMLElement | null>(null);
    const state = ref<LiveState>({ kind: "idle" });
    const failure = ref<string | null>(null);
    const shortcut = ref("Ctrl+Enter");
    const phase = shallowRef<Phase>({ kind: "opening" });
    const { isDark } = useData();
    const theme = () => (isDark.value ? EXAMPLE_THEMES.dark : EXAMPLE_THEMES.light);
    let opening: Promise<Opened> | undefined;

    /** The program `hash` holds, or the start example for a page opened with none. */
    const programAt = (hash: string, start: string): Promise<string> =>
      hash === "" ? Promise.resolve(start) : decodeProgram(hash);

    async function open(parent: HTMLElement, element: HTMLElement): Promise<Opened> {
      const [playground, runtime] = await Promise.all([import("virtual:rich-live/playground"), import("virtual:rich-live/runtime")]);
      // [LAW:no-silent-failure] A link whose program cannot be read says so,
      // and the page opens on the start example rather than on nothing.
      const source = await programAt(location.hash.slice(1), playground.start).catch((error: unknown) => {
        failure.value = `This link's program could not be read (${message(error)}), so the playground opened on its starting example.`;
        return playground.start;
      });
      const live = await LiveTerminal.create(element, {
        runtime: runtime.default,
        terminal: EXAMPLE_TERMINAL,
        theme: theme(),
        font: elementFont(element),
        minimumContrast: READABLE_CONTRAST,
      });
      live.onState((next) => (state.value = next));
      const unwatch = watch(isDark, () => live.setTheme(theme()));
      const motion: RunMode = matchMedia("(prefers-reduced-motion: reduce)").matches ? "still" : "live";

      // [LAW:no-ambient-temporal-coupling] The editor and the address bar are
      // kept agreed here and nowhere else. An edit, a link followed and the
      // page closing are each an event, and an encode or decode that finishes
      // after a later event is dropped: the newest event always wins. An edit
      // still waiting to be written when a link is followed never reaches the
      // history entry left behind.
      let latest = 0;
      let pending: ReturnType<typeof setTimeout> | undefined;
      const next = (): number => {
        clearTimeout(pending);
        return ++latest;
      };
      // A failure shown is about the address bar and the editor disagreeing;
      // once a write makes them agree, it is over. The write itself can throw
      // too: a browser caps a URL's length below what a program may carry.
      const remember = (program: string) => {
        const event = next();
        pending = setTimeout(
          () =>
            void encodeProgram(program)
              .then((hash) => {
                if (event !== latest) return;
                history.replaceState(history.state, "", `#${hash}`);
                failure.value = null;
              })
              .catch((error: unknown) => {
                if (event === latest) failure.value = `The link could not be updated: ${message(error)}`;
              }),
          WRITE_AFTER_MS,
        );
      };
      const run = (mode: RunMode) => live.run(playgroundScript(editor.state.doc.toString(), playground.library), mode);
      const editor = createEditor(parent, source, { change: remember, run: () => run("live") }, PROGRAM_PANE);
      // A playground link opened in this tab changes only the hash: the page
      // stays, and opens the link's program as a fresh page would.
      const followed = () => {
        const event = next();
        void programAt(location.hash.slice(1), playground.start).then(
          (program) => {
            if (event !== latest) return;
            editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: program } });
            run(motion);
          },
          (error: unknown) => {
            if (event === latest) failure.value = `This link's program could not be read: ${message(error)}`;
          },
        );
      };
      addEventListener("hashchange", followed);
      // The terminal's font follows its pane's width (custom.css), so it is refitted when the pane is resized.
      const resized = new ResizeObserver(() => live.setFont(elementFont(element)));
      resized.observe(element);
      run(motion);
      return {
        live,
        run,
        close: () => {
          next();
          removeEventListener("hashchange", followed);
          resized.disconnect();
          unwatch();
          editor.destroy();
          live.dispose();
        },
      };
    }

    function start(): void {
      phase.value = { kind: "opening" };
      failure.value = null;
      opening = open(editorParent.value!, screen.value!);
      opening.then(
        (made) => (phase.value = { kind: "open", made }),
        (error: unknown) => {
          phase.value = { kind: "failed" };
          failure.value = `The playground could not start: ${message(error)}`;
        },
      );
    }

    onMounted(() => {
      shortcut.value = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ Enter" : "Ctrl+Enter";
      start();
    });

    // A playground still opening when the page is left is closed once open:
    // its worker must not run on behind a page nobody is reading.
    onBeforeUnmount(() => {
      void opening?.then((made) => made.close(), () => {});
    });

    return () => {
      const now = phase.value;
      const running = state.value.kind === "running";
      return h("div", { class: "rich-playground" }, [
        h("div", { class: "rich-playground-bar" }, [
          h("h1", { class: "rich-playground-title" }, "Playground"),
          ...(failure.value === null ? [] : [h("span", { class: "rich-live-failure", role: "alert" }, failure.value)]),
          h(
            "button",
            {
              type: "button",
              class: "rich-live-button",
              disabled: now.kind !== "open" || !running,
              onClick: () => now.kind === "open" && now.made.live.stop(),
            },
            "Stop",
          ),
          h(
            "button",
            {
              type: "button",
              class: "rich-live-button rich-playground-run",
              disabled: now.kind === "opening",
              onClick: () => (now.kind === "open" ? now.made.run("live") : start()),
            },
            ["Run ", h("kbd", shortcut.value)],
          ),
        ]),
        h("div", { class: "rich-playground-panes" }, [
          h("div", { class: "rich-playground-editor", ref: editorParent }),
          h("div", { class: "rich-playground-output", style: { "--rich-example-columns": EXAMPLE_TERMINAL.columns } }, [
            h("div", { class: "rich-live-screen", ref: screen }),
          ]),
        ]),
      ]);
    };
  },
});
