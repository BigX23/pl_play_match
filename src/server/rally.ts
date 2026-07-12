import type { getDb } from "@/db";
import {
  RALLY_SYSTEM_PROMPT,
  buildRallyPrompt,
  clampWords,
  getStaticResponse,
  shouldRallyRespond,
} from "@/lib/ai-assistant";
import { conversationContext, insertRallyMessage } from "./data";

type Db = ReturnType<typeof getDb>;

const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";
const GEN_TIMEOUT_MS = 90_000;

/** Ask the local Ollama model for Rally's reply. Returns null on any failure. */
async function askOllama(prompt: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEN_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        options: { temperature: 0.7, num_predict: 160 },
        messages: [
          { role: "system", content: RALLY_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string } };
    const text = data.message?.content?.trim();
    return text ? clampWords(text, 80) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate Rally's reply for the latest message in a conversation and insert it.
 * Fire-and-forget from the message route — errors are swallowed and a static
 * fallback is used if Ollama is unavailable. Safe to call unconditionally; it
 * no-ops when Rally shouldn't respond.
 */
export async function maybeReplyAsRally(
  db: Db,
  conversationId: string,
  humanText: string
): Promise<void> {
  if (!shouldRallyRespond(humanText)) return;
  try {
    const { messages, names, hasRally } = await conversationContext(db, conversationId);
    if (!hasRally) return;
    const prompt = buildRallyPrompt(messages, names);
    const reply = (await askOllama(prompt)) ?? getStaticResponse(humanText);
    if (reply) await insertRallyMessage(db, conversationId, reply);
  } catch (err) {
    console.error("[rally] reply generation failed:", err);
  }
}
