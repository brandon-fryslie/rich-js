/**
 * Pins the build log the job pane shows: every item of every stage gets its
 * line, in order, even on a run whose ticks advance faster than its items
 * last.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "../../../src/index.js";
import { jobWidget } from "../../../examples/rich-dash/widgets/job.js";

const STAGES = ["lint", "tsc", "vitest", "docs:build", "test:demos"];

afterEach(() => vi.restoreAllMocks());

describe("job widget log", () => {
  it("logs every item a stage works through, however far a tick advances", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0); // the shortest run: three ticks an item
    let state = jobWidget.init();
    random.mockReturnValue(0.999); // the longest advance a tick makes
    const text = () => renderToString(jobWidget.render(state), { width: 200, colorSystem: null });
    for (let i = 0; i < 500 && !text().includes("test:demos ok"); i++) state = jobWidget.tick(state);

    const lines = text().split("\n").map((line) => line.trim());
    const logged = (stage: string) => lines.filter((line) => line.startsWith(`${stage}  `) && !line.includes("━")).map((line) => line.slice(stage.length + 2));
    expect(lines).toContain("test:demos ok");
    expect(logged("lint")).toEqual(["tsc --noEmit", "tsc -p tsconfig.scripts.json", "tsc -p tsconfig.test.json"]);
    for (const stage of STAGES) expect(new Set(logged(stage)).size, stage).toBe(logged(stage).length);
    expect(logged("test:demos")).toHaveLength(6);
  });
});
