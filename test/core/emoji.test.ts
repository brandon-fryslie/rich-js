import { describe, it, expect } from "vitest";
import {
  EMOJI,
  emojiReplace,
  Emoji,
  NoEmoji,
} from "../../src/core/emoji.js";
import { Style } from "../../src/core/style.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

// --- EMOJI dictionary ---

describe("EMOJI dictionary", () => {
  it("contains common emoji entries", () => {
    expect(EMOJI["heart"]).toBeDefined();
    expect(EMOJI["thumbs_up"]).toBeDefined();
    expect(EMOJI["smile"]).toBeDefined();
    expect(EMOJI["fire"]).toBeDefined();
    expect(EMOJI["warning"]).toBeDefined();
    expect(EMOJI["check"]).toBeDefined();
    expect(EMOJI["rocket"]).toBeDefined();
  });
});

// --- emojiReplace ---

describe("emojiReplace()", () => {
  it("replaces known shortcodes", () => {
    const result = emojiReplace(":thumbs_up:");
    expect(result).toBe(EMOJI["thumbs_up"]);
  });

  it("leaves unknown shortcodes unchanged", () => {
    expect(emojiReplace(":not_a_real_emoji_name:")).toBe(":not_a_real_emoji_name:");
  });

  it("replaces multiple shortcodes", () => {
    const result = emojiReplace(":heart: and :fire:");
    expect(result).toContain(EMOJI["heart"]);
    expect(result).toContain(EMOJI["fire"]);
  });

  it("returns text unchanged when no shortcodes", () => {
    expect(emojiReplace("hello world")).toBe("hello world");
  });

  it("does not treat colons with spaces as shortcodes", () => {
    expect(emojiReplace(":with spaces:")).toBe(":with spaces:");
  });
});

// --- Variant selectors ---

describe("emojiReplace variant selectors", () => {
  it("appends \\uFE0F for emoji variant", () => {
    const result = emojiReplace(":heart:", "emoji");
    expect(result).toContain("\uFE0F");
  });

  it("appends \\uFE0E for text variant", () => {
    const result = emojiReplace(":heart:", "text");
    expect(result).toContain("\uFE0E");
  });

  it("inline -emoji suffix applies emoji variant selector", () => {
    const result = emojiReplace(":thumbs_up-emoji:");
    expect(result).toContain("\uFE0F");
  });

  it("inline -text suffix applies text variant selector", () => {
    const result = emojiReplace(":thumbs_up-text:");
    expect(result).toContain("\uFE0E");
  });

  it("inline -emoji suffix overrides conflicting default text variant", () => {
    const result = emojiReplace(":heart-emoji:", "text");
    expect(result).toContain("\uFE0F");
    expect(result).not.toContain("\uFE0E");
  });

  it("inline -text suffix overrides conflicting default emoji variant", () => {
    const result = emojiReplace(":heart-text:", "emoji");
    expect(result).toContain("\uFE0E");
    expect(result).not.toContain("\uFE0F");
  });

  it("no variant selector when no variant specified", () => {
    const result = emojiReplace(":heart:");
    expect(result).not.toContain("\uFE0F");
    expect(result).not.toContain("\uFE0E");
  });
});

// --- Emoji class ---

describe("Emoji class", () => {
  it("constructs with valid name", () => {
    const emoji = new Emoji("heart");
    expect(emoji.name).toBe("heart");
  });

  it("throws NoEmoji for unknown name", () => {
    expect(() => new Emoji("definitely_not_an_emoji")).toThrow(NoEmoji);
  });

  it("toString returns the emoji character", () => {
    const emoji = new Emoji("fire");
    expect(emoji.toString()).toBe(EMOJI["fire"]);
  });

  it("toString includes variant selector when specified", () => {
    const emoji = new Emoji("heart", undefined, "emoji");
    expect(emoji.toString()).toContain("\uFE0F");
  });

  it("render produces a single segment containing the emoji character", () => {
    const emoji = new Emoji("star");
    const segments = [...emoji.render({ maxWidth: 80 })];
    expect(segments).toHaveLength(1);
    expect(segments[0]!.text).toBe(EMOJI["star"]);
  });

  it("render carries the style to the segment", () => {
    const style = new Style({ bold: true });
    const emoji = new Emoji("heart", style);
    const segments = [...emoji.render({ maxWidth: 80 })];
    expect(segments).toHaveLength(1);
    expect(segments[0]!.style).toBe(style);
  });

  it("render includes variant selector in segment text", () => {
    const emoji = new Emoji("heart", undefined, "emoji");
    const segments = [...emoji.render({ maxWidth: 80 })];
    expect(segments).toHaveLength(1);
    expect(segments[0]!.text).toContain("\uFE0F");
  });
});

// --- Emoji.replace ---

describe("Emoji.replace()", () => {
  it("works as static shortcut for emojiReplace", () => {
    const result = Emoji.replace(":fire:");
    expect(result).toBe(EMOJI["fire"]);
  });
});
