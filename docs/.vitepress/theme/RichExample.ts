/// <reference lib="dom" />
/**
 * A docs example as one editable card: its code, and under it what the code
 * prints. The build hands it the block (example-card.ts); the page renders it
 * on the server, so a reader sees the card before any of this runs.
 *
 * At rest it is the page's own card: VitePress's highlighted fence, passed in
 * as the default slot, over the output the build printed. A click in the code,
 * or Enter on it, puts an editor in the fence's place, its cursor where the
 * click was. The editor holds the whole program, the setup the block runs on
 * locked and folded around it (setup-regions.ts). Once typing pauses the card runs its program on the edit
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
import { blockOf, blockSpan, cardSource, type CardData } from "../example-card.js";
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

/**
 * What running an edit needs, loaded the first time a card runs one. The
 * example terminal is among it: its themes would otherwise be in every page's
 * first download.
 */
const tools = loader(async () => {
  const [runtime, library, program, fragments, run, terminal] = await Promise.all([
    import("virtual:rich-live/runtime"),
    import("virtual:rich-live/library"),
    import("./playground-program.js"),
    import("../example-fragments.js"),
    import("./static-run.js"),
    import("../example-terminal.js"),
  ]);
  return {
    runtime: runtime.default,
    library: library.default,
    playgroundScript: program.playgroundScript,
    thrownAt: program.thrownAt,
    drawOutput: fragments.drawOutput,
    runStatic: run.runStatic,
    terminal: terminal.EXAMPLE_TERMINAL,
    limitMs: terminal.STATIC_RUN_LIMIT_MS,
  };
});

type Tools = Awaited<ReturnType<typeof tools>>;

/** The editor, loaded the first time a reader's pointer or focus reaches a card, so a click has it at hand. */
const editorModules = loader(() =>
  Promise.all([import("./playground-editor.js"), import("@codemirror/view"), import("@codemirror/state"), import("./setup-regions.js")]),
);

/**
 * Where the code stands: the page's highlighted fence, with why the editor did
 * not load if a click asked for it and it failed; an editor on its way; the
 * editor; or nowhere, the card having left the page.
 */
