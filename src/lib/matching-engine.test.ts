import { describe, it, expect } from "vitest";
import {
  calculateMatchScore,
  findMatches,
  mutualNtrpReject,
  WEIGHTS,
  MIN_MATCH_SCORE,
  OPEN_MATCH_MIN_SCORE,
  type UserProfile,
  type DayAvailability,
} from "./matching-engine";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function avail(map: Record<string, [number, number][]>): DayAvailability[] {
  return ALL_DAYS.map((day) => ({
    day,
    enabled: !!map[day],
    slots: (map[day] || []).map(([start, end]) => ({ start, end })),
  }));
}

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "u1",
    firstName: "Test",
    lastName: "User",
    age: 35,
    gender: "Male",
    avatar: "A",
    ntrpRating: 3.5,
    sports: ["tennis"],
    matchFormats: ["singles"],
    gameType: "slightly-competitive",
    availability: avail({ Mon: [[9, 12]], Wed: [[18, 20]] }),
    partnerPreferences: {
      ageRange: "5",
      ntrpMin: 3.0,
      ntrpMax: 4.0,
      gameTypes: ["slightly-competitive"],
      sports: ["tennis"],
      matchFormats: ["singles"],
      genderPreference: "No Preference",
    },
    profileComplete: true,
    ...overrides,
  };
}

describe("weights", () => {
  it("sum to exactly 1.0", () => {
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });
  it("exports sane thresholds", () => {
    expect(MIN_MATCH_SCORE).toBe(50);
    expect(OPEN_MATCH_MIN_SCORE).toBe(40);
  });
});

describe("calculateMatchScore", () => {
  it("perfect (identical) match scores 100", () => {
    const r = calculateMatchScore(makeUser({ id: "a" }), makeUser({ id: "b" }));
    expect(r.score).toBe(100);
    expect(r.user.id).toBe("b");
  });

  it("no sport overlap scores 0 for sport and drops the total", () => {
    const a = makeUser({ id: "a", sports: ["tennis"] });
    const b = makeUser({ id: "b", sports: ["pickleball"] });
    expect(calculateMatchScore(a, b).breakdown.sport).toBe(0);
  });

  it('"both" sport always matches when preferences accept', () => {
    const a = makeUser({ id: "a", sports: ["both"], partnerPreferences: { ...makeUser().partnerPreferences, sports: ["both"] } });
    const b = makeUser({ id: "b", sports: ["pickleball"], partnerPreferences: { ...makeUser().partnerPreferences, sports: ["both"] } });
    expect(calculateMatchScore(a, b).breakdown.sport).toBe(1);
  });

  it("respects a one-sided partner-sport preference (0.5)", () => {
    // A plays both but only wants pickleball; B plays tennis only and wants tennis.
    const a = makeUser({ id: "a", sports: ["both"], partnerPreferences: { ...makeUser().partnerPreferences, sports: ["pickleball"] } });
    const b = makeUser({ id: "b", sports: ["tennis"], partnerPreferences: { ...makeUser().partnerPreferences, sports: ["tennis"] } });
    // B plays tennis, A wants pickleball only → A not satisfied. A plays both → B satisfied.
    expect(calculateMatchScore(a, b).breakdown.sport).toBe(0.5);
  });
});

