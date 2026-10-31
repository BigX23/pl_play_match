# Mobile App Plan — App Store & Play Store via Capacitor

**Status (2026-10-31):** Phase 1 scaffold exists on `feature/capacitor-wrapper`
(`capacitor.config.ts`, `capacitor-shell/`, Capacitor 8.5 packages). No `ios/` or
`android/` projects yet; Xcode (full) and Android Studio are not installed on the
dev Mac. Nothing below has been started.

**Goal:** a "Pleasanton PlayMatch" app that people can download from the Apple App
Store and Google Play. It should pass review and reach feature parity with the PWA,
while the web app keeps deploying exactly as it does today.

Background and the original "PWA now, Capacitor later" decision are in
[DEPLOYMENT_MIGRATION.md](./DEPLOYMENT_MIGRATION.md#mobile-app--decision-pwa-now-capacitor-later).
React Native is still rejected.

---

## 1. Architecture decision for launch

**Ship Phase 1 (remote URL) and add the native features stores need.** The native
shell loads `https://aiplaymatch.com` (`server.url`). Capacitor injects its bridge
into that remote page, so the Next.js app can call native plugins at runtime
behind `Capacitor.isNativePlatform()`.

- Most updates ship through the normal web deploy, with no store review. Only
  native changes (plugins, permissions, icons) need a new binary.
- **Phase 2 (bundling the UI into the app) is deferred.** The app is App Router
  with server components, server actions, and Auth.js DB sessions, so a static
  export means a major refactor. Do Phase 2 only if Apple rejects us under
  guideline 4.2 *after* the native features below are in.
- Because the bridge is exposed to remote content, `server.allowNavigation` must
  stay limited to our own domain. Every other link opens in the system browser
  (see M5).

---

## 2. Store blockers found in the current code

These are the reasons a plain wrapper would be **rejected or would break**. Each one
maps to a task below.

| # | Problem | Why it matters | Task |
|---|---|---|---|
| B1 | Google OAuth runs inside the WebView | Google blocks OAuth in embedded WebViews (`403 disallowed_useragent`). **Sign-in does not work at all.** | A1, A2 |
| B2 | Google is the only login | Apple guideline 4.8: an app that offers third-party login must also offer Sign in with Apple (or an equivalent privacy-preserving login). | A3 |
| B3 | Notifications use Web Push (VAPID) only | WKWebView and Android WebView have no Web Push. Native apps need APNs/FCM tokens. | P1–P3 |
| B4 | No way to block or report other users | Apple 1.2 and Google UGC policy require report, block, and moderation for user-to-user chat. | U1 |
| B5 | No privacy policy or terms pages | Both stores require a privacy policy URL. Apple requires a EULA/terms for UGC apps. | U2 |
| B6 | Account deletion exists, but Apple token revocation does not | Apple 5.1.1(v): deleting an account must also revoke Sign in with Apple tokens. | A3 |
| B7 | Thin wrapper risk | Apple 4.2 (minimum functionality). We counter it with native push, native sign-in, splash and status bar, haptics, share, and deep links. | M1–M6 |
| B8 | Photo upload needs permission strings | iOS crashes or gets rejected without the camera and photo-library usage descriptions in `Info.plist`. | N1 |

Already in place: account deletion (Settings → Delete Account), the manifest and
icons, and `viewport-fit=cover` in the shell. Rally runs on self-hosted Ollama, so
no personal data goes to a third-party AI (Apple 5.1.2(i)). Say so in the privacy
policy.

---

## 3. Human-only gates (Matt)

Subagents **cannot** do these: they involve payment, identity verification,
password entry, accepting legal terms, or large GUI installs. Each task lists the
gate it is blocked on.

| Gate | Action | Notes |
|---|---|---|
| H1 | Install **Xcode** (Mac App Store), open it once, accept the license, install the iOS Simulator runtime. Run `sudo xcode-select -s /Applications/Xcode.app`. | Right now only Command Line Tools are installed. |
| H2 | Install **Android Studio**, the SDK, and an emulator image. Set `ANDROID_HOME`. | |
| H3 | Enroll in the **Apple Developer Program** ($99/yr). Individual is fastest. Organization needs a D-U-N-S number but shows the company name. | Seller name appears on the listing. |
| H4 | Create a **Google Play Console** account ($25). | A new *personal* account must run a **closed test with 12+ testers for 14 consecutive days** before it can go to production. Line up testers early (Pleasanton players). An organization account skips this. |
| H5 | In Apple Developer: create the App ID `com.aiplaymatch.app` with Sign in with Apple, Push Notifications, and Associated Domains. Create an **APNs auth key (.p8)** and a **Sign in with Apple key** plus a Services ID for the web. | Store the keys outside the repo (the VPS `.env` or GH secrets). Pointers only. |
| H6 | In GCP project `pl-play-match`: create **iOS and Android OAuth client IDs**, plus a Firebase app registration for FCM (iOS and Android). Download `GoogleService-Info.plist` and `google-services.json`. | Keep the project. It already hosts web OAuth. |
| H7 | Create a dedicated **App Review demo account** (a Google account, already onboarded in PlayMatch, with sample matches and messages). | Both stores need working reviewer access. |
| H8 | Final store submissions: agreements, tax and banking forms, pressing "Submit for review". | |

Do H1–H4 **now**. Apple enrollment and the Play 14-day closed test are the
longest lead-time items.

---

## 4. Rules for every subagent task

Paste this block at the top of every subagent brief:

- Repo: `~/Documents/vscode/pl_play_match`. Base branch: `feature/capacitor-wrapper`.
  Work on your own branch, `mobile/<task-id>-<slug>`, cut from it (use a git
  worktree when tasks run in parallel). **Never push to `master`, and never deploy.**
- Before reporting done: `npm run typecheck && npm run lint && npm test && npm run build`.
  All of them must pass. Add Vitest tests for new server and lib code, following the
  existing `*.test.ts` patterns.
- Native code is gated behind `Capacitor.isNativePlatform()`. **The web/PWA
  experience must not change** unless the task says so.
- Never write secret values into the repo (it is **public**). Use env-var names and
  point to where the value lives. Native config files that hold keys
  (`GoogleService-Info.plist`, `google-services.json`, keystores) must be
  gitignored or injected in CI.
- When the server needs a new env var, add it to the `deploy/docker-compose.yml`
  passthrough and document it in `docs/OPERATIONS.md`. **Do not edit the VPS.**
- Report: branch name, files changed, test output, anything left unverified, and
  any human gate you hit.

---

## 5. Tasks (subagent-ready)

Format: **ID — title** · *depends on* · *gate* · then steps and a definition of done.

### Wave 0 — Foundations (after H1/H2)

**F1 — Generate native projects** · deps: none · gate: H1, H2
1. Move `@capacitor/core` to `dependencies`. The web app imports it at runtime.
   Keep `cli`, `ios`, and `android` as dev dependencies.
2. Run `npx cap add ios` and `npx cap add android`. Commit `ios/` and `android/`.
   The build artifacts are already gitignored.
3. In `capacitor.config.ts`: add `server.allowNavigation: ["aiplaymatch.com"]`,
   set `android.allowMixedContent: false`, and set the iOS `limitsNavigationsToAppBoundDomains`
   plus `WKAppBoundDomains` = `aiplaymatch.com` in `Info.plist`.
4. Set the bundle IDs to `com.aiplaymatch.app`, version `1.0.0`, build `1`, the iOS
   deployment target, and Android min/target SDK. Use the target SDK Play currently
   requires; check the Play Console policy page.
5. Add npm scripts: `cap:sync`, `cap:ios`, `cap:android`.
- **Done when:** `npx cap run ios` boots the iOS Simulator and `npx cap run android`
  boots the emulator, and both show the live site's login page. Attach screenshots
  to the report.

**F2 — Native bridge helper in the web app** · deps: F1
1. Create `src/lib/native.ts`: `isNative()`, `platform()`, and safe lazy imports of
   plugins, so the web bundle doesn't break when the bridge is absent.
2. Add a `NativeProvider` client component that runs native-only setup at launch:
   status bar, splash hide, back button, and app-URL listener. Mount it in
   `src/app/layout.tsx`.
3. Add unit tests with the Capacitor global mocked both present and absent.
- **Done when:** the web build is unchanged in behavior, the tests pass, and the
  simulator logs "native bridge ready".

### Wave 1 — Parallel workstreams (after F2)

Tasks in different workstreams touch different files and can run at the same
time. Inside a workstream, run tasks in order.

#### Auth (fixes B1, B2, B6)

**A1 — Server: native ID-token sign-in endpoint** · deps: F2 · gate: H6 (client IDs)
1. Add `POST /api/auth/native`. It takes `{ provider: "google" | "apple", idToken, nonce? }`.
2. Verify the token: Google against Google JWKS (aud = the iOS/Android/web client
   IDs), Apple against Apple JWKS (aud = `com.aiplaymatch.app`, check the nonce).
   Use `jose`.
3. Find or create the user and `accounts` row through the same Drizzle adapter
   tables Auth.js uses (provider `google`/`apple`, `providerAccountId` = `sub`).
   Link to an existing user only when the email is verified, so web-created
   accounts sign in seamlessly.
4. Insert a `sessions` row and set the Auth.js session cookie
   (`__Secure-authjs.session-token`, same attributes Auth.js uses) on the response.
   The WebView then has a normal DB session.
5. Rate-limit the endpoint and add tests for the verify, link, and create paths,
   including rejecting a bad aud, an expired token, or a nonce mismatch.
- **Done when:** a curl call with a test-signed token (mocked JWKS in tests) creates
  a session, and existing web sessions are unaffected.

**A2 — Client: native Google sign-in** · deps: A1
1. Add a social-login Capacitor plugin that supports both Google and Apple (for
   example `@capgo/capacitor-social-login`; confirm it is maintained and supports
   Capacitor 8).
2. On `/login`, when `isNative()`, the Google button calls the native sign-in, POSTs
   the ID token to `/api/auth/native`, and then `router.replace("/dashboard")`.
   The web keeps the existing Auth.js redirect flow.
3. Add the iOS URL scheme (reversed client ID) and the Android SHA-1/SHA-256
   fingerprints (debug and release) in GCP. The fingerprints are a human gate (H6).
- **Done when:** a Google sign-in on both the simulator and the emulator lands on
  the dashboard, survives an app restart, and sign-out works.

**A3 — Sign in with Apple (app and web) and revocation** · deps: A1 · gate: H5
1. Native: an Apple button on `/login` (iOS, and Android optionally through the web
   flow) uses the same plugin, then POSTs to `/api/auth/native`.
2. Web: add the Auth.js `Apple` provider (Services ID plus a key-generated client
   secret), so Apple-created users can sign in on the website too.
3. Follow Apple HIG for button styling and order (Apple button at least as
   prominent as Google).
4. Account deletion: when the user has an `apple` account, call Apple's
   `/auth/revoke` with the stored refresh token before deleting. Store the
   refresh token when exchanging the authorization code.
5. Handle Apple private-relay emails (no email-based linking for relay addresses)
   and a `name` that is only provided the first time.
- **Done when:** Apple sign-in works on the iOS Simulator and on the web, deletion
  revokes the token (unit-tested with a mocked Apple endpoint), and the docs are
  updated.

#### Push (fixes B3)

**P1 — Server: native push sender** · deps: F2 · gate: H5 (APNs key uploaded to Firebase), H6
1. Schema: add a `native_push_tokens` table (`user_id`, `token`, `platform` ios|android,
   `created_at`, `last_seen_at`; unique on token) plus a Drizzle migration.
   Migrations auto-apply at boot.
2. `src/server/push.ts`: keep the web-push path. Add an FCM HTTP v1 sender through
   `firebase-admin` with service-account credentials from env (`FCM_SERVICE_ACCOUNT_JSON`
   as a pointer only). FCM delivers to iOS through the uploaded APNs key.
   `sendPushToUser` fans out to both web subscriptions and native tokens, and prunes
   tokens FCM reports as unregistered.
3. Add `POST /api/push/native/register` and `/unregister` routes, with auth
   required.
4. Payload: `title`, `body`, `url` in `data` so a tap can deep-link, plus a badge count.
- **Done when:** the tests cover the fan-out, pruning, and register auth, and the
  web push tests still pass.

**P2 — Client: register for native push** · deps: P1
1. Add `@capacitor-firebase/messaging`, which returns FCM tokens on both platforms,
   or `@capacitor/push-notifications` plus an APNs→FCM mapping. Pick one and justify
   it in the report.
2. Settings → "Enable Push Notifications": when native, request permission and
   register the token. Otherwise keep the existing Web Push flow, including the
   iOS install guidance from #47.
3. On notification tap: navigate the WebView to `data.url`.
4. iOS: enable the Push Notifications and Background Modes (remote notifications)
   capabilities. Android 13+: the `POST_NOTIFICATIONS` runtime permission.
- **Done when:** a real device receives a push for a new message and a match request.
  The Simulator can't receive FCM push; test on a physical iPhone, which needs H3.
  Tapping opens the right conversation.

**P3 — Notification icons and channels** · deps: P2
- Android: a monochrome small icon (`ic_stat_*`), a default notification channel,
  and the accent color. iOS: the badge is cleared when the app opens.
- **Done when:** notifications look correct on Android 14 and on iOS, with
  screenshots.

#### Store-policy compliance (fixes B4, B5). Web-only code, can start right away

**U1 — Block and report users** · deps: none (web feature, benefits the PWA too)
1. Schema: a `user_blocks` table (blocker, blocked) and a `user_reports` table
   (reporter, reported, optional message_id, reason, free text, status, created_at).
2. A blocked user disappears from matches, suggestions, and open games. Neither
   side can start a conversation or send messages. Existing threads are hidden.
   Enforce it server-side in `src/server/data.ts` and in the authz helpers. The
   existing `suggestion_mutes` is *not* sufficient; it is suggestions only.
3. UI: a "Block" and "Report" menu on player profiles and conversation headers,
   and "Report message" on a long-press or menu of messages. Add a confirmation
   dialog and a "Blocked users" list in Settings with unblock.
4. Moderation: each report emails or notifies the admin (feedback@aiplaymatch.com),
   plus a minimal admin list (admin by email allow-list env var). Commit to a
   24-hour response in the terms.
5. Also add a "Report" path for Rally AI responses.
- **Done when:** the tests cover the block enforcement on every read and write path
  plus report creation, and the UI works on the web.

**U2 — Privacy policy, terms/EULA, support page** · deps: none
1. Add `/privacy`, `/terms`, and `/support` as public static pages in `src/app/`,
   linked from login, settings, and the footer.
2. The privacy policy covers: the data collected (Google/Apple profile, name, email,
   photo, skill levels, availability, location area, messages, push tokens), why it
   is collected, retention, deletion (in-app), self-hosted on OVH (US), no third-party
   AI (Rally is self-hosted), FCM/APNs as processors, no ads or tracking, and a
   contact email.
3. The terms include zero tolerance for objectionable content and abusive users,
   the reporting process, and age 13+ (or 17+, matching the rating chosen in S2).
4. Mark it clearly as a draft that **Matt must review**. This is not legal advice.
- **Done when:** the pages render, they are reachable without login, and their
  content matches the actual data practices. Cross-check the schema.

#### Native polish (fixes B7, B8)

**N1 — Permissions and photo upload** · deps: F1
- iOS `Info.plist`: `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription`
  with specific wording ("to set your profile photo"). Android: confirm
  `<input type=file accept=image/*>` opens the picker (WebChromeClient file chooser).
  Add `@capacitor/camera` only if the plain file input fails.
- **Done when:** a profile photo uploads from both the simulator and the emulator.

**M1 — Icons and splash** · deps: F1
- Generate all icon and splash sizes from a 1024×1024 master with `@capacitor/assets`
  (brand bg `#12463A`, matching the shell). There must be no transparency on the
  iOS icon. Add an Android adaptive icon.

**M2 — Status bar, safe areas, splash timing** · deps: F2
- `@capacitor/status-bar` (themed to match), `@capacitor/splash-screen` hidden after
  the first paint. Add `viewport-fit=cover` to the web `viewport` export and
  `env(safe-area-inset-*)` padding on the dashboard shell header and bottom nav,
  gated by a `.native` class so the PWA is unchanged.

**M3 — Android back button and app lifecycle** · deps: F2
- `@capacitor/app`: the back button means history back, and on the dashboard root it
  exits. On resume, reconnect the SSE stream (`src/server/sse.ts` client side) so
  messages aren't stale after backgrounding.

**M4 — Deep links (Universal Links / App Links)** · deps: F1 · gate: H5 (Team ID), signing SHA-256
1. Serve `/.well-known/apple-app-site-association` (no extension,
   `application/json`) and `/.well-known/assetlinks.json` from `public/`. Check that
   Caddy serves them with the right content type, and add a Caddyfile rule if not.
2. iOS Associated Domains `applinks:aiplaymatch.com`, and an Android intent filter
   with `autoVerify`.
3. An `appUrlOpen` listener routes to the path.
- **Done when:** a tapped `https://aiplaymatch.com/dashboard/messages/<id>` link in
  Notes or Messages opens the app at that conversation.

**M5 — External links, share, haptics** · deps: F2
- `mailto:`, `tel:`, and any off-domain link open in the system handler or
  `@capacitor/browser`. Never navigate the WebView off-domain. Add
  `@capacitor/share` for "Invite a partner" or sharing an open game, and light
  haptics on match accept and sending a message.

**M6 — Offline and error screen** · deps: F1
- Turn `capacitor-shell/index.html` into a branded "You're offline — Retry" screen
  that reloads `server.url`. Also handle the WebView load-failure event.

### Wave 2 — Build, test, ship

**T1 — End-to-end test pass on devices** · deps: all of Wave 1 · gate: H3 (device provisioning)
- Use the iOS Simulator plus a physical iPhone (push), and the Android emulator plus
  a physical Android device if possible. Run a scripted checklist: sign in
  (Google, Apple), onboarding, edit profile with a photo, find matches, send a match
  request, accept it, chat in real time, @rally, report a score, push received and
  tapped, block and report, delete the account, sign in again, offline screen, deep
  link, rotation, dark mode, and small and large screens.
- **Done when:** a pass/fail table with screenshots is committed to
  `docs/mobile-test-report.md`.

**C1 — Signing and CI builds** · deps: F1 · gate: H3, H4
1. Android: generate an upload keystore (the human keeps it; it goes in GH secrets
   as base64) and enroll in Play App Signing. Add a GitHub Actions workflow
   `mobile-android.yml` that runs on tag `mobile-v*` and builds a signed **AAB**.
2. iOS: fastlane `match` or Xcode automatic signing. Add a `mobile-ios.yml` workflow
   on a `macos` runner that archives and uploads to **TestFlight** with an App Store
   Connect API key (in GH secrets). For the first release, a manual Xcode archive is
   fine.
3. Version bump script: `versionName`/`CFBundleShortVersionString` from
   `package.json`, build number from the run number.
- **Done when:** a tag produces an AAB artifact and a TestFlight build. Document it
  in `docs/OPERATIONS.md` → "Mobile releases".

**S1 — Store listings and metadata** · deps: U2, M1 · can run alongside T1
- Draft the copy: name, subtitle (30 chars), promo text, description, keywords
  (100 chars, iOS), category (Sports), support/marketing/privacy URLs, and "What's
  new". Add screenshots: 6.9" and 6.5" iPhone, plus Android phone. Optional iPad
  (set `TARGETED_DEVICE_FAMILY=1` to ship iPhone-only and skip iPad screenshots).
  Put it in `store/` as markdown plus PNGs, ready to paste into the consoles.

**S2 — Privacy and content questionnaires** · deps: U1, U2
- Pre-fill the answers for Apple **App Privacy** labels, the Google **Data safety**
  form, the content rating (IARC: user interaction / chat, user-generated content),
  target audience (adults; not designed for children), and the Apple age rating
  (likely 17+ or 13+ because of unrestricted user chat; decide and match the terms).
  Write it to `store/questionnaires.md`.

**R1 — Google Play closed test → production** · deps: C1, T1, S1, S2 · gate: H4, H7, H8
1. Upload the AAB to the internal track, then the **closed testing** track. Invite
   12+ testers (an email list or Google Group) and keep them opted in for 14
   consecutive days.
2. Fix the feedback, then apply for production access, then roll out in stages
   (20% → 100%).

**R2 — App Store: TestFlight → review** · deps: C1, T1, S1, S2 · gate: H3, H7, H8
1. Run an internal TestFlight, then external TestFlight (needs a beta review) with
   local players.
2. Submit with review notes: the demo account, an explanation that Rally is a
   self-hosted AI, where block and report are, that account deletion is in
   Settings, and that sign-in offers Apple and Google.
3. If rejected under 4.2: list the native features (push, native sign-in, deep
   links, share, haptics, offline screen) in the reply. Escalate to Phase 2 only
   after that.

---

## 6. Execution waves at a glance

```
Now (human):   H1 H2 H3 H4   ───────────────┐   (Apple enrollment + Play 14-day test = long poles)
Now (agents):  U1   U2                      │   web-only, no native toolchain needed
                                            ▼
Wave 0:        F1 → F2
Wave 1:        A1→A2→A3 │ P1→P2→P3 │ N1 │ M1 │ M2 │ M3 │ M4 │ M5 │ M6      (parallel lanes)
Wave 2:        C1 ─┬─ T1 ─┬─ R1 (Play closed test 14d → prod)
               S1 ─┤      └─ R2 (TestFlight → App Review)
               S2 ─┘
```

Conflict notes for parallel lanes: A2, A3, and U2 all touch `src/app/login/`, so
run them in sequence or merge carefully. M2, M3, and M5 all extend the
`NativeProvider` from F2, so expect small merge conflicts there. P1 and U1 both
add migrations, so regenerate migration numbering when merging the second one.

## 7. Ongoing costs and operations after launch

- $99/yr Apple, $25 one-time Google.
- Web deploys update the app instantly. **Native releases are needed only** for
  plugin or permission changes, SDK bumps (Play's yearly target-SDK deadline), or
  Capacitor major versions.
- Watch for: Apple's annual agreement renewal, APNs key validity, Play policy
  emails, and the report-moderation queue (a 24-hour SLA was promised in the terms).
