/**
 * rich-markup-plugins — a one-shot demo of MarkupRegistry tag plugins.
 *
 * Registers two custom tags — `[click]` (OSC 8 hyperlink) and `[badge]`
 * (styled inline pill) — and renders a few lines of markup that mix them
 * with built-in style tags. Handlers return `RichText`, the parser returns
 * `RichText`; same shape every time, no Group, no type narrowing.
 */

import {
  Console,
  MarkupRegistry,
  renderMarkup,
  RichText,
  Style,
} from "../../src/index.js";

const consoleOut = new Console({ forceTerminal: true });

const registry = new MarkupRegistry();

// [click href=URL]inner[/click] -> OSC 8 hyperlink wrapping the inner content.
// `ctx.children` already carries any built-in spans inside the tag (e.g.
// nested [bold]); we layer a link+underline span over the whole range so the
// inner styling stays visible underneath the hyperlink.
registry.register("click", (ctx) => {
  const href = ctx.attrs["href"] ?? ctx.attrs["url"] ?? "";
  const out = new RichText("", { end: "" }).append(ctx.children);
  out.stylize(new Style({ link: href, underline: true }));
  return out;
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
  const out = new RichText(" ", { end: "" }).append(ctx.children).append(" ");
  out.stylize(style);
  return out;
});

function show(label: string, markup: string): void {
  consoleOut.print(new RichText(label, { style: Style.parse("bold") }));
  consoleOut.print(renderMarkup(markup, { registry }));
  consoleOut.print(new RichText(""));
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
