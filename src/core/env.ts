/**
 * Env — the environment variables a program running on a terminal sees, as
 * every public type that carries them names it.
 *
 * [LAW:types-are-the-program] The strongest true theorem about what this
 * library does with an environment is "reads a variable by name, which may be
 * unset." It never writes one, and it never touches the rest of node's
 * `NodeJS.ProcessEnv`. Node's `process.env` satisfies this as-is, and so does
 * a frozen literal in a browser, where there is no `process` at all.
 *
 * It lives here rather than being spelled `NodeJS.ProcessEnv` because a public
 * signature is emitted into the `.d.ts` verbatim, and a TypeScript project
 * without `@types/node` — the ordinary browser project — cannot resolve the
 * `NodeJS` namespace. `test/seam/browser-types.test.ts` holds that line.
 */

export type Env = Readonly<Record<string, string | undefined>>;

/**
 * A terminal that says it cannot be drawn on: `TERM` is `dumb` or `unknown`,
 * as Emacs' shell mode sets it. It takes no color and nothing that moves the
 * cursor.
 */
/** Whether a person is at the destination: a TTY that is not a dumb terminal. */
export function isAttended(isTTY: boolean, env: Env): boolean {
  return isTTY && !isDumbTerminal(env);
}

export function isDumbTerminal(env: Env): boolean {
  const term = env["TERM"];
  return term === "dumb" || term === "unknown";
}
