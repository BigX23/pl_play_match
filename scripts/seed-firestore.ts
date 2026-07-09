/**
 * Seed Firestore with mock data using the Admin SDK.
 *
 * Uses a service-account key so it writes with admin privileges and does NOT
 * require the security rules to be opened. Never set the deployed rules to
 * `if true` for seeding.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     npx tsx scripts/seed-firestore.ts
 *
 * Or set SERVICE_ACCOUNT_PATH in .env.local pointing at the key file.
 */

import { config } from "dotenv";
import { existsSync } from "fs";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

config({ path: ".env.local" });

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const keyPath = process.env.SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!projectId) {
  console.error("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID. Check .env.local");
  process.exit(1);
}

if (!getApps().length) {
  if (keyPath && existsSync(keyPath)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(keyPath);
    initializeApp({ credential: cert(serviceAccount), projectId });
  } else {
    // Fall back to application-default credentials (gcloud auth).
    initializeApp({ credential: applicationDefault(), projectId });
  }
}

const db = getFirestore();

// All demo data removed. To re-seed, add objects to the arrays below.
const players: { id: string; [key: string]: unknown }[] = [];
const matches: { id: string; [key: string]: unknown }[] = [];
const matchRequests: { id: string; [key: string]: unknown }[] = [];
const conversations: { id: string; [key: string]: unknown }[] = [];
const msgs: { id: string; [key: string]: unknown }[] = [];
const notifications: { id: string; [key: string]: unknown }[] = [];

async function seedCollection(
  name: string,
  items: { id: string; [key: string]: unknown }[]
): Promise<void> {
  const batch = db.batch();
  for (const item of items) {
    const { id, ...data } = item;
    batch.set(db.collection(name).doc(id), data);
  }
  await batch.commit();
  console.log(`✅ Seeded ${items.length} ${name}`);
}

async function seed() {
  console.log("🌱 Seeding Firestore (Admin SDK)...\n");
  await seedCollection("users", players);
  await seedCollection("matches", matches);
  await seedCollection("matchRequests", matchRequests);
  await seedCollection("conversations", conversations);
  await seedCollection("messages", msgs);
  await seedCollection("notifications", notifications);
  console.log("\n🎉 Firestore seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
