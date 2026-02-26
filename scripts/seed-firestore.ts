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

// All demo data has been removed.
// To re-seed, add player/match/conversation objects to the arrays below.

const players: { id: string; [key: string]: unknown }[] = [];
const matches: { id: string; [key: string]: unknown }[] = [];
const matchRequests: { id: string; [key: string]: unknown }[] = [];
const conversations: { id: string; [key: string]: unknown }[] = [];
const msgs: { id: string; [key: string]: unknown }[] = [];
const notifications: { id: string; [key: string]: unknown }[] = [];

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
