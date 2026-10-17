/**
 * Writes examples/claude-sessions/staging/: the real Claude Code sessions the
 * demo's card opens on, trimmed to fit a card and scrubbed of the machine they
 * were recorded on.
 *
 * Run by hand, on the machine that holds the sessions (`node
 * scripts/stage-claude-sessions.ts`); its output is committed, so nothing else
 * reads `~/.claude`. `SESSIONS` is the owner's pick (ticket
 * rich-demos-k78j.3ok): a few sessions from each of the five most recently
 * worked projects, chosen for variety of length, human turns, failed tool
 * calls and subagent use.
 *
 * A session is kept as it was recorded — every record, in order, under its
 * real file name and modification time — but for three cuts, each applied to
 * every string in it, so no field is special-cased:
 * - a string past its `Keep` (`keepOf` says which) keeps its first lines and
 *   characters and says how much it lost;
 * - a thinking block's `signature`, opaque bytes no reader can use, is dropped;
 * - the machine is scrubbed out: the owner's home becomes `/home/demo`, their
 *   user name `demo`, every machine on their network `demo-host`, a Tailscale
 *   name `demo-host.tailnet.invalid` (RFC 2606), every private IPv4 address
 *   the documentation address 192.0.2.1 (RFC 5737), and email addresses and
 *   anything shaped like a credential are replaced.
 *
 * It is the one writer of the directory — the per-project modules and the
 * `projects.ts` that gathers them — so a re-run reproduces it whole.
 */
import { existsSync, readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { homedir, hostname, userInfo } from "node:os";
import path from "node:path";
import { isDrawnRecord, readRecord, type HiddenRecordType, type RawRecord } from "../examples/claude-sessions/data/parser.ts";
import { REPO_ROOT } from "./repo-facts.ts";

const SESSIONS: Readonly<Record<string, readonly string[]>> = {
  "cc-hands": ["343f2948", "72de8d71", "9cdac691"],
  "low-talker": ["89ff8d3c", "85ee29e4", "eb64e0f3"],
  "links-issue-tracker": ["fe6510c9", "2a3da176", "9cb4bcc8"],
  "rich-js": ["5c83db1d", "04aeda33", "8c79e4c7"],
  vhid: ["e6c996c1", "5744c4aa", "38b3f562"],
};

// With `SESSIONS`, tight enough that the staged tree fits the card's
// playground link, which MAX_LINK_CHARS (docs/.vitepress/playground-hash.ts)
// bounds: encodeProgram refuses a demo past it, in the docs build and in
// test/docs/demo-card.test.ts. Most of that is the records' ids, which do not compress,
// so the number of records weighs more than how much of each is kept.
// What the reader came to read — a turn's prose — keeps more than a tool's
// output, which is most of the weight and is only skimmed.
type Keep = { readonly lines: number; readonly chars: number };
const KEEP: Keep = { lines: 5, chars: 320 };
const KEEP_PROSE: Keep = { lines: 12, chars: 900 };

/**
 * What the viewer draws: the records it renders (data/parser.ts), the title
 * records its sidebar names a session by (data/scanner.ts), and, on each, the
 * fields it reads. Everything else in a record — the envelope repeated on
 * every line, the hook and skill listings in the `attachment` records that
 * are not a queued prompt, a tool's
 * result held a second time in `toolUseResult` — is weight the card cannot
 * carry and the reader never sees; of `toolUseResult` only the `agentId` a
 * subagent call is drilled into by is kept.
 */
const TITLE_TYPES = new Set<string>(["custom-title", "ai-title"] satisfies HiddenRecordType[]);
const SHOWN_FIELDS = new Set([
  "type", "uuid", "parentUuid", "timestamp", "message", "subtype", "content", "level",
  "isMeta", "isSidechain", "isApiErrorMessage", "durationMs", "error", "promptId", "slug", "customTitle", "aiTitle",
  "commandRun", "hookCount", "hookErrors", "preventedContinuation", "stopReason",
]);

/** A record as the viewer reads it: its shown fields, its message as `shownMessage` has it, a queued prompt's attachment, and its result's `agentId`. */
function shownRecord(record: Record<string, unknown>): Record<string, unknown> {
  const kept = Object.fromEntries(Object.entries(record).filter(([key]) => SHOWN_FIELDS.has(key)));
  const { message, attachment, toolUseResult } = record;
  const agentId = typeof toolUseResult === "object" && toolUseResult !== null ? (toolUseResult as { agentId?: unknown }).agentId : undefined;
  return {
    ...kept,
    ...(typeof message === "object" && message !== null ? { message: shownMessage(message as Record<string, unknown>) } : {}),
    ...(typeof attachment === "object" && attachment !== null ? { attachment: shownAttachment(attachment as Record<string, unknown>) } : {}),
    ...(typeof agentId === "string" ? { toolUseResult: { agentId } } : {}),
  };
}

/**
 * The records of a JSONL file the viewer shows, each re-parented onto its
 * nearest shown ancestor. Claude Code chains every record to the one before
 * it, the records staging drops included; a shown record whose parent was
 * dropped would name a record the card does not have.
 */
function shownRecords(text: string): Record<string, unknown>[] {
  const records = text.split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as Record<string, unknown>);
  const parentOf = new Map(records.flatMap((r) => (typeof r["uuid"] === "string" ? [[r["uuid"], typeof r["parentUuid"] === "string" ? r["parentUuid"] : null] as const] : [])));
  // The sidebar reads only the newest title record of each kind, and a renamed
  // session repeats its title on every turn; the older copies are dead weight.
  const lastOfType = new Map(records.flatMap((r, i) => (TITLE_TYPES.has(String(r["type"])) ? [[String(r["type"]), i] as const] : [])));
  const shown = records.filter((record, i) => {
    const type = String(record["type"]);
    return TITLE_TYPES.has(type) ? lastOfType.get(type) === i : isDrawnRecord(record);
  });
  const kept = new Set(shown.map((r) => r["uuid"]).filter((uuid): uuid is string => typeof uuid === "string"));
  const nearestKept = (uuid: string | null): string | null => {
    const seen = new Set<string>();
    let at = uuid;
    while (at !== null && !kept.has(at) && !seen.has(at)) {
      seen.add(at);
      at = parentOf.get(at) ?? null;
    }
    return at !== null && kept.has(at) ? at : null;
  };
  return shown.map((record) => {
    const staged = shownRecord(record);
    return "parentUuid" in staged ? { ...staged, parentUuid: nearestKept(typeof record["parentUuid"] === "string" ? record["parentUuid"] : null) } : staged;
  });
}

