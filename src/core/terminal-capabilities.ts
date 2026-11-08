/**
 * What the library may send a terminal, decided from what it knows about that
 * terminal and what sits between: one pure decision, `pick`, that every
 * terminal feature is a row of. A feature lists its encodings best first; each
 * says which terminals read it, what a terminal without it does on receiving
 * it, and how each kind of intermediary treats it. `pick` takes the first an
 * evidence-weighed policy accepts and a route through every layer allows, or
 * falls back, and says why either way — so the send log can explain every byte,
 * and every byte not sent.
 *
 * Capabilities, not terminal names: a name is evidence toward an encoding, and
 * how strong that evidence is travels with it. Nothing here performs I/O; the
 * painter and the console write what `pick` returns.
 */

import { HIDES_TERMINAL_VERSION, type Intermediary, type TerminalIdentity, type TerminalName, type VersionAnswer } from "./terminal-identity.js";

/** The wire's escape and string terminator, for every encoder in this layer. */
export const ESC = "\x1b";
export const ST = `${ESC}\\`;
// screen's string buffer (`MAXSTR`, ansi.c), in bytes.
const SCREEN_STRING_MAX = 768;

/**
 * How a fact about the terminal is known, strongest first. `declared`: the
 * program stated it. `confirmed`: the terminal answered a probe for it.
 * `identified`: the terminal named itself and its version (XTVERSION).
 * `inferred`: the environment suggests it, which an inherited variable or ssh
 * can make wrong. `unknown`: nothing says either way.
 */
export type Evidence = "declared" | "confirmed" | "identified" | "inferred" | "unknown";

/**
 * What a terminal that lacks an encoding does on receiving it: `ignored`, as
 * any terminal does an OSC it does not know; `garbage`, drawn as text; or
 * `misread`, taken for a different request — bare OSC 9 is a notification, so
 * a terminal without OSC 9;4 progress raises one reading "4;1;50".
 */
export type Failure = "ignored" | "garbage" | "misread";

/**
 * Which evidence a program acts on. `strict`, the default, acts on what the
 * program declared or the terminal itself said. `bestGuess` also acts on the
 * environment's inference, for an encoding whose failure is `ignored` — never
 * for one that would draw garbage or be misread.
 */
export type TerminalPolicy = "strict" | "bestGuess";

// [LAW:single-enforcer] The one table of which evidence a policy acts on.
export function accepts(policy: TerminalPolicy, evidence: Evidence, failure: Failure): boolean {
  switch (evidence) {
    case "declared":
    case "confirmed":
    case "identified":
      return true;
    case "inferred":
      return policy === "bestGuess" && failure === "ignored";
    case "unknown":
      return false;
  }
}

/**
 * One program between this one and the terminal: a multiplexer, or an
 * editor's terminal. `evidence` is how it is known the layer is there at all;
 * `passthrough`, how it is known that the layer forwards a wrapped sequence
 * (tmux's `allow-passthrough`, off by default since 3.3).
 */
export interface Layer {
  readonly kind: Intermediary;
  readonly evidence: Evidence;
  readonly passthrough: Evidence;
}

/**
 * How a layer treats an encoding: `native`, it understands it and re-emits
 * it to its clients (tmux and OSC 8, titles); `passthrough`, it
 * reaches the terminal only wrapped; `impossible`, it does not reach it.
 */
export type Route = "native" | "passthrough" | "impossible";

/** What is known about the terminal, and how. */
export interface TerminalCapabilities {
  /** The terminal at the far end of every layer, and the evidence it is that one. */
  readonly terminal: { readonly name: TerminalName; readonly evidence: Evidence; readonly source: string };
  /** Encodings the program stated the terminal reads, whatever its name. */
  readonly declared: ReadonlySet<string>;
}

/** Everything `pick` decides from, held by a console and handed to each painter. */
export interface TerminalFeatures {
  readonly capabilities: TerminalCapabilities;
  readonly policy: TerminalPolicy;
  /** Between this program and the terminal, innermost first. */
  readonly layers: readonly Layer[];
  /** Every decision to send, or not, with its reason: the send log. */
  readonly onSend: ((send: TerminalSend) => void) | undefined;
}

/** A layer as a program states it, with no evidence: that it is there is the program's word. */
export type LayerDeclaration = Omit<Layer, "evidence">;

/**
 * What a program may state of its terminal features, each part it leaves out
 * the environment's. A layer given without evidence is held as `declared`;
 * one with evidence — a console's own `terminalFeatures`, handed back — keeps it.
 */
export type TerminalFeaturesOption = Partial<Omit<TerminalFeatures, "capabilities" | "layers">> & {
  readonly capabilities?: Partial<TerminalCapabilities>;
  readonly layers?: readonly (Layer | LayerDeclaration)[];
};

/** `layers` as a console holds them: a stated one is `declared`, one already weighed keeps its evidence. */
export function heldLayers(layers: readonly (Layer | LayerDeclaration)[]): readonly Layer[] {
  return layers.map((layer) => ("evidence" in layer ? layer : { ...layer, evidence: "declared" }));
}

