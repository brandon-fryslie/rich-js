/// <reference lib="dom" />
/**
 * A program as one editable card: its code, and under it what the code does.
 * Two places show one, with one core between them (`cardCore`):
 *
 * - a docs example (`RichExample`). The build hands it the block
 *   (example-card.ts); the page renders it on the server, so a reader sees the
 *   card before any of this runs. At rest it is the page's own card:
 *   VitePress's highlighted fence, passed in as the default slot, over the
 *   block's output. A click in the code, or Enter on it, puts an editor in the
 *   fence's place, its cursor where the click was, the setup the block runs on
 *   locked and folded around it (setup-regions.ts). "Try it" opens the code
 *   the card holds in the playground.
 * - the playground (`RichPlayground`): the card at the page's full width,
 *   opened on the program in the URL's hash (playground-hash.ts), its setup
 *   unfolded and line numbers on. An edit is written back to the hash once
 *   typing pauses, so the address bar is a link to what the editor holds.
 *
 * The landing page's hero is the card with its code hidden (`OutputCard`).
 *
 * Once typing pauses the card shows what its program (`cardSource`) does with
 * the edit, in what stands under the code, its outlet:
 *
 * - a block the build runs shows the output the build printed for it until
 *   it is edited; an edit runs in a sandboxed worker (static-run.ts) and its
 *   output is drawn the way the build draws it (example-fragments.ts);
 * - a `live` block's output is its program running in a live terminal
 *   (LiveScreen.ts), which an edit restarts on the edited program;
 * - a playground program is run the static way, and drawn so when it ends; one
 *   that does what only a terminal shows, reading what is typed or redrawing
 *   what it drew, or is still running at the limit, moves to a live terminal.
 *   What the program does decides it, not a choice the visitor makes.
 *
 * Output shown for code other than the editor's is dimmed: while an edit
 * waits to run, and after one that could not, with what went wrong under it
 * in red.
 *
 * A block the build does not run is the same card, read-only: its code over
 * the note its marker gives, and nothing to edit.
 *
 * [LAW:dataflow-not-control-flow] What the card shows is a function of the
 * code in it. Reset is putting the opened code back, nothing more.
 */
import {
  computed,
  defineAsyncComponent,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  type PropType,
  type Ref,
  type ShallowRef,
  type Slots,
  type VNode,
  type VNodeArrayChildren,
} from "vue";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { DRAWN, NO_SETUP, PRINTS_NOTHING, RAN, RUNNING, blockOf, blockSpan, cardSource, type CardData, type CardProgram, type CardSetup } from "../example-card.js";
import type { Drawn } from "../example-fragments.js";
import { decodeProgram, encodeProgram } from "../playground-hash.js";
import type { SetupStart } from "./setup-regions.js";
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

type EditorModules = Awaited<ReturnType<typeof editorModules>>;

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

/** How a static run of an edit came out: as an outcome, or by doing what only a terminal shows, said as a failure would be. */
type StaticOutcome = Outcome | { readonly kind: "terminal"; readonly said: string };

/** A crash's report as said under the output: its first line, and the line of the program it names. */
function crashSaid(report: string, thrownAt: ThrownAt): string {
  const at = thrownAt(report);
  const headline = report.split("\n")[0]!;
  return at === null ? headline : `${headline} (line ${at})`;
}

/** How a static run that did not draw came out. */
function staticEnded(end: Exclude<StaticEnd, { kind: "finished" | "stopped" }>, thrownAt: ThrownAt): StaticOutcome {
  switch (end.kind) {
    case "threw":
      return { kind: "failed", said: crashSaid(end.report, thrownAt), namesLine: true };
    case "exited":
      return { kind: "failed", said: `It called process.exit(${end.code}).`, namesLine: false };
    case "overflowed":
      return { kind: "failed", said: `Stopped after ${end.limitChars} characters: it was still printing.`, namesLine: false };
    case "timedOut":
      return { kind: "terminal", said: `Stopped after ${end.limitMs / 1000} s: it was still running.` };
    case "listening":
      return { kind: "terminal", said: "It reads what is typed at it, which only a live terminal gives it." };
    case "dropped":
      return { kind: "terminal", said: "It moves the cursor or changes the screen, which only a live terminal shows." };
    case "ranOn":
      return { kind: "terminal", said: "It runs on after its last line, a timer still set, which only a live terminal shows." };
  }
}

