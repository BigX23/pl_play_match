import { type Player, type Message, getPlayerById, getCompatiblePlayers } from "./mock-data";

export const AI_SENDER_ID = "ai";
export const AI_SENDER_NAME = "PlayMatch AI";

export function generateIntroMessage(player1: Player, player2: Player): string {
  const sharedDays = player1.availability.filter((d) => player2.availability.includes(d));
  const sharedTimes = player1.preferredTimes.filter((t) => player2.preferredTimes.includes(t));
  const rating = player1.ntrpRating === player2.ntrpRating
    ? `${player1.ntrpRating} NTRP`
    : `${player1.ntrpRating}/${player2.ntrpRating} NTRP`;

  return `Hey ${player1.name.split(" ")[0]} and ${player2.name.split(" ")[0]}! 🎾 You're both ${rating} players${
    sharedDays.length ? ` who love playing on ${sharedDays.join("/")}` : ""
  }${sharedTimes.length ? ` ${sharedTimes.join(" & ").toLowerCase()}s` : ""}. Want to set up a match this week?`;
}

export function generateMatchSuggestion(player1: Player, player2: Player): string {
  const sharedDays = player1.availability.filter((d) => player2.availability.includes(d));
  const sharedTimes = player1.preferredTimes.filter((t) => player2.preferredTimes.includes(t));
  const day = sharedDays[0] || "this weekend";
  const time = sharedTimes[0]?.toLowerCase() || "morning";
  return `Based on your schedules, how about ${day} ${time}? Pleasanton Tennis Park has open courts! 🏟️`;
}

export function generateReminder(playerName: string, opponentName: string, time: string, date: string): string {
  return `⏰ Reminder: Your match with ${opponentName} is ${date} at ${time}! Good luck, ${playerName.split(" ")[0]}! 🎾`;
}

export function generatePostMatchFollowUp(playerName: string, opponentName: string): string {
  return `How did your match with ${opponentName} go? Report your score! 🎾`;
}

export function getAIResponse(lastMessage: string): string | null {
  const lower = lastMessage.toLowerCase();
  if (lower.includes("what time") || lower.includes("when"))
    return "Based on your mutual availability, weekday evenings or Saturday mornings work great!";
  if (lower.includes("where") || lower.includes("court"))
    return "Pleasanton Tennis Park and Val Vista Community Park both have great courts! 🏟️";
  if (lower.includes("score") || lower.includes("won") || lower.includes("lost"))
    return "Great match! I've logged the result. Want me to find your next opponent? 🎾";
  return null;
}