describe("availability", () => {
  it("no overlap → 0", () => {
    const a = makeUser({ id: "a", availability: avail({ Mon: [[9, 12]] }) });
    const b = makeUser({ id: "b", availability: avail({ Tue: [[9, 12]] }) });
    expect(calculateMatchScore(a, b).breakdown.availability).toBe(0);
  });

  it("is symmetric (score A→B equals B→A)", () => {
    const a = makeUser({ id: "a", availability: avail({ Mon: [[9, 12]] }) });
    const b = makeUser({ id: "b", availability: avail({ Mon: [[8, 22]] }) });
    const ab = calculateMatchScore(a, b).breakdown.availability;
    const ba = calculateMatchScore(b, a).breakdown.availability;
    expect(ab).toBe(ba);
  });

  it("empty availability → 0 (no division by zero)", () => {
    const a = makeUser({ id: "a", availability: avail({}) });
    const b = makeUser({ id: "b", availability: avail({ Mon: [[9, 12]] }) });
    expect(calculateMatchScore(a, b).breakdown.availability).toBe(0);
  });

  it("merges overlapping slots so hours aren't double-counted", () => {
    // Two overlapping Mon slots that merge to 9-13 (4h). Partner fully covers it.
    const a = makeUser({ id: "a", availability: avail({ Mon: [[9, 12], [11, 13]] }) });
    const b = makeUser({ id: "b", availability: avail({ Mon: [[8, 20]] }) });
    // A has 4 merged hours, fully overlapped → directional 1; symmetric min still 1.
    expect(calculateMatchScore(a, b).breakdown.availability).toBe(1);
  });
});

describe("ntrp", () => {
  it("both in range → 1", () => {
    expect(calculateMatchScore(makeUser({ id: "a" }), makeUser({ id: "b" })).breakdown.ntrp).toBe(1);
  });
  it("one-sided → 0.5", () => {
    const a = makeUser({ id: "a", ntrpRating: 3.5, partnerPreferences: { ...makeUser().partnerPreferences, ntrpMin: 3, ntrpMax: 4 } });
    const b = makeUser({ id: "b", ntrpRating: 4.5, partnerPreferences: { ...makeUser().partnerPreferences, ntrpMin: 3, ntrpMax: 5 } });
    // a accepts b? b=4.5 in [3,4]? no. b accepts a? a=3.5 in [3,5]? yes → 0.5
    expect(calculateMatchScore(a, b).breakdown.ntrp).toBe(0.5);
  });
  it("mutual rejection → 0 and mutualNtrpReject true", () => {
    const a = makeUser({ id: "a", ntrpRating: 3.5, partnerPreferences: { ...makeUser().partnerPreferences, ntrpMin: 3, ntrpMax: 4 } });
    const b = makeUser({ id: "b", ntrpRating: 5.5, partnerPreferences: { ...makeUser().partnerPreferences, ntrpMin: 5, ntrpMax: 6 } });
    expect(calculateMatchScore(a, b).breakdown.ntrp).toBe(0);
    expect(mutualNtrpReject(a, b)).toBe(true);
  });
  it("inclusive on both boundaries", () => {
    const a = makeUser({ id: "a", ntrpRating: 3.0, partnerPreferences: { ...makeUser().partnerPreferences, ntrpMin: 3, ntrpMax: 4 } });
    const b = makeUser({ id: "b", ntrpRating: 4.0, partnerPreferences: { ...makeUser().partnerPreferences, ntrpMin: 3, ntrpMax: 4 } });
    expect(calculateMatchScore(a, b).breakdown.ntrp).toBe(1);
  });
});

describe("gameType", () => {
  it("same=1, adjacent=0.5, opposite=0", () => {
    const base = makeUser({ id: "a", gameType: "recreational" });
    const same = makeUser({ id: "b", gameType: "recreational" });
    const adj = makeUser({ id: "c", gameType: "slightly-competitive" });
    const opp = makeUser({ id: "d", gameType: "hardcore-competitive" });
    expect(calculateMatchScore(base, same).breakdown.gameType).toBe(1);
    expect(calculateMatchScore(base, adj).breakdown.gameType).toBe(0.5);
    expect(calculateMatchScore(base, opp).breakdown.gameType).toBe(0); // the real opposite case
  });
  it("unknown/corrupt gameType → 0", () => {
    const a = makeUser({ id: "a", gameType: "nonsense" as unknown as UserProfile["gameType"] });
    const b = makeUser({ id: "b", gameType: "recreational" });
    expect(calculateMatchScore(a, b).breakdown.gameType).toBe(0);
  });
});

