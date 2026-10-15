/**
 * Writes the demos' staging taken from this repository (scripts/repo-staging.ts
 * says what and why). Run by the `pre` scripts of `npm run lint`, `docs:dev`
 * and `docs:build`; by hand it does nothing those do not.
 */
import { stageRepoFiles } from "./repo-staging.ts";

stageRepoFiles();
