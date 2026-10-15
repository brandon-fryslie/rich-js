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
 * - a string longer than `KEEP_LINES` lines keeps its first `KEEP_LINES` and
 *   says how many it lost; one longer than `KEEP_CHARS` is cut the same way;
 * - a thinking block's `signature`, opaque bytes no reader can use, is dropped;
 * - the machine is scrubbed out: the owner's home becomes `/home/demo`, their
 *   user name `demo`, the host's name `demo-host`, every private IPv4 address
 *   the documentation address 192.0.2.1 (RFC 5737), and email addresses and
 *   anything shaped like a credential are replaced.
 *
 * It is the one writer of the directory — the per-project modules and the
 * `projects.ts` that gathers them — so a re-run reproduces it whole.
 */
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { homedir, hostname, userInfo } from "node:os";
import path from "node:path";
import { REPO_ROOT } from "./repo-facts.ts";

const SESSIONS: Readonly<Record<string, readonly string[]>> = {
  "cc-hands": ["343f2948", "72de8d71", "50be1d48", "bf68ecda", "9cdac691"],
  "low-talker": ["89ff8d3c", "344d3433", "85ee29e4", "eb64e0f3"],
  "links-issue-tracker": ["fe6510c9", "2a3da176", "fe5b78a8", "9cb4bcc8"],
  "rich-js": ["5c83db1d", "04aeda33", "de7a7dc9", "8c79e4c7"],
  vhid: ["e6c996c1", "08b61075", "5744c4aa", "38b3f562"],
};

// Tight enough that the 21 sessions weigh ~2.5 MB together. What a card can
// carry is MAX_PROGRAM_BYTES (docs/.vitepress/playground-hash.ts), and the
// docs build refuses a demo past it.
const KEEP_LINES = 20;
const KEEP_CHARS = 1500;

/**
 * What the viewer draws: the records it renders (data/parser.ts), the title
 * records its sidebar names a session by (data/scanner.ts), and, on each, the
 * fields it reads. Everything else in a record — the envelope repeated on
 * every line, the hook and skill listings in `attachment` records, a tool's
 * result held a second time in `toolUseResult` — is weight the card cannot
 * carry and the reader never sees.
 */
const SHOWN_TYPES = new Set(["user", "assistant", "system", "custom-title", "ai-title"]);
const SHOWN_FIELDS = new Set([
  "type", "uuid", "parentUuid", "timestamp", "message", "subtype", "content", "level",
  "isMeta", "isSidechain", "isApiErrorMessage", "durationMs", "error", "promptId", "slug", "customTitle", "aiTitle",
]);

