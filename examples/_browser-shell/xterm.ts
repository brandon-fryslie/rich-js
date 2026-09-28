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
    src: "https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js",
    integrity: "sha384-/nfmYPUzWMS6v2atn8hbljz7NE0EI1iGx34lJaNzyVjWGDzMv+ciUZUeJpKA3Glc",
  },
  stylesheet: {
    href: "https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css",
    integrity: "sha384-LJcOxlx9IMbNXDqJ2axpfEQKkAYbFjJfhXexLfiRJhjDU81mzgkiQq8rkV0j6dVh",
  },
} as const;
