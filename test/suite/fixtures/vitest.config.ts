// The suite's own config, running only the fixture beside this file on a
// short budget, so the report under test is wired exactly as the suite wires it.
import { defineConfig } from "vitest/config";
import { REPO_ROOT } from "../../../scripts/repo-facts.js";
import suite from "../../../vitest.config.js";

export default defineConfig({
  ...suite,
  root: REPO_ROOT,
  test: { ...suite.test, include: ["test/suite/fixtures/times-out.fixture.ts"], testTimeout: 1_000 },
});
