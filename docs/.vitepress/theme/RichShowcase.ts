/// <reference lib="dom" />
/**
 * The landing page's hero: the showcase program
 * (examples/showcase/showcase.ts) running live under the hero's text and
 * buttons, before anything else on the page.
 *
 * It is a docs card with its code hidden: the card's frame around a live
 * card's output, its live terminal (LiveScreen.ts), in a frame of the hero's
 * own. The terminal decides when the program runs — while it is on screen,
 * and as one still frame for a reader who asked for reduced motion — and which
 * theme it wears. This decides only where it stands and how large it is drawn
 * (custom.css, `.rich-showcase`).
 *
 * It is not built in RichExample.ts, which every page loads: there the live
 * terminal has to be fetched on its own, so the hero would stand empty a
 * moment before its terminal arrived. Loaded apart, it brings the terminal
 * with it, and the example terminal it is sized by, whose themes no other
 * page's first download should carry.
 */
import { defineComponent, h } from "vue";
import { EXAMPLE_TERMINAL } from "../example-terminal.js";
import LiveScreen from "./LiveScreen.js";

const showcase = () => import("virtual:rich-live/showcase").then((module) => ({ script: module.default, files: null }));

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
      [h("div", { class: "rich-example rich-example-card" }, [h("div", { class: "rich-example-output" }, [h(LiveScreen, { program: showcase, terminal: EXAMPLE_TERMINAL, contrast: "readable" })])])],
    ),
});
