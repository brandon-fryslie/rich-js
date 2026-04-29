/**
 * rich-markup-plugins — a one-shot demo of MarkupRegistry tag plugins.
 *
 * Registers two custom tags — `[click]` (OSC 8 hyperlink) and `[badge]`
 * (styled inline pill) — and renders a few lines of markup that mix them
 * with built-in style tags. Demonstrates that plugin tags can wrap
 * already-parsed children, can carry attributes (including quoted values),
 * and compose naturally with the rest of the markup dialect.
 */

import {
  Console,
  MarkupRegistry,
  renderMarkup,
  RichText,
  Style,
  Group,
} from "../../src/index.js";
import type { Renderable } from "../../src/index.js";

// `ctx.children` is the already-parsed inner Renderable; `ctx.raw` is the raw
// markup string (still contains any tag syntax). Both demo handlers want the
// inner *visible* text only — the segments rendered from `children` are
// exactly that, with no tag noise. Walking those segments avoids re-parsing
// `raw` and avoids regex.
function plainTextOf(r: Renderable): string {
  let out = "";
  for (const s of r.render({ maxWidth: 1_000_000 })) {
    if (!s.isControl) out += s.text;
  }
  return out;
}

const consoleOut = new Console({ forceTerminal: true });

const registry = new MarkupRegistry();

// [click href=URL]inner[/click] -> OSC 8 hyperlink wrapping the inner content.
// Uses RichText's link style; terminals that support OSC 8 render it as a
// clickable link, others fall back to the underlying styled text.
registry.register("click", (ctx) => {
  const href = ctx.attrs["href"] ?? ctx.attrs["url"] ?? "";
  const linkStyle = new Style({ link: href, underline: true });
  // Collapse `ctx.children` to its plain text and wrap it in a single
  // link-styled RichText. Inner built-in spans (e.g. [bold] inside [click])
  // are intentionally flattened — preserving inner styling beneath an OSC 8
  // link would mean overlaying a link style on top of the children's spans
  // (a separate exercise).
  const richText = new RichText(plainTextOf(ctx.children), { end: "" });
  richText.stylize(linkStyle);
  return richText;
});

// [badge kind=warning|error|info|ok]label[/badge] -> a styled inline pill.
const BADGE_STYLES: Record<string, string> = {
  warning: "black on yellow",
  error: "white on red",
  info: "white on blue",
  ok: "white on green",
};
registry.register("badge", (ctx) => {
  const kind = ctx.attrs["kind"] ?? "info";
  const style = Style.parse(BADGE_STYLES[kind] ?? BADGE_STYLES["info"]!);
  return new RichText(` ${plainTextOf(ctx.children)} `, { style, end: "" });
});

function show(label: string, markup: string): void {
  consoleOut.print(new RichText(label, { style: Style.parse("bold") }));
  const rendered = renderMarkup(markup, { registry });
  // renderMarkup returns a Renderable (Group or RichText). Append a newline
  // so each demo line stays on its own row regardless of which it is.
  consoleOut.print(new Group(rendered, new RichText("")));
}

show(
  "[click] custom tag with attribute",
  `Open [click href="https://anthropic.com"]Anthropic[/click] in your browser.`,
);

show(
  "[badge] custom tag with kind=…",
  `Build status: [badge kind=ok]passing[/badge]  Deploy: [badge kind=warning]paused[/badge]  Tests: [badge kind=error]3 failures[/badge]`,
);

show(
  "Plugin + built-in tags compose",
  `[bold]Release notes[/bold]: [click href="https://example.com/changelog"]changelog[/click] — see [badge kind=info]v0.0.2[/badge] for [italic]new strip primitives[/italic].`,
);

show(
  "Nested plugin tags",
  `[click href="https://example.com"]read [badge kind=warning]beta[/badge] docs[/click]`,
);
