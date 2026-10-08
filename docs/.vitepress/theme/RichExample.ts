/// <reference lib="dom" />
/**
 * A docs example as one editable card: its code, and under it what the code
 * does. The build hands it the block (example-card.ts); the page renders it
 * on the server, so a reader sees the card before any of this runs.
 *
 * At rest it is the page's own card: VitePress's highlighted fence, passed in
 * as the default slot, over the block's output. A click in the code, or Enter
 * on it, puts an editor in the fence's place, its cursor where the click was.
 * The editor holds the whole program, the setup the block runs on locked and
 * folded around it (setup-regions.ts). Once typing pauses the card shows what
 * its program (`cardSource`) does with the edit, in what stands under the
 * code, its outlet:
 *
 * - a block the build runs shows the output the build printed for it until
 *   it is edited; an edit runs in a sandboxed worker (static-run.ts) and its
 *   output is drawn the way the build draws it (example-fragments.ts);
 * - a `live` block's output is its program running in a live terminal
 *   (LiveScreen.ts), which an edit restarts on the edited program.
 *
 * Output shown for code other than the editor's is dimmed: while an edit
 * waits to run, and after one that could not, with what went wrong under it
 * in red. "Try it" opens the code the card holds.
 *
 * A block the build does not run is the same card, read-only: its code over
 * the note its marker gives, and nothing to edit.
 *
 * [LAW:dataflow-not-control-flow] What the card shows is a function of the
 * code in it. Reset is putting the page's code back, nothing more.
 */
import { computed, defineAsyncComponent, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, type PropType, type Ref, type Slots, type VNode, type VNodeArrayChildren } from "vue";
import type { EditorView } from "@codemirror/view";
import { PRINTS_NOTHING, RAN, blockOf, blockSpan, cardSource, type CardData } from "../example-card.js";
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

/** What making a card's program into a script needs, loaded the first time a card runs one. */
const programs = loader(async () => {
  const [library, program] = await Promise.all([import("virtual:rich-live/library"), import("./playground-program.js")]);
  return {
    library: library.default,
    playgroundProgram: program.playgroundProgram,
    playgroundScript: program.playgroundScript,
    thrownAt: program.thrownAt,
  };
});

/**
 * What running an edit for its output needs besides. The example terminal is
 * among it: its themes would otherwise be in every page's first download.
 */
const statics = loader(async () => {
  const [made, runtime, fragments, run, terminal] = await Promise.all([
    programs(),
    import("virtual:rich-live/runtime"),
    import("../example-fragments.js"),
    import("./static-run.js"),
    import("../example-terminal.js"),
  ]);
  return {
    ...made,
    runtime: runtime.default,
    drawOutput: fragments.drawOutput,
    runStatic: run.runStatic,
    terminal: terminal.EXAMPLE_TERMINAL,
    limitMs: terminal.STATIC_RUN_LIMIT_MS,
  };
});

type ThrownAt = Awaited<ReturnType<typeof programs>>["thrownAt"];

/** A live card's terminal, loaded with the first page that has one: it brings xterm's setup and the example terminal's themes. */
const LiveScreen = defineAsyncComponent(() => import("./LiveScreen.js"));

/** The space VitePress's fence leaves above and below its code: the editor's too, and the height of the folded setup's strip, drawn in it. */
const FENCE_PADDING = "20px";

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
  | { readonly kind: "editor"; readonly view: EditorView; readonly unfoldSetup: () => void }
  | { readonly kind: "unmounted" };

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

type EditableCard = Extract<CardData, { readonly run: "build" | "browser" }>;
type ReadOnlyCard = Extract<CardData, { readonly run: "never" }>;

/** The strip naming the output panel: its label, then what stands beside it. */
const labelStrip = (label: string, beside: readonly VNode[]): VNode =>
  h("div", { class: "rich-example-label" }, [h("span", { class: "rich-example-name" }, label), ...beside]);

/** A sentence in the output's place. */
const note = (said: string): VNode => h("p", { class: "rich-example-note" }, said);

/** A block the build does not run: its code over its note, nothing to edit. */
function readOnlyView(card: ReadOnlyCard, slots: Slots): () => VNode {
  return () =>
    h("div", { class: "rich-example rich-example-card" }, [
      slots["default"]?.(),
      h("div", { class: "rich-example-output" }, [labelStrip(card.label, []), note(card.note)]),
    ]);
}

/**
 * How showing an edit's output ended: shown, or what went wrong, said under
 * the output. A failure that names a line of the program counts the setup's
 * lines, so the card puts them in view.
 */
type Outcome = { readonly kind: "shown" } | { readonly kind: "failed"; readonly said: string; readonly namesLine: boolean };

const SHOWN: Outcome = { kind: "shown" };

/** A crash's report as said under the output: its first line, and the line of the program it names. */
function crashSaid(report: string, thrownAt: ThrownAt): string {
  const at = thrownAt(report);
  const headline = report.split("\n")[0]!;
  return at === null ? headline : `${headline} (line ${at})`;
}

