/**
 * Every e2e page loads xterm.js from disk only if it comes from a context
 * `e2e/test.ts` routed: specs take `test` from there, never from
 * `@playwright/test`, and a context a spec makes itself goes through `cdn`.
 * A page outside that reaches jsDelivr, and a stalled CDN reads as a page
 * regression again — with no refusal, because no route ever saw the request.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const E2E = join(import.meta.dirname, "../../e2e");
const files = readdirSync(E2E).filter((name) => name.endsWith(".ts") && name !== "test.ts");

describe("e2e pages come from routed contexts", () => {
  it.each(files)("%s", (name) => {
    const lines = readFileSync(join(E2E, name), "utf8").split("\n");
    const found = lines.flatMap((line, index) => {
      const at = `${name}:${index + 1}: ${line.trim()}`;
      if (/from "@playwright\/test"/.test(line) && !/^import type /.test(line)) return [`value import: ${at}`];
      if (/browser\.newPage\(/.test(line)) return [`unrouted page: ${at}`];
      if (/browser\.newContext\(/.test(line) && !/cdn\(await browser\.newContext\(/.test(line)) return [`unrouted context: ${at}`];
      return [];
    });
    expect(found).toEqual([]);
  });
});
