import { GoogleGenerativeAI } from "@google/generative-ai";
import { type Message, type Player } from "./mock-data";

export const AI_SENDER_ID = "rally";
export const AI_SENDER_NAME = "Rally";

// ---------- Gemini setup ----------
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_GENAI_API_KEY ?? "";
let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI | null {
  if (!API_KEY) {
    console.warn("[Rally AI] No NEXT_PUBLIC_GOOGLE_GENAI_API_KEY – falling back to static responses");
    return null;
  }
  if (!genAI) genAI = new GoogleGenerativeAI(API_KEY);
  return genAI;
}

// ---------- Token budget ----------
const MAX_CONVERSATION_TOKENS = 10_000;
const SYSTEM_PROMPT_TOKENS = 350;
const RESPONSE_RESERVE_TOKENS = 200;
const HISTORY_TOKEN_BUDGET =
  MAX_CONVERSATION_TOKENS - SYSTEM_PROMPT_TOKENS - RESPONSE_RESERVE_TOKENS;

/** Rough token estimate: ~4 chars per token for English text. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------- System prompt ----------
const RALLY_SYSTEM_PROMPT = `You are Rally 🎾, the PlayMatch chat bot — a friendly, motivational, energetic, and helpful tennis & pickleball coach.

PERSONALITY:
• Warm, kind, and genuinely supportive — treat every player like a valued friend
• Motivational and energetic — you lift people up and get them excited to play
• Uses tennis/pickleball terminology naturally
• Uses emojis sparingly but effectively (🎾🔥💪🏆)
• Upbeat and enthusiastic — exclamation marks are your thing!

TONE RULES — VERY IMPORTANT:
• NEVER be rude, condescending, sarcastic, or dismissive
• NEVER talk down to anyone regardless of their skill level
• Always be patient and encouraging, even with beginner questions
• If someone is frustrated or upset, respond with empathy first
• Celebrate every effort — not just wins

KNOWLEDGE:
• You know about local courts, especially Lifetime Activities Pleasanton — (925) 460-8600
• You can help with match logistics: scheduling, court reservations, warm-up tips, directions
• You celebrate wins, console losses, and always motivate
• You can search the web to answer questions about courts, rules, gear, restaurants nearby, weather, etc.

RULES:
• Keep every reply under 100 words — be concise and punchy
• You are part of a group chat with real players — stay contextually relevant
• Reference what people actually said — don't repeat generic lines
• If asked something you don't know, search for it or be honest — but always keep it fun
• Never break character — you ARE Rally the coach
• Do NOT repeat yourself — check what you've already said in the conversation
• Be HELPFUL above all else — if a player asks a question, do your best to answer it`;

// ---------- Public API ----------

/**
 * Check whether Rally should respond to this message.
 * Rally replies only when someone mentions "rally" (case-insensitive).
 */
export function shouldRallyRespond(text: string): boolean {
  return /\brally\b/i.test(text);
}

/**
 * Ask Rally (Gemini) for a contextual reply.
 *
 * @param conversationMessages  Full message history for the conversation
 * @param participantNames      Map of userId → display name
 * @returns Rally's reply text, or null if the API is unavailable
 */
export async function getRallyResponse(
  conversationMessages: Message[],
  participantNames: Record<string, string>,
): Promise<string | null> {
  // --- Try Gemini first ---
  const ai = getGenAI();
  if (ai) {
    try {
      const model = ai.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          maxOutputTokens: 150, // ~100 words
          temperature: 0.9,
        },
        tools: [{ googleSearch: {} } as any],
      });

      // Build trimmed conversation history that fits the token budget
      const history = buildHistory(conversationMessages, participantNames);

      const prompt = `${RALLY_SYSTEM_PROMPT}\n\n--- CONVERSATION ---\n${history}\n\n--- YOUR TURN ---\nReply as Rally (under 100 words):`;

      console.log(
        "[Rally AI] Sending prompt to Gemini, estimated tokens:",
        estimateTokens(prompt),
      );

      const result = await model.generateContent(prompt);
      const response = result.response;
      let text = response.text().trim();

      // Safety: enforce 100-word limit client-side
      const words = text.split(/\s+/);
      if (words.length > 100) {
        text = words.slice(0, 100).join(" ");
      }

      console.log("[Rally AI] Gemini replied:", text.substring(0, 80) + "...");
      return text;
    } catch (err) {
      console.error("[Rally AI] Gemini error, falling back to static:", err);
    }
  }

  // --- Fallback: keyword-based static response ---
  const lastMsg = conversationMessages[conversationMessages.length - 1];
  return lastMsg ? getStaticResponse(lastMsg.text) : null;
}

// ---------- History builder ----------