/** A message as the viewer reads it: who, which model, how it stopped, what it said, and its token counts. */
function shownMessage(message: Record<string, unknown>): Record<string, unknown> {
  const { id, role, model, stop_reason, content, usage } = message;
  const tokens = usage as { readonly input_tokens?: number; readonly output_tokens?: number } | undefined;
  return Object.fromEntries(
    Object.entries({ id, role, model, stop_reason, content, usage: tokens && { input_tokens: tokens.input_tokens, output_tokens: tokens.output_tokens } })
      .filter(([, v]) => v !== undefined),
  );
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

function scrub(text: string): string {
  let out = text.replaceAll(HOME, DEMO_HOME).replaceAll(HOME.replaceAll("/", "-"), DEMO_HOME.replaceAll("/", "-"));
  out = out.replace(PRIVATE_IPV4, "192.0.2.1");
  out = out.replace(EMAIL, "demo@example.com");
  for (const host of HOSTS) out = out.replace(word(host), "demo-host");
  out = out.replace(word(USER), "demo");
  for (const pattern of CREDENTIALS) out = out.replace(pattern, (_, bearer: unknown) => `${typeof bearer === "string" ? bearer : ""}[redacted]`);
  return out;
}

function trim(text: string): string {
  const lines = text.split("\n");
  const kept = lines.length > KEEP_LINES ? lines.slice(0, KEEP_LINES).join("\n") : text;
  const cut = kept.length > KEEP_CHARS ? kept.slice(0, KEEP_CHARS) : kept;
  if (cut === text) return text;
  const lost = lines.length - cut.split("\n").length;
  return `${cut}\n… ${lost > 0 ? `${lost} more lines` : `${text.length - cut.length} more characters`}`;
}

function stage(value: unknown): unknown {
  if (typeof value === "string") return scrub(trim(value));
  if (Array.isArray(value)) return value.map(stage);
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const thinking = record["type"] === "thinking";
    return Object.fromEntries(
      Object.entries(record).filter(([key]) => !(thinking && key === "signature")).map(([key, v]) => [scrub(key), stage(v)]),
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

/** Each picked session's file, read once. */
const SOURCES = Object.entries(SESSIONS).map(([project, ids]) => {
  const dir = path.join(HOME, ".claude/projects", `${HOME.replaceAll("/", "-")}-code-${project}`);
  const names = readdirSync(dir);
  return [project, ids.map((id) => {
    const matches = names.filter((name) => name.startsWith(id) && name.endsWith(".jsonl"));
    if (matches.length !== 1) throw new Error(`${dir}: expected one session starting ${id}, found ${matches.length}`);
    const file = path.join(dir, matches[0]!);
    return { id, name: matches[0]!, file, text: readFileSync(file, "utf-8") };
  })] as const;
});

/**
 * The machines the sessions name: this one, and every mDNS `<name>.local` any
 * of them reaches — a session run here ssh-es and scp-s to the others on the
 * LAN — so no host is named in this file. A name counts only in a host
 * position: the host of `user@host` (a format verb's `%s@host` is an address
 * template, not a login), an argument of ssh, scp, rsync, sftp, mosh or ping,
 * or the host of a `host:path` remote. A `.local` anywhere else — a file's
 * `settings.local.json`, code's `binding.local` — names no machine. Each host
 * is then scrubbed wherever it appears as a word, bare or with its `.local`.
 */
const HOST_POSITION = /(?:(?<![%\w.-])[A-Za-z_][\w.-]*@|\b(?:ssh|scp|rsync|sftp|mosh|ping)\s+(?:-\S+\s+)*|(?<![\w.$-])(?=[A-Za-z0-9-]+\.local:))([A-Za-z0-9-]+)\.local(?![\w-]|\.[A-Za-z0-9])/g;
const HOSTS = new Set([
  hostname().replace(/\.local$/, ""),
  ...SOURCES.flatMap(([, files]) => files.flatMap(({ text }) => [...text.matchAll(HOST_POSITION)].map((m) => m[1]!))),
]);
console.log(`hosts: ${HOSTS.size}`);

const out = path.join(REPO_ROOT, "examples/claude-sessions/staging");
// [LAW:one-source-of-truth] This script is the directory's one writer, so it
// clears it and writes every module in it, projects.ts included.
rmSync(out, { recursive: true, force: true });
mkdirSync(out);

let total = 0;
for (const [project, sessionsOf] of SOURCES) {
  const sessions = sessionsOf.map(({ id, name, file, text }) => {
    const records = text.split("\n").filter((line) => line.trim() !== "");
    const shown = records
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((record) => SHOWN_TYPES.has(String(record["type"])))
      .map((record) => Object.fromEntries(Object.entries(record).filter(([key]) => SHOWN_FIELDS.has(key))))
      .map((record) => (typeof record["message"] === "object" && record["message"] !== null ? { ...record, message: shownMessage(record["message"] as Record<string, unknown>) } : record));
    const jsonl = shown.map((record) => JSON.stringify(stage(record))).join("\n");
    total += Buffer.byteLength(jsonl);
    console.log(`${project}/${id}: ${records.length} records, ${Math.round(Buffer.byteLength(jsonl) / 1024)} KB`);
    return { name, mtime: statSync(file).mtime.toISOString(), jsonl };
  });
  const module = `/** ${project}: real sessions, trimmed and scrubbed by scripts/stage-claude-sessions.ts, which writes this file. */
import type { MemoryDirectory } from "../../_capabilities/memory-file-system.js";

export const PROJECT = "${DEMO_HOME.replaceAll("/", "-")}-code-${project}";

export const SESSIONS: MemoryDirectory = {
  kind: "directory",
  children: {
${sessions.map((s) => `    "${s.name}": {
      kind: "file",
      mtime: new Date("${s.mtime}"),
      content: String.raw\`${rawTemplateBody(s.jsonl)}\`,
    },`).join("\n")}
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

console.log(`total: ${Math.round(total / 1024)} KB`);