/**
 * One decision the send log records: the bytes written, or `undefined` and
 * why not, and whether they cross a layer only inside its passthrough
 * envelope — which a tmux reattach forgets, so it must be sent again.
 */
export interface TerminalSend {
  readonly feature: string;
  readonly bytes: string | undefined;
  readonly reason: string;
  readonly wrapped: boolean;
}

/** A decision to write nothing, and why. */
export const notSent = (feature: string, reason: string): TerminalSend => ({ feature, bytes: undefined, reason, wrapped: false });

/**
 * One way to write a feature: a sequence, and what is known of who reads it —
 * the terminals known to, or `any`, for a sequence sent whatever the terminal
 * because one without it ignores it, which the type allows only then.
 */
export type Encoding<A> = EncodingShape<A> & (
  | { readonly terminals: readonly TerminalName[]; readonly failure: Failure }
  | { readonly terminals: "any"; readonly failure: "ignored" }
);

interface EncodingShape<A> {
  /** How the send log names it, and how a program declares it: `"OSC 9;4"`. */
  readonly name: string;
  readonly routes: Readonly<Record<Intermediary, Route>>;
  encode(value: A): string;
}

/** A thing a program asks of a terminal, and the encodings that ask it, best first. */
export interface TerminalFeature<A> {
  readonly name: string;
  readonly encodings: readonly Encoding<A>[];
}

/**
 * What the environment's `identity` says, all of it `inferred`: the terminal it names, and
 * each multiplexer as a layer whose passthrough nothing has confirmed.
 */
export function inferCapabilities(identity: TerminalIdentity): { capabilities: TerminalCapabilities; layers: readonly Layer[] } {
  const named = identity.namedBy;
  return {
    capabilities: {
      terminal: named === undefined
        ? { name: identity.terminal, evidence: "unknown", source: "no variable names the terminal" }
        : { name: identity.terminal, evidence: "inferred", source: named },
      declared: new Set(),
    },
    layers: identity.intermediary === undefined ? [] : [{ kind: identity.intermediary, evidence: "inferred", passthrough: "unknown" }],
  };
}

// How strongly each is known, strongest first.
const STRENGTH: Readonly<Record<Evidence, number>> = { declared: 0, confirmed: 1, identified: 2, inferred: 3, unknown: 4 };
// Whether `a` is known more strongly than `b`.
const stronger = (a: Evidence, b: Evidence): boolean => STRENGTH[a] < STRENGTH[b];

/**
 * What an answer to XTVERSION makes of `known`. Nothing known more strongly
 * than `identified` is replaced or dropped: what the program declared, or a
 * probe confirmed, outweighs a name. A terminal that answers is `identified`,
 * and an answer from it proves no layer that hides it
 * (`HIDES_TERMINAL_VERSION`) sits in front, so each such layer only inferred
 * is dropped. A multiplexer that answers is the innermost layer, once; the
 * terminal past it stays what was known, since its answer cannot be heard
 * through the multiplexer (tmux#5530: the reply arrives as keystrokes) —
 * unless the environment never saw that multiplexer, in which case the
 * terminal was read off the multiplexer's own `TERM`, which names none past
 * it, and is `other`.
 */
export function identifiedBy(answer: VersionAnswer, known: { capabilities: TerminalCapabilities; layers: readonly Layer[] }): { capabilities: TerminalCapabilities; layers: readonly Layer[] } {
  const source = `XTVERSION ${answer.text}`;
  const terminal = known.capabilities.terminal;
  const outweighs = (evidence: Evidence): boolean => stronger(evidence, "identified");
  if (answer.kind === "terminal") {
    return {
      capabilities: outweighs(terminal.evidence) ? known.capabilities : { ...known.capabilities, terminal: { name: answer.name, evidence: "identified", source } },
      layers: known.layers.filter((layer) => !HIDES_TERMINAL_VERSION.has(layer.kind) || outweighs(layer.evidence)),
    };
  }
  const existing = known.layers.find((layer) => layer.kind === answer.layer);
  // A layer known more strongly than an answer keeps the place it was known in.
  if (existing !== undefined && outweighs(existing.evidence)) return known;
  const answered: Layer = existing === undefined
    ? { kind: answer.layer, evidence: "identified", passthrough: "unknown" }
    : { ...existing, evidence: "identified" };
  const capabilities = existing === undefined && !outweighs(terminal.evidence)
    ? { ...known.capabilities, terminal: { name: "other" as const, evidence: "inferred" as const, source: `${source}: ${answer.layer} answered, and no variable names the terminal past it` } }
    : known.capabilities;
  return { capabilities, layers: [answered, ...known.layers.filter((layer) => layer !== existing)] };
}

/**
 * Capabilities a program states: the encodings, by name, its terminal reads,
 * and, only when it says so, which terminal that is. Stating an encoding says
 * nothing of the terminal's name, so a console keeps the one it inferred.
 */
export function declareCapabilities(encodings: Iterable<string>): Pick<TerminalCapabilities, "declared">;
export function declareCapabilities(encodings: Iterable<string>, terminal: TerminalName): TerminalCapabilities;
export function declareCapabilities(encodings: Iterable<string>, terminal?: TerminalName): Partial<TerminalCapabilities> {
  const declared = new Set(encodings);
  return terminal === undefined ? { declared } : { terminal: { name: terminal, evidence: "declared", source: "declared by the program" }, declared };
}

