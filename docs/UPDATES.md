# UPDATES.md — Pleasanton PlayMatch Feature Roadmap

## 1. Firebase Integration

### Firestore Database
Replace all mock data with Firestore collections:
- **`users`** — Player profiles (name, email, NTRP rating, availability, location, preferences, avatar, stats)
- **`matches`** — Match records (players, date, location, score, status: open/confirmed/completed)
- **`conversations`** — Messaging threads between players
- **`messages`** — Individual messages within conversations (sender, text, timestamp, read status)
- **`notifications`** — Push notification records (recipient, type, title, body, read status, timestamp)

Firebase config will be loaded from environment variables (`.env.local`):
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

### Implementation:
- `src/lib/firebase.ts` — Firebase app initialization, Firestore & Auth instances
- `src/lib/firestore.ts` — CRUD helpers for each collection (getUser, updateUser, createMatch, getMatches, sendMessage, etc.)
- Firestore security rules will be documented but applied in Firebase Console
- Real-time listeners via `onSnapshot` for messages and notifications

---

## 2. Authentication (Firebase Auth + Email/Password)

### Google Sign-In
- One-tap Google sign-in on login page
- Auto-create user profile in Firestore on first Google login
- Link Google account to existing email/password account if same email

### Email/Password
- Registration with email + password (min 8 chars, validation)
- Login with email + password
- Password reset via email
- Email verification on registration

### Implementation:
- `src/lib/auth.ts` — Auth helper functions (signInWithGoogle, signInWithEmail, registerWithEmail, signOut, resetPassword)
- `src/contexts/auth-context.tsx` — React context providing current user, loading state, auth methods
- Protected routes: `/dashboard/*` requires authentication, redirects to `/login` if not authenticated
- Auth state persisted via Firebase (survives page refresh)
- Profile creation flow: Register → Set NTRP & preferences → Dashboard

---

## 3. In-App Messaging

### Player-to-Player Chat
- Direct messaging between matched players
- Real-time message delivery via Firestore `onSnapshot`
- Message status: sent, delivered, read
- Typing indicators (optional, via Firestore presence)
- Conversation list with last message preview, unread count, timestamps

### Pages & Components:
- **`/dashboard/messages`** — Conversation list (all active chats)
- **`/dashboard/messages/[conversationId]`** — Individual chat view with message input
- `src/components/message-bubble.tsx` — Styled message bubble (sent vs received)
- `src/components/conversation-card.tsx` — Preview card in conversation list
- `src/components/chat-input.tsx` — Message input with send button

### Firestore Structure:
```
conversations/{conversationId}
  - participants: [userId1, userId2]
  - lastMessage: string
  - lastMessageAt: timestamp
  - createdAt: timestamp

messages/{messageId}
  - conversationId: string
  - senderId: string
  - text: string
  - createdAt: timestamp
  - readBy: [userId1]
```

---

## 4. AI Match Assistant

### Concept
An AI assistant that proactively introduces matched players and helps them schedule matches. It operates as a participant in messaging conversations.

### How It Works:
1. When two players have a compatibility score ≥ 70%, the AI can initiate a conversation
2. The AI sends an intro message: "Hey [Player1] and [Player2]! You're a great match — you're both NTRP [rating] players who like to play [days]. Want to set up a match?"
3. The AI can suggest available times based on both players' schedules
4. The AI can answer questions about court locations, rules, NTRP levels
5. Players can ask the AI for match suggestions: "Find me a doubles partner for Saturday"

### Implementation:
- `src/lib/ai-assistant.ts` — AI message generation logic
- Uses a system prompt with player context (ratings, preferences, availability)
- AI messages appear in chat with a distinct "AI Assistant" avatar and badge
- For MVP: rule-based responses with templates (no external AI API needed initially)
- Future: integrate Google Gemini API for natural language responses
- AI triggers:
  - New high-compatibility match detected → auto-intro message
  - Player asks for match suggestions → AI responds with options
  - Match scheduled → AI sends confirmation and reminders

### AI Message Types:
- **Introduction**: Introduces two compatible players
- **Match Suggestion**: Suggests a time/place based on mutual availability
- **Reminder**: Upcoming match reminder (24h and 1h before)
- **Follow-up**: After a match, asks for score reporting and feedback

---

## 5. Push Notifications (Firebase Cloud Messaging)

### Notification Types:
- **New Message** — "[Player Name] sent you a message"
- **Match Invitation** — "You've been invited to a match on [date]"
- **Match Confirmed** — "Your match with [Player] is confirmed for [date]"
- **Match Reminder** — "Your match starts in 1 hour at [location]"
- **AI Introduction** — "You have a new match suggestion!"
- **Profile Update** — "Someone viewed your profile" (optional)

### Implementation:
- `src/lib/notifications.ts` — FCM setup, permission request, token management
- `public/firebase-messaging-sw.js` — Service worker for background push notifications
- Notification permission prompt on first dashboard visit
- FCM tokens stored in user's Firestore document
- In-app notification bell with unread count (in navbar)
- **`/dashboard/notifications`** — Full notification history page
- Toast notifications for real-time in-app alerts

### Flow:
1. User logs in → app requests notification permission
2. If granted → FCM token saved to Firestore under user doc
3. When event occurs (new message, match invite, etc.) → Cloud Function sends push via FCM
4. If app is open → in-app toast notification
5. If app is backgrounded → system push notification via service worker

### Notification Preferences (in Settings):
- Toggle: New messages
- Toggle: Match invitations
- Toggle: Match reminders
- Toggle: AI suggestions
- Quiet hours: Don't disturb between [time] and [time]

---

## Implementation Order

1. **Firebase setup** — Initialize Firebase, auth context, Firestore helpers
2. **Authentication** — Google + email/password login, protected routes
3. **Firestore data layer** — Replace mock data with Firestore reads/writes
4. **Messaging** — Conversations list, chat view, real-time messages
5. **AI Assistant** — Rule-based intro messages, match suggestions
6. **Notifications** — FCM integration, notification preferences, in-app alerts
