/**
 * A renderable handed no column is held (`render` in src/core/protocol.ts):
 * drawn, with what it drew dropped, and everything it draws reported held.
 * For every renderable a consumer can import, held, it reports the probes it
 * reports drawn at a generous width, in the order it draws them — so a widget
 * a container squeezes to nothing stays in the view and in focus order — and
 * it survives being drawn under one column at all, which nothing else asks of
 * it. Every exported renderable (test/seam/exported-renderables.ts) must have
 * a row in `ROWS`, so a renderable added without one fails here, by name.
 *
 * A row puts a probe in every slot that takes a renderable; a renderable that
 * draws only what it builds itself makes none.
 */

import { describe, expect, it } from "vitest";
import { exportedRenderables } from "../seam/exported-renderables.js";
import { render, type Presence, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { NULL_STYLE, type Style } from "../../src/core/style.js";
import type { StyledRenderable } from "../../src/core/strip.js";
import {
  Align,
  Animation,
  Columns,
  Constrain,
  DEFAULT_TERMINAL_THEME,
  Effected,
  GlyphEffected,
  Emoji,
  FlexStrip,
  FrameSequence,
  Frames,
  Group,
  JOINERS,
  JSONRenderable,
  Layout,
  ListView,
  Markdown,
  Padding,
  Panel,
  Pretty,
  Progress,
  ProgressBar,
  RichText,
  Rule,
  Spinner,
  Strip,
  Syntax,
  Table,
  Traceback,
  Tree,
  Viewport,
  type EffectFrame,
  type GlyphFrame,
} from "../../src/index.js";
import {
  Button,
  Checkbox,
  Dropdown,
  Slider,
  StaticItem,
  TextInput,
  Toggle,
} from "../../src/widgets/index.js";

/** One line of its own name, counting every render. */
class Probe implements StyledRenderable {
  renders = 0;
  constructor(readonly name: string) {}

  render(): Iterable<Segment> {
    this.renders += 1;
    return [new Segment(this.name), Segment.line()];
  }

  measure(): { minimum: number; maximum: number } {
    return { minimum: this.name.length, maximum: this.name.length };
  }

  edgeStyle(): Style {
    return NULL_STYLE;
  }
}

type Row = (probe: (name: string) => Probe) => Renderable;

const ROWS: Record<string, Row> = {
  // src/index.ts
  RichText: () => new RichText("plain"),
  Strip: (p) => new Strip([p("a"), p("b")], JOINERS.plain),
  Emoji: () => new Emoji("smile"),
  Pretty: () => new Pretty({ a: [1, "two"] }),
  JSONRenderable: () => JSONRenderable.fromData({ a: 1 }),
  Constrain: (p) => new Constrain(p("a"), 20),
  Effected: (p) => new Effected(p("a"), () => Animation.constant<EffectFrame>((c) => c), { key: "probe", theme: DEFAULT_TERMINAL_THEME }).at(0),
  GlyphEffected: (p) => new GlyphEffected(p("a"), () => Animation.constant<GlyphFrame>((cell) => cell.glyph), { key: "probe" }).at(0),
  Align: (p) => new Align(p("a")),
  Padding: (p) => new Padding(p("a"), 1),
  Viewport: (p) => new Viewport(p("a"), { rows: 2 }),
  ListView: (p) => new ListView(new Viewport(new RichText(""), { rows: 2 }), [p("a"), p("b")], 1),
  Rule: () => new Rule("title"),
  Panel: (p) => new Panel(p("a"), { title: "title", subtitle: "subtitle" }),
  Group: (p) => new Group(p("a"), p("b")),
  ProgressBar: () => new ProgressBar({ total: 10, completed: 5 }),
  Frames: () => new Frames(new FrameSequence([{ text: new RichText("a"), seconds: 1 }]), { t: 0 }),
  FrameSequence: () => new FrameSequence([{ text: new RichText("a"), seconds: 1 }]),
  Spinner: () => new Spinner("dots", "label"),
  // One column: a table handed no column seats one, as below.
  Table: (p) => {
    const table = new Table({ showFooter: true });
    table.addColumn(p("head-1"), { footer: p("foot-1") });
    table.addRow(p("cell-1-1"));
    table.addRow(p("cell-2-1"));
    return table;
  },
  Tree: (p) => {
    const tree = new Tree(p("root"));
    tree.add(p("first")).add(p("nested"));
    tree.add(p("last"));
    tree.add(p("collapsed"), { expanded: false }).add(p("unseen"));
    return tree;
  },
  Columns: (p) => new Columns([p("a"), p("b"), p("c")]),
  FlexStrip: (p) => new FlexStrip([p("a"), p("b")], { joiner: JOINERS.plain }),
  Progress: (p) => {
    const cells = new Map<number, Probe>();
    const progress = new Progress(
      { tableColumn: {}, render: (task) => cells.get(task.id) ?? cells.set(task.id, p(`task-${task.id}`)).get(task.id)! },
      { autoRefresh: false },
    );
    progress.addTask("one", { total: 10 });
    progress.addTask("two", { total: 10 });
    return progress;
  },
  Traceback: () => new Traceback(new Error("boom")),
  Syntax: () => new Syntax("const a = 1;", "typescript"),
  Markdown: () => new Markdown("- item\n\n> quote"),
  Layout: (p) => {
    const hidden = new Layout(p("hidden"));
    hidden.visible = false;
    const left = new Layout();
    left.splitColumn(new Layout(p("top")), new Layout(p("bottom")), hidden);
    const root = new Layout();
    root.splitRow(left, new Layout(p("right")));
    return root;
  },

  // src/widgets/index.ts
  StaticItem: (p) => new StaticItem({ id: "static", render: p("a") }),
  Button: () => new Button({ label: "press" }),
  Checkbox: () => new Checkbox({ label: "check" }),
  Toggle: () => new Toggle({ label: "toggle" }),
  TextInput: () => new TextInput({ value: "typed" }),
  Dropdown: () => new Dropdown({ options: ["one", "two"] }),
  Slider: () => new Slider({ value: 50 }),
};

/**
 * Containers in a configuration that changes what their `render` draws, held
 * to the same rule as their `ROWS` entry.
 */
const VARIANTS: Record<string, Row> = {
  "Table without its header": (p) => {
    const table = new Table({ showHeader: false });
    table.addColumn(p("head-1"));
    table.addRow(p("cell-1-1"));
    return table;
  },
  "Tree with its root hidden": (p) => {
    const tree = new Tree(p("root"), { hideRoot: true });
    tree.add(p("first"));
    return tree;
  },
};

/** Every report `render` makes for `renderable` at `maxWidth`. */
function reports(renderable: Renderable, maxWidth: number): [Renderable, Presence][] {
  const heard: [Renderable, Presence][] = [];
  const options: RenderOptions = { maxWidth, onPresent: (reported, presence) => heard.push([reported, presence]) };
  [...render(renderable, options)];
  return heard;
}

/** The probes a row makes, in the order it makes them, and what it makes. */
function build(row: Row): { renderable: Renderable; probes: Probe[] } {
  const probes: Probe[] = [];
  const renderable = row((name) => {
    const probe = new Probe(name);
    probes.push(probe);
    return probe;
  });
  return { renderable, probes };
}

const probesIn = (heard: [Renderable, Presence][]): string[] =>
  heard.flatMap(([reported]) => (reported instanceof Probe ? [reported.name] : []));

describe("a renderable handed no column", () => {
  it("has a row for every exported renderable, and none for a name no entry exports", () => {
    expect(Object.keys(ROWS).sort()).toEqual(exportedRenderables().map((cls) => cls.name).sort());
  });

  for (const [name, row] of [...Object.entries(ROWS), ...Object.entries(VARIANTS)]) {
    it(`${name} is held, and holds the probes it draws, in the order it draws them`, () => {
      const drawn = build(row);
      const held = build(row);
      const atWidth = reports(drawn.renderable, 40);
      expect(atWidth.every(([, presence]) => presence === "drawn")).toBe(true);

      const atNone = reports(held.renderable, 0);
      expect(atNone[0]).toEqual([held.renderable, "held"]);
      expect(probesIn(atNone)).toEqual(probesIn(atWidth));
      expect(atNone.every(([, presence]) => presence === "held")).toBe(true);
    });

    it(`${name}, with nothing listening, draws nothing`, () => {
      expect([...render(build(row).renderable, { maxWidth: 0 })]).toEqual([]);
    });
  }

  it("a Table holds its first column only: no divider fits, so the rest are dropped, as at any width too narrow for them", () => {
    const { renderable } = build((p) => {
      const table = new Table({ showFooter: true });
      table.addColumn(p("head-1"), { footer: p("foot-1") });
      table.addColumn(p("head-2"), { footer: p("foot-2") });
      table.addRow(p("cell-1-1"), p("cell-1-2"));
      return table;
    });
    expect(probesIn(reports(renderable, 0))).toEqual(["head-1", "cell-1-1", "foot-1"]);
  });
});
