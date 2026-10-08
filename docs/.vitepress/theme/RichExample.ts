/// <reference lib="dom" />
/**
 * A docs example as one editable card: its code, and under it what the code
 * prints. The build hands it the block (example-card.ts); the page renders it
 * on the server, so a reader sees the card before any of this runs.
 *
 * At rest it is the page's own card: VitePress's highlighted fence, passed in
 * as the default slot, over the output the build printed. A click in the code,
 * or Enter on it, puts an editor in the fence's place, its cursor where the
 * click was. Once typing pauses the card runs its program on the edit
 * (`cardSource`) in a sandboxed worker (static-run.ts) and draws what it
 * printed the way the build draws it (example-fragments.ts). Output drawn for
 * code other than the editor's is dimmed: while an edit waits to run, and
 * after one that threw, exited, or ran past the time or output limit, with
 * what went wrong under it in red. "Try it" opens the code the card holds.
 *
 * [LAW:dataflow-not-control-flow] What the card shows is a function of the
 * code in it. The page's own code is shown with the output the build proved
 * for it, with nothing run; any other code is run. Reset is putting the page's
 * code back, nothing more.
 */
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, type PropType } from "vue";
import type { EditorView } from "@codemirror/view";
import { cardSource, codeLine, type CardData } from "../example-card.js";
import { EXAMPLE_TERMINAL, STATIC_RUN_LIMIT_MS } from "../example-terminal.js";
import type { Drawn } from "../example-fragments.js";
import { encodeProgram } from "../playground-hash.js";
import type { StaticEnd, StaticRun } from "./static-run.js";

/** How long typing must pause before an edit runs. */
const RUN_AFTER_MS = 250;

/**
 * How much an edit may print. The card draws it on the page's thread, so this
 * bounds what one edit can cost the page; a docs example prints a few
 * thousand characters.
 */
const OUTPUT_LIMIT_CHARS = 1 << 18;

/** `load`, run the first time it is asked for and shared from then on; one that failed is forgotten, so the next ask tries again. */
function loader<T>(load: () => Promise<T>): () => Promise<T> {
  let loaded: Promise<T> | undefined;
  return () => (loaded ??= load().catch((error: unknown) => ((loaded = undefined), Promise.reject(error))));
}

/** What running an edit needs, loaded the first time a card runs one. */
const tools = loader(async () => {
  const [runtime, library, program, fragments, run] = await Promise.all([
    import("virtual:rich-live/runtime"),
    import("virtual:rich-live/library"),
    import("./playground-program.js"),
    import("../example-fragments.js"),
    import("./static-run.js"),
  ]);
  return {
    runtime: runtime.default,
    library: library.default,
    playgroundScript: program.playgroundScript,
    thrownAt: program.thrownAt,
    drawOutput: fragments.drawOutput,
    runStatic: run.runStatic,
  };
});

type Tools = Awaited<ReturnType<typeof tools>>;

/** The editor, loaded the first time a reader's pointer or focus reaches a card, so a click has it at hand. */
const editorModules = loader(() => Promise.all([import("./playground-editor.js"), import("@codemirror/view"), import("@codemirror/state")]));

