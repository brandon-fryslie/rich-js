/**
 * The terminal asked who it is, with XTVERSION (`CSI > 0 q`): the answer
 * raises what the environment inferred to `identified`, the evidence a
 * `strict` policy acts on.
 *
 * Only the nearest program that answers is heard. Under tmux or zellij that
 * is the multiplexer itself, and the terminal past it cannot be asked: a
 * passthrough-wrapped query reaches it, but tmux takes the reply for one of
 * its own and hands its body to the pane as keystrokes (tmux#5530), so no
 * wrapped probe is sent. What lies past a multiplexer stays what the
 * environment infers, or what the program declares.
 *
 * [LAW:effects-at-boundaries] The ask is `App`'s; what the answer means is
 * `readVersionAnswer` and `identifiedBy`, which stay pure.
 */

import { identifiedBy, type Layer, type TerminalFeatures } from "../core/terminal-capabilities.js";
import { readVersionAnswer, readsVersionQuery } from "../core/terminal-identity.js";
import type { App } from "./app.js";

const XTVERSION = "\x1b[>0q";
// The answer is a DCS whose body begins `>|`.
const ANSWER_PREFIX = ">|";

const sameLayers = (a: readonly Layer[], b: readonly Layer[]): boolean =>
  a.length === b.length && a.every((layer, i) => layer.kind === b[i]!.kind && layer.evidence === b[i]!.evidence && layer.passthrough === b[i]!.passthrough);

/**
 * Ask the terminal `app` runs on who it is, and return `app`'s terminal
 * features with the answer weighed in, to set as `app.terminalFeatures`.
 * `undefined` when it learned nothing: the terminal did not implement
 * XTVERSION, named itself off the table `readVersionAnswer` reads, or said
 * what was already known — or is a VTE old enough to draw the query as text,
 * which is not asked at all.
 */
export async function askTerminalIdentity(app: App): Promise<TerminalFeatures | undefined> {
  if (!readsVersionQuery(app.terminalIdentity)) return undefined;
  const { replies } = await app.ask([XTVERSION]);
  const body = replies.find((reply) => reply.kind === "dcs" && reply.body.startsWith(ANSWER_PREFIX))?.body;
  const answer = body === undefined ? undefined : readVersionAnswer(body.slice(ANSWER_PREFIX.length));
  if (answer === undefined) return undefined;
  const features = app.terminalFeatures;
  const learned = identifiedBy(answer, features);
  const was = features.capabilities.terminal;
  const now = learned.capabilities.terminal;
  if (now.name === was.name && now.evidence === was.evidence && sameLayers(learned.layers, features.layers)) return undefined;
  return { ...features, ...learned };
}
