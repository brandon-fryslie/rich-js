# Viewport

`Viewport` shows a fixed number of rows of a taller renderable, and scrolls through it. Its offset can never leave the content: it stops at the first line and at the last full view.

## Basic usage

```typescript
import { Console, Panel, RichText, Viewport } from "@promptctl/rich-js";

const console = new Console({ width: 32 });
const log = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");

const viewport = new Viewport(new RichText(log), { rows: 5 });
viewport.scrollTo(20);
console.print(new Panel(viewport));
```

```
╭──────────────────────────────╮
│ line 20                      │
│ line 21                      │
│ line 22                      │
│ line 23                      │
│ line 24                      │
╰──────────────────────────────╯
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
```

None of these moves anything straight away. The rows and the content's length are only known once the viewport renders, so each call is queued, and the next render resolves the calls in order, clamping after each one. `viewport.offset` is the first line the last render showed.

## Keeping a selection in view

`ensureVisible(start, end)` scrolls the least distance that shows lines `start` up to but not including `end`. They are lines of the content as it renders at the viewport's width: an item that wraps spans more than one, so a list whose items are its lines renders each without wrapping (`noWrap`). A range already in view does not move it. A range taller than the viewport shows its first line at the top.

```typescript
viewport.ensureVisible(selected, selected + 1);
```

The scroll position belongs to the viewport, not to its content. A view rebuilt every frame keeps one `Viewport` and replaces `content`:

```typescript
const viewport = new Viewport(renderList(state), { rows: 8 });

function frame(state: State) {
  viewport.content = renderList(state);
  viewport.ensureVisible(state.selected, state.selected + 1);
  return new Panel(viewport);
}
```

## Scrollbar

Pass `scrollbar` to draw one down the right edge. The content renders one cell narrower to make room for it.

```typescript
import { RichText, SCROLLBAR, Viewport } from "@promptctl/rich-js";

const viewport = new Viewport(new RichText(log), { rows: 5, scrollbar: SCROLLBAR });
```

The thumb's length is the share of the content in view, and its position is how far the view has scrolled. It touches the top when the first line is showing and the bottom at the last full view. When all the content fits, the thumb fills the track. The thumb is drawn from the offset the render resolves, so moves queued since the last render are already reflected.

`SCROLLBAR` draws a heavy line (`┃`) for the thumb on a light one (`│`) for the track, styled by the theme names `scrollbar.thumb` and `scrollbar.track`. A scrollbar is plain data, so any glyphs and styles will do. The gutter is as wide as the wider glyph:

```typescript
const blocks = {
  thumb: { glyph: "█", style: "cyan" },
  track: { glyph: "░", style: "grey37" },
};
new Viewport(new RichText(log), { rows: 10, scrollbar: blocks });
```

`npm run viewport` runs the selection example above, with a scrollbar, against a list of forty lines.
