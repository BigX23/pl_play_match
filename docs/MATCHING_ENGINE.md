# Matching Engine

> Full reference for any human or AI agent working on the partner matching system.
> Last updated: 2026-02-24

---

## Overview

The matching engine is a **pure-function, client-side scoring algorithm**. When the dashboard loads, it fetches all player profiles from Firestore, converts them into a canonical `UserProfile` shape, and ranks every other player against the current user using a weighted multi-factor score (0–100). No cloud function or server-side computation is involved — the math happens entirely in the browser.

The engine deliberately does **not** filter on gender preference inside `findMatches`. Instead, `genderPreference` is stored in `PartnerPreferences` and is available to be added to the scoring weights in a future iteration (see [Extending the Engine](#extending-the-engine)).

---

## Relevant Files

| File | Role |
|---|---|
| [src/lib/matching-engine.ts](../src/lib/matching-engine.ts) | **Core algorithm** — all types, scoring functions, `calculateMatchScore`, `findMatches`, weight constants |
| [src/lib/matching-engine.test.ts](../src/lib/matching-engine.test.ts) | Unit tests for every scoring sub-function |
| [src/lib/mock-data.ts](../src/lib/mock-data.ts) | `playerToUserProfile()` adapter — maps Firestore Player docs → `UserProfile` shape consumed by the engine |
| [src/app/dashboard/page.tsx](../src/app/dashboard/page.tsx) | **Only call site** — fetches players, converts profiles, calls `findMatches`, renders ranked results + send-request flow |
| [src/app/onboarding/page.tsx](../src/app/onboarding/page.tsx) | Collects all preference data that feeds the engine (step 4 = Partner Prefs) |
| [src/app/dashboard/profile/page.tsx](../src/app/dashboard/profile/page.tsx) | Allows editing of own preferences and partner preferences post-onboarding |
| [src/lib/firestore.ts](../src/lib/firestore.ts) | `getPlayers()` — reads `users` collection that provides the candidate pool |

---

## Type Definitions

All types are exported from `src/lib/matching-engine.ts`.

```ts
// A single contiguous availability block
interface TimeSlot {
  start: number; // hour 0–23 (e.g. 9 = 9:00 AM)
  end:   number; // hour 0–23 (e.g. 12 = 12:00 PM)
}

// One row in the weekly calendar grid
interface DayAvailability {
  day:     "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  enabled: boolean;
  slots:   TimeSlot[];
}

type GameType    = "recreational" | "slightly-competitive" | "hardcore-competitive";
type SportType   = "tennis" | "pickleball" | "both";
type MatchFormat = "singles" | "doubles" | "both";
type AgeRange    = "2" | "5" | "10" | "any";   // ± years, or no restriction

interface PartnerPreferences {
  ageRange:          AgeRange;
  ntrpMin:           number;                            // 2.0–5.5
  ntrpMax:           number;                            // 2.0–5.5
  gameTypes:         GameType[];
  sports:            SportType[];
  matchFormats:      MatchFormat[];
  genderPreference:  "Male" | "Female" | "No Preference";
}

// The shape the engine operates on — built from Firestore via playerToUserProfile()
interface UserProfile {
  id:                 string;
  firstName:          string;
  lastName:           string;
  age:                number;
  gender:             string;           // player's own gender
  avatar:             string;           // emoji or Storage URL
  aboutMe?:           string;
  ntrpRating:         number;
  sports:             SportType[];
  matchFormats:       MatchFormat[];
  gameType:           GameType;
  availability:       DayAvailability[];  // weeklyAvailability from Firestore
  partnerPreferences: PartnerPreferences;
  profileComplete:    boolean;
}

interface MatchResult {
  user:      UserProfile;
  score:     number;           // 0–100 final weighted score
  breakdown: {
    availability: number;     // 0–1
    sport:        number;     // 0 or 1
    ntrp:         number;     // 0, 0.5, or 1
    gameType:     number;     // 0, 0.5, or 1
    matchFormat:  number;     // 0 or 1
    age:          number;     // 0, 0.5, or 1
  };
}
```

---

## Firestore Fields Read by the Engine

The engine operates on `UserProfile` objects built by `playerToUserProfile()` in `src/lib/mock-data.ts`. The following fields are read from each user's document in the `users` Firestore collection:

| Firestore Field | Maps To | Used In |
|---|---|---|
| `id` | `UserProfile.id` | Deduplication (`u.id !== currentUser.id`) |
| `firstName` | `UserProfile.firstName` | Guard: profile skipped if missing |
| `lastName` | `UserProfile.lastName` | Display only |
| `age` | `UserProfile.age` | Age score |
| `gender` | `UserProfile.gender` | `genderPreference` filtering (future) |
| `ntrpRating` | `UserProfile.ntrpRating` | NTRP score |
| `sports` | `UserProfile.sports` | Sport score |
| `matchFormats` | `UserProfile.matchFormats` | Match format score |
| `gameType` | `UserProfile.gameType` | Game type score |
| `weeklyAvailability` | `UserProfile.availability` | Availability score |
| `partnerPreferences.ageRange` | `PartnerPreferences.ageRange` | Age score |
| `partnerPreferences.ntrpMin` | `PartnerPreferences.ntrpMin` | NTRP score |
| `partnerPreferences.ntrpMax` | `PartnerPreferences.ntrpMax` | NTRP score |
| `partnerPreferences.gameTypes` | `PartnerPreferences.gameTypes` | (stored, not yet scored) |
| `partnerPreferences.sports` | `PartnerPreferences.sports` | (stored, not yet scored) |
| `partnerPreferences.matchFormats` | `PartnerPreferences.matchFormats` | (stored, not yet scored) |
| `partnerPreferences.genderPreference` | `PartnerPreferences.genderPreference` | Gender score |
| `profileComplete` | `UserProfile.profileComplete` | Guard: `false` → excluded from pool |

> **Note:** `playerToUserProfile()` returns `null` if any of `profileComplete`, `firstName`, `weeklyAvailability`, or `partnerPreferences` are missing, and that candidate is silently excluded from the pool.

---

## Scoring Algorithm

### Entry Points

```ts
// Score one pair
calculateMatchScore(userA: UserProfile, userB: UserProfile): MatchResult

// Score current user against all others, filter & sort
findMatches(
  currentUser: UserProfile,
  allUsers:    UserProfile[],
  minScore:    number = 50      // MIN_MATCH_SCORE constant
): MatchResult[]
```

`findMatches` pre-filters to `profileComplete === true` candidates before scoring. Results are returned sorted descending by score.

---

### Weights

```ts
export const WEIGHTS = {
  availability: 0.25,   // 25 pts max
  sport:        0.20,   // 20 pts max
  ntrp:         0.20,   // 20 pts max
  gameType:     0.10,   // 10 pts max
  matchFormat:  0.10,   // 10 pts max
  age:          0.05,   //  5 pts max
  gender:       0.10,   // 10 pts max
};                      // sum = 1.00 → max score = 100
```

Final score formula:

```
score = round(
  (availability * 0.25 +
   sport        * 0.20 +
   ntrp         * 0.20 +
   gameType     * 0.10 +
   matchFormat  * 0.10 +
   age          * 0.05 +
   gender       * 0.10) * 100
)
```

---

### Sub-Scores

Each sub-score function returns a value in `[0, 1]` (or `[0, 0.5, 1]` for step functions).

#### 1. Availability — `calcAvailabilityScore(a, b)` — weight 0.30

Computes the **total hour overlap** between both players' `weeklyAvailability` by iterating every enabled day and every time slot pair, then finding the intersection.

```
overlapHours = Σ max(0, min(slotA.end, slotB.end) - max(slotA.start, slotB.start))
                  for each enabled (day, slotA, slotB) pair

score = min(1, overlapHours / max(totalUserAHours * 0.3, 1))
```

- The denominator target is **30% of user A's total available hours** — so a player who overlaps on even a small fraction of their schedule can still score well.
- Returns `0` if user A has no enabled availability at all.

#### 2. Sport — `calcSportScore(a, b)` — weight 0.20

Binary: `1` if there is any sport in common (or if either player lists `"both"`); `0` if no overlap.

```
if a.includes("both") || b.includes("both") → 1
if intersection(a, b).length > 0 → 1
else → 0
```

#### 3. NTRP — `calcNtrpScore(userA, userB)` — weight 0.20

Mutual range check — each player's rating must fall inside the other's preferred NTRP range.

```
aInBRange = userB.ntrpRating ∈ [userA.prefs.ntrpMin, userA.prefs.ntrpMax]
bInARange = userA.ntrpRating ∈ [userB.prefs.ntrpMin, userB.prefs.ntrpMax]

both → 1
one  → 0.5
none → 0
```

#### 4. Game Type — `calcGameTypeScore(a, b)` — weight 0.15

Ordered ladder: `recreational < slightly-competitive < hardcore-competitive`.

```
same level    → 1
1 step apart  → 0.5
2 steps apart → 0
```

#### 5. Match Format — `calcMatchFormatScore(a, b)` — weight 0.10

Same logic as sport: binary overlap check.

```
if a.includes("both") || b.includes("both") → 1
if intersection(a, b).length > 0 → 1
else → 0
```

#### 6. Age — `calcAgeScore(userA, userB)` — weight 0.05

Mutual check: each player's `ageRange` preference is applied to the age difference.

```
checkAge(user, other):
  if user.prefs.ageRange === "any" → true
  else → |user.age - other.age| <= parseInt(user.prefs.ageRange)

aOk = checkAge(userA, userB)
bOk = checkAge(userB, userA)

both → 1
one  → 0.5
none → 0
```

#### 7. Gender — `calcGenderScore(userA, userB)` — weight 0.10

Mutual check: each player's `genderPreference` is applied against the other player's `gender`.

```
aOk = userA.prefs.genderPreference === "No Preference" || userA.prefs.genderPreference === userB.gender
bOk = userB.prefs.genderPreference === "No Preference" || userB.prefs.genderPreference === userA.gender

both → 1
one  → 0.5   (one player is indifferent; the other has a mismatch)
none → 0    (both players have conflicting gender preferences)
```

This ensures that a user who sets `"Female"` is never ranked highly against a male player, regardless of how well other factors match.

---

### Score Thresholds

| Constant | Value | Usage |
|---|---|---|
| `MIN_MATCH_SCORE` | `50` | Default minimum for `findMatches()` — dashboard suggested matches |
| `OPEN_MATCH_MIN_SCORE` | `40` | Lower threshold available for open-match context (not yet wired to UI) |

---

## Data Flow (Dashboard)

```
Firestore users collection
  └─ getPlayers()                            src/lib/firestore.ts
       └─ Player[]
            └─ playerToUserProfile(p)        src/lib/mock-data.ts
                 └─ UserProfile | null
                      └─ findMatches(me, others, 50)   src/lib/matching-engine.ts
                           └─ MatchResult[]  (sorted desc by score)
                                └─ Rendered as ranked player cards
                                     └─ "Send Match Request" → matchRequests collection
```

---

## Dashboard Integration Detail

Location: `src/app/dashboard/page.tsx` lines ~47–60.

```ts
const myProfile = playerToUserProfile(displayUser as Player);
if (myProfile) {
  const otherProfiles = p
    .filter((pl) => pl.id !== displayUser.id)
    .map(playerToUserProfile)
    .filter(Boolean);
  setMatchResults(findMatches(myProfile, otherProfiles));
}
```

Each `MatchResult` card in the UI shows:
- Player name, avatar, NTRP rating, sports
- `result.score` rendered as a percentage with a `<Progress>` bar
- Score color: green (≥ 80), yellow (≥ 60), orange (< 60)
- A score `breakdown` object is available on every result for debugging (not currently displayed in the UI but accessible via `result.breakdown`)

---

## Extending the Engine

### Adding a new scoring factor (e.g. gender preference)

1. Add the field to `PartnerPreferences` in `src/lib/matching-engine.ts` ✅ *(already done)*
2. Write a `calcXScore(userA, userB): number` function returning `[0, 1]`
3. Add it to the `WEIGHTS` object (ensure weights still sum to 1.0)
4. Include the new dimension in `breakdown` inside `calculateMatchScore()`
5. Update `MatchResult.breakdown` interface
6. Add the field to the onboarding step 4 UI (`src/app/onboarding/page.tsx`) and profile editor (`src/app/dashboard/profile/page.tsx`) ✅ *(already done for gender)*

### Gender preference (current status)

`genderPreference` is **fully active** in the scoring algorithm with a weight of 0.10. It uses a mutual check: both players' preferences must be satisfied for a full score. If only one player's preference is satisfied, the score is 0.5; if neither is satisfied (e.g. user A wants Female but user B is Male, and user B wants Male but user A is Female), the score is 0, penalising the pair by up to 10 points.

---

## Running the Tests

```bash
npx jest src/lib/matching-engine.test.ts
```

The test suite covers: perfect-match high score, no sport overlap, no availability overlap, `findMatches` min-score filtering, and game type step function values.
