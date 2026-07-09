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

/** Merge overlapping/adjacent slots within a day so hours aren't double-counted. */
function mergeSlots(slots: TimeSlot[]): TimeSlot[] {
  const valid = slots.filter((s) => s.end > s.start).sort((x, y) => x.start - y.start);
  const merged: TimeSlot[] = [];
  for (const s of valid) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

function enabledSlotsByDay(av: DayAvailability[]): Map<string, TimeSlot[]> {
  const map = new Map<string, TimeSlot[]>();
  for (const day of av) {
    if (!day.enabled || day.slots.length === 0) continue;
    map.set(day.day, mergeSlots(day.slots));
  }
  return map;
}

function totalHours(byDay: Map<string, TimeSlot[]>): number {
  let sum = 0;
  for (const slots of byDay.values()) for (const s of slots) sum += s.end - s.start;
  return sum;
}

/**
 * One-directional availability score: how much of `a`'s time overlaps with `b`,
 * normalized by `a`'s own hours. Directional by design — combine with min() at
 * the call site for a symmetric, fair score.
 */
function directionalAvailability(
  aByDay: Map<string, TimeSlot[]>,
  bByDay: Map<string, TimeSlot[]>
): number {
  const totalA = totalHours(aByDay);
  if (totalA === 0) return 0;
  let overlap = 0;
  for (const [day, slotsA] of aByDay) {
    const slotsB = bByDay.get(day);
    if (!slotsB) continue;
    for (const sa of slotsA) {
      for (const sb of slotsB) {
        const start = Math.max(sa.start, sb.start);
        const end = Math.min(sa.end, sb.end);
        if (end > start) overlap += end - start;
      }
    }
  }
  return Math.min(1, overlap / Math.max(totalA * 0.3, 1));
}

function calcAvailabilityScore(a: DayAvailability[], b: DayAvailability[]): number {
  const aByDay = enabledSlotsByDay(a);
  const bByDay = enabledSlotsByDay(b);
  // Symmetric: use the weaker of the two directional scores so the value shown
  // to both parties is identical and fair.
  return Math.min(directionalAvailability(aByDay, bByDay), directionalAvailability(bByDay, aByDay));
}

const NO_PREFS: PartnerPreferences = {
  ageRange: "any",
  ntrpMin: 0,
  ntrpMax: 7,
  gameTypes: [],
  sports: [],
  matchFormats: [],
  genderPreference: "No Preference",
};

/** Always return a usable preferences object, guarding malformed docs. */
function prefs(user: UserProfile): PartnerPreferences {
  return user.partnerPreferences ?? NO_PREFS;
}

/**
 * Sport score also respects each user's stated partner-sport preference: if A
 * only wants pickleball partners, B must actually play pickleball.
 */
function calcSportScore(userA: UserProfile, userB: UserProfile): number {
  const bothPlay = (a: SportType[], b: SportType[]) =>
    a.includes("both") || b.includes("both") || a.some((s) => b.includes(s));
  const prefOk = (pref: SportType[], plays: SportType[]) =>
    !pref || pref.length === 0 || pref.includes("both") ||
    plays.includes("both") || pref.some((s) => plays.includes(s));

  if (!bothPlay(userA.sports, userB.sports)) return 0;
  const aWantsB = prefOk(prefs(userA).sports, userB.sports);
  const bWantsA = prefOk(prefs(userB).sports, userA.sports);
  if (aWantsB && bWantsA) return 1;
  if (aWantsB || bWantsA) return 0.5;
  return 0;
}

function calcNtrpScore(userA: UserProfile, userB: UserProfile): number {
  const pa = prefs(userA);
  const pb = prefs(userB);
  const aInBRange = userB.ntrpRating >= pa.ntrpMin && userB.ntrpRating <= pa.ntrpMax;
  const bInARange = userA.ntrpRating >= pb.ntrpMin && userA.ntrpRating <= pb.ntrpMax;

  if (aInBRange && bInARange) return 1;
  if (aInBRange || bInARange) return 0.5;
  return 0;
}

/** True only when neither player accepts the other's NTRP — a hard exclusion. */
export function mutualNtrpReject(userA: UserProfile, userB: UserProfile): boolean {
  return calcNtrpScore(userA, userB) === 0;
}

const GAME_TYPE_ORDER: GameType[] = ["recreational", "slightly-competitive", "hardcore-competitive"];

function calcGameTypeScore(a: GameType, b: GameType): number {
  const idxA = GAME_TYPE_ORDER.indexOf(a);
  const idxB = GAME_TYPE_ORDER.indexOf(b);
  if (idxA < 0 || idxB < 0) return 0; // unknown/corrupt value
  if (idxA === idxB) return 1;
  if (Math.abs(idxA - idxB) === 1) return 0.5;
  return 0;
}

/**
 * Format score respecting each user's stated partner-format preference in
 * addition to whether they both play a common format.
 */
function calcMatchFormatScore(userA: UserProfile, userB: UserProfile): number {
  const common = (a: MatchFormat[], b: MatchFormat[]) =>
    a.includes("both") || b.includes("both") || a.some((f) => b.includes(f));
  const prefOk = (pref: MatchFormat[], plays: MatchFormat[]) =>
    !pref || pref.length === 0 || pref.includes("both") ||
    plays.includes("both") || pref.some((f) => plays.includes(f));

  if (!common(userA.matchFormats, userB.matchFormats)) return 0;
  const aOk = prefOk(prefs(userA).matchFormats, userB.matchFormats);
  const bOk = prefOk(prefs(userB).matchFormats, userA.matchFormats);
  if (aOk && bOk) return 1;
  if (aOk || bOk) return 0.5;
  return 0;
}

function calcAgeScore(userA: UserProfile, userB: UserProfile): number {
  const checkAge = (user: UserProfile, other: UserProfile): boolean => {
    const pref = prefs(user).ageRange;
    if (pref === "any") return true;
    const range = parseInt(pref);
    if (Number.isNaN(range)) return true;
    return Math.abs(user.age - other.age) <= range;
  };

  const aOk = checkAge(userA, userB);
  const bOk = checkAge(userB, userA);
  if (aOk && bOk) return 1;
  if (aOk || bOk) return 0.5;
  return 0;
}

function calcGenderScore(userA: UserProfile, userB: UserProfile): number {
  const aPref = prefs(userA).genderPreference ?? "No Preference";
  const bPref = prefs(userB).genderPreference ?? "No Preference";
  const aOk = aPref === "No Preference" || aPref === userB.gender;
  const bOk = bPref === "No Preference" || bPref === userA.gender;
  if (aOk && bOk) return 1;
  if (aOk || bOk) return 0.5;
  return 0;
}

export function calculateMatchScore(userA: UserProfile, userB: UserProfile): MatchResult {
  const breakdown = {
    availability: calcAvailabilityScore(userA.availability, userB.availability),
    sport: calcSportScore(userA, userB),
    ntrp: calcNtrpScore(userA, userB),
    gameType: calcGameTypeScore(userA.gameType, userB.gameType),
    matchFormat: calcMatchFormatScore(userA, userB),
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
    // Hard exclusion: if neither player accepts the other's NTRP band, never suggest.
    .filter((u) => !mutualNtrpReject(currentUser, u))
    .map((u) => calculateMatchScore(currentUser, u))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
