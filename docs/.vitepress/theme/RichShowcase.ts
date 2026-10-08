/// <reference lib="dom" />
/**
 * The landing page's hero: the showcase program
 * (examples/showcase/showcase.ts) running live under the hero's text and
 * buttons, before anything else on the page.
 *
 * It is the card with its code hidden (`OutputCard`), in a frame of the
 * hero's own. The card's live terminal decides when the program runs — while
 * it is on screen, and as one still frame for a reader who asked for reduced
 * motion — and which theme it wears. This decides only where it stands and
 * how large it is drawn (custom.css, `.rich-showcase`). It is loaded apart
 * from the card, which every page has: the example terminal it is sized by
 * brings that terminal's themes.
 */
import { defineComponent, h } from "vue";
import { EXAMPLE_TERMINAL } from "../example-terminal.js";
import { OutputCard } from "./RichExample.js";

const showcase = () => import("virtual:rich-live/showcase").then((module) => module.default);

export default defineComponent({
  name: "RichShowcase",
  setup: () => () =>
    h(
      "section",
      {
        class: "rich-showcase",
        "aria-label": "rich-js, running live",
        // The terminal the card runs its program in, for the stylesheet to size it by.
        style: { "--rich-example-columns": EXAMPLE_TERMINAL.columns, "--rich-example-rows": EXAMPLE_TERMINAL.rows },
      },
      [h(OutputCard, { program: showcase })],
    ),
});