// What says the terminal reads `encoding`, and whether `policy` acts on it, in
// the send log's words. An `any` encoding needs no fact about the terminal:
// every policy acts on it, since one without it ignores it.
function supportOf(encoding: Encoding<unknown>, { terminal, declared }: TerminalCapabilities, policy: TerminalPolicy): { accepted: boolean; why: string } {
  const weighed = (evidence: Evidence, source: string) => ({ accepted: accepts(policy, evidence, encoding.failure), why: `${source} is ${evidence}, ${policy}` });
  if (declared.has(encoding.name)) return weighed("declared", "declared by the program");
  if (encoding.terminals === "any") return { accepted: true, why: "sent to any terminal, ignored where unread" };
  if (encoding.terminals.includes(terminal.name)) return weighed(terminal.evidence, terminal.source);
  return weighed("unknown", `whether ${terminal.name} reads it`);
}

/**
 * Through which layers `sequence` reaches the terminal: written as is, or the
 * reason it cannot. `passes` says which layer a passthrough may be trusted
 * through; a native layer needs no trust.
 */
export function route(sequence: string, encoding: Pick<Encoding<unknown>, "routes">, layers: readonly Layer[], passes: (layer: Layer) => boolean): { bytes: string; via: string } | { refused: string } {
  let bytes = sequence;
  const via: string[] = [];
  // The innermost layer reads the bytes first, so its envelope is the outermost:
  // wrap from the terminal's side inward.
  for (const layer of [...layers].reverse()) {
    const kind = encoding.routes[layer.kind];
    if (kind === "impossible") return { refused: `${layer.kind} does not pass it` };
    if (kind === "native") {
      // A layer re-emits the sequence it reads, not another layer's envelope.
      if (bytes !== sequence) return { refused: `${layer.kind} does not pass a wrapped sequence` };
      via.push(`${layer.kind} natively`);
      continue;
    }
    if (!passes(layer)) return { refused: `${layer.kind} passthrough is ${layer.passthrough}` };
    const wrapped = passthrough(bytes, layer.kind);
    if (typeof wrapped !== "string") return wrapped;
    bytes = wrapped;
    via.push(`${layer.kind} passthrough`);
  }
  return { bytes, via: via.length === 0 ? "" : ` through ${[...via].reverse().join(", ")}` };
}

// tmux's DCS passthrough with every ESC doubled; screen's bare DCS, ending in
// BEL since screen ends its DCS at the first ST, and refused when it is longer
// than screen holds, which would leave the terminal in an unended OSC.
function passthrough(sequence: string, kind: Intermediary): string | { refused: string } {
  switch (kind) {
    case "tmux":
      return `${ESC}Ptmux;${sequence.replaceAll(ESC, ESC + ESC)}${ST}`;
    case "screen": {
      // An envelope ends in its own ST, which screen would end at or turn to BEL.
      if (sequence.startsWith(`${ESC}P`)) return { refused: "screen cannot carry another layer's passthrough" };
      const inner = sequence.replaceAll(ST, "\x07");
      const length = byteLength(inner);
      return length > SCREEN_STRING_MAX ? { refused: `through screen: ${length} bytes > ${SCREEN_STRING_MAX}` } : `${ESC}P${inner}${ST}`;
    }
    case "zellij":
    case "editor":
      return { refused: `${kind} has no passthrough` };
  }
}

const UTF8 = new TextEncoder();
/** `text` as UTF-8 bytes, the one encoder this layer measures and encodes with. */
export const utf8 = (text: string): Uint8Array => UTF8.encode(text);
const byteLength = (text: string): number => utf8(text).length;

/**
 * `value` written in the best encoding of `feature` that `features` lets
 * through, or no bytes; the reason is the send log's either way. Pure.
 */
export function pick<A>(feature: TerminalFeature<A>, value: A, features: Pick<TerminalFeatures, "capabilities" | "policy" | "layers">): TerminalSend {
  const { capabilities, policy, layers } = features;
  const refusals: string[] = [];
  for (const encoding of feature.encodings) {
    const support = supportOf(encoding, capabilities, policy);
    if (!support.accepted) {
      refusals.push(`${encoding.name} ${encoding.failure} where unsupported; ${support.why}`);
      continue;
    }
    // A closed passthrough drops the envelope (tmux's `allow-passthrough off`):
    // that miss is `ignored`, whatever the terminal would make of the sequence.
    const sequence = encoding.encode(value);
    const routed = route(sequence, encoding, layers, (layer) => accepts(policy, layer.passthrough, "ignored"));
    if ("refused" in routed) {
      refusals.push(`${encoding.name}: ${routed.refused}`);
      continue;
    }
    return { feature: feature.name, bytes: routed.bytes, reason: `${encoding.name}${routed.via}: ${support.why}`, wrapped: routed.bytes !== sequence };
  }
  return notSent(feature.name, `fallback: ${refusals.join("; ")}`);
}
