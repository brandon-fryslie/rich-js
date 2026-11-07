/**
 * What a destination draws of a style beyond the codes every terminal reads:
 * kitty's underline kinds (`4:3`–`4:5`) and underline color (`58`). These are
 * drawing, so unlike a terminal request they are not sent once: every run that
 * carries one is encoded by `segmentsToString` (`./render.ts`), the one wire
 * writer. What a console decides once, through `pick`, is whether its
 * destination draws them, held on its `OutputTarget` as `UnderlineSupport`;
 * a kind it does not draw is written as a plain underline, and a color it does
 * not is left out.
 *
 * A terminal that does not read the colon form takes `4:3` for `4;3` and draws
 * italic, so a miss is `misread` and only evidence the policy trusts turns
 * either on. tmux and zellij parse both and re-emit them to each client as
 * that client draws them — tmux through its own `usstyle` feature, falling
 * back to a plain underline — so they cross both natively. screen and an
 * editor's terminal pass on what they do not parse as nothing a policy can
 * count on.
 */

import type { UnderlineSupport } from "./color.js";
import { pick, type Failure, type TerminalFeature, type TerminalFeatures, type TerminalSend } from "./terminal-capabilities.js";
import type { TerminalName } from "./terminal-identity.js";
import { UNDERLINE } from "./style.js";

const CSI = "\x1b[";

const PARSED = { tmux: "native", screen: "impossible", zellij: "native", editor: "impossible" } as const;

// kitty's colon underline: kitty, WezTerm, foot, Ghostty, Alacritty (0.12),
// iTerm2 (3.5) and VTE (0.52) read both.
const READERS: { readonly terminals: readonly TerminalName[]; readonly failure: Failure } = {
  terminals: ["kitty", "wezterm", "foot", "ghostty", "alacritty", "iterm2", "vte"],
  failure: "misread",
};

/** SGR `4:3`–`4:5`: a curly, dotted or dashed underline. */
export const UNDERLINE_STYLE: TerminalFeature<void> = {
  name: "underline style",
  encodings: [{ name: "SGR 4:n", ...READERS, routes: PARSED, encode: () => `${CSI}${UNDERLINE.curly.sgr}m` }],
};

/** SGR 58: an underline's own color. */
export const UNDERLINE_COLOR: TerminalFeature<void> = {
  name: "underline color",
  encodings: [{ name: "SGR 58", ...READERS, routes: PARSED, encode: () => `${CSI}58:5:1m` }],
};

/**
 * What `features` lets a destination draw of an underline, each decision
 * handed to `log` with its reason.
 */
export function underlineSupport(features: Pick<TerminalFeatures, "capabilities" | "policy" | "layers">, log: (send: TerminalSend) => void): UnderlineSupport {
  const decided = (feature: TerminalFeature<void>): boolean => {
    const send = pick(feature, undefined, features);
    log(send);
    return send.bytes !== undefined;
  };
  return { styles: decided(UNDERLINE_STYLE), color: decided(UNDERLINE_COLOR) };
}
