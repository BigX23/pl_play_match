import { calculateMatchScore, findMatches, type UserProfile } from "./matching-engine";

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "u1",
    firstName: "Test",
    lastName: "User",
    age: 35,
    gender: "Male",
    avatar: "🎾",
    ntrpRating: 3.5,
    sports: ["tennis"],
    matchFormats: ["singles"],
    gameType: "slightly-competitive",
    availability: [
      { day: "Mon", enabled: true, slots: [{ start: 9, end: 12 }] },
      { day: "Wed", enabled: true, slots: [{ start: 18, end: 20 }] },
      { day: "Tue", enabled: false, slots: [] },
      { day: "Thu", enabled: false, slots: [] },
      { day: "Fri", enabled: false, slots: [] },
      { day: "Sat", enabled: false, slots: [] },
      { day: "Sun", enabled: false, slots: [] },
    ],
    partnerPreferences: {
      ageRange: "5",
      ntrpMin: 3.0,
      ntrpMax: 4.0,
      gameTypes: ["slightly-competitive"],
      sports: ["tennis"],
      matchFormats: ["singles"],
      genderPreference: "No Preference" as const,
    },
    profileComplete: true,
    ...overrides,
  };
}

describe("matching engine", () => {
  test("perfect match scores high", () => {
    const userA = makeUser({ id: "a" });
    const userB = makeUser({ id: "b" });
    const result = calculateMatchScore(userA, userB);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  test("no sport overlap scores 0 for sport", () => {
    const userA = makeUser({ id: "a", sports: ["tennis"] });
    const userB = makeUser({ id: "b", sports: ["pickleball"] });
    const result = calculateMatchScore(userA, userB);
    expect(result.breakdown.sport).toBe(0);
  });

  test("no availability overlap scores 0 for availability", () => {
    const userA = makeUser({
      id: "a",
      availability: [
        { day: "Mon", enabled: true, slots: [{ start: 9, end: 12 }] },
        ...["Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => ({ day: d, enabled: false, slots: [] })),
      ],
    });
    const userB = makeUser({
      id: "b",
      availability: [
        { day: "Mon", enabled: false, slots: [] },
        { day: "Tue", enabled: true, slots: [{ start: 9, end: 12 }] },
        ...["Wed", "Thu", "Fri", "Sat", "Sun"].map(d => ({ day: d, enabled: false, slots: [] })),
      ],
    });
    const result = calculateMatchScore(userA, userB);
    expect(result.breakdown.availability).toBe(0);
  });

  test("findMatches filters below minScore", () => {
    const me = makeUser({ id: "me" });
    const good = makeUser({ id: "good" });
    const bad = makeUser({
      id: "bad",
      sports: ["pickleball"],
      ntrpRating: 5.5,
      availability: [
        { day: "Sun", enabled: true, slots: [{ start: 6, end: 7 }] },
        ...["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => ({ day: d, enabled: false, slots: [] })),
      ],
      partnerPreferences: { ageRange: "2" as const, ntrpMin: 5.0, ntrpMax: 5.5, gameTypes: ["hardcore-competitive"], sports: ["pickleball"], matchFormats: ["doubles"], genderPreference: "No Preference" as const },
      gameType: "hardcore-competitive",
      age: 60,
    });
    const results = findMatches(me, [good, bad], 50);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((r) => r.score >= 50)).toBe(true);
  });

  test("game type: same = 1, adjacent = 0.5, opposite = 0", () => {
    const base = makeUser({ id: "a" });
    const same = makeUser({ id: "b", gameType: "slightly-competitive" });
    const adj = makeUser({ id: "c", gameType: "recreational" });
    const opp = makeUser({ id: "d", gameType: "hardcore-competitive" });

    expect(calculateMatchScore(base, same).breakdown.gameType).toBe(1);
    expect(calculateMatchScore(base, adj).breakdown.gameType).toBe(0.5);
    // base is slightly-competitive, opp is hardcore-competitive — adjacent
    expect(calculateMatchScore(base, opp).breakdown.gameType).toBe(0.5);
  });
});
