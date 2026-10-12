/**
 * rich-markup-plugins: markup tags you register yourself, each line of markup
 * printed dim above what it draws.
 *
 * The entry for `npm run markup-plugins` and for the demo's card on the docs
 * site alike. Edit a sample or a handler and the card draws it again.
 */
import { Console, MarkupRegistry, globalMarkupRegistry, renderMarkup, RichText, Style } from "@promptctl/rich-js";

const console = new Console();

/** `markup` as written, then `drawn`, what it became. */
function show(markup: string, drawn: RichText | string): void {
  console.print(new RichText(markup, { style: "dim" }));
  console.print(drawn);
  console.print();
}

// A registry of your own scopes its tags to the calls that are handed it.
const tags = new MarkupRegistry();

// A handler gets the opening tag's attributes as strings, and the markup
// between the tags already parsed into `children`.
tags.register("click", ({ attrs, children }) => {
  const link = new RichText("", { end: "" }).append(children);
  link.stylize(new Style({ link: attrs["href"] ?? "", underline: true }));
  return link;
});

const badgeStyles: Record<string, string> = {
  ok: "white on green",
  warning: "black on yellow",
  error: "white on red",
};
tags.register("badge", ({ attrs, children }) => {
  const badge = new RichText(" ", { end: "" }).append(children).append(" ");
  badge.stylize(badgeStyles[attrs["kind"] ?? "ok"] ?? "white on blue");
  return badge;
});

const samples = [
  `Open [click href="https://example.com"]the docs[/click] in your browser.`,
  `[badge kind=ok]build[/badge] [badge kind=error]tests[/badge]`,
  `[bold]Release[/bold] [badge kind=info]v1.2[/badge] is [italic]out[/italic].`,
  `[click href=https://example.com]see the [badge]beta[/badge][/click]`,
];
for (const markup of samples) show(markup, renderMarkup(markup, { registry: tags }));

// A tag on `globalMarkupRegistry` resolves wherever markup is read without a
// registry of its own: `renderMarkup` with no options, and a string handed
// straight to `print`.
globalMarkupRegistry.register("shout", ({ children }) => {
  const shout = new RichText(children.plain.toUpperCase(), { end: "" });
  shout.stylize("bold yellow");
  return shout;
});
try {
  const viaRender = "renderMarkup, no registry: [shout]still resolves[/shout]";
  show(viaRender, renderMarkup(viaRender));
  const viaPrint = "a bare string to print: [shout]resolves too[/shout]";
  show(viaPrint, viaPrint);
} finally {
  // The global registry outlives this program, so take back what it added.
  globalMarkupRegistry.unregister("shout");
}