/** What stands under an editable card's code: the output of some code, and how an edit's output reaches it. */
interface Outlet {
  /** The code what it shows is the output of. */
  readonly code: () => string;
  readonly caption: () => string;
  /** How many columns what it shows is drawn in, for the font to fit the card; null when that is nothing at all. */
  readonly columns: () => number | null;
  readonly body: () => VNodeArrayChildren;
  /** Show the output of `source`, the card's code, while `current` says no newer edit has come. */
  show(source: string, current: () => boolean): Promise<Outcome>;
}

/** Output drawn under the code: the code it is the output of, what it printed, and the caption that says where it came from. */
interface Shown {
  readonly code: string;
  readonly output: Drawn | null;
  readonly caption: string;
}

/**
 * A block the build runs: the page's own code is shown with the output the
 * build proved for it, with nothing run; any other code is run, its frame in
 * `root`.
 */
function staticOutlet(card: Extract<CardData, { readonly run: "build" }>, root: Ref<HTMLElement | null>): Outlet {
  const page: Shown = { code: card.code, output: card.output, caption: card.caption };
  const drawn = shallowRef<Shown>(page);
  let running: StaticRun | null = null;
  onBeforeUnmount(() => running?.stop());

  /** Why a run did not draw, as said under the output. */
  const failed = (end: Exclude<StaticEnd, { kind: "finished" | "stopped" }>, thrownAt: ThrownAt): string => {
    switch (end.kind) {
      case "threw":
        return crashSaid(end.report, thrownAt);
      case "exited":
        return `It called process.exit(${end.code}).`;
      case "timedOut":
        return `Stopped after ${end.limitMs / 1000} s: it was still running.`;
      case "overflowed":
        return `Stopped after ${end.limitChars} characters: it was still printing.`;
    }
  };

  return {
    code: () => drawn.value.code,
    caption: () => drawn.value.caption,
    columns: () => drawn.value.output?.columns ?? null,
    body: () => {
      const { output } = drawn.value;
      return output === null
        ? [note(PRINTS_NOTHING)]
        : [h("div", { class: "rich-example-light", innerHTML: output.light }), h("div", { class: "rich-example-dark", innerHTML: output.dark })];
    },
    async show(source, current) {
      running?.stop();
      if (source === card.code) {
        drawn.value = page;
        return SHOWN;
      }
      const made = await statics();
      if (!current()) return SHOWN;
      running = made.runStatic(root.value!, {
        runtime: made.runtime,
        script: made.playgroundScript(cardSource(card.setup, source), made.library),
        terminal: made.terminal,
        limitMs: made.limitMs,
        limitChars: OUTPUT_LIMIT_CHARS,
      });
      const { bytes, end } = await running.result;
      if (!current() || end.kind === "stopped") return SHOWN;
      // A program that exits 0 has ended as one that finished, as in Node.
      if (end.kind === "finished" || (end.kind === "exited" && end.code === 0)) {
        drawn.value = { code: source, output: made.drawOutput(bytes), caption: RAN };
        return SHOWN;
      }
      return { kind: "failed", said: failed(end, made.thrownAt), namesLine: end.kind === "threw" };
    },
  };
}

/**
 * A `live` block: its program running in a live terminal. An edit that parses
 * is a new program, which the terminal restarts on; one that does not leaves
 * the terminal running the last that did.
 */
function liveOutlet(card: Extract<CardData, { readonly run: "browser" }>): Outlet {
  const pageProgram = async () => {
    const made = await programs();
    return made.playgroundScript(cardSource(card.setup, card.code), made.library);
  };
  const running = shallowRef<{ readonly code: string; readonly program: () => Promise<string> }>({ code: card.code, program: pageProgram });
  return {
    code: () => running.value.code,
    caption: () => card.caption,
    columns: () => card.columns,
    body: () => [h(LiveScreen, { program: running.value.program })],
    async show(source, current) {
      const made = await programs();
      const program = made.playgroundProgram(cardSource(card.setup, source), made.library);
      if (program.kind === "refused") return { kind: "failed", said: crashSaid(program.report, made.thrownAt), namesLine: true };
      if (current()) running.value = { code: source, program: () => Promise.resolve(program.script) };
      return SHOWN;
    },
  };
}

