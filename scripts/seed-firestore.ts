/**
 * Seed Firestore with mock data.
 *
 * Usage: npx tsx scripts/seed-firestore.ts
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection, getDocs } from "firebase/firestore";
import { config } from "dotenv";

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

function makeWeek(schedule: Record<string, { start: number; end: number }[]>) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((d) => ({ day: d, enabled: !!schedule[d], slots: schedule[d] || [] }));
}

const players = [
  { id: "p1", name: "Alex Johnson", email: "alex@example.com", ntrpRating: 3.5, avatar: "🎾", location: "Pleasanton, CA", availability: ["Mon", "Wed", "Fri", "Sat"], preferredTimes: ["Morning", "Evening"], sport: "both", matchesPlayed: 47, wins: 28, losses: 19, bio: "Weekend warrior who loves competitive tennis and casual pickleball.", joinedDate: "2025-03-15", firstName: "Alex", lastName: "Johnson", age: 34, gender: "Male", aboutMe: "Weekend warrior!", sports: ["tennis", "pickleball"], matchFormats: ["singles", "doubles"], gameType: "slightly-competitive", weeklyAvailability: makeWeek({ Mon: [{ start: 9, end: 12 }], Wed: [{ start: 18, end: 20 }], Fri: [{ start: 17, end: 19 }], Sat: [{ start: 8, end: 12 }] }), partnerPreferences: { ageRange: "10", ntrpMin: 3.0, ntrpMax: 4.5, gameTypes: ["slightly-competitive", "recreational"], sports: ["tennis", "pickleball"], matchFormats: ["singles", "doubles"] }, profileComplete: true },
  { id: "p2", name: "Sarah Chen", email: "sarah@example.com", ntrpRating: 3.5, avatar: "💪", location: "Pleasanton, CA", availability: ["Mon", "Wed", "Sat"], preferredTimes: ["Morning"], sport: "tennis", matchesPlayed: 62, wins: 38, losses: 24, bio: "Former college player.", joinedDate: "2024-11-20", firstName: "Sarah", lastName: "Chen", age: 31, gender: "Female", sports: ["tennis"], matchFormats: ["singles"], gameType: "slightly-competitive", weeklyAvailability: makeWeek({ Mon: [{ start: 8, end: 11 }], Wed: [{ start: 9, end: 12 }], Sat: [{ start: 8, end: 11 }] }), partnerPreferences: { ageRange: "5", ntrpMin: 3.0, ntrpMax: 4.0, gameTypes: ["slightly-competitive"], sports: ["tennis"], matchFormats: ["singles", "doubles"] }, profileComplete: true },
  { id: "p3", name: "Mike Rodriguez", email: "mike@example.com", ntrpRating: 4.0, avatar: "🔥", location: "Dublin, CA", availability: ["Tue", "Thu", "Sat", "Sun"], preferredTimes: ["Morning", "Afternoon"], sport: "both", matchesPlayed: 89, wins: 55, losses: 34, bio: "Competitive player.", joinedDate: "2024-08-10", firstName: "Mike", lastName: "Rodriguez", age: 38, gender: "Male", sports: ["tennis", "pickleball"], matchFormats: ["singles", "doubles"], gameType: "hardcore-competitive", weeklyAvailability: makeWeek({ Tue: [{ start: 7, end: 10 }], Thu: [{ start: 7, end: 10 }], Sat: [{ start: 9, end: 14 }], Sun: [{ start: 9, end: 14 }] }), partnerPreferences: { ageRange: "10", ntrpMin: 3.5, ntrpMax: 4.5, gameTypes: ["slightly-competitive", "hardcore-competitive"], sports: ["tennis", "pickleball"], matchFormats: ["singles"] }, profileComplete: true },
  { id: "p4", name: "Emily Watson", email: "emily@example.com", ntrpRating: 3.0, avatar: "🏓", location: "Pleasanton, CA", availability: ["Mon", "Fri", "Sun"], preferredTimes: ["Evening"], sport: "pickleball", matchesPlayed: 31, wins: 18, losses: 13, bio: "Pickleball enthusiast!", joinedDate: "2025-01-05", firstName: "Emily", lastName: "Watson", age: 45, gender: "Female", sports: ["pickleball"], matchFormats: ["doubles"], gameType: "recreational", weeklyAvailability: makeWeek({ Mon: [{ start: 17, end: 20 }], Fri: [{ start: 17, end: 20 }], Sun: [{ start: 10, end: 14 }] }), partnerPreferences: { ageRange: "10", ntrpMin: 2.5, ntrpMax: 3.5, gameTypes: ["recreational", "slightly-competitive"], sports: ["pickleball"], matchFormats: ["doubles"] }, profileComplete: true },
  { id: "p5", name: "David Kim", email: "david@example.com", ntrpRating: 4.5, avatar: "🏆", location: "Livermore, CA", availability: ["Wed", "Sat", "Sun"], preferredTimes: ["Morning", "Afternoon"], sport: "tennis", matchesPlayed: 124, wins: 82, losses: 42, bio: "Tournament player.", joinedDate: "2024-06-01", firstName: "David", lastName: "Kim", age: 29, gender: "Male", sports: ["tennis"], matchFormats: ["singles"], gameType: "hardcore-competitive", weeklyAvailability: makeWeek({ Wed: [{ start: 6, end: 9 }], Sat: [{ start: 8, end: 13 }], Sun: [{ start: 8, end: 13 }] }), partnerPreferences: { ageRange: "any", ntrpMin: 3.5, ntrpMax: 5.5, gameTypes: ["slightly-competitive", "hardcore-competitive"], sports: ["tennis"], matchFormats: ["singles"] }, profileComplete: true },
  { id: "p6", name: "Lisa Park", email: "lisa@example.com", ntrpRating: 3.5, avatar: "⭐", location: "Pleasanton, CA", availability: ["Tue", "Thu", "Sat"], preferredTimes: ["Morning", "Evening"], sport: "both", matchesPlayed: 43, wins: 25, losses: 18, bio: "Love both sports!", joinedDate: "2024-12-15", firstName: "Lisa", lastName: "Park", age: 33, gender: "Female", sports: ["tennis", "pickleball"], matchFormats: ["singles", "doubles"], gameType: "slightly-competitive", weeklyAvailability: makeWeek({ Tue: [{ start: 9, end: 11 }], Thu: [{ start: 9, end: 11 }], Sat: [{ start: 8, end: 12 }, { start: 17, end: 19 }] }), partnerPreferences: { ageRange: "10", ntrpMin: 3.0, ntrpMax: 4.0, gameTypes: ["recreational", "slightly-competitive"], sports: ["tennis", "pickleball"], matchFormats: ["singles", "doubles"] }, profileComplete: true },
  { id: "p7", name: "James Taylor", email: "james@example.com", ntrpRating: 2.5, avatar: "🦊", location: "San Ramon, CA", availability: ["Mon", "Wed", "Fri"], preferredTimes: ["Evening"], sport: "tennis", matchesPlayed: 15, wins: 6, losses: 9, bio: "Beginner looking to improve.", joinedDate: "2025-02-01", firstName: "James", lastName: "Taylor", age: 27, gender: "Male", sports: ["tennis"], matchFormats: ["singles"], gameType: "recreational", weeklyAvailability: makeWeek({ Mon: [{ start: 18, end: 21 }], Wed: [{ start: 18, end: 21 }], Fri: [{ start: 18, end: 21 }] }), partnerPreferences: { ageRange: "5", ntrpMin: 2.0, ntrpMax: 3.5, gameTypes: ["recreational", "slightly-competitive"], sports: ["tennis"], matchFormats: ["singles"] }, profileComplete: true },
  { id: "p8", name: "Maria Garcia", email: "maria@example.com", ntrpRating: 3.0, avatar: "🌟", location: "Pleasanton, CA", availability: ["Tue", "Sat", "Sun"], preferredTimes: ["Morning"], sport: "pickleball", matchesPlayed: 52, wins: 30, losses: 22, bio: "Retired and loving pickleball.", joinedDate: "2024-09-20", firstName: "Maria", lastName: "Garcia", age: 62, gender: "Female", sports: ["pickleball"], matchFormats: ["doubles"], gameType: "recreational", weeklyAvailability: makeWeek({ Tue: [{ start: 8, end: 11 }], Sat: [{ start: 8, end: 11 }], Sun: [{ start: 8, end: 11 }] }), partnerPreferences: { ageRange: "any", ntrpMin: 2.5, ntrpMax: 3.5, gameTypes: ["recreational"], sports: ["pickleball"], matchFormats: ["doubles"] }, profileComplete: true },
  { id: "p9", name: "Robert Brown", email: "robert@example.com", ntrpRating: 4.0, avatar: "🦁", location: "Dublin, CA", availability: ["Mon", "Wed", "Fri", "Sun"], preferredTimes: ["Afternoon", "Evening"], sport: "tennis", matchesPlayed: 78, wins: 45, losses: 33, bio: "Serious about improving.", joinedDate: "2024-07-12", firstName: "Robert", lastName: "Brown", age: 41, gender: "Male", sports: ["tennis"], matchFormats: ["singles"], gameType: "hardcore-competitive", weeklyAvailability: makeWeek({ Mon: [{ start: 14, end: 17 }], Wed: [{ start: 14, end: 17 }], Fri: [{ start: 14, end: 17 }], Sun: [{ start: 10, end: 14 }] }), partnerPreferences: { ageRange: "10", ntrpMin: 3.5, ntrpMax: 5.0, gameTypes: ["slightly-competitive", "hardcore-competitive"], sports: ["tennis"], matchFormats: ["singles"] }, profileComplete: true },
  { id: "p10", name: "Jennifer Lee", email: "jennifer@example.com", ntrpRating: 3.5, avatar: "🎯", location: "Pleasanton, CA", availability: ["Tue", "Thu"], preferredTimes: ["Morning"], sport: "both", matchesPlayed: 36, wins: 20, losses: 16, bio: "Mom of two who plays whenever possible!", joinedDate: "2025-01-22", firstName: "Jennifer", lastName: "Lee", age: 36, gender: "Female", sports: ["tennis", "pickleball"], matchFormats: ["doubles"], gameType: "recreational", weeklyAvailability: makeWeek({ Tue: [{ start: 9, end: 11 }], Thu: [{ start: 9, end: 11 }] }), partnerPreferences: { ageRange: "5", ntrpMin: 3.0, ntrpMax: 4.0, gameTypes: ["recreational", "slightly-competitive"], sports: ["tennis", "pickleball"], matchFormats: ["doubles"] }, profileComplete: true },
  { id: "p11", name: "Chris Martinez", email: "chris@example.com", ntrpRating: 5.0, avatar: "🚀", location: "Livermore, CA", availability: ["Sat", "Sun"], preferredTimes: ["Morning", "Afternoon"], sport: "tennis", matchesPlayed: 200, wins: 145, losses: 55, bio: "Former D1 player.", joinedDate: "2024-05-01", firstName: "Chris", lastName: "Martinez", age: 32, gender: "Male", sports: ["tennis"], matchFormats: ["singles"], gameType: "hardcore-competitive", weeklyAvailability: makeWeek({ Sat: [{ start: 7, end: 13 }], Sun: [{ start: 7, end: 13 }] }), partnerPreferences: { ageRange: "any", ntrpMin: 4.0, ntrpMax: 5.5, gameTypes: ["hardcore-competitive"], sports: ["tennis"], matchFormats: ["singles"] }, profileComplete: true },
  { id: "p12", name: "Amanda White", email: "amanda@example.com", ntrpRating: 3.0, avatar: "🌈", location: "San Ramon, CA", availability: ["Mon", "Wed", "Sat"], preferredTimes: ["Evening"], sport: "both", matchesPlayed: 28, wins: 14, losses: 14, bio: "Even win/loss record!", joinedDate: "2024-10-30", firstName: "Amanda", lastName: "White", age: 39, gender: "Female", sports: ["tennis", "pickleball"], matchFormats: ["singles", "doubles"], gameType: "slightly-competitive", weeklyAvailability: makeWeek({ Mon: [{ start: 18, end: 20 }], Wed: [{ start: 18, end: 20 }], Sat: [{ start: 10, end: 13 }] }), partnerPreferences: { ageRange: "10", ntrpMin: 2.5, ntrpMax: 3.5, gameTypes: ["recreational", "slightly-competitive"], sports: ["tennis", "pickleball"], matchFormats: ["singles", "doubles"] }, profileComplete: true },
  { id: "p13", name: "Kevin Nguyen", email: "kevin@example.com", ntrpRating: 4.0, avatar: "💎", location: "Pleasanton, CA", availability: ["Tue", "Thu", "Sat"], preferredTimes: ["Morning", "Evening"], sport: "tennis", matchesPlayed: 95, wins: 58, losses: 37, bio: "Tennis is therapy.", joinedDate: "2024-04-18", firstName: "Kevin", lastName: "Nguyen", age: 37, gender: "Male", sports: ["tennis"], matchFormats: ["singles", "doubles"], gameType: "slightly-competitive", weeklyAvailability: makeWeek({ Tue: [{ start: 7, end: 9 }], Thu: [{ start: 7, end: 9 }], Sat: [{ start: 8, end: 12 }, { start: 17, end: 19 }] }), partnerPreferences: { ageRange: "10", ntrpMin: 3.0, ntrpMax: 4.5, gameTypes: ["slightly-competitive", "hardcore-competitive"], sports: ["tennis"], matchFormats: ["singles", "doubles"] }, profileComplete: true },
  { id: "p14", name: "Rachel Adams", email: "rachel@example.com", ntrpRating: 2.5, avatar: "🐬", location: "Dublin, CA", availability: ["Wed", "Fri", "Sun"], preferredTimes: ["Afternoon"], sport: "pickleball", matchesPlayed: 20, wins: 10, losses: 10, bio: "Just started pickleball!", joinedDate: "2025-02-10", firstName: "Rachel", lastName: "Adams", age: 28, gender: "Female", sports: ["pickleball"], matchFormats: ["doubles"], gameType: "recreational", weeklyAvailability: makeWeek({ Wed: [{ start: 13, end: 16 }], Fri: [{ start: 13, end: 16 }], Sun: [{ start: 10, end: 14 }] }), partnerPreferences: { ageRange: "5", ntrpMin: 2.0, ntrpMax: 3.0, gameTypes: ["recreational"], sports: ["pickleball"], matchFormats: ["doubles"] }, profileComplete: true },
];

const matches = [
  { id: "m1", player1Id: "p1", player2Id: "p2", participants: ["p1", "p2"], date: "2026-02-20", time: "9:00 AM", location: "Lifetime Activities Pleasanton", sport: "tennis", status: "upcoming", compatibilityScore: 92, matchExplanation: "Same NTRP rating, overlapping availability." },
  { id: "m2", player1Id: "p1", player2Id: "p6", participants: ["p1", "p6"], date: "2026-02-22", time: "6:00 PM", location: "Lifetime Activities Pleasanton", sport: "pickleball", status: "upcoming", compatibilityScore: 88, matchExplanation: "Matching NTRP, both enjoy both sports." },
  { id: "m3", player1Id: "p1", player2Id: "p3", participants: ["p1", "p3"], date: "2026-02-15", time: "10:00 AM", location: "Lifetime Activities Pleasanton", sport: "tennis", status: "completed", score: "6-4, 3-6, 7-5", compatibilityScore: 78, matchExplanation: "Close NTRP ratings." },
  { id: "m4", player1Id: "p1", player2Id: "p10", participants: ["p1", "p10"], date: "2026-02-12", time: "8:00 AM", location: "Lifetime Activities Pleasanton", sport: "tennis", status: "completed", score: "6-3, 6-4", compatibilityScore: 85, matchExplanation: "Same NTRP." },
  { id: "m5", player1Id: "p3", player2Id: "p9", participants: ["p3", "p9"], date: "2026-02-25", time: "2:00 PM", location: "Lifetime Activities Pleasanton", sport: "tennis", status: "open", compatibilityScore: 90, matchExplanation: "Same NTRP 4.0." },
  { id: "m6", player1Id: "p5", player2Id: "p11", participants: ["p5", "p11"], date: "2026-02-23", time: "10:00 AM", location: "Lifetime Activities Pleasanton", sport: "tennis", status: "open", compatibilityScore: 72, matchExplanation: "Both high-level players." },
  { id: "m7", player1Id: "p4", player2Id: "p8", participants: ["p4", "p8"], date: "2026-02-21", time: "9:00 AM", location: "Lifetime Activities Pleasanton", sport: "pickleball", status: "open", compatibilityScore: 94, matchExplanation: "Same NTRP, both pickleball focused." },
  { id: "m8", player1Id: "p7", player2Id: "p14", participants: ["p7", "p14"], date: "2026-02-24", time: "3:00 PM", location: "Lifetime Activities Pleasanton", sport: "pickleball", status: "open", compatibilityScore: 91, matchExplanation: "Both beginners." },
  { id: "m9", player1Id: "p1", player2Id: "p13", participants: ["p1", "p13"], date: "2026-02-10", time: "7:00 PM", location: "Lifetime Activities Pleasanton", sport: "tennis", status: "completed", score: "4-6, 6-3, 6-7(5)", compatibilityScore: 80, matchExplanation: "Close match." },
];

const matchRequests = [
  { id: "mr1", fromUserId: "p1", toUserId: "p6", status: "accepted", score: 88, createdAt: "2026-02-15T10:00:00Z", conversationId: "conv2" },
  { id: "mr2", fromUserId: "p1", toUserId: "p12", status: "pending", score: 72, createdAt: "2026-02-17T07:00:00Z" },
  { id: "mr3", fromUserId: "p3", toUserId: "p1", status: "pending", score: 78, createdAt: "2026-02-17T06:00:00Z" },
  { id: "mr4", fromUserId: "p13", toUserId: "p1", status: "pending", score: 80, createdAt: "2026-02-16T14:00:00Z" },
];

const conversations = [
  { id: "conv1", participants: ["p1", "p2"], lastMessage: "See you Saturday morning!", lastMessageAt: "2026-02-17T08:30:00Z", unreadCount: 1, createdAt: "2026-02-14T10:00:00Z" },
  { id: "conv2", participants: ["p1", "p6"], lastMessage: "The courts at Val Vista are great for pickleball", lastMessageAt: "2026-02-16T19:00:00Z", unreadCount: 0, createdAt: "2026-02-15T14:00:00Z" },
  { id: "conv3", participants: ["p1", "p2", "ai"], lastMessage: "Hey Sarah and Alex!", lastMessageAt: "2026-02-14T09:00:00Z", unreadCount: 0, createdAt: "2026-02-14T09:00:00Z" },
  { id: "conv4", participants: ["p1", "p13", "ai"], lastMessage: "How did your match with Kevin go?", lastMessageAt: "2026-02-11T10:00:00Z", unreadCount: 1, createdAt: "2026-02-09T12:00:00Z" },
];

const msgs = [
  { id: "msg1", conversationId: "conv1", senderId: "p2", senderName: "Sarah Chen", text: "Hey Alex! Looking forward to our match on the 20th.", createdAt: "2026-02-16T10:00:00Z", readBy: ["p2", "p1"] },
  { id: "msg2", conversationId: "conv1", senderId: "p1", senderName: "Alex Johnson", text: "Me too! I've been practicing my backhand 😄", createdAt: "2026-02-16T10:15:00Z", readBy: ["p1", "p2"] },
  { id: "msg3", conversationId: "conv1", senderId: "p2", senderName: "Sarah Chen", text: "See you Saturday morning!", createdAt: "2026-02-17T08:30:00Z", readBy: ["p2"] },
  { id: "msg6", conversationId: "conv3", senderId: "ai", senderName: "PlayMatch AI", text: "Hey Sarah and Alex! You're both 3.5 NTRP players.", createdAt: "2026-02-14T09:00:00Z", readBy: ["ai", "p1", "p2"], isAI: true },
  { id: "msg7", conversationId: "conv4", senderId: "ai", senderName: "PlayMatch AI", text: "Hey Alex and Kevin! You're both competitive players.", createdAt: "2026-02-09T12:00:00Z", readBy: ["ai", "p1", "p13"], isAI: true },
  { id: "msg10", conversationId: "conv4", senderId: "ai", senderName: "PlayMatch AI", text: "How did your match with Kevin go? Report your score! 🎾", createdAt: "2026-02-11T10:00:00Z", readBy: ["ai"], isAI: true },
];

const notifications = [
  { id: "n1", userId: "p1", type: "new_message", title: "New message from Sarah", body: "See you Saturday morning!", read: false, createdAt: "2026-02-17T08:30:00Z", link: "/dashboard/messages/conv1" },
  { id: "n2", userId: "p1", type: "match_confirmed", title: "Match Confirmed!", body: "Your match with Sarah Chen on Feb 20 is confirmed.", read: false, createdAt: "2026-02-16T12:00:00Z", link: "/dashboard/open-matches" },
  { id: "n5", userId: "p1", type: "match_request", title: "New Match Request!", body: "Mike Rodriguez wants to match with you! (78% compatible)", read: false, createdAt: "2026-02-17T06:00:00Z", link: "/dashboard" },
];

async function seed() {
  console.log("🌱 Seeding Firestore...\n");

  const usersSnap = await getDocs(collection(db, "users"));
  if (usersSnap.size > 0) console.log(`⚠️  Overwriting ${usersSnap.size} existing users...`);

  for (const p of players) {
    const { id, ...data } = p;
    await setDoc(doc(db, "users", id), data);
  }
  console.log(`✅ Seeded ${players.length} users`);

  for (const m of matches) {
    const { id, ...data } = m;
    await setDoc(doc(db, "matches", id), data);
  }
  console.log(`✅ Seeded ${matches.length} matches`);

  for (const r of matchRequests) {
    const { id, ...data } = r;
    await setDoc(doc(db, "matchRequests", id), data);
  }
  console.log(`✅ Seeded ${matchRequests.length} match requests`);

  for (const c of conversations) {
    const { id, ...data } = c;
    await setDoc(doc(db, "conversations", id), data);
  }
  console.log(`✅ Seeded ${conversations.length} conversations`);

  for (const msg of msgs) {
    const { id, ...data } = msg;
    await setDoc(doc(db, "messages", id), data);
  }
  console.log(`✅ Seeded ${msgs.length} messages`);

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
