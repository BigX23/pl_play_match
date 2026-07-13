# Firestore Database Schema  — ⚠️ DEPRECATED / HISTORICAL

> **⚠️ OUT OF DATE.** This describes the original **Firestore** model, which no longer
> exists. PlayMatch was migrated to **PostgreSQL** in July 2026. The current schema is
> defined in code at `src/db/schema.ts` and documented in
> [`ARCHITECTURE.md` §5](./ARCHITECTURE.md#5-data-model-postgres). This file is kept only
> as historical reference for the pre-migration design.

---

## Table of Contents

- [Overview](#overview)
- [Collections](#collections)
  - [users](#users)
  - [matches](#matches)
  - [matchRequests](#matchrequests)
  - [conversations](#conversations)
  - [messages](#messages)
  - [notifications](#notifications)
- [Embedded Types](#embedded-types)
- [Enums & Constants](#enums--constants)
- [Match State Machines](#match-state-machines)
- [Collection Relationships](#collection-relationships)
- [Indexes](#indexes)
- [Security Rules](#security-rules)

---

## Overview

| Collection | Doc ID | Purpose |
|---|---|---|
| `users` | Firebase Auth UID | Player profiles, preferences, stats |
| `matches` | Auto-generated | Match records (open, confirmed, completed) |
| `matchRequests` | Auto-generated | Player-to-player match invitations |
| `conversations` | Auto-generated | Chat threads between players (and AI) |
| `messages` | Auto-generated | Individual chat messages |
| `notifications` | Auto-generated | In-app and push notification records |

---

## Collections

### `users`

Player profiles including onboarding data, skill ratings, availability, and partner preferences.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Document ID — same as Firebase Auth UID |
| `name` | `string` | ✅ | Display name (legacy, `"firstName lastName"`) |
| `email` | `string` | ✅ | Email address (from Firebase Auth) |
| `firstName` | `string` | ✅* | First name (set during onboarding) |
| `lastName` | `string` | ✅* | Last name (set during onboarding) |
| `age` | `number` | ✅* | Player's age |
| `gender` | `string` | ✅* | `"Male"` \| `"Female"` \| `"Non-binary"` \| `"Prefer not to say"` |
| `ntrpRating` | `number` | ✅* | NTRP skill rating (2.0–5.5 in 0.5 increments) |
| `avatar` | `string` | ✅ | Emoji character or photo URL |
| `location` | `string` | ✅ | City/area (e.g. `"Pleasanton, CA"`) |
| `bio` | `string` | ❌ | Legacy bio field |
| `aboutMe` | `string` | ❌ | Free text bio (max 300 chars, onboarding) |
| `sport` | `string` | ✅ | Legacy: `"tennis"` \| `"pickleball"` \| `"both"` |
| `sports` | `SportType[]` | ✅* | Array of sports played |
| `matchFormats` | `MatchFormat[]` | ✅* | `["singles"]`, `["doubles"]`, or `["singles","doubles"]` |
| `gameType` | `GameType` | ✅* | Competitive level preference |
| `availability` | `string[]` | ✅ | Legacy: day names `["Mon","Wed","Fri"]` |
| `preferredTimes` | `string[]` | ✅ | Legacy: `["Morning","Evening"]` |
| `weeklyAvailability` | `DayAvailability[]` | ✅* | Structured weekly schedule with time slots |
| `partnerPreferences` | `PartnerPreferences` | ✅* | What the user wants in a match partner |
| `profileComplete` | `boolean` | ✅ | `false` until onboarding is finished |
| `matchesPlayed` | `number` | ✅ | Total matches played |
| `wins` | `number` | ✅ | Total wins |
| `losses` | `number` | ✅ | Total losses |
| `joinedDate` | `string` | ✅ | ISO date string of registration |

> *Fields marked ✅* are required after onboarding but absent on initial account creation.

#### Example Document

```json
{
  "id": "uid_abc123",
  "name": "Alex Johnson",
  "email": "alex@example.com",
  "firstName": "Alex",
  "lastName": "Johnson",
  "age": 34,
  "gender": "Male",
  "ntrpRating": 3.5,
  "avatar": "🎾",
  "location": "Pleasanton, CA",
  "bio": "Weekend warrior who loves competitive tennis.",
  "aboutMe": "Weekend warrior who loves competitive tennis and casual pickleball.",
  "sport": "both",
  "sports": ["tennis", "pickleball"],
  "matchFormats": ["singles", "doubles"],
  "gameType": "slightly-competitive",
  "availability": ["Mon", "Wed", "Fri", "Sat"],
  "preferredTimes": ["Morning", "Evening"],
  "weeklyAvailability": [
    { "day": "Mon", "enabled": true, "slots": [{ "start": 9, "end": 12 }] },
    { "day": "Tue", "enabled": false, "slots": [] },
    { "day": "Wed", "enabled": true, "slots": [{ "start": 18, "end": 20 }] },
    { "day": "Thu", "enabled": false, "slots": [] },
    { "day": "Fri", "enabled": true, "slots": [{ "start": 17, "end": 19 }] },
    { "day": "Sat", "enabled": true, "slots": [{ "start": 8, "end": 12 }] },
    { "day": "Sun", "enabled": false, "slots": [] }
  ],
  "partnerPreferences": {
    "ageRange": "10",
    "ntrpMin": 3.0,
    "ntrpMax": 4.5,
    "gameTypes": ["slightly-competitive", "recreational"],
    "sports": ["tennis", "pickleball"],
    "matchFormats": ["singles", "doubles"]
  },
  "profileComplete": true,
  "matchesPlayed": 47,
  "wins": 28,
  "losses": 19,
  "joinedDate": "2025-03-15"
}
```

---

### `matches`

Match records covering the full lifecycle from open posting through completion.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Document ID (auto-generated) |
| `player1Id` | `string` | ✅ | UID of first player (or creator for open matches) |
| `player2Id` | `string` | ✅ | UID of second player (empty string for unaccepted open matches) |
| `participants` | `string[]` | ✅ | Array of player UIDs (used for Firestore `array-contains` queries) |
| `date` | `string` | ✅ | Match date (`"YYYY-MM-DD"`) |
| `time` | `string` | ✅ | Match time (`"9:00 AM"`) |
| `location` | `string` | ✅ | Venue name (always `"Lifetime Activities Pleasanton"` for now) |
| `sport` | `string` | ✅ | `"tennis"` \| `"pickleball"` |
| `status` | `string` | ✅ | Match status (see [Match States](#match-states)) |
| `score` | `string` | ❌ | Final score (e.g. `"6-4, 3-6, 7-5"`) — set after completion |
| `compatibilityScore` | `number` | ✅ | 0–100 compatibility score between players |
| `matchExplanation` | `string` | ✅ | Human-readable reason for the match |
| `matchType` | `string` | ❌ | `"singles"` \| `"doubles"` — used for open matches |
| `notes` | `string` | ❌ | Free-text notes from match creator |
| `createdBy` | `string` | ❌ | UID of open match creator |

#### Example Document

```json
{
  "id": "m5",
  "player1Id": "p3",
  "player2Id": "",
  "participants": ["p3"],
  "date": "2026-02-25",
  "time": "2:00 PM",
  "location": "Lifetime Activities Pleasanton",
  "sport": "tennis",
  "status": "open",
  "compatibilityScore": 90,
  "matchExplanation": "Same NTRP 4.0, both competitive players.",
  "matchType": "singles",
  "createdBy": "p3"
}
```

---

### `matchRequests`

Player-to-player match invitations created from the matching engine results.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Document ID (auto-generated) |
| `fromUserId` | `string` | ✅ | UID of the requesting player |
| `toUserId` | `string` | ✅ | UID of the invited player |
| `status` | `string` | ✅ | `"pending"` \| `"accepted"` \| `"declined"` \| `"expired"` |
| `score` | `number` | ✅ | Compatibility score (0–100) at time of request |
| `createdAt` | `string` | ✅ | ISO 8601 timestamp |
| `conversationId` | `string` | ❌ | ID of conversation created on acceptance |

#### Example Document

```json
{
  "id": "mr1",
  "fromUserId": "uid_abc123",
  "toUserId": "uid_def456",
  "status": "accepted",
  "score": 88,
  "createdAt": "2026-02-15T10:00:00Z",
  "conversationId": "conv2"
}
```

---

### `conversations`

Chat threads between two players, optionally including the AI assistant.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Document ID (auto-generated or set on creation) |
| `participants` | `string[]` | ✅ | Array of participant UIDs (includes `"ai"` for AI-mediated chats) |
| `lastMessage` | `string` | ✅ | Text of the most recent message |
| `lastMessageAt` | `string` | ✅ | ISO 8601 timestamp of last message |
| `unreadCount` | `number` | ✅ | Number of unread messages (simplified; per-user tracking TBD) |
| `createdAt` | `string` | ✅ | ISO 8601 timestamp of conversation creation |

#### Example Document

```json
{
  "id": "conv3",
  "participants": ["uid_abc123", "uid_def456", "ai"],
  "lastMessage": "Hey Sarah and Alex! You're both 3.5 NTRP players...",
  "lastMessageAt": "2026-02-14T09:00:00Z",
  "unreadCount": 0,
  "createdAt": "2026-02-14T09:00:00Z"
}
```

---

### `messages`

Individual messages within conversations. Stored as a **top-level collection** (not a subcollection), linked to conversations via `conversationId`.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Document ID (auto-generated) |
| `conversationId` | `string` | ✅ | Reference to parent conversation |
| `senderId` | `string` | ✅ | UID of sender (or `"ai"` for AI messages) |
| `senderName` | `string` | ✅ | Display name of sender (or `"PlayMatch AI"`) |
| `text` | `string` | ✅ | Message body |
| `createdAt` | `string` | ✅ | ISO 8601 timestamp |
| `readBy` | `string[]` | ✅ | Array of UIDs who have read this message |
| `isAI` | `boolean` | ❌ | `true` for AI-generated messages |

#### Example Document

```json
{
  "id": "msg6",
  "conversationId": "conv3",
  "senderId": "ai",
  "senderName": "PlayMatch AI",
  "text": "Hey Sarah and Alex! You're both 3.5 NTRP players who love playing on Mon/Wed/Sat mornings.",
  "createdAt": "2026-02-14T09:00:00Z",
  "readBy": ["ai", "uid_abc123", "uid_def456"],
  "isAI": true
}
```

---

### `notifications`

In-app notification records delivered to individual users.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Document ID (auto-generated) |
| `userId` | `string` | ✅ | UID of the recipient |
| `type` | `NotificationType` | ✅ | Notification category (see [Notification Types](#notification-types)) |
| `title` | `string` | ✅ | Notification title |
| `body` | `string` | ✅ | Notification body text |
| `read` | `boolean` | ✅ | Whether the user has seen it |
| `createdAt` | `string` | ✅ | ISO 8601 timestamp |
| `link` | `string` | ❌ | In-app route to navigate to on tap |

#### Example Document

```json
{
  "id": "n5",
  "userId": "uid_abc123",
  "type": "match_request",
  "title": "New Match Request!",
  "body": "Mike Rodriguez wants to match with you! (78% compatible)",
  "read": false,
  "createdAt": "2026-02-17T06:00:00Z",
  "link": "/dashboard"
}
```

---

## Embedded Types

### `TimeSlot`

```typescript
{
  start: number  // Hour 0–23
  end: number    // Hour 0–23
}
```

### `DayAvailability`

```typescript
{
  day: string       // "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"
  enabled: boolean  // Whether the user is available this day
  slots: TimeSlot[] // Time ranges within the day
}
```

### `PartnerPreferences`

```typescript
{
  ageRange: AgeRange          // "2" | "5" | "10" | "any"
  ntrpMin: number             // Minimum acceptable NTRP (2.0–5.5)
  ntrpMax: number             // Maximum acceptable NTRP (2.0–5.5)
  gameTypes: GameType[]       // Acceptable competitive levels
  sports: SportType[]         // Acceptable sports
  matchFormats: MatchFormat[] // Acceptable formats
}
```

---

## Enums & Constants

### `SportType`
`"tennis"` | `"pickleball"` | `"both"`

### `MatchFormat`
`"singles"` | `"doubles"` | `"both"`

### `GameType`
`"recreational"` | `"slightly-competitive"` | `"hardcore-competitive"`

### `AgeRange`
`"2"` | `"5"` | `"10"` | `"any"` — maximum age difference in years

### `Gender`
`"Male"` | `"Female"` | `"Non-binary"` | `"Prefer not to say"`

### `NotificationType`
| Value | Trigger |
|---|---|
| `new_message` | New chat message received |
| `match_invitation` | Invited to an open match |
| `match_confirmed` | Match partner accepted |
| `match_reminder` | Upcoming match reminder |
| `ai_suggestion` | AI found a compatible partner |
| `match_request` | Someone sent a match request |
| `match_accepted` | Your match request was accepted |
| `match_declined` | Your match request was declined |

---

## Match State Machines

### Match Status (Open Matches)

```
open → confirmed → reserved → completed
  │        │          │
  └→ cancelled  cancelled  cancelled
```

| Status | Description |
|---|---|
| `open` | Posted by a player, waiting for someone to accept |
| `confirmed` | A partner accepted; court reservation pending |
| `reserved` | Court has been booked |
| `completed` | Match was played; score can be reported |
| `cancelled` | Cancelled by either player at any stage |

Legacy statuses: `"upcoming"` (equivalent to `confirmed`/`reserved` in older data).

### Match Request Status

```
pending → accepted
    │  → declined
    │  → expired
```

| Status | Description |
|---|---|
| `pending` | Sent to target player, awaiting response |
| `accepted` | Target accepted — AI intro conversation created |
| `declined` | Target declined |
| `expired` | No response within expiry window |

On **acceptance**: a new `conversations` document is created with an AI intro message, and `conversationId` is written back to the match request.

---

## Collection Relationships

```
users ──────────────────────────────────────────────┐
  │                                                  │
  ├── matches.player1Id / matches.player2Id          │
  ├── matches.createdBy                              │
  ├── matches.participants[]                         │
  ├── matchRequests.fromUserId / .toUserId           │
  ├── conversations.participants[]                   │
  ├── messages.senderId                              │
  └── notifications.userId                           │
                                                     │
matchRequests.conversationId ──→ conversations.id    │
messages.conversationId ──→ conversations.id         │
```

- **users ↔ matches**: `player1Id`, `player2Id`, `createdBy`, and `participants[]` all reference user doc IDs
- **users ↔ matchRequests**: `fromUserId` and `toUserId` reference user doc IDs
- **users ↔ conversations**: `participants[]` contains user doc IDs (plus `"ai"`)
- **users ↔ messages**: `senderId` references a user doc ID (or `"ai"`)
- **users ↔ notifications**: `userId` references a user doc ID
- **matchRequests → conversations**: `conversationId` links accepted requests to their intro chat
- **messages → conversations**: `conversationId` groups messages into threads

---

## Indexes

### Required Composite Indexes

| Collection | Fields | Query |
|---|---|---|
| `matches` | `participants` (array-contains), `status` (==) | Get a user's open/confirmed matches |
| `conversations` | `participants` (array-contains), `lastMessageAt` (desc) | Get a user's conversations sorted by recency |
| `messages` | `conversationId` (==), `createdAt` (asc) | Get messages in a conversation in order |
| `notifications` | `userId` (==), `createdAt` (desc) | Get a user's notifications sorted by recency |
| `notifications` | `userId` (==), `read` (==), `createdAt` (desc) | Get unread notifications |
| `matchRequests` | `fromUserId` (==), `status` (==) | Get a user's sent pending requests |
| `matchRequests` | `toUserId` (==), `status` (==) | Get incoming pending requests |

### Single-Field Indexes (automatic)

Firestore auto-indexes all single fields. No manual configuration needed for:
- `users` by `id`
- `matchRequests` by `fromUserId` or `toUserId`
- `notifications` by `userId`

---

## Security Rules

### Recommended Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- Users ---
    match /users/{userId} {
      // Anyone authenticated can read profiles (needed for matching)
      allow read: if request.auth != null;
      // Users can only write their own profile
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // --- Matches ---
    match /matches/{matchId} {
      // Authenticated users can read all matches (open matches are public)
      allow read: if request.auth != null;
      // Authenticated users can create matches
      allow create: if request.auth != null
        && request.resource.data.createdBy == request.auth.uid;
      // Only participants can update a match
      allow update: if request.auth != null
        && request.auth.uid in resource.data.participants;
    }

    // --- Match Requests ---
    match /matchRequests/{requestId} {
      // Sender or receiver can read
      allow read: if request.auth != null
        && (resource.data.fromUserId == request.auth.uid
            || resource.data.toUserId == request.auth.uid);
      // Authenticated users can create (must be the sender)
      allow create: if request.auth != null
        && request.resource.data.fromUserId == request.auth.uid;
      // Receiver can update status; sender can cancel
      allow update: if request.auth != null
        && (resource.data.fromUserId == request.auth.uid
            || resource.data.toUserId == request.auth.uid);
    }

    // --- Conversations ---
    match /conversations/{convId} {
      // Only participants can read/write
      allow read, write: if request.auth != null
        && request.auth.uid in resource.data.participants;
      // Allow create if user is in participants list
      allow create: if request.auth != null
        && request.auth.uid in request.resource.data.participants;
    }

    // --- Messages ---
    match /messages/{msgId} {
      // Allow read if user is a participant of the parent conversation
      // (requires reading the conversation doc — consider denormalization)
      allow read: if request.auth != null;
      // Allow create if sender matches auth
      allow create: if request.auth != null
        && request.resource.data.senderId == request.auth.uid;
    }

    // --- Notifications ---
    match /notifications/{notifId} {
      // Users can only read their own notifications
      allow read: if request.auth != null
        && resource.data.userId == request.auth.uid;
      // Users can mark their own notifications as read
      allow update: if request.auth != null
        && resource.data.userId == request.auth.uid;
      // System creates notifications (use admin SDK or Cloud Functions)
      allow create: if false;
    }
  }
}
```

### Security Notes

1. **Notifications creation** should use Firebase Admin SDK (Cloud Functions) since users shouldn't create arbitrary notifications for other users.
2. **AI messages** (`senderId: "ai"`) should be created server-side via Cloud Functions, not from the client.
3. **Message read access** is simplified above — for production, denormalize `participants` into each message or use a subcollection under `conversations`.
4. **Rate limiting** match request creation should be enforced server-side to prevent spam.
5. **Profile completeness** should be validated server-side before allowing match creation or requests.

---

## Design Decisions

- **Messages as top-level collection** (not subcollection of conversations): enables simpler cross-conversation queries and Firestore `collectionGroup` isn't needed.
- **`participants` array on matches**: enables `array-contains` queries to find all matches for a user, regardless of whether they're `player1Id` or `player2Id`.
- **Legacy + onboarding fields coexist** on `users`: the app supports both mock mode (legacy fields) and full onboarding (structured fields). Over time, legacy fields (`availability`, `preferredTimes`, `sport`, `bio`) should be deprecated in favor of structured equivalents (`weeklyAvailability`, `sports`, `aboutMe`).
- **`"ai"` as a participant**: the AI assistant is treated as a pseudo-user with the reserved ID `"ai"` and display name `"PlayMatch AI"`.
