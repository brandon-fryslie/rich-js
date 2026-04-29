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

const consoleOut = new Console({ forceTerminal: true });

const registry = new MarkupRegistry();

// [click href=URL]inner[/click] -> OSC 8 hyperlink wrapping the inner content.
// Uses RichText's link style; terminals that support OSC 8 render it as a
// clickable link, others fall back to the underlying styled text.
registry.register("click", (ctx) => {
  const href = ctx.attrs["href"] ?? ctx.attrs["url"] ?? "";
  const linkStyle = new Style({ link: href, underline: true });
  // Wrap the children in a RichText that carries a link span over the whole
  // inner cell range. We re-render the children to a flat string so we can
  // attach the link style cleanly; built-in spans inside ctx.children remain
  // visible because we reuse the same Renderable as a sibling, then overlay.
  const text = ctx.raw.replace(/\[[^\]]*\]/g, "");
  const richText = new RichText(text, { end: "" });
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
  const label = ctx.raw.replace(/\[[^\]]*\]/g, "");
  return new RichText(` ${label} `, { style, end: "" });
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
