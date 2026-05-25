/**
 * rich-markup-plugins demo body — MarkupRegistry tag plugins demonstration.
 * [LAW:dataflow-not-control-flow] runs against any TerminalHost.
 */

import {
  Console,
  MarkupRegistry,
  renderMarkup,
  RichText,
  Style,
  hostStream,
  type TerminalHost,
} from "../../src/index.js";

export interface DemoHandle {
  stop(): void;
}

export function runDemo(host: TerminalHost): DemoHandle {
  const { cols } = host.size();
  const consoleOut = new Console({
    forceTerminal: true,
    file: hostStream(host),
    width: cols,
  });

  const registry = new MarkupRegistry();

  registry.register("click", (ctx) => {
    const href = ctx.attrs["href"] ?? ctx.attrs["url"] ?? "";
    const out = new RichText("", { end: "" }).append(ctx.children);
    out.stylize(new Style({ link: href, underline: true }));
    return out;
  });

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

  const show = (label: string, markup: string): void => {
    consoleOut.print(new RichText(label, { style: Style.parse("bold") }));
    consoleOut.print(renderMarkup(markup, { registry }));
    consoleOut.print(new RichText(""));
  };

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

  return { stop(): void { /* one-shot */ } };
}