/** A message as the viewer reads it: who, which model, how it stopped, what it said, and its token counts. */
function shownMessage(message: Record<string, unknown>): Record<string, unknown> {
  const { id, role, model, stop_reason, content, usage } = message;
  const tokens = usage as { readonly input_tokens?: number; readonly output_tokens?: number } | undefined;
  return Object.fromEntries(
    Object.entries({ id, role, model, stop_reason, content, usage: tokens && { input_tokens: tokens.input_tokens, output_tokens: tokens.output_tokens } })
      .filter(([, v]) => v !== undefined),
  );
}

/** A queued prompt's attachment as the viewer reads it (data/parser.ts, readRecord): its kind, the prompt, and whether it is meta. */
function shownAttachment(attachment: Record<string, unknown>): Record<string, unknown> {
  const { type, prompt, isMeta } = attachment;
  return Object.fromEntries(Object.entries({ type, prompt, isMeta }).filter(([, v]) => v !== undefined));
}

const HOME = homedir();
const DEMO_HOME = "/home/demo";

// Shapes a secret is written in: provider-prefixed keys, bearer tokens, JWTs.
const CREDENTIALS = [
  /sk-ant-[A-Za-z0-9_-]{10,}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /npm_[A-Za-z0-9]{30,}/g,
  /xox[abprs]-[A-Za-z0-9-]{10,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /(Bearer\s+)[A-Za-z0-9._~+/-]{20,}=*/g,
];
// An address, but not the `git@host:owner/repo` an SSH remote is spelled with.
const EMAIL = /(?<![A-Za-z0-9._%+-])(?!git@)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// RFC 1918 private ranges, and RFC 6598's shared range a tailnet hands out.
const PRIVATE_IPV4 = /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01])|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7]))\.\d{1,3}\.\d{1,3}\b/g;
const USER = userInfo().username;
const word = (name: string) => new RegExp(`(?<![A-Za-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`, "g");

