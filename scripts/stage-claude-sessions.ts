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
 * - the owner's home becomes `/home/demo`, and email addresses and anything
 *   shaped like a credential are replaced.
 */
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
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
 * What the viewer draws: the records it renders (data/parser.ts) and, on each,
 * the fields it reads. Everything else in a record — the envelope repeated on
 * every line, the hook and skill listings in `attachment` records, a tool's
 * result held a second time in `toolUseResult` — is weight the card cannot
 * carry and the reader never sees.
 */
const SHOWN_TYPES = new Set(["user", "assistant", "system"]);
const SHOWN_FIELDS = new Set([
  "type", "uuid", "parentUuid", "timestamp", "message", "subtype", "content", "level",
  "isMeta", "isSidechain", "isApiErrorMessage", "durationMs", "error", "promptId", "slug",
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
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function scrub(text: string): string {
  let out = text.replaceAll(HOME, DEMO_HOME).replaceAll(HOME.replaceAll("/", "-"), DEMO_HOME.replaceAll("/", "-"));
  out = out.replace(EMAIL, "demo@example.com");
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
 * back byte for byte. JSON escapes a backtick and a `$` as ``` and
 * `$`, which a raw template leaves alone and `JSON.parse` reads back.
 */
function rawTemplateBody(jsonl: string): string {
  return jsonl.replaceAll("`", "\\u0060").replaceAll("$", "\\u0024");
}

const out = path.join(REPO_ROOT, "examples/claude-sessions/staging");
rmSync(out, { recursive: true, force: true });
mkdirSync(out);

let total = 0;
for (const [project, ids] of Object.entries(SESSIONS)) {
  const dir = path.join(HOME, ".claude/projects", `${HOME.replaceAll("/", "-")}-code-${project}`);
  const names = readdirSync(dir);
  const sessions = ids.map((id) => {
    const matches = names.filter((name) => name.startsWith(id) && name.endsWith(".jsonl"));
    if (matches.length !== 1) throw new Error(`${dir}: expected one session starting ${id}, found ${matches.length}`);
    const file = path.join(dir, matches[0]!);
    const records = readFileSync(file, "utf-8").split("\n").filter((line) => line.trim() !== "");
    const shown = records
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((record) => SHOWN_TYPES.has(String(record["type"])))
      .map((record) => Object.fromEntries(Object.entries(record).filter(([key]) => SHOWN_FIELDS.has(key))))
      .map((record) => (typeof record["message"] === "object" && record["message"] !== null ? { ...record, message: shownMessage(record["message"] as Record<string, unknown>) } : record));
    const jsonl = shown.map((record) => JSON.stringify(stage(record))).join("\n");
    total += Buffer.byteLength(jsonl);
    console.log(`${project}/${id}: ${records.length} records, ${Math.round(Buffer.byteLength(jsonl) / 1024)} KB`);
    return { name: matches[0]!, mtime: statSync(file).mtime.toISOString(), jsonl };
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

console.log(`total: ${Math.round(total / 1024)} KB`);
