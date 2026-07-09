import { describe, it, expect, beforeEach } from "vitest";
import {
  players,
  matches,
  getPlayerById,
  getOpponent,
  playerToUserProfile,
  RALLY_USER,
  type Player,
  type Match,
} from "./mock-data";

function makePlayer(id: string, extra: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player ${id}`,
    email: `${id}@x.com`,
    ntrpRating: 3.5,
    avatar: "P",
    location: "",
    availability: [],
    preferredTimes: [],
    sport: "tennis",
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    bio: "bio",
    joinedDate: "2024-01-01",
    ...extra,
  };
}

beforeEach(() => {
  players.length = 0;
  matches.length = 0;
});

describe("RALLY_USER", () => {
  it("is a complete bot profile", () => {
    expect(RALLY_USER.id).toBe("rally");
    expect(RALLY_USER.profileComplete).toBe(true);
  });
});

describe("getPlayerById / getOpponent", () => {
  it("finds a player or returns undefined", () => {
    players.push(makePlayer("a"));
    expect(getPlayerById("a")?.id).toBe("a");
    expect(getPlayerById("nope")).toBeUndefined();
  });

  it("getOpponent returns the other participant", () => {
    players.push(makePlayer("a"), makePlayer("b"));
    const match = { player1Id: "a", player2Id: "b" } as Match;
    expect(getOpponent(match, "a")?.id).toBe("b");
    expect(getOpponent(match, "b")?.id).toBe("a");
  });
});

describe("playerToUserProfile", () => {
  it("returns null when the profile is incomplete", () => {
    expect(playerToUserProfile(makePlayer("a", { profileComplete: false }))).toBeNull();
    expect(playerToUserProfile(makePlayer("a", { profileComplete: true, firstName: "A" }))).toBeNull(); // no availability/prefs
  });

  it("maps a complete player to a UserProfile with fallbacks", () => {
    const p = makePlayer("a", {
      profileComplete: true,
      firstName: "Alex",
      lastName: "",
      weeklyAvailability: [{ day: "Mon", enabled: true, slots: [{ start: 9, end: 12 }] }],
      partnerPreferences: {
        ageRange: "any",
        ntrpMin: 3,
        ntrpMax: 4,
        gameTypes: [],
        sports: [],
        matchFormats: [],
        genderPreference: "No Preference",
      },
      sport: "both",
    });
    const profile = playerToUserProfile(p);
    expect(profile).not.toBeNull();
    expect(profile!.firstName).toBe("Alex");
    expect(profile!.age).toBe(30); // default
    expect(profile!.sports).toEqual(["tennis"]); // "both" → "tennis" fallback
    expect(profile!.gameType).toBe("slightly-competitive"); // default
    expect(profile!.matchFormats).toEqual(["singles"]); // default
  });

  it("preserves provided sports/gameType/formats", () => {
    const p = makePlayer("a", {
      profileComplete: true,
      firstName: "Alex",
      weeklyAvailability: [],
      partnerPreferences: { ageRange: "any", ntrpMin: 3, ntrpMax: 4, gameTypes: [], sports: [], matchFormats: [], genderPreference: "No Preference" },
      sports: ["pickleball"],
      gameType: "hardcore-competitive",
      matchFormats: ["doubles"],
      age: 42,
      gender: "Female",
    });
    const profile = playerToUserProfile(p)!;
    expect(profile.sports).toEqual(["pickleball"]);
    expect(profile.gameType).toBe("hardcore-competitive");
    expect(profile.matchFormats).toEqual(["doubles"]);
    expect(profile.age).toBe(42);
    expect(profile.gender).toBe("Female");
  });
});
