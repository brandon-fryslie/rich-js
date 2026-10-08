/**
 * The one xterm.js the site loads: its version, and the integrity hash of each
 * file taken from jsDelivr. The demo shell's HTML and the docs' live terminal
 * both load from here, so the site cannot run two versions of it.
 *
 * [LAW:one-source-of-truth] A version bump is this file: the demo shell's
 * `__XTERM_*__` placeholders are filled from it by vite.config.demos.ts, and
 * the live terminal (docs/.vitepress/theme/live-terminal.ts) reads it
 * directly.
 */
export const XTERM = {
  script: {
    src: "https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0/lib/xterm.js",
    integrity: "sha384-f/1U6Z9wM4D71a5eRXEZnyOTMOvjqxr2XLwh+Go1OvIl3L3tOcvUrzudnhbECwl4",
  },
  stylesheet: {
    href: "https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0/css/xterm.css",
    integrity: "sha384-n2n7twoohnW+d3myBKaUgl7DSiwidw6MkQy9oesGzkPpMjejKRR3XlnD+5yCdtBD",
  },
} as const;
