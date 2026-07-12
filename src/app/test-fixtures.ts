import type { Player } from "@/lib/mock-data";
import type { PartnerPreferences, DayAvailability } from "@/lib/matching-engine";

const availability: DayAvailability[] = [
  { day: "Mon", enabled: true, slots: [{ start: 8, end: 21 }] },
  { day: "Tue", enabled: true, slots: [{ start: 8, end: 21 }] },
  { day: "Wed", enabled: true, slots: [{ start: 8, end: 21 }] },
];

const partnerPreferences: PartnerPreferences = {
  ageRange: "any",
  ntrpMin: 0,
  ntrpMax: 7,
  gameTypes: ["recreational", "slightly-competitive", "hardcore-competitive"],
  sports: ["tennis", "pickleball", "both"],
  matchFormats: ["singles", "doubles", "both"],
  genderPreference: "No Preference",
};

/** A fully-onboarded player that passes playerToUserProfile(). */
export function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "u_self",
    name: "Self Player",
    email: "self@example.com",
    ntrpRating: 3.5,
    avatar: "🎾",
    location: "Pleasanton",
    availability: [],
    preferredTimes: [],
    sport: "both",
    matchesPlayed: 4,
    wins: 3,
    losses: 1,
    bio: "hi",
    joinedDate: "2024-01-01",
    firstName: "Self",
    lastName: "Player",
    age: 30,
    gender: "Male",
    aboutMe: "about me",
    sports: ["tennis", "pickleball", "both"],
    matchFormats: ["singles", "doubles", "both"],
    gameType: "slightly-competitive",
    weeklyAvailability: availability,
    partnerPreferences,
    profileComplete: true,
    ...overrides,
  };
}

/** A complete auth-context value with sensible defaults; override as needed. */
export function makeAuth(user: Player | null, overrides: Record<string, unknown> = {}) {
  return {
    user,
    isAuthenticated: !!user,
    profileComplete: user?.profileComplete ?? false,
    loading: false,
    login: () => Promise.resolve(true),
    loginWithGoogle: () => Promise.resolve(true),
    register: () => Promise.resolve(true),
    logout: () => {},
    deleteAccount: () => Promise.resolve(),
    setProfileComplete: () => {},
    updateUserProfile: () => {},
    refreshProfile: () => Promise.resolve(),
    ...overrides,
  };
}
