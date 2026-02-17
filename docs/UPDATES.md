# UPDATES.md — Pleasanton PlayMatch

---

## 📌 Project Scope

**This app is scoped to a single location: Lifetime Activities in Pleasanton, CA.**

The sole purpose is to help members find tennis and pickleball partners to play with at this club. No multi-location support, no league management, no tournament brackets — just simple partner matching.

If the app gains traction, we'll expand scope later. Until then, keep it focused and lean.

---

## Completed Features

### v0.1 — PWA Foundation (Feb 17, 2026)
- Next.js 15 + shadcn/ui + Tailwind CSS
- PWA: manifest, service worker, installable on mobile
- Mobile-first design: bottom nav on mobile, sidebar on desktop
- Dark/light mode via next-themes
- 8 pages: Landing, Login, Register, Partner Preferences, Dashboard, Open Matches, Profile, Settings
- Mock data: 14 players, 9 matches, AI compatibility scoring
- Color scheme: green (#22c55e) + orange (#f97316)

### v0.2 — Messaging, AI Assistant & Notifications (Feb 17, 2026)
- In-app messaging: conversation list + chat view
- Message bubbles: sent (green), received (gray), AI (orange with 🎾 bot badge)
- AI Match Assistant: rule-based introductions, match suggestions, reminders, follow-ups
- Notifications page with type-based icons/colors
- Bell icon + unread badges in nav
- Notification preferences in Settings (per-type toggles, quiet hours)
- Protected route component for auth gating

### v0.3 — Live Firebase Integration (Feb 17, 2026)
- Firebase Auth: Google sign-in, email/password, password reset, email verification
- Firestore: live database for users, matches, conversations, messages, notifications
- FCM: service worker configured for push notifications
- Seed script (`npm run seed`) to populate Firestore with demo data
- Mock fallback preserved — app works without Firebase env vars
- Analytics support (measurementId)

---

## Firestore Collections

| Collection | Purpose |
|---|---|
| `users` | Player profiles (name, NTRP rating, availability, preferences, stats) |
| `matches` | Match records (players, date, location, sport, score, status) |
| `conversations` | Chat threads between players |
| `messages` | Individual messages within conversations |
| `notifications` | Push notification records |

---

## Firebase Config

Loaded from `.env.local` (not committed):
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

---

## Next Up

### 🔑 Mandatory Onboarding Profile (priority)
First-time users (email/password or Google Auth) are redirected to a **mandatory profile setup** before accessing the app. This is not optional — the app is useless without player preferences.

**Required fields:**
- Display name
- NTRP / skill rating (tennis and/or pickleball)
- Sports played: tennis, pickleball, or both
- What they're looking for in a partner (skill level range, play style, competitive vs casual)
- Weekly availability: specific days and time slots they're free to play
- Contact preferences

**Flow:**
1. User registers or signs in for the first time
2. App detects profile is incomplete → redirects to `/onboarding` (or `/dashboard/profile` in setup mode)
3. User fills out all required fields
4. Profile saved to Firestore → user gains full app access
5. Profile is editable anytime from `/dashboard/profile`
6. If profile is incomplete, all other dashboard routes redirect back to onboarding

### 🎾 Open Matches Flow (priority)
Users can post an open match when they want to play but don't have a partner. Other compatible players can accept it.

**Creating an open match:**
- User taps "Create Open Match" from the Open Matches page
- Fills out: sport (tennis/pickleball), match type (singles/doubles), date, time, any notes
- Match is posted with status `open` and visible to compatible players

**Visibility & notifications:**
- Only players who fit the poster's partner criteria (and vice versa) see the open match
- If notifications are enabled, compatible players get a push notification: "New open match: [Sport] [Type] at [Time] with [User]"

**Accepting a match:**
- Any compatible user can tap "Accept" on the open match
- Match status changes from `open` → `confirmed`
- AI creates a new conversation with both players and sends an intro:
  > "Hey [UserA], meet [UserB]! You're set to play [sport] at [time] today. [UserA], please call Lifetime Activities at (925) 460-8600 to reserve a court. Update here once it's reserved!"
- The match moves to `confirmed` state and appears in both players' upcoming matches

**Match states:**
| Status | Meaning |
|---|---|
| `open` | Posted, waiting for a partner |
| `confirmed` | Partner accepted, court reservation pending |
| `reserved` | Court booked, match is on |
| `completed` | Match played, ready for score reporting |
| `cancelled` | Match was cancelled by either player |

### 👤 User Profile & Partner Preferences (priority)
Mandatory on first login — user cannot access the app until complete. Editable anytime from Profile page.

**User Profile fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| First name | text | ✅ | |
| Last name | text | ✅ | |
| Age | number | ✅ | |
| Gender | select | ✅ | Male / Female / Non-binary / Prefer not to say |
| NTRP rating | select | ✅ | 2.0 – 5.5 in 0.5 increments |
| Match format | multi-select | ✅ | Singles / Doubles / Both |
| Sport | multi-select | ✅ | Tennis / Pickleball / Both |
| Weekly availability | day+time picker | ✅ | Select specific days and hour ranges (e.g. Mon 9am–12pm, Wed 6pm–8pm) |
| Game type | select | ✅ | Recreational / Slightly competitive / Hardcore competitive |
| About me | textarea | ❌ | Optional bio — free text, max 300 chars |

**Partner Preference fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| Age range | select | ✅ | Relative to own age: ±2 years, ±5 years, ±10 years, Any |
| Partner NTRP rating | range select | ✅ | Acceptable NTRP range (e.g. 3.5–4.5) |
| Partner game type | multi-select | ✅ | Recreational / Slightly competitive / Hardcore competitive |
| Sport | multi-select | ✅ | Tennis / Pickleball / Both |
| Match format | multi-select | ✅ | Singles / Doubles / Both |

These fields directly feed the matching engine — every field maps to a scoring criterion.

### 🤝 Partner Matching Engine (priority)
When a user completes their profile, the app immediately calculates compatibility scores against all other users and presents ranked matches.

**How matching works:**
- 100% rule-based — no AI needed for scoring. Static weighted criteria is more predictable, transparent, and debuggable. AI is better used for the conversational side (intros, scheduling help) not the matching logic itself.
- Scores calculated on profile save and recalculated when any user updates their profile

**Scoring criteria (weighted):**

| Criteria | Weight | Description |
|---|---|---|
| Availability overlap | High | Days/times both users are free. Most important — can't play if schedules don't align |
| Sport match | High | Both play tennis, pickleball, or both |
| Skill level (NTRP) | High | Within acceptable range of each other's preferences |
| Match type | Medium | Singles vs doubles preference alignment |
| Play style | Medium | Competitive vs casual — both want the same vibe |
| Partner preferences | Medium | Each user's stated criteria about what they want in a partner |

- **100%** = all criteria match perfectly, overlapping availability, same skill range, same sport, same vibe → no-brainer, play ASAP
- **70-99%** = strong match, most criteria align, minor gaps (e.g. one time slot difference)
- **50-69%** = decent match, worth considering
- **Below 50%** = not shown (or shown at bottom as "other players")

**Match flow:**
1. User completes profile → matching engine runs → ranked list of compatible players shown on dashboard
2. User reviews matches and selects the best one(s)
   - Limit TBD: maybe 1 active match request at a time, maybe up to 3
3. Selected player gets a notification: "[User] wants to match with you!"
4. That player can view the requester's profile → **Accept** or **Decline**
5. If **accepted**:
   - Match appears on both users' dashboards as an accepted match
   - AI creates a group chat and introduces them
   - AI nudges them to schedule a time and reserve a court
6. If **declined**:
   - Requester is notified (generic: "They're not available right now")
   - No hard feelings — both can still appear in each other's future matches

**Match request states:**

| Status | Meaning |
|---|---|
| `pending` | Sent to other player, awaiting response |
| `accepted` | Both players agreed — AI intro chat created |
| `declined` | Other player passed |
| `expired` | No response within X days (TBD) |

### Other
- [ ] Lock down Firestore security rules (auth-based access)
- [ ] Enable Google Auth provider in Firebase Console
- [ ] Real-time chat via Firestore onSnapshot
- [ ] Match creation + join flow (users create/join real matches)
- [ ] Score reporting after matches
- [ ] Tailor all content/copy to Lifetime Activities Pleasanton
