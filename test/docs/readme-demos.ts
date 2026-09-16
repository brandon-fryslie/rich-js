/*
 * The rule behind the demo table in `README.md`: its rows name exactly the npm
 * scripts that run a demo, each paired with the demo it runs.
 *
 * That table is the one list of demos a package user reads. It replaced
 * per-demo "Features exercised" tables, which were a hand-copied second answer
 * to a question `test/coverage/` already computes, and a list stays in the
 * README only if something holds it to what it describes.
 * [LAW:one-source-of-truth] `package.json#scripts` owns which command runs
 * which demo; each README row is a copy of one such pairing, checked here, so
 * renaming a script or adding a demo fails the suite instead of the reader.
 *
 * Its blind spot is the third column. Whether "a file browser" is still a fair
 * line for `rich-explore` is prose about behaviour, and no parse of two files
 * answers it.
 */

/** One demo as a user runs it, written `script → demo`. */
export type DemoRun = `${string} → ${string}`;

/** The node entry a demo script runs, compiled into `dist-demo/`, with or without arguments after it. */
const DEMO_ENTRY = /\bnode dist-demo\/examples\/([^/\s]+)\/index\.js\b/;

/** A table row's first two cells: `` | `npm run <script>` | <demo> | ``. */
const TABLE_ROW = /^\| `npm run ([^`]+)` \| ([^|]+?) \|/;

/** Every script in `package.json#scripts` that runs a demo's node entry, sorted. */
export function scriptedDemos(scripts: Readonly<Record<string, string>>): DemoRun[] {
  return Object.entries(scripts)
    .flatMap(([script, command]): DemoRun[] => {
      const match = DEMO_ENTRY.exec(command);
      return match === null ? [] : [`${script} → ${match[1]!}`];
    })
    .sort();
}

/**
 * The rows of the table in the README's `## Demos` section, sorted.
 *
 * [LAW:no-silent-failure] A README without that heading throws rather than
 * yielding no rows, because an empty list is also what a table with no demos
 * looks like.
 */
export function readmeDemos(readme: string): DemoRun[] {
  const [, afterHeading] = readme.split("\n## Demos\n");
  if (afterHeading === undefined) throw new Error("README.md has no `## Demos` section");
  const [section] = afterHeading.split("\n## ");
  return section!
    .split("\n")
    .flatMap((line): DemoRun[] => {
      const match = TABLE_ROW.exec(line);
      return match === null ? [] : [`${match[1]!} → ${match[2]!}`];
    })
    .sort();
}
