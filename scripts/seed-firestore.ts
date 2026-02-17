/**
 * Seed Firestore with mock data.
 *
 * Usage: npx tsx scripts/seed-firestore.ts
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key,
 *   OR run from a GCP environment with default credentials.
 *   Alternatively, set NEXT_PUBLIC_FIREBASE_* env vars and use the client SDK approach below.
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { config } from "dotenv";

// Load .env.local
config({ path: ".env.local" });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("Missing Firebase config. Check .env.local");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Import mock data inline to avoid Next.js path alias issues
const players = [
  { id: "p1", name: "Alex Johnson", email: "alex@example.com", ntrpRating: 3.5, avatar: "", location: "Pleasanton, CA", availability: ["Mon", "Wed", "Fri", "Sat"], preferredTimes: ["Morning", "Evening"], sport: "both", matchesPlayed: 47, wins: 28, losses: 19, bio: "Weekend warrior who loves competitive tennis and casual pickleball.", joinedDate: "2025-03-15" },
  { id: "p2", name: "Sarah Chen", email: "sarah@example.com", ntrpRating: 3.5, avatar: "", location: "Pleasanton, CA", availability: ["Mon", "Wed", "Sat"], preferredTimes: ["Morning"], sport: "tennis", matchesPlayed: 62, wins: 38, losses: 24, bio: "Former college player getting back into the game.", joinedDate: "2024-11-20" },
  { id: "p3", name: "Mike Rodriguez", email: "mike@example.com", ntrpRating: 4.0, avatar: "", location: "Dublin, CA", availability: ["Tue", "Thu", "Sat", "Sun"], preferredTimes: ["Morning", "Afternoon"], sport: "both", matchesPlayed: 89, wins: 55, losses: 34, bio: "Competitive player looking for quality matches.", joinedDate: "2024-08-10" },
  { id: "p4", name: "Emily Watson", email: "emily@example.com", ntrpRating: 3.0, avatar: "", location: "Pleasanton, CA", availability: ["Mon", "Fri", "Sun"], preferredTimes: ["Evening"], sport: "pickleball", matchesPlayed: 31, wins: 18, losses: 13, bio: "Pickleball enthusiast, always up for a fun game!", joinedDate: "2025-01-05" },
  { id: "p5", name: "David Kim", email: "david@example.com", ntrpRating: 4.5, avatar: "", location: "Livermore, CA", availability: ["Wed", "Sat", "Sun"], preferredTimes: ["Morning", "Afternoon"], sport: "tennis", matchesPlayed: 124, wins: 82, losses: 42, bio: "Tournament player, happy to rally with all levels.", joinedDate: "2024-06-01" },
  { id: "p6", name: "Lisa Park", email: "lisa@example.com", ntrpRating: 3.5, avatar: "", location: "Pleasanton, CA", availability: ["Tue", "Thu", "Sat"], preferredTimes: ["Morning", "Evening"], sport: "both", matchesPlayed: 43, wins: 25, losses: 18, bio: "Love both sports! Looking for regular hitting partners.", joinedDate: "2024-12-15" },
  { id: "p7", name: "James Taylor", email: "james@example.com", ntrpRating: 2.5, avatar: "", location: "San Ramon, CA", availability: ["Mon", "Wed", "Fri"], preferredTimes: ["Evening"], sport: "tennis", matchesPlayed: 15, wins: 6, losses: 9, bio: "Beginner looking to improve. Patient partners welcome!", joinedDate: "2025-02-01" },
  { id: "p8", name: "Maria Garcia", email: "maria@example.com", ntrpRating: 3.0, avatar: "", location: "Pleasanton, CA", availability: ["Tue", "Sat", "Sun"], preferredTimes: ["Morning"], sport: "pickleball", matchesPlayed: 52, wins: 30, losses: 22, bio: "Retired and loving pickleball life.", joinedDate: "2024-09-20" },
  { id: "p9", name: "Robert Brown", email: "robert@example.com", ntrpRating: 4.0, avatar: "", location: "Dublin, CA", availability: ["Mon", "Wed", "Fri", "Sun"], preferredTimes: ["Afternoon", "Evening"], sport: "tennis", matchesPlayed: 78, wins: 45, losses: 33, bio: "Serious about improving my game.", joinedDate: "2024-07-12" },
  { id: "p10", name: "Jennifer Lee", email: "jennifer@example.com", ntrpRating: 3.5, avatar: "", location: "Pleasanton, CA", availability: ["Tue", "Thu"], preferredTimes: ["Morning"], sport: "both", matchesPlayed: 36, wins: 20, losses: 16, bio: "Mom of two who plays whenever possible!", joinedDate: "2025-01-22" },
  { id: "p11", name: "Chris Martinez", email: "chris@example.com", ntrpRating: 5.0, avatar: "", location: "Livermore, CA", availability: ["Sat", "Sun"], preferredTimes: ["Morning", "Afternoon"], sport: "tennis", matchesPlayed: 200, wins: 145, losses: 55, bio: "Former D1 player, coaching on the side.", joinedDate: "2024-05-01" },
  { id: "p12", name: "Amanda White", email: "amanda@example.com", ntrpRating: 3.0, avatar: "", location: "San Ramon, CA", availability: ["Mon", "Wed", "Sat"], preferredTimes: ["Evening"], sport: "both", matchesPlayed: 28, wins: 14, losses: 14, bio: "Even win/loss record — I keep things interesting!", joinedDate: "2024-10-30" },
  { id: "p13", name: "Kevin Nguyen", email: "kevin@example.com", ntrpRating: 4.0, avatar: "", location: "Pleasanton, CA", availability: ["Tue", "Thu", "Sat"], preferredTimes: ["Morning", "Evening"], sport: "tennis", matchesPlayed: 95, wins: 58, losses: 37, bio: "Tennis is therapy. Let's hit!", joinedDate: "2024-04-18" },
  { id: "p14", name: "Rachel Adams", email: "rachel@example.com", ntrpRating: 2.5, avatar: "", location: "Dublin, CA", availability: ["Wed", "Fri", "Sun"], preferredTimes: ["Afternoon"], sport: "pickleball", matchesPlayed: 20, wins: 10, losses: 10, bio: "Just started pickleball and I'm hooked!", joinedDate: "2025-02-10" },
];

const matches = [
  { id: "m1", player1Id: "p1", player2Id: "p2", participants: ["p1", "p2"], date: "2026-02-20", time: "9:00 AM", location: "Pleasanton Tennis Park", sport: "tennis", status: "upcoming", compatibilityScore: 92, matchExplanation: "Same NTRP rating, overlapping availability on Mon/Wed/Sat, both prefer morning play." },
  { id: "m2", player1Id: "p1", player2Id: "p6", participants: ["p1", "p6"], date: "2026-02-22", time: "6:00 PM", location: "Val Vista Community Park", sport: "pickleball", status: "upcoming", compatibilityScore: 88, matchExplanation: "Matching NTRP, both enjoy tennis and pickleball, overlapping Sat availability." },
  { id: "m3", player1Id: "p1", player2Id: "p3", participants: ["p1", "p3"], date: "2026-02-15", time: "10:00 AM", location: "Pleasanton Tennis Park", sport: "tennis", status: "completed", score: "6-4, 3-6, 7-5", compatibilityScore: 78, matchExplanation: "Close NTRP ratings, both competitive players." },
  { id: "m4", player1Id: "p1", player2Id: "p10", participants: ["p1", "p10"], date: "2026-02-12", time: "8:00 AM", location: "Muirwood Community Park", sport: "tennis", status: "completed", score: "6-3, 6-4", compatibilityScore: 85, matchExplanation: "Same NTRP, similar play style preferences." },
  { id: "m5", player1Id: "p3", player2Id: "p9", participants: ["p3", "p9"], date: "2026-02-25", time: "2:00 PM", location: "Dublin Sports Grounds", sport: "tennis", status: "open", compatibilityScore: 90, matchExplanation: "Same NTRP 4.0, both in Dublin area." },
  { id: "m6", player1Id: "p5", player2Id: "p11", participants: ["p5", "p11"], date: "2026-02-23", time: "10:00 AM", location: "Livermore Tennis Center", sport: "tennis", status: "open", compatibilityScore: 72, matchExplanation: "Both high-level players in Livermore." },
  { id: "m7", player1Id: "p4", player2Id: "p8", participants: ["p4", "p8"], date: "2026-02-21", time: "9:00 AM", location: "Pleasanton Senior Center Courts", sport: "pickleball", status: "open", compatibilityScore: 94, matchExplanation: "Same NTRP, both pickleball focused." },
  { id: "m8", player1Id: "p7", player2Id: "p14", participants: ["p7", "p14"], date: "2026-02-24", time: "3:00 PM", location: "San Ramon Central Park", sport: "pickleball", status: "open", compatibilityScore: 91, matchExplanation: "Both beginners (2.5 NTRP)." },
  { id: "m9", player1Id: "p1", player2Id: "p13", participants: ["p1", "p13"], date: "2026-02-10", time: "7:00 PM", location: "Pleasanton Tennis Park", sport: "tennis", status: "completed", score: "4-6, 6-3, 6-7(5)", compatibilityScore: 80, matchExplanation: "Close match between 3.5 and 4.0 players." },
];

const conversations = [
  { id: "conv1", participants: ["p1", "p2"], lastMessage: "See you Saturday morning!", lastMessageAt: "2026-02-17T08:30:00Z", unreadCount: 1, createdAt: "2026-02-14T10:00:00Z" },
  { id: "conv2", participants: ["p1", "p6"], lastMessage: "The courts at Val Vista are great for pickleball", lastMessageAt: "2026-02-16T19:00:00Z", unreadCount: 0, createdAt: "2026-02-15T14:00:00Z" },
  { id: "conv3", participants: ["p1", "p2", "ai"], lastMessage: "Hey Sarah and Alex! You're both 3.5 NTRP players who love playing on Mon/Wed/Sat mornings.", lastMessageAt: "2026-02-14T09:00:00Z", unreadCount: 0, createdAt: "2026-02-14T09:00:00Z" },
  { id: "conv4", participants: ["p1", "p13", "ai"], lastMessage: "How did your match with Kevin go? Report your score! 🎾", lastMessageAt: "2026-02-11T10:00:00Z", unreadCount: 1, createdAt: "2026-02-09T12:00:00Z" },
];

const messages = [
  { id: "msg1", conversationId: "conv1", senderId: "p2", senderName: "Sarah Chen", text: "Hey Alex! Looking forward to our match on the 20th.", createdAt: "2026-02-16T10:00:00Z", readBy: ["p2", "p1"] },
  { id: "msg2", conversationId: "conv1", senderId: "p1", senderName: "Alex Johnson", text: "Me too! I've been practicing my backhand 😄", createdAt: "2026-02-16T10:15:00Z", readBy: ["p1", "p2"] },
  { id: "msg3", conversationId: "conv1", senderId: "p2", senderName: "Sarah Chen", text: "See you Saturday morning!", createdAt: "2026-02-17T08:30:00Z", readBy: ["p2"] },
  { id: "msg4", conversationId: "conv2", senderId: "p1", senderName: "Alex Johnson", text: "Hey Lisa, want to play pickleball this Saturday?", createdAt: "2026-02-16T18:00:00Z", readBy: ["p1", "p6"] },
  { id: "msg5", conversationId: "conv2", senderId: "p6", senderName: "Lisa Park", text: "The courts at Val Vista are great for pickleball", createdAt: "2026-02-16T19:00:00Z", readBy: ["p6", "p1"] },
  { id: "msg6", conversationId: "conv3", senderId: "ai", senderName: "PlayMatch AI", text: "Hey Sarah and Alex! You're both 3.5 NTRP players who love playing on Mon/Wed/Sat mornings. Want to set up a match this week?", createdAt: "2026-02-14T09:00:00Z", readBy: ["ai", "p1", "p2"], isAI: true },
  { id: "msg7", conversationId: "conv4", senderId: "ai", senderName: "PlayMatch AI", text: "Hey Alex and Kevin! You're both competitive players who enjoy evening tennis.", createdAt: "2026-02-09T12:00:00Z", readBy: ["ai", "p1", "p13"], isAI: true },
  { id: "msg8", conversationId: "conv4", senderId: "p1", senderName: "Alex Johnson", text: "Sounds good! Kevin, are you free this Tuesday evening?", createdAt: "2026-02-09T13:00:00Z", readBy: ["p1", "p13"] },
  { id: "msg9", conversationId: "conv4", senderId: "p13", senderName: "Kevin Nguyen", text: "Tuesday works! 7pm at Pleasanton Tennis Park?", createdAt: "2026-02-09T14:00:00Z", readBy: ["p13", "p1"] },
  { id: "msg10", conversationId: "conv4", senderId: "ai", senderName: "PlayMatch AI", text: "How did your match with Kevin go? Report your score! 🎾", createdAt: "2026-02-11T10:00:00Z", readBy: ["ai"], isAI: true },
];

const notifications = [
  { id: "n1", userId: "p1", type: "new_message", title: "New message from Sarah", body: "See you Saturday morning!", read: false, createdAt: "2026-02-17T08:30:00Z", link: "/dashboard/messages/conv1" },
  { id: "n2", userId: "p1", type: "match_confirmed", title: "Match Confirmed!", body: "Your match with Sarah Chen on Feb 20 at 9:00 AM is confirmed.", read: false, createdAt: "2026-02-16T12:00:00Z", link: "/dashboard/open-matches" },
  { id: "n3", userId: "p1", type: "ai_suggestion", title: "New Match Suggestion", body: "PlayMatch AI found a great partner for you — Lisa Park (3.5 NTRP)!", read: true, createdAt: "2026-02-15T14:00:00Z", link: "/dashboard/messages/conv2" },
  { id: "n4", userId: "p1", type: "match_reminder", title: "Match Tomorrow!", body: "Your match with Sarah Chen is tomorrow at 9:00 AM.", read: true, createdAt: "2026-02-19T18:00:00Z" },
  { id: "n5", userId: "p1", type: "match_invitation", title: "Match Invitation", body: "Mike Rodriguez invited you to play tennis on Feb 25.", read: true, createdAt: "2026-02-14T10:00:00Z", link: "/dashboard/open-matches" },
  { id: "n6", userId: "p1", type: "ai_suggestion", title: "Post-Match Follow Up", body: "How did your match with Kevin go? Don't forget to report your score!", read: false, createdAt: "2026-02-11T10:00:00Z", link: "/dashboard/messages/conv4" },
];

async function seed() {
  console.log("🌱 Seeding Firestore...\n");

  // Check if already seeded
  const usersSnap = await getDocs(collection(db, "users"));
  if (usersSnap.size > 0) {
    console.log(`⚠️  Firestore already has ${usersSnap.size} users. Overwriting...`);
  }

  // Seed users
  for (const p of players) {
    const { id, ...data } = p;
    await setDoc(doc(db, "users", id), data);
  }
  console.log(`✅ Seeded ${players.length} users`);

  // Seed matches
  for (const m of matches) {
    const { id, ...data } = m;
    await setDoc(doc(db, "matches", id), data);
  }
  console.log(`✅ Seeded ${matches.length} matches`);

  // Seed conversations
  for (const c of conversations) {
    const { id, ...data } = c;
    await setDoc(doc(db, "conversations", id), data);
  }
  console.log(`✅ Seeded ${conversations.length} conversations`);

  // Seed messages
  for (const msg of messages) {
    const { id, ...data } = msg;
    await setDoc(doc(db, "messages", id), data);
  }
  console.log(`✅ Seeded ${messages.length} messages`);

  // Seed notifications
  for (const n of notifications) {
    const { id, ...data } = n;
    await setDoc(doc(db, "notifications", id), data);
  }
  console.log(`✅ Seeded ${notifications.length} notifications`);

  console.log("\n🎉 Firestore seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