type Code =
  | { readonly kind: "fence"; readonly refused: string | null }
  | { readonly kind: "opening" }
  | { readonly kind: "editor"; readonly view: EditorView }
  | { readonly kind: "unmounted" };

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export default defineComponent({
  name: "RichExample",
  props: {
    card: { type: Object as PropType<CardData>, required: true },
  },
  setup(props, { slots }) {
    const root = ref<HTMLElement | null>(null);
    const host = ref<HTMLElement | null>(null);
    const code = shallowRef<Code>({ kind: "fence", refused: null });
    const text = ref(props.card.code);
    /** The output shown, and the code it is the output of. */
    const drawn = shallowRef<{ readonly code: string; readonly output: Drawn }>({ code: props.card.code, output: props.card.output });
    const failure = ref<string | null>(null);
    /** The hash "Try it" opens the playground on, the page's program or the card's edit; or why an edit has none. */
    const tryIt = shallowRef<{ readonly hash: string } | { readonly refused: string }>({ hash: props.card.tryIt.program });
    const edited = computed(() => text.value !== props.card.code);

    // [LAW:no-ambient-temporal-coupling] Each edit is a turn, and only the
    // newest turn's run may draw: an edit ends the run before it, and a run
    // that ends after a newer edit is no one's.
    let turn = 0;
    let pending: ReturnType<typeof setTimeout> | undefined;
    let running: StaticRun | null = null;

    /** Why a run did not draw, as said under the output. */
    const failed = (end: Exclude<StaticEnd, { kind: "finished" | "stopped" }>, thrownAt: Tools["thrownAt"]): string => {
      switch (end.kind) {
        case "threw": {
          const at = thrownAt(end.report);
          // The editor holds the whole program, so the program's line is the reader's.
          const headline = end.report.split("\n")[0]!;
          return at === null ? headline : `${headline} (line ${at})`;
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
    // running or drawing, is said under the output.
    async function run(source: string, mine: number): Promise<void> {
      try {
        const made = await tools();
        if (mine !== turn) return;
        running = made.runStatic(root.value!, {
          runtime: made.runtime,
          script: made.playgroundScript(cardSource(props.card.setup, source), made.library),
          terminal: made.terminal,
          limitMs: made.limitMs,
          limitChars: OUTPUT_LIMIT_CHARS,
        });
        const { bytes, end } = await running.result;
        if (mine !== turn || end.kind === "stopped") return;
        // A program that exits 0 has ended as one that finished, as in Node.
        if (end.kind === "finished" || (end.kind === "exited" && end.code === 0)) {
          drawn.value = { code: source, output: made.drawOutput(bytes) };
          failure.value = null;
        } else {
          failure.value = failed(end, made.thrownAt);
        }
      } catch (error) {
        if (mine === turn) failure.value = `The example could not run: ${message(error)}`;
      }
    }

    /** Point "Try it" at the card's program around `source`, which needs nothing a run does. */
    async function link(source: string, mine: number): Promise<void> {
      const linked = await encodeProgram(cardSource(props.card.setup, source)).then(
        (hash) => ({ hash }),
        (error: unknown) => ({ refused: `"Try it" cannot carry this edit: ${message(error)}` }),
      );
      if (mine === turn) tryIt.value = linked;
    }

    /** The code changed to `source`: show the page's output for the page's code, and run any other. */
    function changed(source: string): void {
      text.value = source;
      const mine = ++turn;
      clearTimeout(pending);
      running?.stop();
      if (source === props.card.code) {
        drawn.value = { code: source, output: props.card.output };
        tryIt.value = { hash: props.card.tryIt.program };
        failure.value = null;
        return;
      }
      void link(source, mine);
      pending = setTimeout(() => void run(source, mine), RUN_AFTER_MS);
    }

    /** Put the editor in the fence's place, its cursor at `at` on screen, or at the start. */
    async function edit(at: { readonly x: number; readonly y: number } | null): Promise<void> {
      if (code.value.kind !== "fence") return;
      code.value = { kind: "opening" };
      const modules = await editorModules().catch((error: unknown) => {
        if (code.value.kind === "opening") code.value = { kind: "fence", refused: `The editor could not load: ${message(error)}` };
        return null;
      });
      if (modules === null) return;
      const [{ createEditor }, { EditorView: View }, { Prec }, { setupRegions }] = modules;
      await nextTick();
      // The card may have left the page while the editor loaded.
      if (code.value.kind !== "opening") return;
      const { setup } = props.card;
      const changedTo = (program: string) => changed(blockOf(setup, program));
      const view = createEditor(host.value!, cardSource(setup, props.card.code), { change: changedTo, run: () => changedTo(view.state.doc.toString()) }, [
        setupRegions(setup, "folded"),
        View.contentAttributes.of({ "aria-label": "Example code" }),
        // The fence's own measures, so the code does not move when the editor takes its place.
        Prec.highest(
          View.theme({
            "&": { backgroundColor: "var(--vp-code-block-bg)" },
            ".cm-scroller": { fontFamily: "var(--rich-code-font-family)", lineHeight: "var(--vp-code-line-height)" },
            ".cm-content": { padding: "20px 0" },
            ".cm-line, .rich-setup-label, .rich-setup-strip": { padding: "0 24px" },
          }),
        ),
      ]);
      code.value = { kind: "editor", view };
      await nextTick();
      const start = blockSpan(setup).before;
      const anchor = at === null ? start : (view.posAtCoords(at) ?? start);
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
      if (now.kind !== "editor") return;
      const { before, after } = blockSpan(props.card.setup);
      now.view.dispatch({ changes: { from: before, to: now.view.state.doc.length - after, insert: props.card.code } });
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
      code.value = { kind: "unmounted" };
    });

    return () => {
      const now = code.value;
      const { card } = props;
      const stale = drawn.value.code !== text.value;
      const link = tryIt.value;
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
              "hash" in link
                ? h("a", { class: "rich-example-try", href: `${card.tryIt.playground}#${link.hash}` }, "Try it")
                : h("span", { class: "rich-example-try", "aria-disabled": "true", title: link.refused }, "Try it"),
            ]),
            h("div", { class: "rich-example-light", innerHTML: drawn.value.output.light }),
            h("div", { class: "rich-example-dark", innerHTML: drawn.value.output.dark }),
            ...[failure.value, now.kind === "fence" ? now.refused : null].map((said) =>
              said === null ? null : h("p", { class: "rich-example-failure", role: "alert" }, said),
            ),
          ]),
        ],
      );
    };
  },
});
