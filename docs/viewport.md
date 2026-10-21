---
exampleContext: |
  type State = { readonly items: readonly string[]; readonly selected: number };
  const selected = 30;
  const renderList = (state: State) =>
    renderMarkup(state.items.map((item, i) => (i === state.selected ? `[reverse bold]${item}[/]` : item)).join("\n"));
  const state: State = { items: Array.from({ length: 40 }, (_, i) => `task ${i}`), selected: 12 };
---

# Viewport

`Viewport` shows a fixed number of rows of a taller renderable, and scrolls through it. Its offset can never leave the content: it stops at the first line and at the last full view.

## Basic usage

```typescript
import { Console, Panel, Viewport, renderMarkup } from "@promptctl/rich-js";

const console = new Console({ width: 32 });
const levels = ["[green]INFO[/]", "[green]INFO[/]", "[yellow]WARN[/]", "[green]INFO[/]", "[red]FAIL[/]"];
const log = Array.from({ length: 50 }, (_, i) => `[dim]${String(i).padStart(2, "0")}[/] ${levels[i % 5]} line ${i}`).join("\n");

const viewport = new Viewport(renderMarkup(log), { rows: 5 });
viewport.scrollTo(20);
console.print(new Panel(viewport, { title: "log", borderStyle: "cyan" }));
```

## How many rows it shows

A viewport given a region — a `Layout` pane, or a full-screen `Live` frame — fills it, and its `rows` option is ignored. Otherwise it shows its `rows`, or the content's full length when `rows` is absent, capped by the terminal's height. Content shorter than a viewport is padded with blank rows.

The content always renders with no height limit, at the width the viewport was given. The number of lines it wraps to is how far the viewport can scroll.

Every row is exactly that width: content that ignores its width is cropped at the viewport's edge, and shorter rows are padded out to it.

## Scrolling

```typescript
viewport.scrollTo(0);     // the first line at the top
viewport.scrollBy(3);     // three lines down
viewport.scrollBy(-1);    // one line up

console.print(new Panel(viewport, { title: "log", borderStyle: "cyan" }));
```

The panel shows lines 2 to 6: the three calls resolve in order when it renders.

None of these moves anything straight away. The rows and the content's length are only known once the viewport renders, so each call is queued, and the next render resolves the calls in order, clamping after each one. `viewport.offset` is the first line the last frame showed. A render changes nothing, so the viewport keeps what its render resolved only once the frame it was drawn in has been drawn whole; a measurement keeps nothing.

In a [`WidgetApp`](/widgets), the mouse wheel scrolls a viewport with no code of yours. Each notch moves the innermost viewport under the pointer by one line, however deep in the view it sits and whatever widget it shows under the pointer, and the app paints the result. A viewport that cannot move that way — its content fits, or it is already at that end — passes the notch to the viewport around it, and the outermost one passes it out of the app: in the docs' cards, the page scrolls.

## Keeping a selection in view

`ensureVisible(start, end)` scrolls the least distance that shows lines `start` up to but not including `end`. They are lines of the content as it renders at the viewport's width less any scrollbar, which `contentWidth(width)` reports: an item that wraps spans more than one, so a list whose items are its lines renders each without wrapping (`noWrap`). A range already in view does not move it. A range taller than the viewport shows its first line at the top.

```typescript
viewport.ensureVisible(selected, selected + 1);
console.print(new Panel(viewport, { title: `line ${selected} in view`, borderStyle: "cyan" }));
```

The scroll position belongs to the viewport, not to its content. A view rebuilt every frame keeps one `Viewport` and draws the content it builds through it with `viewport.showing(content)`. It brings the selection into view when the selection moves, not in every frame — called in every frame, `ensureVisible` would undo each scroll the mouse wheel queues on the very render that applies it:

```typescript
const viewport = new Viewport(new RichText(""), { rows: 8 });

function select(state: State, selected: number): State {
  viewport.ensureVisible(selected, selected + 1);
  return { ...state, selected };
}

function frame(state: State) {
  return new Panel(viewport.showing(renderList(state)));
}

const next = select(state, state.selected + 1);

console.print(frame(next));
```

