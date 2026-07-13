import { describe, it, expect } from "vitest";
import { displayName, ageBracket } from "./privacy";

describe("displayName", () => {
  it("shows first name + last initial", () => {
    expect(displayName("Jill", "White")).toBe("Jill W.");
  });
  it("uppercases the last initial", () => {
    expect(displayName("Jill", "white")).toBe("Jill W.");
  });
  it("returns just the first name when there is no last name", () => {
    expect(displayName("Jill", "")).toBe("Jill");
    expect(displayName("Jill", null)).toBe("Jill");
    expect(displayName("Jill")).toBe("Jill");
  });
  it("trims whitespace", () => {
    expect(displayName("  Jill ", "  White ")).toBe("Jill W.");
  });
  it("falls back to 'Player' with no first name", () => {
    expect(displayName("", "White")).toBe("Player");
    expect(displayName(null, null)).toBe("Player");
    expect(displayName()).toBe("Player");
  });
});

describe("ageBracket", () => {
  it("buckets into 5-year ranges aligned to multiples of 5", () => {
    expect(ageBracket(46)).toBe("45 - 50");
    expect(ageBracket(45)).toBe("45 - 50");
    expect(ageBracket(49)).toBe("45 - 50");
    expect(ageBracket(50)).toBe("50 - 55");
    expect(ageBracket(21)).toBe("20 - 25");
  });
  it("returns undefined for missing or invalid ages", () => {
    expect(ageBracket(undefined)).toBeUndefined();
    expect(ageBracket(null)).toBeUndefined();
    expect(ageBracket(0)).toBeUndefined();
    expect(ageBracket(-5)).toBeUndefined();
    expect(ageBracket(NaN)).toBeUndefined();
  });
});