// A Tailscale MagicDNS name, `<host>.<tailnet>.ts.net`, and any name under it.
const MAGIC_DNS = /\b[\w-]+(?:\.[\w-]+)*\.ts\.net\b/g;

function scrub(text: string): string {
  let out = text.replaceAll(HOME, DEMO_HOME).replaceAll(HOME.replaceAll("/", "-"), DEMO_HOME.replaceAll("/", "-"));
  out = out.replace(PRIVATE_IPV4, "192.0.2.1");
  out = out.replace(MAGIC_DNS, "demo-host.tailnet.invalid");
  out = out.replace(EMAIL, "demo@example.com");
  for (const host of HOSTS) out = out.replace(word(host), "demo-host");
  out = out.replace(word(USER), "demo");
  for (const pattern of CREDENTIALS) out = out.replace(pattern, (_, bearer: unknown) => `${typeof bearer === "string" ? bearer : ""}[redacted]`);
  return out;
}

const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function trim(text: string, keep: Keep): string {
  // A trailing newline ends the last line; it does not start another.
  const lines = text.replace(/\n$/, "").split("\n");
  if (lines.length <= keep.lines && text.length <= keep.chars) return text;
  const kept = lines.slice(0, keep.lines).join("\n");
  // By grapheme, so a cut never splits what the reader sees as one character.
  const graphemes = Array.from(GRAPHEMES.segment(kept), (g) => g.segment);
  const cut = graphemes.slice(0, keep.chars).join("");
  if (cut === text || cut === text.replace(/\n$/, "")) return text;
  const lostLines = lines.length - Math.min(lines.length, keep.lines);
  const lostChars = Array.from(GRAPHEMES.segment(text)).length - graphemes.slice(0, keep.chars).length;
  const plural = (n: number, unit: string) => `${n} more ${unit}${n === 1 ? "" : "s"}`;
  return `${cut}\n… ${[plural(lostChars, "character"), ...(lostLines > 0 ? [plural(lostLines, "line")] : [])].join(", ")}`;
}

/**
 * The budget `value`'s strings get, given its container's: what a person or
 * the model said keeps `KEEP_PROSE`; output keeps `KEEP` — a tool's call and
 * result wherever they sit, a `system` or meta record, and a turn whose text is
 * harness output wrapped in a tag (`<bash-stdout>`, `<task-notification>`, …).
 */
function keepOf(record: Record<string, unknown>, inherited: Keep): Keep {
  const { type, isMeta, message } = readRecord(record as RawRecord);
  if (type === "tool_use" || type === "tool_result" || type === "system" || isMeta === true) return KEEP;
  const content = typeof message === "object" && message !== null ? (message as { content?: unknown }).content : undefined;
  return typeof content === "string" && content.startsWith("<") ? KEEP : inherited;
}

function stage(value: unknown, keep: Keep): unknown {
  if (typeof value === "string") return trim(scrub(value), keep);
  if (Array.isArray(value)) return value.map((v) => stage(v, keep));
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const thinking = record["type"] === "thinking";
    const inner = keepOf(record, keep);
    return Object.fromEntries(
      Object.entries(record).filter(([key]) => !(thinking && key === "signature")).map(([key, v]) => [scrub(key), stage(v, inner)]),
    );
  }
  return value;
}

/**
 * A JSONL file as the body of a `String.raw` template: one record a line, read
 * back byte for byte. A backtick would end the template and `${` would open a
 * substitution, so every backtick and `$` is written as its JSON escape
 * (`\u0060`, `\u0024`) — which a raw template keeps as written and
 * `JSON.parse` reads back as the character. Inside a JSON string, the only
 * place either can occur, the escape means the same thing.
 */
