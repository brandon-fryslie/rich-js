/**
 * Sucrase's parser, which its package publishes no types for at the path its
 * code is at: the declarations it ships for that file, under that path.
 */
declare module "sucrase/dist/parser/index.js" {
  export { parse } from "sucrase/dist/types/parser/index.js";
}