`showing` draws its content whole to learn how long it is. Content too long to draw whole every frame, such as a textarea's rows, can be shown as `Lines` with `viewport.showingLines(lines, follow)` instead. Laid out at a width, it reports its length and draws only the lines the frame shows, so a frame costs the rows in view rather than the content's length.

## A list kept in view

`ListView` draws items stacked down a viewport you hand it, and keeps the selected one in view. An item may wrap to any number of lines: the list draws them at the viewport's content width, so it knows which lines the selection covers. `gap` puts blank lines between items, and `context` keeps that many lines above and below the selection in view too, so the next item shows before the cursor reaches it. It shows them with `viewport.showing(lines, { start, end })`, which follows the selection's lines: it calls `ensureVisible` only when the range differs from the one the last frame followed — so the list can be rebuilt every frame, and the wheel still scrolls away from the selection until it moves. A followed range is the per-frame form of the pattern above, for any view rebuilt every frame: pass the selection's lines to `showing` each frame instead of calling `ensureVisible` on select. A followed range that was in view stays in view when the viewport's rows change; one the wheel scrolled away from stays where the wheel left it.

`moveSelection(index, delta, length)` is the cursor: `index + delta` held to the list's ends, with `-Infinity` and `Infinity` naming the first and the last item. When nothing moves it returns `index` itself, so `next === index` tells a reducer it has nothing to change.

```typescript
import { ListView, moveSelection } from "@promptctl/rich-js";

const notes = Array.from({ length: 12 }, (_, i) =>
  renderMarkup(`[bold]note ${i}[/] ${"a longer body that wraps ".repeat(1 + (i % 3))}`),
);
const list = new Viewport(new RichText(""), { rows: 6, scrollbar: SCROLLBAR });
const cursor = moveSelection(0, 7, notes.length);

console.print(new Panel(new ListView(list, notes, cursor, { gap: 1, context: 1 }), { title: `note ${cursor}` }));
```

A pane whose subject changes — the file a preview shows, the session a reader has open — wants a fresh scroll position for each subject and the same one while it holds. `ViewportPerKey` is that: `of(key)` returns the viewport it holds while `key` is unchanged, and a new one, made with the options it was given, for a new key.

```typescript
import { ViewportPerKey } from "@promptctl/rich-js";

const previews = new ViewportPerKey({ rows: 4 });
previews.of("README.md").scrollTo(10);
console.print(new Panel(previews.of("README.md").showing(renderMarkup(log)), { title: "README.md" }));
```

## Scrollbar

Pass `scrollbar` to draw one down the right edge. The content renders narrower by the scrollbar's gutter, one cell for `SCROLLBAR`. A viewport no wider than its gutter draws only the scrollbar. Its content has no column and is not drawn, so the viewport keeps the content's length from the last render that drew it, and the offset and thumb stay where they were. A scroll asked for in the meantime takes effect at the next render that draws the content.

```typescript
import { SCROLLBAR, Viewport } from "@promptctl/rich-js";

const viewport = new Viewport(renderMarkup(log), { rows: 5, scrollbar: SCROLLBAR });
viewport.scrollTo(20);
console.print(new Panel(viewport, { title: "log", borderStyle: "cyan" }));
```

The thumb's length is the share of the content in view, and its position is how far the view has scrolled. A gap above or below the thumb always means there is more content in that direction. Wherever the track has room, the thumb also stays off an end until the view reaches it. When all the content fits, the thumb fills the track. The thumb is drawn from the offset the render resolves, so moves queued since the last render are already reflected.

`SCROLLBAR` draws a heavy line (`┃`) for the thumb on a light one (`│`) for the track, styled by the theme names `scrollbar.thumb` and `scrollbar.track`. A scrollbar is plain data, so any glyphs and styles will do. The gutter is as wide as the wider glyph:

```typescript
const blocks = {
  thumb: { glyph: "█", style: "cyan" },
  track: { glyph: "░", style: "grey37" },
};
const blocky = new Viewport(renderMarkup(log), { rows: 5, scrollbar: blocks });
blocky.scrollTo(40);
console.print(new Panel(blocky, { title: "log", borderStyle: "cyan" }));
```

`npm run viewport` is the selection example above in a `WidgetApp`, with a scrollbar, against a list of forty lines: the keys move the selection, and the wheel scrolls the window away from it until the next key brings it back. The [demo page](/demos/rich-viewport) runs the same program in the browser.