/** Where the code stands: the page's highlighted fence, an editor on its way, or the editor. */
type Code =
  | { readonly kind: "fence" }
  | { readonly kind: "opening" }
  | { readonly kind: "editor"; readonly view: EditorView };

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export default defineComponent({
  name: "RichExample",
  props: {
    card: { type: Object as PropType<CardData>, required: true },
  },
  setup(props, { slots }) {
    const root = ref<HTMLElement | null>(null);
    const host = ref<HTMLElement | null>(null);
    const code = shallowRef<Code>({ kind: "fence" });
    const text = ref(props.card.code);
    /** The output shown, and the code it is the output of. */
    const drawn = shallowRef<{ readonly code: string; readonly output: Drawn }>({ code: props.card.code, output: props.card.output });
    const failure = ref<string | null>(null);
    /** The hash "Try it" opens the playground on: the page's program, or the card's edit. */
    const tryIt = ref(props.card.tryIt.program);
    const edited = computed(() => text.value !== props.card.code);

    // [LAW:no-ambient-temporal-coupling] Each edit is a turn, and only the
    // newest turn's run may draw: an edit ends the run before it, and a run
    // that ends after a newer edit is no one's.
    let turn = 0;
    let pending: ReturnType<typeof setTimeout> | undefined;
    let running: StaticRun | null = null;

    /** Why a run did not draw, as said under the output. */
    const failed = (end: Exclude<StaticEnd, { kind: "finished" | "stopped" }>, source: string, thrownAt: Tools["thrownAt"]): string => {
      switch (end.kind) {
        case "threw": {
          const at = thrownAt(end.report);
          const line = at === null ? null : codeLine(props.card.setup, source, at);
          const headline = end.report.split("\n")[0]!;
          return line === null ? headline : `${headline} (line ${line})`;
        }
        case "exited":
          return `It called process.exit(${end.code}).`;
        case "timedOut":
          return `Stopped after ${end.limitMs / 1000} s: it was still running.`;
        case "overflowed":
          return `Stopped after ${end.limitChars} characters: it was still printing.`;
      }
    };

    // [LAW:no-silent-failure] Whatever fails on the way, loading, compiling,
    // linking, running or drawing, is said under the output.
    async function run(source: string, mine: number): Promise<void> {
      try {
        const whole = cardSource(props.card.setup, source);
        const [made, hash] = await Promise.all([tools(), encodeProgram(whole)]);
        if (mine !== turn) return;
        tryIt.value = hash;
        running = made.runStatic(root.value!, {
          runtime: made.runtime,
          script: made.playgroundScript(whole, made.library),
          terminal: EXAMPLE_TERMINAL,
          limitMs: STATIC_RUN_LIMIT_MS,
          limitChars: OUTPUT_LIMIT_CHARS,
        });
        const { bytes, end } = await running.result;
        if (mine !== turn || end.kind === "stopped") return;
        if (end.kind === "finished") {
          drawn.value = { code: source, output: made.drawOutput(bytes) };
          failure.value = null;
        } else {
          failure.value = failed(end, source, made.thrownAt);
        }
      } catch (error) {
        if (mine === turn) failure.value = `The example could not run: ${message(error)}`;
      }
    }

    /** The code changed to `source`: show the page's output for the page's code, and run any other. */
    function changed(source: string): void {
      text.value = source;
      const mine = ++turn;
      clearTimeout(pending);
      running?.stop();
      if (source === props.card.code) {
        drawn.value = { code: source, output: props.card.output };
        tryIt.value = props.card.tryIt.program;
        failure.value = null;
        return;
      }
      pending = setTimeout(() => void run(source, mine), RUN_AFTER_MS);
    }

    /** Put the editor in the fence's place, its cursor at `at` on screen, or at the start. */
    async function edit(at: { readonly x: number; readonly y: number } | null): Promise<void> {
      if (code.value.kind !== "fence") return;
      code.value = { kind: "opening" };
      const modules = await editorModules().catch((error: unknown) => {
        code.value = { kind: "fence" };
        failure.value = `The editor could not load: ${message(error)}`;
        return null;
      });
      if (modules === null) return;
      const [{ createEditor }, { EditorView: View }, { Prec }] = modules;
      await nextTick();
      const view = createEditor(host.value!, props.card.code, { change: changed, run: () => changed(view.state.doc.toString()) }, [
        View.contentAttributes.of({ "aria-label": "Example code" }),
        // The fence's own measures, so the code does not move when the editor takes its place.
        Prec.highest(
          View.theme({
            "&": { backgroundColor: "var(--vp-code-block-bg)" },
            ".cm-scroller": { fontFamily: "var(--rich-code-font-family)", lineHeight: "var(--vp-code-line-height)" },
            ".cm-content": { padding: "20px 0" },
            ".cm-line": { padding: "0 24px" },
          }),
        ),
      ]);
      code.value = { kind: "editor", view };
      await nextTick();
      const anchor = at === null ? 0 : (view.posAtCoords(at) ?? 0);
      view.dispatch({ selection: { anchor } });
      view.focus();
    }

    // A failed fetch here is said by the click that needs the editor, which
    // fetches it again.
    const approached = () => void editorModules().catch(() => {});
    // A click that selected text is the reader copying, not editing; the
    // fence's own copy button is the reader copying too.
    const clicked = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target.closest("div[class*='language-']") === null || target.closest("button") !== null) return;
      if (getSelection()?.isCollapsed === false) return;
      void edit({ x: event.clientX, y: event.clientY });
    };
    const pressed = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || (event.target as Element).closest("div[class*='language-'] pre") === null) return;
      event.preventDefault();
      void edit(null);
    };
    const reset = () => {
      const now = code.value;
      if (now.kind === "editor") now.view.dispatch({ changes: { from: 0, to: now.view.state.doc.length, insert: props.card.code } });
    };

    // The page is the server's until this runs: a click before it reaches
    // nothing, so the card says it can be edited only from here.
    const editable = ref(false);
    onMounted(() => {
      editable.value = true;
    });
    onBeforeUnmount(() => {
      turn += 1;
      clearTimeout(pending);
      running?.stop();
      const now = code.value;
      if (now.kind === "editor") now.view.destroy();
    });

    return () => {
      const now = code.value;
      const { card } = props;
      const stale = drawn.value.code !== text.value;
      return h(
        "div",
        {
          class: ["rich-example rich-example-card", editable.value ? "rich-example-editable" : null],
          ref: root,
          onClick: clicked,
          onKeydown: pressed,
          onPointerenter: approached,
          onFocusin: approached,
        },
        [
          now.kind === "editor" ? null : slots["default"]?.(),
          now.kind === "fence" ? null : h("div", { class: "rich-example-editor", ref: host }),
          edited.value
            ? h("div", { class: "rich-example-edited" }, ["● edited · ", h("button", { type: "button", class: "rich-example-reset", onClick: reset }, "reset")])
            : null,
          h("div", { class: ["rich-example-output", stale ? "rich-example-stale" : null], style: { "--rich-example-columns": drawn.value.output.columns } }, [
            h("div", { class: "rich-example-label" }, [
              h("span", { class: "rich-example-name" }, card.label),
              h("span", { class: "rich-example-caption" }, card.caption),
              h("a", { class: "rich-example-try", href: `${card.tryIt.playground}#${tryIt.value}` }, "Try it"),
            ]),
            h("div", { class: "rich-example-light", innerHTML: drawn.value.output.light }),
            h("div", { class: "rich-example-dark", innerHTML: drawn.value.output.dark }),
            failure.value === null ? null : h("p", { class: "rich-example-failure", role: "alert" }, failure.value),
          ]),
        ],
      );
    };
  },
});
