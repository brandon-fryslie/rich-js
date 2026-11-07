/**
 * Probe sessions the identification tests replay. Until the recording ticket
 * (rich-control-codes-xh4n.6ch.xy8) captures them from the real terminals,
 * each answer is the shape its source documents, with a version picked to fit
 * it; `source` says which.
 */

import type { ProbeSession } from "./replay-host.js";

const XTVERSION = "\x1b[>0q";
const answer = (text: string): ReadonlyMap<string, string> => new Map([[XTVERSION, `\x1bP>|${text}\x1b\\`]]);
const DA1 = "\x1b[?62;22c";
const DOCUMENTED = "documented shape: yazi-emulator/src/brand.rs and vtdn.dev/docs/dcs/xtversion";

export const SESSIONS = {
  kitty: { source: DOCUMENTED, env: { TERM: "xterm-kitty" }, answers: answer("kitty(0.35.2)"), da1: DA1 },
  foot: { source: DOCUMENTED, env: { TERM: "foot" }, answers: answer("foot(1.16.2)"), da1: DA1 },
  wezterm: { source: DOCUMENTED, env: { TERM: "xterm-256color", TERM_PROGRAM: "WezTerm" }, answers: answer("WezTerm 20240203-110809-5046fc22"), da1: DA1 },
  iterm2: { source: DOCUMENTED, env: { TERM: "xterm-256color", TERM_PROGRAM: "iTerm.app" }, answers: answer("iTerm2 3.5.0"), da1: DA1 },
  ghostty: { source: DOCUMENTED, env: { TERM: "xterm-ghostty" }, answers: answer("ghostty 1.0.0"), da1: DA1 },
  // tmux answers XTVERSION for itself: tmux#5530 shows `tmux 3.7c` so answered in a pane.
  tmuxInIterm2: {
    source: "tmux's own answer, as tmux#5530 records it",
    env: { TERM: "tmux-256color", TERM_PROGRAM: "tmux", TMUX: "/tmp/tmux-501/default,1,0", LC_TERMINAL: "iTerm2" },
    answers: answer("tmux 3.7c"),
    da1: DA1,
  },
  // kitty started from a tmux pane inherits TMUX and TERM_PROGRAM=tmux.
  kittyFromTmux: { source: DOCUMENTED, env: { TERM: "xterm-kitty", TERM_PROGRAM: "tmux", TMUX: "/tmp/tmux-501/default,1,0" }, answers: answer("kitty(0.35.2)"), da1: DA1 },
  // VTE does not implement XTVERSION: DA1 alone.
  vte: { source: "a terminal without XTVERSION", env: { TERM: "xterm-256color", VTE_VERSION: "7600" }, answers: new Map(), da1: DA1 },
} satisfies Record<string, ProbeSession>;
