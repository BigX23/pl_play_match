/**
 * Partner Matching Engine
 * Pure function scoring algorithm for player compatibility.
 */

export interface TimeSlot {
  start: number; // hour 0-23
  end: number;   // hour 0-23
}

export interface DayAvailability {
  day: string; // "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"
  enabled: boolean;
  slots: TimeSlot[];
}

export type GameType = "recreational" | "slightly-competitive" | "hardcore-competitive";
export type SportType = "tennis" | "pickleball" | "both";
export type MatchFormat = "singles" | "doubles" | "both";
export type AgeRange = "2" | "5" | "10" | "any";

export interface PartnerPreferences {
  ageRange: AgeRange;
  ntrpMin: number;
  ntrpMax: number;
  gameTypes: GameType[];
  sports: SportType[];
  matchFormats: MatchFormat[];
  genderPreference: "Male" | "Female" | "No Preference";
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  avatar: string;
  aboutMe?: string;
  ntrpRating: number;
  sports: SportType[];
  matchFormats: MatchFormat[];
  gameType: GameType;
  availability: DayAvailability[];
  partnerPreferences: PartnerPreferences;
  profileComplete: boolean;
}

export interface MatchResult {
  user: UserProfile;
  score: number;
  breakdown: {
    availability: number;
    sport: number;
    ntrp: number;
    gameType: number;
    matchFormat: number;
    age: number;
    gender: number;
  };
}

// Configurable weights
export const WEIGHTS = {
  availability: 0.25,
  sport: 0.20,
  ntrp: 0.20,
  gameType: 0.10,
  matchFormat: 0.10,
  age: 0.05,
  gender: 0.10,
};

export const MIN_MATCH_SCORE = 50;
export const OPEN_MATCH_MIN_SCORE = 40;

function calcAvailabilityScore(a: DayAvailability[], b: DayAvailability[]): number {
  let totalOverlapHours = 0;
  let totalUserHours = 0;

  for (const dayA of a) {
    if (!dayA.enabled || dayA.slots.length === 0) continue;
    for (const slotA of dayA.slots) {
      totalUserHours += slotA.end - slotA.start;
    }
    const dayB = b.find((d) => d.day === dayA.day);
    if (!dayB || !dayB.enabled || dayB.slots.length === 0) continue;

    for (const slotA of dayA.slots) {
      for (const slotB of dayB.slots) {
        const overlapStart = Math.max(slotA.start, slotB.start);
        const overlapEnd = Math.min(slotA.end, slotB.end);
        if (overlapEnd > overlapStart) {
          totalOverlapHours += overlapEnd - overlapStart;
        }
      }
    }
  }

  if (totalUserHours === 0) return 0;
  return Math.min(1, totalOverlapHours / Math.max(totalUserHours * 0.3, 1));
}

function calcSportScore(a: SportType[], b: SportType[]): number {
  if (a.includes("both") || b.includes("both")) return 1;
  const overlap = a.filter((s) => b.includes(s));
  return overlap.length > 0 ? 1 : 0;
}

function calcNtrpScore(userA: UserProfile, userB: UserProfile): number {
  const aInBRange = userB.ntrpRating >= userA.partnerPreferences.ntrpMin &&
    userB.ntrpRating <= userA.partnerPreferences.ntrpMax;
  const bInARange = userA.ntrpRating >= userB.partnerPreferences.ntrpMin &&
    userA.ntrpRating <= userB.partnerPreferences.ntrpMax;

  if (aInBRange && bInARange) return 1;
  if (aInBRange || bInARange) return 0.5;
  return 0;
}

const GAME_TYPE_ORDER: GameType[] = ["recreational", "slightly-competitive", "hardcore-competitive"];

function calcGameTypeScore(a: GameType, b: GameType): number {
  if (a === b) return 1;
  const idxA = GAME_TYPE_ORDER.indexOf(a);
  const idxB = GAME_TYPE_ORDER.indexOf(b);
  if (Math.abs(idxA - idxB) === 1) return 0.5;
  return 0;
}

function calcMatchFormatScore(a: MatchFormat[], b: MatchFormat[]): number {
  if (a.includes("both") || b.includes("both")) return 1;
  const overlap = a.filter((f) => b.includes(f));
  return overlap.length > 0 ? 1 : 0;
}

function calcAgeScore(userA: UserProfile, userB: UserProfile): number {
  const checkAge = (user: UserProfile, other: UserProfile): boolean => {
    const pref = user.partnerPreferences.ageRange;
    if (pref === "any") return true;
    const range = parseInt(pref);
    return Math.abs(user.age - other.age) <= range;
  };

  const aOk = checkAge(userA, userB);
  const bOk = checkAge(userB, userA);
  if (aOk && bOk) return 1;
  if (aOk || bOk) return 0.5;
  return 0;
}

function calcGenderScore(userA: UserProfile, userB: UserProfile): number {
  const aPref = userA.partnerPreferences?.genderPreference ?? "No Preference";
  const bPref = userB.partnerPreferences?.genderPreference ?? "No Preference";
  const aOk = aPref === "No Preference" || aPref === userB.gender;
  const bOk = bPref === "No Preference" || bPref === userA.gender;
  if (aOk && bOk) return 1;
  if (aOk || bOk) return 0.5;
  return 0;
}

export function calculateMatchScore(userA: UserProfile, userB: UserProfile): MatchResult {
  const breakdown = {
    availability: calcAvailabilityScore(userA.availability, userB.availability),
    sport: calcSportScore(userA.sports, userB.sports),
    ntrp: calcNtrpScore(userA, userB),
    gameType: calcGameTypeScore(userA.gameType, userB.gameType),
    matchFormat: calcMatchFormatScore(userA.matchFormats, userB.matchFormats),
    age: calcAgeScore(userA, userB),
    gender: calcGenderScore(userA, userB),
  };

  const score = Math.round(
    (breakdown.availability * WEIGHTS.availability +
      breakdown.sport * WEIGHTS.sport +
      breakdown.ntrp * WEIGHTS.ntrp +
      breakdown.gameType * WEIGHTS.gameType +
      breakdown.matchFormat * WEIGHTS.matchFormat +
      breakdown.age * WEIGHTS.age +
      breakdown.gender * WEIGHTS.gender) * 100
  );

  return { user: userB, score, breakdown };
}

export function findMatches(
  currentUser: UserProfile,
  allUsers: UserProfile[],
  minScore: number = MIN_MATCH_SCORE
): MatchResult[] {
  return allUsers
    .filter((u) => u.id !== currentUser.id && u.profileComplete)
    .map((u) => calculateMatchScore(currentUser, u))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