function rawTemplateBody(jsonl: string): string {
  return jsonl.replaceAll("`", "\\u0060").replaceAll("$", "\\u0024");
}

/**
 * Each picked session's file, read once, with the transcript of every
 * subagent it ran — what drilling into a subagent call opens, at
 * `<session>/subagents/agent-<id>.jsonl` beside it, as Claude Code keeps it.
 */
const SOURCES = Object.entries(SESSIONS).map(([project, ids]) => {
  const dir = path.join(HOME, ".claude/projects", `${HOME.replaceAll("/", "-")}-code-${project}`);
  const names = readdirSync(dir);
  return [project, ids.map((id) => {
    const matches = names.filter((name) => name.startsWith(id) && name.endsWith(".jsonl"));
    if (matches.length !== 1) throw new Error(`${dir}: expected one session starting ${id}, found ${matches.length}`);
    const file = path.join(dir, matches[0]!);
    const subagentDir = path.join(dir, matches[0]!.replace(/\.jsonl$/, ""), "subagents");
    const subagents = existsSync(subagentDir)
      ? readdirSync(subagentDir).filter((name) => /^agent-.*\.jsonl$/.test(name)).map((name) => ({ name, file: path.join(subagentDir, name), text: readFileSync(path.join(subagentDir, name), "utf-8") }))
      : [];
    return { id, name: matches[0]!, file, text: readFileSync(file, "utf-8"), subagents };
  })] as const;
});

/**
 * The machines on this owner's network, by name: this one, every LAN or
 * tailnet host their ssh config and known hosts name (mDNS `<name>.local`,
 * a MagicDNS label), and every `<name>.local` or MagicDNS name
 * the sessions reach — so no host is named in this file. A `.local` from the
 * sessions counts only in a host position: the host of `user@host` (a format
 * verb's `%s@host` is an address template, not a login), an argument of ssh,
 * scp, rsync, sftp, mosh or ping, or the host of a `host:path` remote; one
 * anywhere else — a file's `settings.local.json`, code's `binding.local` —
 * names no machine. A name of two letters is too common a word to scrub as
 * one. Each host is then scrubbed wherever it appears as a word, bare or with its `.local`.
 */
const HOST_POSITION = /(?:(?<![%\w.-])[A-Za-z_][\w.-]*@|\b(?:ssh|scp|rsync|sftp|mosh|ping)\s+(?:-\S+\s+)*|(?<![\w.$-])(?=[A-Za-z0-9-]+\.local:))([A-Za-z0-9-]+)\.local(?![\w-]|\.[A-Za-z0-9])/g;
const read = (file: string) => (existsSync(file) ? readFileSync(file, "utf-8") : "");
const SSH_NAMES = [
  ...[...read(path.join(HOME, ".ssh/config")).matchAll(/^\s*Host(?:Name)?\s+(.+)$/gim)].flatMap((m) => m[1]!.trim().split(/\s+/)),
  ...read(path.join(HOME, ".ssh/known_hosts")).split("\n").flatMap((line) => (line.startsWith("|") ? [] : (line.split(" ")[0] ?? "").split(","))),
].map((name) => name.replace(/^\[|\](:\d+)?$/g, ""));
/**
 * A name of a machine on the owner's own network, as its labels, or none: an
 * mDNS or MagicDNS name. A public name, an address or a pattern is not one,
 * and nor is a bare ssh alias — `runner`, `gpu` — which is as often an
 * English word as a machine, and scrubbing it would rewrite every sentence it
 * appears in.
 */
const ownMachine = (name: string): string[] => {
  if (/[*?]/.test(name) || /^[\d.:]+$/.test(name)) return [];
  if (/\.local$/.test(name)) return [name.replace(/\.local$/, "")];
  if (/\.ts\.net$/.test(name)) return name.split(".").slice(0, -2);
  return [];
};
const HOSTS = new Set(
  [
    `${hostname().replace(/\.local$/, "")}.local`,
    ...SSH_NAMES,
    ...SOURCES.flatMap(([, files]) => files.flatMap(({ text, subagents }) => [text, ...subagents.map((a) => a.text)].flatMap((t) => [
      ...[...t.matchAll(HOST_POSITION)].map((m) => `${m[1]!}.local`),
      ...[...t.matchAll(MAGIC_DNS)].map((m) => m[0]),
    ]))),
  ].flatMap(ownMachine).filter((name) => name.length > 2),
);
console.log(`hosts: ${HOSTS.size}`);

