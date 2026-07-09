# PlayMatch Improvement Plan

Consolidated findings from the 2026-07-08 code review and UI design audit.
Work top-to-bottom: each section is ordered by priority. Items reference `file:line`
as of commit `76df41a` (master). Check items off as they land.

---

## Implementation status (branch `improvement-plan`)

All code items below have been implemented on the `improvement-plan` branch, plus a
vitest unit-test suite. **Three items require manual action by the account owner** and
could not be done from code:

1. **Rotate the Gemini API key** in Google AI Studio (the old key was public in git
   history + the static bundle — treat it as burned). Then set it as a Cloud Functions
   secret: `firebase functions:config:set genai.key="NEW_KEY"` (or a secret env var
   `GOOGLE_GENAI_API_KEY`). The client no longer uses the key at all.
2. **Verify/replace the deployed Firestore rules** in the Firebase console — the new
   `firestore.rules` is in the repo and CI now deploys it, but confirm the live database
   is no longer `allow read, write: if true`.
3. **Move the admin service-account JSON** out of the repo root to a secure location
   (it's gitignored but still on disk).

Everything else — the rules file, the server-side Rally function, the messaging/matches/
auth fixes, the UI token pass, the landing redesign, accessibility, cleanup, and tests —
is done in code. Set the `FIREBASE_TOKEN` GitHub secret to enable the new rules+functions
deploy steps in CI.

---

## P0 — Security (do these first)

### 1. Rotate and re-home the Gemini API key
The key is public two ways: `.env` is tracked in the **public** GitHub repo (since April 2025),
and `NEXT_PUBLIC_GOOGLE_GENAI_API_KEY` is inlined into the served static JS bundle
(`src/lib/ai-assistant.ts:8` + `output: 'export'` in `next.config.ts` — verified present in
`out/_next/static/chunks/app/dashboard/messages/[conversationId]/page-*.js`).

- [ ] Rotate the key in Google AI Studio (the old one must be treated as burned).
- [ ] `git rm --cached .env` and commit; consider purging it from git history (e.g. `git filter-repo`).
- [ ] Move all Gemini calls into a Cloud Function (Firestore-triggered or callable) in `functions/`;
      the key lives only in function config/secrets. Delete the `NEXT_PUBLIC_GOOGLE_GENAI_API_KEY` variant.
- [ ] This also fixes: CI builds silently shipping the canned-reply fallback (the deploy workflow
      never passes the key — `.github/workflows/firebase-deploy.yml`), and Rally replies depending
      on the sender's browser tab staying open (`chat-client.tsx:129-140`).

### 2. Lock down Firestore rules
Committed `firestore.rules` is deny-all, but production demonstrably serves reads and the seed
script (`scripts/seed-firestore.ts`) writes with the *unauthenticated client SDK* — the deployed
rules are almost certainly `allow read, write: if true`. **Verify in the Firebase console.**
Even the documented intent (`if request.auth != null`, `docs/DATABASE_SCHEMA.md:494`) lets any
signed-in user read/write everything.

- [ ] Write real per-collection rules:
  - `users/{uid}`: read auth'd; write only `request.auth.uid == uid`.
  - `matchRequests`: create only if `request.resource.data.fromUserId == request.auth.uid`;
    update only by `toUserId` (status transitions) or `fromUserId` (cancel).
  - `conversations` + `messages`: read/write only if `request.auth.uid in participants`
    (easiest if messages become a subcollection of conversations).
  - `notifications`: owner-only.
- [ ] Deploy rules via CI (add `firebase deploy --only firestore:rules` to the workflow) so
      committed rules == deployed rules.
- [ ] Re-write `scripts/seed-firestore.ts` to use the Admin SDK so rules never need opening.
- [ ] Move the admin service-account JSON (`pl-play-match-firebase-adminsdk-*.json`) out of the
      repo directory entirely; rotate it if it was ever shared.

### 3. Stop leaking private user fields to all clients
`getPlayers()` (`src/lib/firestore.ts:46-53`) downloads the whole `users` collection — every
user's email and FCM token (`src/lib/notifications.ts:63` writes `fcmToken` to the public doc)
goes to every client.

- [ ] Move `fcmToken` and `email` to a private subcollection (e.g. `users/{uid}/private/profile`)
      readable only by the owner and Cloud Functions; update rules accordingly.

---

## P1 — High-impact functional bugs

### Messaging
- [ ] **Make chat live.** Messages are fetched once on mount (`chat-client.tsx:94-103`); there is
      no `onSnapshot` anywhere in the data layer, so the other player's messages never appear
      without a full reload. Add snapshot subscriptions for the message list and conversation list.
- [ ] **Fix the stale-closure send.** `chat-client.tsx:125-126` uses `[...msgs, msg]` inside an
      async handler — two rapid sends make the second erase the first from the UI. Use
      `setMsgs(prev => [...prev, msg])`.
- [ ] **Rebuild unread counts.** `unreadCount` is a single shared number written once at creation
      (`firestore.ts:206,238` — hardcoded `1` for groups) and never incremented/cleared, so group
      chats show a phantom badge forever and real unreads never badge. Use a per-user map
      (`unread: { [uid]: n }`): increment for other participants in `sendMessage`, zero for the
      current user when the chat opens. Then feed the nav badges, which are currently hardcoded
      to `0` (`bottom-nav.tsx:21-24`, `desktop-sidebar.tsx:25-28`).
- [ ] **Fix ID generation.** Conversations use `setDoc` with `conv_${Date.now()}`
      (`firestore.ts:198,227`) — same-millisecond creates overwrite each other; messages persist a
      stale client `id` that shadows the real doc ID on every read (`firestore.ts:298-311`, readers
      spread `...d.data()` *after* `id`). Use deterministic IDs for direct conversations (sorted
      `${uidA}_${uidB}` — also fixes the duplicate-chat race in `createDirectConversation`,
      `firestore.ts:192-217`), `addDoc` for groups, and never store `id` inside the doc.
- [ ] **Server timestamps.** All `createdAt`/`lastMessageAt` are client-clock ISO strings
      (`firestore.ts:71,199,227-239,304`) and queries order by them — a skewed clock reorders
      everyone's history. Use `serverTimestamp()`.
- [ ] **Confirm destructive deletes.** The conversation trash button is `opacity-0
      group-hover:opacity-100` (`conversation-card.tsx:119-127`) — invisible but tappable on touch,
      no confirmation, and `deleteConversation` hard-deletes the conversation + all messages for
      BOTH users (`firestore.ts:151-170`). Make it visible on mobile
      (`opacity-100 md:opacity-0 md:group-hover:opacity-100`), add an AlertDialog confirm (also for
      the chat-screen delete at `chat-client.tsx:217-219`), and consider per-user archive instead
      of hard delete.
- [ ] **Persist the AI flag.** `chat-client.tsx:133-134` sets `isAI` only on the local object;
      other participants lose Rally's styling on reload. Let `sendMessage` accept and persist it.

### Matches
- [ ] **Declined requests block re-requesting forever.** `dashboard/page.tsx:78-80` builds the
      `alreadyRequested` set from ALL requests including declined. Exclude `status === "declined"`
      (and `expired`).
- [ ] **Guard double-submits.** `handleAcceptRequest` (`dashboard/page.tsx:98-115`) can create two
      group conversations + two Rally intros on double-click (buttons never disable while awaiting);
      same for match creation (`open-matches/page.tsx:170-191`). Add per-request in-flight state and
      disable buttons while pending.
- [ ] **Fix the join race.** `handleRequestJoin` (`open-matches/page.tsx:193-201`) blind-writes
      `player2Id` — two simultaneous joiners and one silently loses. Use a Firestore transaction
      that verifies `status === "open" && !player2Id`. Also: withdrawing from a confirmed match
      (`open-matches:242-250`) leaves the group conversation and auto-added contacts orphaned —
      clean them up.
- [ ] **Update stats on score report.** Reported scores (`open-matches:270-277`) never update
      `matchesPlayed`/`wins`/`losses`, so Win Rate is permanently 0%.

### Auth & app shell
- [ ] **Auth can hang forever.** `loadAndSetProfile` (`auth-context.tsx:51-59`) has no try/catch;
      if the profile read rejects, `setLoading(false)` is never reached and the app sticks on the
      loading screen. Wrap in try/finally, fall back to `buildMinimalUser`.
- [ ] **Dashboard crash/blank stats for real users.** `displayUser.ntrpRating.toFixed(1)`
      (`dashboard/page.tsx:144`) throws when rating is missing; `matchesPlayed` (`:141`) renders
      blank for new signups. Use `?? 0` fallbacks like the profile page does.
- [ ] **Dead Settings buttons.** "Change Password" (`settings/page.tsx:170`) and "Delete Account"
      (`:175`) have no onClick. Wire to `resetPassword(user.email)` and a real delete flow, or
      remove until implemented.
- [ ] **Loud failure over silent fallback.** Missing Firebase env at build time silently ships mock
      localStorage auth that accepts ANY password (`firebase.ts:17-19`, `auth-context.tsx:111-128`),
      and Firestore errors return `[]` indistinguishable from empty data (`firestore.ts:279-282`).
      Fail the production build when env is missing; surface read errors in the UI.
- [ ] **Better auth errors.** All auth failures collapse to "Invalid credentials."
      (`auth-context.tsx:122,142,161` bare catches; `login/page.tsx:23-36`); register's Google
      failure sets no error at all (`register/page.tsx:38-41`); onboarding's `handleComplete`
      (`onboarding/page.tsx:95-133`) leaves the button silently dead if `updateUser` throws.
      Surface error codes; add pending/disabled state to submit buttons.

### Cloud Functions
- [ ] **Wrong-audience push.** `onNewConversation` (`functions/src/index.ts:147-166`) sends
      "You've got a new match! 🎾" for ANY conversation create — including direct chats — and also
      notifies the person who initiated it. Gate on `type === "group"`, add `createdBy` to the
      conversation doc, exclude the actor.
- [ ] **Crash guards.** `functions/src/index.ts:80` throws if a message doc has no `text`
      (any client can create one); the token-cleanup `update()` at `:50` can itself reject.
      Guard both.
- [ ] **Notification type mismatch.** `firestore.ts:410-419` creates `type: "match_request"` but
      `notification-card.tsx:8-22` doesn't map it — wrong icon/color. Align the type strings.

---

## P2 — UI design (from the design audit)

### Quick wins (do together — mostly one file)
- [ ] **Wire up the fonts.** `layout.tsx:8-9` loads Geist but `globals.css:6-8` hard-codes
      `font-family: Arial, Helvetica` — the entire app renders in Arial. Set body to
      `var(--font-geist-sans)` (or add it to Tailwind `theme.extend.fontFamily.sans`). Consider a
      distinctive display face for headings while at it.
- [ ] **Token pass in `globals.css`.** The palette is untouched shadcn defaults: pure-white
      surfaces, zero-chroma grays. Tint neutrals slightly toward the brand green (2–3% chroma),
      soften pure white to off-white paper.
- [ ] **One boss accent.** Green `--primary` and orange `--accent` both act as brand carriers
      (orange Register vs green Get Started on the same screen; split-color hero headline).
      Keep green for all interactive elements; demote orange to a sport-tag/Rally color only.
- [ ] **Fix the focus ring.** `--ring: 0 0% 3.9%` (near-black) reads harsh — visible as the heavy
      black outline on the chat input. Use primary green at reduced lightness.
- [ ] **Remove `maximumScale: 1`** (`layout.tsx:21`) — blocks pinch-zoom, WCAG 1.4.4 violation.
- [ ] **Match PWA theme color.** `themeColor: "#22c55e"` (`layout.tsx:22`) ≠ `--primary`
      (hsl 147 51% 41%). Make them the same green.

### Sweeps
- [ ] **Emoji → Lucide.** Replace emoji used as UI icons: 🏆 status icon
      (`open-matches/page.tsx:57`), 🎾/🏓 in badges and select items (`open-matches:400,493`,
      `profile:333,519`), 💪/🔥/🎉 game-type labels (`profile:357,507`), and the 🎾 appended to page
      headings (`dashboard/page.tsx:134`, `onboarding/page.tsx:139`). Keep the emoji *avatar picker*
      (that's content, not iconography).
- [ ] **Rewrite Rally's voice.** The ALL-CAPS + emoji-cluster hype copy ("GAME ON! 🎾🔥 …
      LET'S GO! 🏟️💪") in `dashboard/page.tsx:103`, `open-matches/page.tsx:211`, and the Gemini
      system prompt in `ai-assistant.ts` reads as generated text. Make Rally calm, concrete, and
      brief; deduplicate the intro string into one helper.
- [ ] **Kill `transition-all` + `hover:scale-110`.** Avatar picker and availability toggles
      (`onboarding/page.tsx:186,322`, `profile/page.tsx:280,413`). Transition specific properties;
      one hover signal per element.
- [ ] **Retire the repeated gradient wash.** The identical `bg-gradient-to-br from-green-50
      to-orange-50` appears on landing, login, register, and partner-preferences. Use solid tinted
      paper instead.
- [ ] **Typography niceties.** `…` instead of `...` ("Type a message..." — `chat-input.tsx:28`),
      curly quotes in copy.

### Landing page restructure
- [ ] `src/app/page.tsx` is the canonical AI-template page: full-height centered hero +
      "⚡ AI-Powered Matchmaking" pill + two CTAs + three equal icon cards + one-line footer.
      Restructure: bias the hero off-center, replace the abstract feature cards with something real
      (e.g. an actual match-compatibility card or chat mockup from the product), and give the page
      one asymmetric moment. This is the only page needing structural redesign — the dashboard
      shell (bottom nav + sidebar) is the right pattern and just needs the token pass.

---

## P3 — Accessibility

- [ ] **Keyboard-unreachable required controls.** Sport/format/game-type pickers are clickable
      `Badge` divs with only `onClick` (`onboarding/page.tsx:238-276,349-434`,
      `profile/page.tsx:330-359,462-534`, filter pills in `messages/page.tsx:112-121`). Onboarding
      cannot be completed by keyboard at all. Render as `<button type="button">` or add
      `role="button" tabIndex={0}` + Enter/Space handlers.
- [ ] **NotificationCard clickable div** (`notification-card.tsx:42-62`) isn't keyboard accessible
      when there's no link.

---

## P4 — Quality, tests, hygiene

- [ ] **Make the test suite runnable.** No `test` script, no jest/vitest installed (only
      `@types/jest`) — `matching-engine.test.ts` cannot execute. Add vitest (or jest) + a `test`
      script, run it in the deploy workflow. Also fix the mislabeled test
      (`matching-engine.test.ts:93-103` claims "opposite = 0" but asserts the adjacent 0.5 case)
      and add coverage for NTRP boundaries, age, gender, empty availability.
- [ ] **Matching engine improvements:**
  - Score the collected partner preferences (`gameTypes`/`sports`/`matchFormats` are stored but
    never compared — engine only compares users' own attributes, `matching-engine.ts:165-168`).
  - Availability score is asymmetric (normalized by one side's hours,
    `matching-engine.ts:77-102`) yet persisted and shown to both parties — use
    `min(score(A,B), score(B,A))` for displayed scores; merge overlapping slots before intersecting.
  - Guard `partnerPreferences` uniformly (`calcNtrpScore`:111 and `calcAgeScore`:140 dereference
    unguarded; `calcGenderScore`:153 uses `?.`).
  - `calcGameTypeScore`: unknown values hit `indexOf === -1` and score 0.5 vs "recreational"
    (`:125-128`) — return 0 for invalid values.
  - Consider making mutual NTRP rejection a hard exclusion rather than a soft 20% weight.
- [ ] **AI assistant hardening (post P0 move to server):** use `systemInstruction` instead of
      concatenating the system prompt into the user prompt (`ai-assistant.ts:101` — currently
      injectable); fix `buildHistory` so an oversized newest message doesn't yield an empty prompt
      (`:140-152`); don't hard-slice at 100 words mid-sentence (`:113-116`); consider `@rally`
      mention syntax instead of firing on any "rally" ("great rally!" summons the bot,
      `:71`); migrate off deprecated `@google/generative-ai` to `@google/genai`.
- [ ] **Repo hygiene:** delete committed CI logs (`logs_58485737679/`), site logs
      (`pl-play-match.web.app-*.log`), `screenshots/`; remove dead deps (`genkit` scripts point at
      nonexistent `src/ai/`; `sqlite3` + `@types/sqlite3` unused); delete the orphaned
      `/register/partner-preferences` page (collects input and discards it — superseded by
      onboarding step 4); delete legacy no-caller helpers (`getCompatiblePlayers` with its
      40-point floor, `generateIntroMessage`/`generateMatchSuggestion` in `ai-assistant.ts`).
- [ ] **Strip production console logging** of user IDs, participant lists, and message previews
      (`messages/page.tsx:27-54`, `chat-client.tsx:36`, `conversation-card.tsx:25-26`, throughout
      `firestore.ts`) — gate behind `NODE_ENV`.
- [ ] **Misc small fixes:** duplicate FCM `onMessage` listeners (`notifications.ts:66-75` — keep a
      module singleton); `getAnalytics` without `isSupported()` (`firebase.ts:34-38`); profile
      photo upload has no error handling/validation and leaks object URLs
      (`profile/page.tsx:70-88`); profile edit Cancel doesn't revert state and `parseInt(age)` can
      write `NaN` (`profile/page.tsx:91,216,311,383,451`); `<a href>` instead of `<Link>` for chat
      buttons (`open-matches/page.tsx:330-367`); Enter-to-send fires during IME composition
      (`chat-input.tsx:29` — check `e.nativeEvent.isComposing`); update stale
      `docs/MATCHING_ENGINE.md` (weights and gender scoring don't match code).

---

## UX polish backlog (nice-to-have)

- [ ] Date separators in chat (bubbles show time only — multi-day threads are ambiguous).
- [ ] Empty states for new users' dashboard cards ("Recent Results" renders an empty card).
- [ ] Notify the requester when a match request is declined.
- [ ] "Resend request" affordance (after the declined-block fix lands).

---

## Suggested execution order for a goal run

1. P0 (security) — items 1–3, in order.
2. P1 Messaging + Auth (the app's core loop).
3. P2 Quick wins (one-file token/font pass — biggest visible win per minute).
4. P1 Matches + Cloud Functions.
5. P3, P2 sweeps, P4.
6. Landing page restructure last (largest creative scope).

**Verification:** `npm run typecheck` and `npm run lint` must stay clean; add and run the test
suite from P4 as early as convenient; manually verify chat live-updates with two browsers and
that Firestore rules block cross-user reads (use the emulator or a second test account).
