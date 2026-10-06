/**
 * What the playground page is served by its dev server's plugin
 * (vite.config.effects-playground.ts): the live library with the playground's
 * kit added, and the program each effect's playground opens on.
 */
declare module "virtual:effects-playground" {
  export const library: string;
  export const programs: Readonly<Record<import("../effects-feel/vocabulary.js").EffectName, string>>;
}
