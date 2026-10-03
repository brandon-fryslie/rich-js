// The suite's own config, running only the fixture beside this file on a
// short budget, so the report under test is wired exactly as the suite wires it.
import { defineConfig } from "vitest/config";
import suite from "../../../vitest.config.js";

export default defineConfig({
  ...suite,
  root: new URL("../../..", import.meta.url).pathname,
  test: { ...suite.test, include: ["test/suite/fixtures/times-out.fixture.ts"], testTimeout: 1_000 },
});
