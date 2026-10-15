/**
 * Writes the staging the demos' cards take from this repository, every file
 * as it is here: examples/rich-explore/staging/rich-js.ts, the tree
 * rich-explore browses, and examples/rich-dash/staging/readme.ts, the README
 * rich-dash's notes panel renders.
 *
 * Run by hand (`node scripts/stage-repo-files.ts`) after those files change;
 * its output is committed. `PICKED` is the pick: sources from
 * src/core and src/renderables, a few docs pages and their site's theme, the
 * manifest and a JSON config, CI, tests, an extensionless LICENSE, and a real
 * PNG four directories down in node_modules — one of each kind the preview
 * pane draws, several levels deep.
 */
import { readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./repo-facts.ts";

const PICKED = [
  "package.json", "tsconfig.json", ".gitignore", "LICENSE", "README.md",
  ".github/workflows/ci.yml",
  ...["anchor", "clock", "easing", "env", "fnv1a", "json", "measure", "memo", "noise", "osc8", "place", "render", "selection", "subscription", "wrap"]
    .map((name) => `src/core/${name}.ts`),
  ...["align", "constrain", "group", "list-view", "padding", "rule", "spinner", "status"].map((name) => `src/renderables/${name}.ts`),
  ...["colorRef", "palette", "ramp", "terminalThemes"].map((name) => `src/themes/${name}.ts`),
  "src/host/index.ts", "src/host/host-environment.ts",
  "src/node/save.ts", "src/node/prompt.ts",
  ...["clock", "fnv1a", "memo"].map((name) => `test/core/${name}.test.ts`),
  ...["introduction", "padding", "tree", "group", "panel", "columns"].map((name) => `docs/${name}.md`),
  "docs/.vitepress/sidebar.ts",
  ...["index.ts", "xterm.ts", "device-pixel-ratio.ts", "CardSliders.ts", "live-runtime.d.ts", "sucrase-parser.d.ts"].map((name) => `docs/.vitepress/theme/${name}`),
  "node_modules/playwright-core/lib/server/chromium/appIcon.png",
];

/** `text` as the body of a template literal that reads back as `text`. */
const templateBody = (text: string) => text.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");

type Node = { readonly kind: "file"; readonly path: string } | { readonly kind: "directory"; readonly children: Map<string, Node> };

const root: Node = { kind: "directory", children: new Map() };
for (const file of PICKED) {
  const parts = file.split("/");
  let at = root;
  for (const dir of parts.slice(0, -1)) {
    const next = at.children.get(dir) ?? { kind: "directory", children: new Map() };
    if (next.kind !== "directory") throw new Error(`${file}: ${dir} is a file`);
    at.children.set(dir, next);
    at = next;
  }
  at.children.set(parts.at(-1)!, { kind: "file", path: file });
}

let bytes = 0;
function literal(node: Node, indent: string): string {
  if (node.kind === "file") {
    const full = path.join(REPO_ROOT, node.path);
    const mtime = `new Date("${statSync(full).mtime.toISOString()}")`;
    const data = readFileSync(full);
    bytes += data.length;
    // A binary file's bytes, one character each, so its size reads true; the
    // source carries them as base64.
    const content = node.path.endsWith(".png") ? `latin1("${data.toString("base64")}")` : `\`${templateBody(data.toString("utf-8"))}\``;
    return `{ kind: "file", mtime: ${mtime}, content: ${content} }`;
  }
  const entries = [...node.children].map(([name, child]) => `${indent}  ${JSON.stringify(name)}: ${literal(child, `${indent}  `)},`);
  return `{ kind: "directory", children: {\n${entries.join("\n")}\n${indent}} }`;
}

const module = `/** Part of the rich-js repository, as it is, written by scripts/stage-repo-files.ts. */
import type { MemoryDirectory } from "../../_capabilities/memory-file-system.js";

/** Base64's bytes as a string of one character per byte. */
const latin1 = (base64: string): string => atob(base64);

export const RICH_JS: MemoryDirectory = ${literal(root, "")};
`;

function write(file: string, text: string): void {
  mkdirSync(path.dirname(path.join(REPO_ROOT, file)), { recursive: true });
  writeFileSync(path.join(REPO_ROOT, file), text);
}

write("examples/rich-explore/staging/rich-js.ts", module);
console.log(`rich-explore: ${PICKED.length} files, ${Math.round(bytes / 1024)} KB`);

write("examples/rich-dash/staging/readme.ts", `/** This repository's README, as it is, written by scripts/stage-repo-files.ts. */
export const README = \`${templateBody(readFileSync(path.join(REPO_ROOT, "README.md"), "utf-8"))}\`;
`);
