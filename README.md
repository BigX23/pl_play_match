# 🎾 Pleasanton PlayMatch

A modern tennis & pickleball matchmaking app for the Pleasanton community. Find compatible partners, chat, schedule matches, and get AI-powered match suggestions — all from a mobile-first PWA.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-components-black)
![PWA](https://img.shields.io/badge/PWA-installable-green)

---

## ✨ Features

### 🏠 Landing Page
- Hero section with app description and CTAs
- Links to login and registration

### 🔐 Authentication
- Email/password login & registration
- Google sign-in support
- Password reset with email verification
- Protected dashboard routes
- Firebase Auth when configured, localStorage mock fallback

### 🔑 Mandatory Onboarding (NEW)
- 4-step onboarding flow for new users: Basic Info → Play Preferences → Availability → Partner Preferences
- Emoji avatar picker (20 options) or photo upload
- Weekly availability with day toggles and time range pickers
- NTRP rating, sport, match format, game type selection
- Partner preference configuration (age range, NTRP range, game type, sport, format)
- Profile completion required before accessing dashboard
- All dashboard routes redirect to `/onboarding` until profile is complete

### 🤝 Partner Matching Engine (NEW)
- Weighted scoring algorithm: Availability (30%), Sport (20%), NTRP (20%), Game Type (15%), Match Format (10%), Age (5%)
- Scores 0–100%, only shows matches ≥50%
- Real-time match results displayed on dashboard
- "Send Match Request" button on match cards
- Accept/Decline flow with AI-generated intro chat on acceptance

### 📬 Match Request Flow (NEW)
- Send match requests to compatible players
- "New Match Requests" section for incoming requests
- "Pending Requests" section for sent requests
- "Accepted Matches" with direct chat links
- AI creates group conversation with intro message on acceptance

### 📊 Dashboard
- Match compatibility cards with engine-powered scores
- Incoming/outgoing match requests management
- Accepted matches with chat links
- Upcoming matches overview
- Player stats and activity summary

### 🎯 Open Matches (UPDATED)
- Browse available matches in the community
- Filter by sport, skill level, availability
- Join matches with one tap

### 💬 Messaging
- Conversation list with last message preview and unread badges
- Full chat view with message bubbles (sent/received/AI)
- Real-time updates via Firestore (or mock state)
- Auto-scroll to latest messages

### 🤖 AI Match Assistant
- Rule-based matchmaking AI (no external API needed)
- Auto-introductions for compatible players (≥70% compatibility)
- Match time suggestions based on mutual availability
- Pre-match reminders and post-match follow-ups
- Distinct orange styling with 🎾 bot avatar

### 🔔 Notifications
- Notification history with type-based icons and colors
- Types: new message, match invitation, match confirmed, match reminder, AI suggestion
- Bell icon with unread count badge in navbar
- Notification preferences in Settings (quiet hours, per-type toggles)
- FCM service worker ready for push notifications

### 👤 Profile
- View/edit player profile and stats
- NTRP rating, preferred sports, availability
- Match history

### ⚙️ Settings
- Dark/light mode toggle
- Notification preferences
- Account management

### 📱 PWA
- Installable on mobile devices (Add to Home Screen)
- `manifest.json` with app name, theme colors, icons
- Service worker for offline caching
- Mobile-optimized viewport and meta tags

---

## 🗂️ Project Structure

```
pl_play_match/
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service worker
│   ├── sw-register.js             # SW registration script
│   ├── firebase-messaging-sw.js   # FCM service worker (activates with Firebase)
│   ├── icons/                     # PWA icons (192px, 512px)
│   └── images/                    # Static images
├── src/
│   ├── app/
│   │   ├── page.tsx               # Landing page (/)
│   │   ├── layout.tsx             # Root layout (AuthProvider, ThemeProvider)
│   │   ├── login/page.tsx         # Login (/login)
│   │   ├── register/
│   │   │   ├── page.tsx           # Registration (/register)
│   │   │   └── partner-preferences/page.tsx  # Preferences (/register/partner-preferences)
│   │   └── dashboard/
│   │       ├── layout.tsx         # Dashboard layout (sidebar + bottom nav)
│   │       ├── page.tsx           # Dashboard home (/dashboard)
│   │       ├── open-matches/page.tsx      # Open matches
│   │       ├── messages/
│   │       │   ├── page.tsx               # Conversation list
│   │       │   └── [conversationId]/page.tsx  # Chat view
│   │       ├── notifications/page.tsx     # Notification history
│   │       ├── profile/page.tsx           # Player profile
│   │       └── settings/page.tsx          # App settings
│   ├── components/
│   │   ├── bottom-nav.tsx         # Mobile bottom navigation
│   │   ├── desktop-sidebar.tsx    # Desktop sidebar navigation
│   │   ├── chat-input.tsx         # Message input bar
│   │   ├── message-bubble.tsx     # Chat message bubble
│   │   ├── conversation-card.tsx  # Conversation list item
│   │   ├── notification-card.tsx  # Notification list item
│   │   ├── protected-route.tsx    # Auth gate wrapper
│   │   ├── theme-provider.tsx     # Dark/light mode provider
│   │   └── ui/                    # 33 shadcn/ui components
│   └── lib/
│       ├── mock-data.ts           # 14 players, 9 matches, conversations, notifications
│       ├── auth-context.tsx       # Auth state provider
│       ├── auth.ts                # Auth functions (Firebase + mock fallback)
│       ├── firebase.ts            # Firebase initialization (graceful fallback)
│       ├── firestore.ts           # Firestore CRUD (real + mock)
│       ├── ai-assistant.ts        # Rule-based AI matchmaking
│       ├── notifications.ts       # FCM + mock notification handling
│       └── utils.ts               # Utility functions
├── docs/
│   └── UPDATES.md                 # Feature changelog
├── package.json
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── components.json                # shadcn/ui config
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Install & Run

```bash
git clone https://github.com/BigX23/pl_play_match.git
cd pl_play_match
npm install
npm run dev
```

The app runs on **http://localhost:9002** by default.

> **No Firebase required** — the app is fully functional with mock data out of the box.

### Firebase Configuration (Live Mode)

The app now supports **live Firebase** for auth, Firestore, and FCM push notifications. Create a `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

When configured, the app uses:
- **Firebase Auth** for Google sign-in, email/password, and password reset
- **Firestore** for all data (users, matches, conversations, messages, notifications)
- **FCM** for push notifications via service worker
- **Google Analytics** for usage tracking

Without `.env.local`, the app falls back to mock data seamlessly.

### Seed Firestore

To populate Firestore with mock data for development:

```bash
npm run seed
```

> **Note:** Firestore security rules must allow writes for the seed script (uses client SDK without auth). Temporarily set rules to allow all writes, run the seed, then restore rules.

---

## 🎨 Design

- **Colors:** Vibrant green (`#22c55e`), bright orange (`#f97316`), light gray backgrounds
- **Dark/light mode** via `next-themes`
- **Mobile-first** responsive design
- **Bottom nav** on mobile, **sidebar** on desktop
- **Tennis-themed** iconography with Lucide React icons

---

## 🧪 Mock Data

The app ships with realistic mock data:
- **14 players** with NTRP ratings (2.5–5.0), availability, bios
- **9 matches** (upcoming, completed, open)
- **AI compatibility scoring** based on skill level, schedule overlap, sport preference
- **Mock conversations** with player and AI messages
- **Mock notifications** across all notification types

---

## 📝 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI Components | shadcn/ui + Radix UI primitives |
| Styling | Tailwind CSS |
| Theming | next-themes |
| Auth | Firebase Auth (live) + mock fallback |
| Database | Firestore (live) + mock data fallback |
| Analytics | Google Analytics via Firebase |
| Push | Firebase Cloud Messaging (FCM) |
| PWA | Custom service worker + manifest |
| Icons | Lucide React |

---

## 📄 License

Private project.
