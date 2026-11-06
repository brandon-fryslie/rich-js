import { describe, it, expect } from "vitest";
import { comparedIntents } from "../../../examples/themes-and-color-studio/text-on.js";

describe("TEXT_ON_INTENTS", () => {
  it("names the intents section 9 compares", () => {
    expect(comparedIntents(" text-muted  text-error ")).toEqual(["text-muted", "text-error"]);
  });

  it("refuses a name that is no intent", () => {
    expect(() => comparedIntents("text-errr")).toThrow(/"text-errr" is not one of/);
  });

  it("refuses a setting that names nothing, as it refuses any other bad value", () => {
    expect(() => comparedIntents(" ")).toThrow(/names no intent/);
  });
});