function buildHistory(
  messages: Message[],
  names: Record<string, string>,
): string {
  const lines: string[] = [];
  let tokenCount = 0;

  // Walk backwards from newest, accumulating until we hit the token budget
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const sender =
      m.senderId === AI_SENDER_ID
        ? "Rally"
        : names[m.senderId] || "User";
    const line = `${sender}: ${m.text}`;
    const lineTokens = estimateTokens(line);

    if (tokenCount + lineTokens > HISTORY_TOKEN_BUDGET) break;
    lines.unshift(line); // prepend to maintain chronological order
    tokenCount += lineTokens;
  }

  console.log(
    "[Rally AI] History:",
    lines.length,
    "messages,",
    tokenCount,
    "est. tokens",
  );
  return lines.join("\n");
}

// ---------- Static fallback (original keyword matching) ----------

function getStaticResponse(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("what time") || lower.includes("when"))
    return "GREAT question! 📅 Based on your mutual availability, weekday evenings or Saturday mornings are your sweet spot! Let's lock in a time and MAKE IT HAPPEN! 🎾💪";
  if (lower.includes("where") || lower.includes("court"))
    return "Oh I LOVE this energy! 🏟️ Lifetime Activities Pleasanton is THE spot — top-notch courts waiting for you champions! Call (925) 460-8600 to reserve! LET'S GO! 🎾🔥";
  if (lower.includes("score") || lower.includes("won") || lower.includes("lost"))
    return "AMAZING match! 🏆 I've logged the result — every point counts in your journey! Want me to find your next opponent? The court is calling! 🎾💪🔥";
  if (lower.includes("cancel") || lower.includes("can't make"))
    return "No worries at all! 🙌 Life happens, and there's ALWAYS another match around the corner! Let me know when you're ready to get back out there, champion! 🎾";
  if (lower.includes("thanks") || lower.includes("thank you"))
    return "That's what I'm HERE for! 🎾 Helping you find amazing matches is my FAVORITE thing! Keep that energy up, champion! 💪🔥";
  // Generic fallback when Rally is mentioned but no keyword detected
  return "LET'S GO, champion! 🎾🔥 I'm here if you need help setting up matches, finding courts, or anything else! Just say the word! 💪";
}

// ---------- Legacy generators (still used for match-creation intro messages) ----------

export function generateIntroMessage(player1: Player, player2: Player): string {
  const sharedDays = player1.availability.filter((d) =>
    player2.availability.includes(d),
  );
  const sharedTimes = player1.preferredTimes.filter((t) =>
    player2.preferredTimes.includes(t),
  );
  const rating =
    player1.ntrpRating === player2.ntrpRating
      ? `${player1.ntrpRating} NTRP`
      : `${player1.ntrpRating}/${player2.ntrpRating} NTRP`;

  return `GAME ON! 🎾🔥 Hey ${player1.name.split(" ")[0]} and ${player2.name.split(" ")[0]}! I'm Rally, your match coach! You two are ${rating} players${
    sharedDays.length
      ? ` who both crush it on ${sharedDays.join("/")}`
      : ""
  }${
    sharedTimes.length
      ? ` ${sharedTimes.join(" & ").toLowerCase()}s`
      : ""
  }. This is gonna be AWESOME! Let's get a match set up this week! 💪`;
}

export function generateMatchSuggestion(
  player1: Player,
  player2: Player,
): string {
  const sharedDays = player1.availability.filter((d) =>
    player2.availability.includes(d),
  );
  const sharedTimes = player1.preferredTimes.filter((t) =>
    player2.preferredTimes.includes(t),
  );
  const day = sharedDays[0] || "this weekend";
  const time = sharedTimes[0]?.toLowerCase() || "morning";
  return `LET'S GO! 🏟️ Based on your schedules, ${day} ${time} looks PERFECT! Lifetime Activities Pleasanton has courts ready for you two champions! Call (925) 460-8600 to lock in your court! 🔒🎾`;
}

export function generateReminder(
  playerName: string,
  opponentName: string,
  time: string,
  date: string,
): string {
  return `⏰ MATCH DAY ALERT! ${playerName.split(" ")[0]}, your showdown with ${opponentName} is ${date} at ${time}! Bring your A-game, champion! You've GOT this! 🎾🔥💪`;
}

export function generatePostMatchFollowUp(
  playerName: string,
  opponentName: string,
): string {
  return `Hey ${playerName.split(" ")[0]}! 🎾 How was the match with ${opponentName}?! I bet it was ELECTRIC! Drop your score so I can update the stats! Win or lose, every match makes you BETTER! 💪🏆`;
}

/** @deprecated Use shouldRallyRespond + getRallyResponse instead */
export function getAIResponse(lastMessage: string): string | null {
  return getStaticResponse(lastMessage);
}