function editableView(card: EditableCard, slots: Slots): () => VNode {
  const root = ref<HTMLElement | null>(null);
  const host = ref<HTMLElement | null>(null);
  const code = shallowRef<Code>({ kind: "fence", refused: null });
  const text = ref(card.code);
  const outlet = card.run === "build" ? staticOutlet(card, root) : liveOutlet(card);
  const failure = ref<string | null>(null);
  /** The hash "Try it" opens the playground on, the page's program or the card's edit; or why an edit has none. */
  const tryIt = shallowRef<{ readonly hash: string } | { readonly refused: string }>({ hash: card.tryIt.program });
  const edited = computed(() => text.value !== card.code);

  // [LAW:no-ambient-temporal-coupling] Each edit is a turn, and only the
  // newest turn may show what it does: a show that ends after a newer edit is
  // no one's.
  let turn = 0;
  let pending: ReturnType<typeof setTimeout> | undefined;

  // [LAW:no-silent-failure] Whatever fails on the way, loading, compiling,
  // running or drawing, is said under the output.
  async function show(source: string, mine: number): Promise<void> {
    const current = () => mine === turn;
    try {
      const outcome = await outlet.show(source, current);
      if (!current()) return;
      failure.value = outcome.kind === "shown" ? null : outcome.said;
      const now = code.value;
      if (outcome.kind === "failed" && outcome.namesLine && now.kind === "editor") now.unfoldSetup();
    } catch (error) {
      if (current()) failure.value = `The example could not run: ${message(error)}`;
    }
  }

  /** Point "Try it" at the page's program for the page's code, and at the card's program around any other, which needs nothing a run does. */
  async function link(source: string, mine: number): Promise<void> {
    const linked =
      source === card.code
        ? { hash: card.tryIt.program }
        : await encodeProgram(cardSource(card.setup, source)).then(
            (hash) => ({ hash }),
            (error: unknown) => ({ refused: `"Try it" cannot carry this edit: ${message(error)}` }),
          );
    if (mine === turn) tryIt.value = linked;
  }

  /** The code changed to `source`: show what it does once typing pauses. */
  function changed(source: string): void {
    text.value = source;
    const mine = ++turn;
    clearTimeout(pending);
    void link(source, mine);
    pending = setTimeout(() => void show(source, mine), RUN_AFTER_MS);
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
    const [{ createEditor }, { EditorView: View }, { Prec }, { setupRegions, unfoldSetup }] = modules;
    await nextTick();
    // The card may have left the page while the editor loaded.
    if (code.value.kind !== "opening") return;
    const { setup } = card;
    const changedTo = (program: string) => changed(blockOf(setup, program));
    const view = createEditor(host.value!, cardSource(setup, card.code), { change: changedTo, run: () => changedTo(view.state.doc.toString()) }, [
      setupRegions(setup, "folded"),
      View.contentAttributes.of({ "aria-label": "Example code" }),
      // The fence's own measures, so the code does not move when the editor
      // takes its place; the folded setup's strip stands in the space above it.
      Prec.highest(
        View.theme({
          "&": { backgroundColor: "var(--vp-code-block-bg)" },
          ".cm-scroller": { fontFamily: "var(--rich-code-font-family)", lineHeight: "var(--vp-code-line-height)" },
          ".cm-content": { padding: `${FENCE_PADDING} 0` },
          ".cm-line, .rich-setup-label, .rich-setup-strip": { padding: "0 24px" },
          ".rich-setup-strip": { lineHeight: FENCE_PADDING },
        }),
      ),
    ]);
    code.value = { kind: "editor", view, unfoldSetup: () => unfoldSetup(view) };
    await nextTick();
    // The cursor starts in the block, where the click was or nearest it: a
    // click in the space above the code is a click on its first line.
    const span = blockSpan(setup);
    const start = span.before;
    const end = view.state.doc.length - span.after;
    const anchor = at === null ? start : Math.min(Math.max(view.posAtCoords(at) ?? start, start), end);
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
    const { before, after } = blockSpan(card.setup);
    now.view.dispatch({ changes: { from: before, to: now.view.state.doc.length - after, insert: card.code } });
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
    const now = code.value;
    if (now.kind === "editor") now.view.destroy();
    code.value = { kind: "unmounted" };
  });

  return () => {
    const now = code.value;
    const stale = outlet.code() !== text.value;
    const columns = outlet.columns();
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
        h("div", { class: ["rich-example-output", stale ? "rich-example-stale" : null], style: columns === null ? null : { "--rich-example-columns": columns } }, [
          labelStrip(card.label, [
            h("span", { class: "rich-example-caption" }, outlet.caption()),
            "hash" in link
              ? h("a", { class: "rich-example-try", href: `${card.tryIt.playground}#${link.hash}` }, "Try it")
              : h("span", { class: "rich-example-try", "aria-disabled": "true", title: link.refused }, "Try it"),
          ]),
          ...outlet.body(),
          ...[failure.value, now.kind === "fence" ? now.refused : null].map((said) =>
            said === null ? null : h("p", { class: "rich-example-failure", role: "alert" }, said),
          ),
        ]),
      ],
    );
  };
}

export default defineComponent({
  name: "RichExample",
  props: {
    card: { type: Object as PropType<CardData>, required: true },
  },
  setup(props, { slots }) {
    const { card } = props;
    return card.run === "never" ? readOnlyView(card, slots) : editableView(card, slots);
  },
});
