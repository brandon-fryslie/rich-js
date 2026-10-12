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
// between the tags already parsed into `children`. A handler that throws
// fails the whole render, so a mistyped tag is loud rather than quietly plain.
tags.register("click", ({ attrs, children }) => {
  const href = attrs["href"];
  if (href === undefined) throw new Error(`[click] needs href=`);
  const link = new RichText("", { end: "" }).append(children);
  link.stylize(new Style({ link: href, underline: true }));
  return link;
});

const badgeStyles: Record<string, string> = {
  ok: "white on green",
  warn: "black on yellow",
  error: "white on red",
  info: "white on blue",
};
tags.register("badge", ({ attrs, children }) => {
  const badge = new RichText(" ", { end: "" }).append(children).append(" ");
  const kind = attrs["kind"] ?? "";
  const style = badgeStyles[kind];
  if (style === undefined) throw new Error(`[badge] kind="${kind}" is none of ${Object.keys(badgeStyles).join(", ")}`);
  badge.stylize(style);
  return badge;
});

const samples = [
  `Open [click href="https://example.com"]the docs[/click] in your browser.`,
  `[badge kind=ok]build[/badge] [badge kind=error]tests[/badge]`,
  `[bold]v1.2[/bold] [badge kind=info]new[/badge] is [italic]out[/italic].`,
  `[click href=https://example.com]see [badge kind=warn]beta[/badge][/click]`,
];
for (const markup of samples) show(markup, renderMarkup(markup, { registry: tags }));

// A tag on `globalMarkupRegistry` resolves wherever markup is read without a
// registry of its own: `renderMarkup` with no options, and a string handed
// straight to `print`.
const before = globalMarkupRegistry.get("shout");
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
  // The global registry outlives this program, so leave it as it was found.
  if (before === undefined) globalMarkupRegistry.unregister("shout");
  else globalMarkupRegistry.register("shout", before);
}
