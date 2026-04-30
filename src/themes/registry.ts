import { Palette } from "./palette.js";

/**
 * The 18 Textual theme palettes shipped with rich-js. The list is the
 * authoritative set of theme identifiers — any name not in here is unknown.
 *
 * Names are also the JSON filenames under `./data/`, so they double as the
 * dynamic-import key. Keeping this as a single readonly array means the
 * registry has [LAW:one-source-of-truth] for valid theme names — both
 * `listThemePalettes` and `getThemePalette`'s membership check read from
 * this same list.
 */
const THEME_NAMES = [
  "atom-one-dark",
  "atom-one-light",
  "catppuccin-latte",
  "catppuccin-mocha",
  "dracula",
  "flexoki",
  "gruvbox",
  "monokai",
  "nord",
  "rose-pine",
  "rose-pine-dawn",
  "rose-pine-moon",
  "solarized-dark",
  "solarized-light",
  "textual-ansi",
  "textual-dark",
  "textual-light",
  "tokyo-night",
] as const satisfies readonly string[];

export type ThemeName = (typeof THEME_NAMES)[number];

interface ThemeJson {
  readonly name: string;
  readonly dark: boolean;
  readonly vars: Record<string, string>;
}

const cache = new Map<string, Palette>();

/**
 * Returns the static list of available theme names. Does not load any theme
 * data — safe to call without paying the JSON import cost.
 */
export function listThemePalettes(): readonly ThemeName[] {
  return THEME_NAMES;
}

/**
 * Lazy-load a theme palette by name. Returns `null` for unknown names.
 *
 * Async by design: dynamic `import()` is what lets bundlers tree-shake the
 * 17 themes a consumer doesn't use. A synchronous API would force every
 * theme JSON into the consumer's bundle, defeating the laziness the spec
 * requires. Callers typically resolve a single theme at startup, so the
 * one-time await is cheap.
 *
 * Cache is per-process: subsequent calls for the same name return the same
 * Palette instance without re-parsing.
 */
export async function getThemePalette(name: string): Promise<Palette | null> {
  // [LAW:single-enforcer] Membership check happens here, once. Downstream
  // never sees an unknown name — `import()` is only attempted for known
  // themes, so a missing JSON file is a build/install bug, not a runtime
  // "did the user typo it" question.
  if (!isThemeName(name)) return null;

  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  // Dynamic import — bundlers see the template literal `./data/${name}.json`
  // and emit per-theme chunks. Keep the call on one line so Vite's
  // dynamic-import-vars plugin can statically analyze the path pattern.
  // The `with { type: "json" }` attribute is required by Node 22+ for JSON.
  const mod = (await import(`./data/${name}.json`, { with: { type: "json" } })) as { default: ThemeJson };
  const data = mod.default;

  const palette = Palette.fromHex(data.name, data.dark, data.vars);
  cache.set(name, palette);
  return palette;
}

function isThemeName(name: string): name is ThemeName {
  return (THEME_NAMES as readonly string[]).includes(name);
}
