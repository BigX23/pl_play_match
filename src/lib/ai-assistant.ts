import { type Player } from "./mock-data";

export const AI_SENDER_ID = "ai";
export const AI_SENDER_NAME = "Rally";

/**
 * Rally — the PlayMatch bot 🎾
 * Personality: High-energy motivational tennis coach who is always happy and encouraging.
 * Uses tennis terminology, exclamation marks, and lots of enthusiasm.
 */

export function generateIntroMessage(player1: Player, player2: Player): string {
  const sharedDays = player1.availability.filter((d) => player2.availability.includes(d));
  const sharedTimes = player1.preferredTimes.filter((t) => player2.preferredTimes.includes(t));
  const rating = player1.ntrpRating === player2.ntrpRating
    ? `${player1.ntrpRating} NTRP`
    : `${player1.ntrpRating}/${player2.ntrpRating} NTRP`;

  return `GAME ON! 🎾🔥 Hey ${player1.name.split(" ")[0]} and ${player2.name.split(" ")[0]}! I'm Rally, your match coach! You two are ${rating} players${
    sharedDays.length ? ` who both crush it on ${sharedDays.join("/")}` : ""
  }${sharedTimes.length ? ` ${sharedTimes.join(" & ").toLowerCase()}s` : ""}. This is gonna be AWESOME! Let's get a match set up this week! 💪`;
}

export function generateMatchSuggestion(player1: Player, player2: Player): string {
  const sharedDays = player1.availability.filter((d) => player2.availability.includes(d));
  const sharedTimes = player1.preferredTimes.filter((t) => player2.preferredTimes.includes(t));
  const day = sharedDays[0] || "this weekend";
  const time = sharedTimes[0]?.toLowerCase() || "morning";
  return `LET'S GO! 🏟️ Based on your schedules, ${day} ${time} looks PERFECT! Lifetime Activities Pleasanton has courts ready for you two champions! Call (925) 460-8600 to lock in your court! 🔒🎾`;
}

export function generateReminder(playerName: string, opponentName: string, time: string, date: string): string {
  return `⏰ MATCH DAY ALERT! ${playerName.split(" ")[0]}, your showdown with ${opponentName} is ${date} at ${time}! Bring your A-game, champion! You've GOT this! 🎾🔥💪`;
}

export function generatePostMatchFollowUp(playerName: string, opponentName: string): string {
  return `Hey ${playerName.split(" ")[0]}! 🎾 How was the match with ${opponentName}?! I bet it was ELECTRIC! Drop your score so I can update the stats! Win or lose, every match makes you BETTER! 💪🏆`;
}

export function getAIResponse(lastMessage: string): string | null {
  const lower = lastMessage.toLowerCase();
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
  return null;
}
