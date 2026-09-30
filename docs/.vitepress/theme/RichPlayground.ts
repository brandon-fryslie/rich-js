/// <reference lib="dom" />
/**
 * The playground: an editor, a Run button and a terminal. A visitor edits a
 * program and runs it on the live library, in the live terminal the docs' live
 * examples run in (live-terminal.ts), as the script playground-program.ts
 * makes of it. Running again replaces the run before.
 *
 * The program lives in the URL's hash (playground-hash.ts). Every edit is
 * written there, so the address bar is always a link to what the editor
 * holds, and a page opened on a hash opens on its program. With no hash it
 * opens on the docs example `PLAYGROUND_MODULE` serves (example-runner.ts).
 * Either way it runs the program once on opening, so the terminal shows what
 * it does; a reader who asked for reduced motion gets one still frame, as a
 * docs live example gives them.
 */
import { defineComponent, h, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useData } from "vitepress";
import type { EditorView } from "@codemirror/view";
import { EXAMPLE_TERMINAL, EXAMPLE_THEMES } from "../example-terminal.js";
import { decodeProgram, encodeProgram } from "../playground-hash.js";
import { LiveTerminal, elementFont, type LiveState, type RunMode } from "./live-terminal.js";
import { playgroundScript } from "./playground-program.js";
import { createEditor } from "./playground-editor.js";

/** A running playground: its terminal, its editor, and how to run what the editor holds. */
interface Opened {
  readonly live: LiveTerminal;
  readonly editor: EditorView;
  run(mode: RunMode): void;
  close(): void;
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export default defineComponent({
  name: "RichPlayground",
  setup() {
    const editorParent = ref<HTMLElement | null>(null);
    const screen = ref<HTMLElement | null>(null);
    const state = ref<LiveState>({ kind: "idle" });
    const failure = ref<string | null>(null);
    const shortcut = ref("Ctrl+Enter");
    const opened = shallowRef<Opened | null>(null);
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
      });
      live.onState((next) => (state.value = next));
      const unwatch = watch(isDark, () => live.setTheme(theme()));
      // [LAW:no-ambient-temporal-coupling] Encoding is asynchronous, so the
      // writes are chained: each lands after the one before, and the last
      // edit's hash is the one the address bar is left with.
      let written = Promise.resolve();
      const remember = (program: string) => {
        written = written
          .then(() => encodeProgram(program))
          .then((hash) => history.replaceState(history.state, "", `#${hash}`))
          .catch((error: unknown) => void (failure.value = `The link could not be updated: ${message(error)}`));
      };
      const run = (mode: RunMode) => live.run(playgroundScript(editor.state.doc.toString(), playground.library), mode);
      const editor = createEditor(parent, source, { change: remember, run: () => run("live") });
      // A playground link opened in this tab changes only the hash: the page
      // stays, and opens the link's program as a fresh page would.
      const followed = () =>
        void programAt(location.hash.slice(1), playground.start).then(
          (program) => {
            editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: program } });
            run("live");
          },
          (error: unknown) => void (failure.value = `This link's program could not be read: ${message(error)}`),
        );
      addEventListener("hashchange", followed);
      // The terminal's font follows its pane's width (custom.css), so it is refitted when the pane is resized.
      const resized = new ResizeObserver(() => live.setFont(elementFont(element)));
      resized.observe(element);
      run(matchMedia("(prefers-reduced-motion: reduce)").matches ? "still" : "live");
      return {
        live,
        editor,
        run,
        close: () => {
          removeEventListener("hashchange", followed);
          resized.disconnect();
          unwatch();
          editor.destroy();
          live.dispose();
        },
      };
    }

    onMounted(() => {
      shortcut.value = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ Enter" : "Ctrl+Enter";
      opening = open(editorParent.value!, screen.value!);
      opening.then(
        (made) => (opened.value = made),
        (error: unknown) => (failure.value = `The playground could not start: ${message(error)}`),
      );
    });

    // A playground still opening when the page is left is closed once open:
    // its worker must not run on behind a page nobody is reading.
    onBeforeUnmount(() => {
      void opening?.then((made) => made.close(), () => {});
    });

    return () => {
      const made = opened.value;
      const running = state.value.kind === "running";
      return h("div", { class: "rich-playground" }, [
        h("div", { class: "rich-playground-bar" }, [
          h("h1", { class: "rich-playground-title" }, "Playground"),
          ...(failure.value === null ? [] : [h("span", { class: "rich-live-failure", role: "alert" }, failure.value)]),
          h(
            "button",
            { type: "button", class: "rich-live-button", disabled: made === null || !running, onClick: () => made?.live.stop() },
            "Stop",
          ),
          h(
            "button",
            {
              type: "button",
              class: "rich-live-button rich-playground-run",
              disabled: made === null,
              "aria-keyshortcuts": "Control+Enter Meta+Enter",
              onClick: () => made?.run("live"),
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
