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

- [ ] Lock down Firestore security rules (auth-based access)
- [ ] Enable Google Auth provider in Firebase Console
- [ ] Real-time chat via Firestore onSnapshot
- [ ] Auto-create user profile in Firestore on registration
- [ ] Match creation + join flow (users create/join real matches)
- [ ] Score reporting after matches
- [ ] Tailor all content/copy to Lifetime Activities Pleasanton