describe("matchFormat", () => {
  it("no common format → 0", () => {
    const a = makeUser({ id: "a", matchFormats: ["singles"] });
    const b = makeUser({ id: "b", matchFormats: ["doubles"], partnerPreferences: { ...makeUser().partnerPreferences, matchFormats: ["doubles"] } });
    expect(calculateMatchScore(a, b).breakdown.matchFormat).toBe(0);
  });
  it('"both" format matches when preferences accept', () => {
    const a = makeUser({ id: "a", matchFormats: ["both"], partnerPreferences: { ...makeUser().partnerPreferences, matchFormats: ["both"] } });
    const b = makeUser({ id: "b", matchFormats: ["doubles"], partnerPreferences: { ...makeUser().partnerPreferences, matchFormats: ["both"] } });
    expect(calculateMatchScore(a, b).breakdown.matchFormat).toBe(1);
  });
});

describe("age", () => {
  it('"any" preference always passes', () => {
    const a = makeUser({ id: "a", age: 20, partnerPreferences: { ...makeUser().partnerPreferences, ageRange: "any" } });
    const b = makeUser({ id: "b", age: 70, partnerPreferences: { ...makeUser().partnerPreferences, ageRange: "any" } });
    expect(calculateMatchScore(a, b).breakdown.age).toBe(1);
  });
  it("out of range on both sides → 0", () => {
    const a = makeUser({ id: "a", age: 20, partnerPreferences: { ...makeUser().partnerPreferences, ageRange: "2" } });
    const b = makeUser({ id: "b", age: 60, partnerPreferences: { ...makeUser().partnerPreferences, ageRange: "2" } });
    expect(calculateMatchScore(a, b).breakdown.age).toBe(0);
  });
});

describe("gender", () => {
  it("mutual no-preference → 1", () => {
    expect(calculateMatchScore(makeUser({ id: "a" }), makeUser({ id: "b" })).breakdown.gender).toBe(1);
  });
  it("preference respected", () => {
    const a = makeUser({ id: "a", gender: "Male", partnerPreferences: { ...makeUser().partnerPreferences, genderPreference: "Female" } });
    const b = makeUser({ id: "b", gender: "Male", partnerPreferences: { ...makeUser().partnerPreferences, genderPreference: "No Preference" } });
    // a wants Female, b is Male → a not ok. b no pref → ok. → 0.5
    expect(calculateMatchScore(a, b).breakdown.gender).toBe(0.5);
  });
});

describe("guards on missing partnerPreferences", () => {
  it("does not throw when partnerPreferences is undefined", () => {
    const a = makeUser({ id: "a", partnerPreferences: undefined as unknown as UserProfile["partnerPreferences"] });
    const b = makeUser({ id: "b" });
    expect(() => calculateMatchScore(a, b)).not.toThrow();
  });
});

describe("findMatches", () => {
  it("excludes self, incomplete profiles, and below-minScore", () => {
    const me = makeUser({ id: "me" });
    const good = makeUser({ id: "good" });
    const incomplete = makeUser({ id: "inc", profileComplete: false });
    const results = findMatches(me, [me, good, incomplete]);
    expect(results.map((r) => r.user.id)).toEqual(["good"]);
  });

  it("hard-excludes mutual NTRP rejects even if other factors are high", () => {
    const me = makeUser({ id: "me", ntrpRating: 3.5, partnerPreferences: { ...makeUser().partnerPreferences, ntrpMin: 3, ntrpMax: 4 } });
    const bad = makeUser({ id: "bad", ntrpRating: 6.0, partnerPreferences: { ...makeUser().partnerPreferences, ntrpMin: 5.5, ntrpMax: 7 } });
    expect(findMatches(me, [bad])).toHaveLength(0);
  });

  it("sorts by descending score", () => {
    const me = makeUser({ id: "me" });
    const strong = makeUser({ id: "strong" });
    const weak = makeUser({ id: "weak", age: 34, availability: avail({ Mon: [[9, 10]] }) });
    const results = findMatches(me, [weak, strong], 0);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });
});
