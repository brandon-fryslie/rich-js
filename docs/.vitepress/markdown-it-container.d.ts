/**
 * markdown-it-container's ESM export, typed against markdown-it's ESM types.
 * `@types/markdown-it-container` declares it through markdown-it's CommonJS
 * types, which an ESM import of markdown-it never matches.
 */
declare module "markdown-it-container" {
  import type MarkdownIt from "markdown-it";
  export default function container(
    md: MarkdownIt,
    name: string,
    options?: { readonly validate?: (info: string) => boolean; readonly marker?: string },
  ): void;
}
