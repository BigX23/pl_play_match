import { type Message } from "./mock-data";

export const AI_SENDER_ID = "rally";
export const AI_SENDER_NAME = "Rally";

/**
 * Rally AI — shared, key-free helpers.
 *
 * The live Gemini call runs server-side in a Cloud Function (functions/src),
 * so no API key is ever shipped to the browser. This module holds the pure
 * pieces both client and function need: the trigger check, the system prompt,
 * history construction, and a deterministic static fallback used in mock/dev
 * mode where no function is available.
 */

// ---------- System prompt ----------
export const RALLY_SYSTEM_PROMPT = `You are Rally, the PlayMatch assistant — a calm, concrete, helpful tennis & pickleball coach for the Pleasanton community.

VOICE:
• Warm and encouraging, but plain-spoken. Write like a knowledgeable friend, not a hype machine.
• No ALL-CAPS words. At most one exclamation mark per message. Emoji are optional and rare (never more than one).
• Be specific and useful. Answer the actual question asked.

KNOWLEDGE:
• Local courts, especially Lifetime Activities Pleasanton — (925) 460-8600.
• Match logistics: scheduling, court reservations, warm-up tips, directions.

RULES:
• Keep replies under 80 words.
• You are in a group chat with real players — reference what they actually said; don't repeat yourself.
• If you don't know something, say so briefly.
• Stay in character as Rally, the coach.`;

// ---------- Trigger ----------
/**
 * Rally replies only when explicitly addressed with an "@rally" mention, so a
 * casual "great rally!" doesn't summon the bot.
 */
export function shouldRallyRespond(text: string): boolean {
  return /@rally\b/i.test(text) || /\brally[,:]/i.test(text.trim());
}

// ---------- Token budget ----------
const MAX_CONVERSATION_TOKENS = 10_000;
const SYSTEM_PROMPT_TOKENS = 350;
const RESPONSE_RESERVE_TOKENS = 200;
const HISTORY_TOKEN_BUDGET =
  MAX_CONVERSATION_TOKENS - SYSTEM_PROMPT_TOKENS - RESPONSE_RESERVE_TOKENS;

/** Rough token estimate: ~4 chars per token for English text. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Build a chronological transcript that fits the token budget. Always includes
 * at least the newest message (truncated if it alone exceeds the budget) so the
 * model never receives an empty conversation.
 */
export function buildHistory(
  msgs: Message[],
  names: Record<string, string>
): string {
  if (msgs.length === 0) return "";
  const lines: string[] = [];
  let tokenCount = 0;

  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    const sender = m.senderId === AI_SENDER_ID ? "Rally" : names[m.senderId] || "User";
    let line = `${sender}: ${m.text}`;
    let lineTokens = estimateTokens(line);

    if (tokenCount + lineTokens > HISTORY_TOKEN_BUDGET) {
      // Always include the newest message; truncate it to fit rather than drop it.
      if (i === msgs.length - 1) {
        const budgetChars = Math.max(0, HISTORY_TOKEN_BUDGET) * 4;
        line = line.slice(0, budgetChars);
        lineTokens = estimateTokens(line);
        lines.unshift(line);
        tokenCount += lineTokens;
      }
      break;
    }
    lines.unshift(line);
    tokenCount += lineTokens;
  }
  return lines.join("\n");
}

/** Compose the full prompt the Cloud Function sends to Gemini. */
export function buildRallyPrompt(
  msgs: Message[],
  names: Record<string, string>
): string {
  const history = buildHistory(msgs, names);
  return `${history}\n\n--- Reply as Rally (under 80 words) ---`;
}

/** Clamp a reply to at most `maxWords`, trimming on a sentence boundary if possible. */
export function clampWords(text: string, maxWords = 80): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  const clipped = words.slice(0, maxWords).join(" ");
  const lastStop = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));
  return lastStop > clipped.length * 0.6 ? clipped.slice(0, lastStop + 1) : clipped + "…";
}

// ---------- Static fallback (mock/dev mode) ----------
/**
 * Deterministic keyword response used when no Cloud Function is available
 * (mock mode). Calm, concrete voice — matches the system prompt.
 */
export function getStaticResponse(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("what time") || lower.includes("when"))
    return "Based on your shared availability, weekday evenings or Saturday mornings tend to work best. Want me to pencil in a time?";
  if (lower.includes("where") || lower.includes("court") || lower.includes("address"))
    return "Lifetime Activities Pleasanton is the usual spot — call (925) 460-8600 to reserve a court.";
  if (lower.includes("score") || lower.includes("won") || lower.includes("lost"))
    return "Nice — drop the final score here and I'll log it for you.";
  if (lower.includes("cancel") || lower.includes("can't make") || lower.includes("cant make"))
    return "No problem, these things happen. Let me know when you'd like to reschedule.";
  if (lower.includes("thanks") || lower.includes("thank you"))
    return "Anytime. Have a good match!";
  return "Happy to help — ask me about scheduling, courts, or match logistics.";
}

/**
 * Client-side reply used in mock mode. In a Firebase deploy the Cloud Function
 * generates the reply server-side instead.
 */
export function getRallyFallbackResponse(msgs: Message[]): string | null {
  const last = msgs[msgs.length - 1];
  return last ? getStaticResponse(last.text) : null;
}

// ---------- Match intro (calm voice) ----------
export function buildMatchIntro(
  name1: string,
  name2: string,
  details?: { sport?: string; matchType?: string; date?: string; time?: string; location?: string; score?: number }
): string {
  const first1 = name1.split(" ")[0];
  const first2 = name2.split(" ")[0];
  let line = `Hi ${first1} and ${first2}, I'm Rally, your match assistant.`;
  if (details?.date && details?.time && details?.location) {
    line += ` You're set for ${details.sport || "a match"} ${details.matchType || "singles"} on ${details.date} at ${details.time}, ${details.location}.`;
    line += ` To reserve a court, call (925) 460-8600.`;
  } else if (typeof details?.score === "number") {
    line += ` You matched at ${details.score}% compatibility. When you're ready, pick a time and I can help with court details.`;
  } else {
    line += ` When you're ready, pick a time and I can help with court details — Lifetime Activities Pleasanton, (925) 460-8600.`;
  }
  return line;
}