/** What stands under an editable card's code: the output of some code, and how an edit's output reaches it. */
interface Outlet {
  /** The code what it shows is the output of; null before it shows any. */
  readonly code: () => string | null;
  readonly label: () => string;
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

/** A card's code run for what it prints: the output last drawn, and how a run of other code draws its own. */
interface StaticRuns {
  readonly drawn: ShallowRef<Shown | null>;
  run(source: string, current: () => boolean): Promise<StaticOutcome>;
}

/**
 * `setup` around whatever code is run, each run's frame in `root`. Code
 * `rest` is the output of is shown with that output, with nothing run.
 */
function staticRuns(setup: CardSetup, root: Ref<HTMLElement | null>, rest: Shown | null): StaticRuns {
  const drawn = shallowRef<Shown | null>(rest);
  let running: StaticRun | null = null;
  onBeforeUnmount(() => running?.stop());
  return {
    drawn,
    async run(source, current) {
      running?.stop();
      if (source === rest?.code) {
        drawn.value = rest;
        return SHOWN;
      }
      const made = await statics();
      if (!current()) return SHOWN;
      running = made.runStatic(root.value!, {
        runtime: made.runtime,
        script: made.playgroundScript(cardSource(setup, source), made.library),
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
      return staticEnded(end, made.thrownAt);
    },
  };
}

/** What `drawn` shows, under `label`. */
function drawnView(drawn: ShallowRef<Shown | null>, label: string): Omit<Outlet, "show"> {
  return {
    code: () => drawn.value?.code ?? null,
    label: () => label,
    caption: () => drawn.value?.caption ?? DRAWN.caption,
    columns: () => drawn.value?.output?.columns ?? null,
    body: () => {
      const shown = drawn.value;
      if (shown === null) return [];
      return shown.output === null
        ? [note(PRINTS_NOTHING)]
        : [h("div", { class: "rich-example-light", innerHTML: shown.output.light }), h("div", { class: "rich-example-dark", innerHTML: shown.output.dark })];
    },
  };
}

/**
 * A block the build runs: the page's own code is shown with the output the
 * build proved for it, with nothing run; any other code is run, its frame in
 * `root`, and what only a terminal shows is a failure, as the block's marker
 * says it is static.
 */
function staticOutlet(card: Extract<CardData, { readonly run: "build" }>, root: Ref<HTMLElement | null>): Outlet {
  const runs = staticRuns(card.setup, root, { code: card.code, output: card.output, caption: card.caption });
  return {
    ...drawnView(runs.drawn, card.label),
    async show(source, current) {
      const outcome = await runs.run(source, current);
      return outcome.kind === "terminal" ? { kind: "failed", said: outcome.said, namesLine: false } : outcome;
    },
  };
}

/**
 * `start` in `setup`, running in a live terminal of `columns` columns. An edit
 * that parses is a new program, which the terminal restarts on; one that does
 * not leaves the terminal running the last that did.
 */
function liveOutlet(setup: CardSetup, start: string, look: { readonly label: string; readonly caption: string }, columns: number): Outlet {
  // Made once and kept: each scroll into view and each Restart asks for it.
  const startProgram = loader(async () => {
    const made = await programs();
    return made.playgroundScript(cardSource(setup, start), made.library);
  });
  const running = shallowRef<{ readonly code: string; readonly program: () => Promise<string> }>({ code: start, program: startProgram });
  return {
    code: () => running.value.code,
    label: () => look.label,
    caption: () => look.caption,
    columns: () => columns,
    body: () => [h(LiveScreen, { program: running.value.program })],
    async show(source, current) {
      if (source === start) {
        running.value = { code: source, program: startProgram };
        return SHOWN;
      }
      const made = await programs();
      const program = made.playgroundProgram(cardSource(setup, source), made.library);
      if (program.kind === "refused") {
        return { kind: "failed", said: crashSaid(program.report, made.thrownAt), namesLine: made.thrownAt(program.report) !== null };
      }
      if (current()) running.value = { code: source, program: () => Promise.resolve(program.script) };
      return SHOWN;
    },
  };
}

/**
 * A playground program: each version run the static way first, and drawn
 * when it ends; one that does what only a terminal shows is run in a live
 * terminal instead, until a version that ends is drawn again.
 */
function decidedOutlet(setup: CardSetup, root: Ref<HTMLElement | null>): Outlet {
  const runs = staticRuns(setup, root, null);
  const still = drawnView(runs.drawn, DRAWN.label);
  const live = shallowRef<Outlet | null>(null);
  const now = () => live.value ?? still;
  return {
    code: () => now().code(),
    label: () => now().label(),
    caption: () => now().caption(),
    columns: () => now().columns(),
    body: () => now().body(),
    async show(source, current) {
      const outcome = await runs.run(source, current);
      if (!current()) return SHOWN;
      if (outcome.kind === "shown") live.value = null;
      if (outcome.kind !== "terminal") return outcome;
      const { terminal } = await statics();
      if (current()) live.value = liveOutlet(setup, source, RUNNING, terminal.columns);
      return SHOWN;
    },
  };
}

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

/** How an editor sits in its card: where its setup starts, and what it shows around the code. */
interface Seat {
  readonly setup: SetupStart;
  readonly shown: (modules: EditorModules) => Extension[];
}

/** An editor in a docs card: the setup folded, and the fence's own measures, so the code does not move when the editor takes its place. */
const PAGE_SEAT: Seat = {
  setup: "folded",
  shown: ([, { EditorView: View }, { Prec }]) => [
    View.contentAttributes.of({ "aria-label": "Example code" }),
    // The folded setup's strip stands in the space above the code.
    Prec.highest(
      View.theme({
        "&": { backgroundColor: "var(--vp-code-block-bg)" },
        ".cm-scroller": { fontFamily: "var(--rich-code-font-family)", lineHeight: "var(--vp-code-line-height)" },
        ".cm-content": { padding: `${FENCE_PADDING} 0` },
        ".cm-line, .rich-setup-label, .rich-setup-strip": { padding: "0 24px" },
        ".rich-setup-strip": { lineHeight: FENCE_PADDING },
      }),
    ),
  ],
};

/** An editor in the playground: the setup in view from the start, with line numbers, as a program's whole page. */
const PLAYGROUND_SEAT: Seat = {
  setup: "unfolded",
  shown: ([{ PROGRAM_PANE }]) => [...PROGRAM_PANE],
};

/**
 * What every editable card does with its code: `opened` in an editor, the
 * edit shown by `outlet` once typing pauses, a failure said under it, and the
 * opened code put back on reset. `edited` hears each change, with whether it
 * is still the newest.
 */
function cardCore(opened: CardProgram, outlet: Outlet, edited: (source: string, current: () => boolean) => void) {
  const code = shallowRef<Code>({ kind: "fence", refused: null });
  const text = ref(opened.code);
  const failure = ref<string | null>(null);

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

  /**
   * Show what `source` does once typing pauses, or `now` when the reader asks
   * for it; the opened code, whose output an outlet may already hold, at once.
   */
  function run(source: string, when: "paused" | "now"): number {
    const mine = ++turn;
    clearTimeout(pending);
    pending = setTimeout(() => void show(source, mine), when === "now" || source === opened.code ? 0 : RUN_AFTER_MS);
    return mine;
  }

  /** The code changed to `source`, or the reader asked to run it. */
  function changed(source: string, when: "paused" | "now"): void {
    text.value = source;
    const mine = run(source, when);
    edited(source, () => mine === turn);
  }

  /** Put an editor holding the opened program in `host`, seated as `seat` says. */
  async function openEditor(host: () => HTMLElement, seat: Seat): Promise<EditorView | null> {
    code.value = { kind: "opening" };
    const modules = await editorModules().catch((error: unknown) => {
      if (code.value.kind === "opening") code.value = { kind: "fence", refused: `The editor could not load: ${message(error)}` };
      return null;
    });
    if (modules === null) return null;
    const [{ createEditor }, , , { setupRegions, unfoldSetup }] = modules;
    await nextTick();
    // The card may have left the page while the editor loaded.
    if (code.value.kind !== "opening") return null;
    const { setup } = opened;
    const changedTo = (program: string, when: "paused" | "now") => changed(blockOf(setup, program), when);
    const view = createEditor(host(), cardSource(setup, text.value), { change: (program) => changedTo(program, "paused"), run: () => changedTo(view.state.doc.toString(), "now") }, [
      setupRegions(setup, seat.setup),
      ...seat.shown(modules),
    ]);
    code.value = { kind: "editor", view, unfoldSetup: () => unfoldSetup(view) };
    await nextTick();
    return view;
  }

  const reset = () => {
    const now = code.value;
    if (now.kind !== "editor") return;
    const { before, after } = blockSpan(opened.setup);
    now.view.dispatch({ changes: { from: before, to: now.view.state.doc.length - after, insert: opened.code } });
  };

  onBeforeUnmount(() => {
    turn += 1;
    clearTimeout(pending);
    const now = code.value;
    if (now.kind === "editor") now.view.destroy();
    code.value = { kind: "unmounted" };
  });

  const isEdited = computed(() => text.value !== opened.code);

  /** The quiet line offering the opened code back, `● edited · reset`; or, where it always shows, that there is nothing to put back. */
  const editedLine = () =>
    h("div", { class: "rich-example-edited" }, [
      isEdited.value ? "● edited · " : "○ unedited · ",
      h("button", { type: "button", class: "rich-example-reset", disabled: !isEdited.value, onClick: reset }, "reset"),
    ]);

  /** The output panel: its label strip, with `beside` after the caption, the output, and what went wrong. */
  const output = (beside: readonly VNode[]) => {
    const now = code.value;
    const columns = outlet.columns();
    return h(
      "div",
      { class: ["rich-example-output", outlet.code() !== text.value ? "rich-example-stale" : null], style: columns === null ? null : { "--rich-example-columns": columns } },
      [
        labelStrip(outlet.label(), [h("span", { class: "rich-example-caption" }, outlet.caption()), ...beside]),
        ...outlet.body(),
        ...[failure.value, now.kind === "fence" ? now.refused : null].map((said) =>
          said === null ? null : h("p", { class: "rich-example-failure", role: "alert" }, said),
        ),
      ],
    );
  };

  return { code, edited: isEdited, run, openEditor, editedLine, output };
}

function editableView(card: EditableCard, slots: Slots): () => VNode {
  const root = ref<HTMLElement | null>(null);
  const host = ref<HTMLElement | null>(null);
  const opened: CardProgram = { setup: card.setup, code: card.code };
  /** The hash "Try it" opens the playground on, the page's program or the card's edit; or why an edit has none. */
  const tryIt = shallowRef<{ readonly hash: string } | { readonly refused: string }>({ hash: card.tryIt.program });
  const outlet = card.run === "build" ? staticOutlet(card, root) : liveOutlet(card.setup, card.code, card, card.columns);

  /** Point "Try it" at the page's program for the page's code, and at the card's program around any other, which needs nothing a run does. */
  async function link(source: string, current: () => boolean): Promise<void> {
    const linked =
      source === card.code
        ? { hash: card.tryIt.program }
        : await encodeProgram({ setup: card.setup, code: source }).then(
            (hash) => ({ hash }),
            (error: unknown) => ({ refused: `"Try it" cannot carry this edit: ${message(error)}` }),
          );
    if (current()) tryIt.value = linked;
  }
  const core = cardCore(opened, outlet, (source, current) => void link(source, current));

  /** Put the editor in the fence's place, its cursor at `at` on screen, or at the start. */
  async function edit(at: { readonly x: number; readonly y: number } | null): Promise<void> {
    if (core.code.value.kind !== "fence") return;
    const view = await core.openEditor(() => host.value!, PAGE_SEAT);
    if (view === null) return;
    // The cursor starts in the block, where the click was or nearest it: a
    // click in the space above the code is a click on its first line.
    const span = blockSpan(card.setup);
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

  // The page is the server's until this runs: a click before it reaches
  // nothing, so the card says it can be edited only from here.
  const editable = ref(false);
  onMounted(() => {
    editable.value = true;
  });

  return () => {
    const now = core.code.value;
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
        core.edited.value ? core.editedLine() : null,
        core.output([
          "hash" in link
            ? h("a", { class: "rich-example-try", href: `${card.tryIt.playground}#${link.hash}` }, "Try it")
            : h("span", { class: "rich-example-try", "aria-disabled": "true", title: link.refused }, "Try it"),
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

/**
 * The card with its code hidden: a program running in a live terminal, as a
 * live card's output does, and nothing to edit. `program` makes the script,
 * as a live card's does. The landing page's hero is one (RichShowcase.ts).
 */
export const OutputCard = defineComponent({
  name: "OutputCard",
  props: {
    program: { type: Function as PropType<() => Promise<string>>, required: true },
  },
  setup: (props) => () =>
    h("div", { class: "rich-example rich-example-card" }, [h("div", { class: "rich-example-output" }, [h(LiveScreen, { program: props.program })])]),
});

/**
 * The playground's card, on one program: an editor from the start, the
 * program run at once, and every edit handed to `edited`.
 */
const PlaygroundCard = defineComponent({
  name: "PlaygroundCard",
  props: {
    program: { type: Object as PropType<CardProgram>, required: true },
    edited: { type: Function as PropType<(program: CardProgram) => void>, required: true },
  },
  setup(props) {
    const root = ref<HTMLElement | null>(null);
    const host = ref<HTMLElement | null>(null);
    const { program } = props;
    const core = cardCore(program, decidedOutlet(program.setup, root), (code) => props.edited({ setup: program.setup, code }));
    onMounted(() => {
      core.run(program.code, "now");
      void core.openEditor(() => host.value!, PLAYGROUND_SEAT);
    });
    return () =>
      h("div", { class: "rich-example rich-example-card", ref: root }, [
        h("div", { class: "rich-example-editor", ref: host }),
        core.editedLine(),
        core.output([]),
      ]);
  },
});

/**
 * How long typing must pause before the link is written. Browsers refuse
 * (Safari, Firefox) or quietly drop (Chrome) a burst of history writes, and
 * one a keystroke is such a burst.
 */
const WRITE_AFTER_MS = 300;

/**
 * The playground page: the card on the program in the URL's hash, or, with
 * none, on the first block of the start page (`PLAYGROUND_MODULE` in
 * example-runner.ts), with no setup.
 */
export const RichPlayground = defineComponent({
  name: "RichPlayground",
  setup() {
    /** The program the card is open on, keyed by the event that opened it: a new one is a new card. */
    const opened = shallowRef<{ readonly key: number; readonly program: CardProgram } | null>(null);
    const failure = ref<string | null>(null);

    // [LAW:no-ambient-temporal-coupling] The card and the address bar are kept
    // agreed here and nowhere else. An edit, a link followed and the page
    // closing are each an event, and an encode or decode that finishes after a
    // later event is dropped: the newest event always wins. An edit still
    // waiting to be written when a link is followed never reaches the history
    // entry left behind.
    let latest = 0;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const next = (): number => {
      clearTimeout(pending);
      return ++latest;
    };

    /** Open the program the hash holds, or the start page's for none. A link that cannot be read says so, and opens the start example rather than nothing. */
    async function follow(): Promise<void> {
      const event = next();
      const hash = location.hash.slice(1);
      const start = () => import("virtual:rich-live/playground").then(({ start }): CardProgram => ({ setup: NO_SETUP, code: start }));
      try {
        const program = await (hash === "" ? start() : decodeProgram(hash)).catch(async (error: unknown) => {
          const fallback = await start();
          if (event === latest) failure.value = `This link's program could not be read (${message(error)}), so the playground opened on its starting example.`;
          return fallback;
        });
        if (event !== latest) return;
        opened.value = { key: event, program };
      } catch (error) {
        if (event === latest) failure.value = `The playground could not start: ${message(error)}`;
      }
    }

    // A failure shown is about the address bar and the card disagreeing;
    // once a write makes them agree, it is over. The write itself can throw
    // too: a browser caps a URL's length below what a program may carry.
    const remember = (program: CardProgram) => {
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

    // A playground link opened in this tab changes only the hash: the page
    // stays, and opens the link's program as a fresh page would.
    const followed = () => {
      failure.value = null;
      void follow();
    };
    onMounted(() => {
      addEventListener("hashchange", followed);
      void follow();
    });
    onBeforeUnmount(() => {
      next();
      removeEventListener("hashchange", followed);
    });

    return () => {
      const now = opened.value;
      return h("div", { class: "rich-playground vp-doc" }, [
        h("h1", "Playground"),
        failure.value === null ? null : h("p", { class: "rich-example-failure rich-playground-failure", role: "alert" }, failure.value),
        now === null ? null : h(PlaygroundCard, { key: now.key, program: now.program, edited: remember }),
      ]);
    };
  },
});
