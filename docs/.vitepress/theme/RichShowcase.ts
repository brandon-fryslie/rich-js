/// <reference lib="dom" />
/**
 * The landing page's hero terminal: the showcase program
 * (examples/showcase/showcase.ts) running live under the hero's text and
 * buttons, before anything else on the page.
 *
 * It is a live example's terminal, `RichLive`, in a frame of the hero's own.
 * `RichLive` decides when the program runs — while it is on screen, and as one
 * still frame for a reader who asked for reduced motion — and which theme it
 * wears. This decides only where it stands and how large it is drawn
 * (custom.css, `.rich-showcase`).
 */
import { defineComponent, h } from "vue";
import { EXAMPLE_TERMINAL } from "../example-terminal.js";
import RichLive from "./RichLive.js";

export default defineComponent({
  name: "RichShowcase",
  setup: () => () =>
    h(
      "section",
      {
        class: "rich-showcase",
        "aria-label": "rich-js, running live",
        // The terminal RichLive runs its program in, for the stylesheet to size it by.
        style: { "--rich-example-columns": EXAMPLE_TERMINAL.columns, "--rich-example-rows": EXAMPLE_TERMINAL.rows },
      },
      [h(RichLive, { load: () => import("virtual:rich-live/showcase") })],
    ),
});
