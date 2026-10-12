/**
 * The one xterm.js the site loads: its version, and the integrity hash of each
 * file taken from jsDelivr. The live terminal (live-terminal.ts) loads it from
 * here, and the landing e2e spec checks the page against it.
 *
 * [LAW:one-source-of-truth] A version bump is this file.
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