const out = path.join(REPO_ROOT, "examples/claude-sessions/staging");
// [LAW:one-source-of-truth] This script is the directory's one writer, so it
// clears it and writes every module in it, projects.ts included.
rmSync(out, { recursive: true, force: true });
mkdirSync(out);

/** A file of the staged tree, its records as the viewer reads them. */
const stagedFile = (file: string, text: string) => {
  const jsonl = shownRecords(text).map((record) => JSON.stringify(stage(record, KEEP_PROSE))).join("\n");
  return { mtime: statSync(file).mtime.toISOString(), jsonl };
};

const fileLiteral = (f: { readonly mtime: string; readonly jsonl: string }, indent: string) => `{
${indent}  kind: "file",
${indent}  mtime: new Date("${f.mtime}"),
${indent}  content: String.raw\`${rawTemplateBody(f.jsonl)}\`,
${indent}}`;

let total = "";
for (const [project, sessionsOf] of SOURCES) {
  const sessions = sessionsOf.map(({ id, name, file, text, subagents }) => {
    const session = stagedFile(file, text);
    // Only the subagents a staged call names: a run the session does not reach is weight.
    const named = subagents.filter((a) => session.jsonl.includes(`"agentId":"${a.name.replace(/^agent-|\.jsonl$/g, "")}"`)).map((a) => ({ name: a.name, ...stagedFile(a.file, a.text) }));
    for (const f of [session, ...named]) total += f.jsonl;
    console.log(`${project}/${id}: ${Math.round(Buffer.byteLength(session.jsonl) / 1024)} KB, ${named.length} subagents ${Math.round(named.reduce((n, a) => n + Buffer.byteLength(a.jsonl), 0) / 1024)} KB`);
    return { name, session, named };
  });
  const module = `/** ${project}: real sessions, trimmed and scrubbed by scripts/stage-claude-sessions.ts, which writes this file. */
import type { MemoryDirectory } from "../../_capabilities/memory-file-system.js";

export const PROJECT = "${DEMO_HOME.replaceAll("/", "-")}-code-${project}";

export const SESSIONS: MemoryDirectory = {
  kind: "directory",
  children: {
${sessions.map((s) => `    "${s.name}": ${fileLiteral(s.session, "    ")},${s.named.length === 0 ? "" : `
    "${s.name.replace(/\.jsonl$/, "")}": { kind: "directory", children: { subagents: { kind: "directory", children: {
${s.named.map((a) => `      "${a.name}": ${fileLiteral(a, "      ")},`).join("\n")}
    } } } },`}`).join("\n")}
  },
};
`;
  writeFileSync(path.join(out, `${project}.ts`), module);
}

const binding = (project: string) => project.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
const projects = Object.keys(SESSIONS);
writeFileSync(path.join(out, "projects.ts"), `/**
 * The \`~/.claude/projects/\` the card browses: real sessions from ${projects.length}
 * projects, one module each, written by scripts/stage-claude-sessions.ts.
 */
import type { MemoryTree } from "../../_capabilities/memory-file-system.js";
${projects.map((p) => `import * as ${binding(p)} from "./${p}.js";`).join("\n")}

export const STAGED_HOME: MemoryTree = {
  home: "${DEMO_HOME}",
  root: {
    kind: "directory",
    children: {
      ".claude": {
        kind: "directory",
        children: {
          projects: {
            kind: "directory",
            children: Object.fromEntries([${projects.map(binding).join(", ")}].map((p) => [p.PROJECT, p.SESSIONS])),
          },
        },
      },
    },
  },
};
`);

// Whether the card's link still fits is encodeProgram's to say, not an
// estimate here: test/docs/demo-card.test.ts encodes this card.
console.log(`total: ${Math.round(Buffer.byteLength(total) / 1024)} KB staged`);
