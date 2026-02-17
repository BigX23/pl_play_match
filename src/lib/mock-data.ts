export interface Player {
  id: string;
  name: string;
  email: string;
  ntrpRating: number;
  avatar: string;
  location: string;
  availability: string[];
  preferredTimes: string[];
  sport: "tennis" | "pickleball" | "both";
  matchesPlayed: number;
  wins: number;
  losses: number;
  bio: string;
  joinedDate: string;
}

export interface Match {
  id: string;
  player1Id: string;
  player2Id: string;
  date: string;
  time: string;
  location: string;
  sport: "tennis" | "pickleball";
  status: "upcoming" | "completed" | "open";
  score?: string;
  compatibilityScore: number;
  matchExplanation: string;
}

export const currentUser: Player = {
  id: "p1",
  name: "Alex Johnson",
  email: "alex@example.com",
  ntrpRating: 3.5,
  avatar: "",
  location: "Pleasanton, CA",
  availability: ["Mon", "Wed", "Fri", "Sat"],
  preferredTimes: ["Morning", "Evening"],
  sport: "both",
  matchesPlayed: 47,
  wins: 28,
  losses: 19,
  bio: "Weekend warrior who loves competitive tennis and casual pickleball.",
  joinedDate: "2025-03-15",
};

export const players: Player[] = [
  currentUser,
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

export const matches: Match[] = [
  { id: "m1", player1Id: "p1", player2Id: "p2", date: "2026-02-20", time: "9:00 AM", location: "Pleasanton Tennis Park", sport: "tennis", status: "upcoming", compatibilityScore: 92, matchExplanation: "Same NTRP rating, overlapping availability on Mon/Wed/Sat, both prefer morning play." },
  { id: "m2", player1Id: "p1", player2Id: "p6", date: "2026-02-22", time: "6:00 PM", location: "Val Vista Community Park", sport: "pickleball", status: "upcoming", compatibilityScore: 88, matchExplanation: "Matching NTRP, both enjoy tennis and pickleball, overlapping Sat availability." },
  { id: "m3", player1Id: "p1", player2Id: "p3", date: "2026-02-15", time: "10:00 AM", location: "Pleasanton Tennis Park", sport: "tennis", status: "completed", score: "6-4, 3-6, 7-5", compatibilityScore: 78, matchExplanation: "Close NTRP ratings, both competitive players. Slight rating gap makes for a challenging match." },
  { id: "m4", player1Id: "p1", player2Id: "p10", date: "2026-02-12", time: "8:00 AM", location: "Muirwood Community Park", sport: "tennis", status: "completed", score: "6-3, 6-4", compatibilityScore: 85, matchExplanation: "Same NTRP, similar play style preferences." },
  { id: "m5", player1Id: "p3", player2Id: "p9", date: "2026-02-25", time: "2:00 PM", location: "Dublin Sports Grounds", sport: "tennis", status: "open", compatibilityScore: 90, matchExplanation: "Same NTRP 4.0, both in Dublin area, overlapping Sun availability." },
  { id: "m6", player1Id: "p5", player2Id: "p11", date: "2026-02-23", time: "10:00 AM", location: "Livermore Tennis Center", sport: "tennis", status: "open", compatibilityScore: 72, matchExplanation: "Both high-level players in Livermore. Rating gap provides good challenge." },
  { id: "m7", player1Id: "p4", player2Id: "p8", date: "2026-02-21", time: "9:00 AM", location: "Pleasanton Senior Center Courts", sport: "pickleball", status: "open", compatibilityScore: 94, matchExplanation: "Same NTRP, both pickleball focused, overlapping availability." },
  { id: "m8", player1Id: "p7", player2Id: "p14", date: "2026-02-24", time: "3:00 PM", location: "San Ramon Central Park", sport: "pickleball", status: "open", compatibilityScore: 91, matchExplanation: "Both beginners (2.5 NTRP), great for learning together." },
  { id: "m9", player1Id: "p1", player2Id: "p13", date: "2026-02-10", time: "7:00 PM", location: "Pleasanton Tennis Park", sport: "tennis", status: "completed", score: "4-6, 6-3, 6-7(5)", compatibilityScore: 80, matchExplanation: "Close match between 3.5 and 4.0 players. Exciting three-setter!" },
];

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  readBy: string[];
  isAI?: boolean;
}

export type NotificationType = "new_message" | "match_invitation" | "match_confirmed" | "match_reminder" | "ai_suggestion";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

export const conversations: Conversation[] = [
  { id: "conv1", participants: ["p1", "p2"], lastMessage: "See you Saturday morning!", lastMessageAt: "2026-02-17T08:30:00Z", unreadCount: 1, createdAt: "2026-02-14T10:00:00Z" },
  { id: "conv2", participants: ["p1", "p6"], lastMessage: "The courts at Val Vista are great for pickleball", lastMessageAt: "2026-02-16T19:00:00Z", unreadCount: 0, createdAt: "2026-02-15T14:00:00Z" },
  { id: "conv3", participants: ["p1", "p2", "ai"], lastMessage: "Hey Sarah and Alex! You're both 3.5 NTRP players who love playing on Mon/Wed/Sat mornings. Want to set up a match this week?", lastMessageAt: "2026-02-14T09:00:00Z", unreadCount: 0, createdAt: "2026-02-14T09:00:00Z" },
  { id: "conv4", participants: ["p1", "p13", "ai"], lastMessage: "How did your match with Kevin go? Report your score! 🎾", lastMessageAt: "2026-02-11T10:00:00Z", unreadCount: 1, createdAt: "2026-02-09T12:00:00Z" },
];

export const messages: Message[] = [
  // conv1: Alex <-> Sarah
  { id: "msg1", conversationId: "conv1", senderId: "p2", senderName: "Sarah Chen", text: "Hey Alex! Looking forward to our match on the 20th.", createdAt: "2026-02-16T10:00:00Z", readBy: ["p2", "p1"] },
  { id: "msg2", conversationId: "conv1", senderId: "p1", senderName: "Alex Johnson", text: "Me too! I've been practicing my backhand 😄", createdAt: "2026-02-16T10:15:00Z", readBy: ["p1", "p2"] },
  { id: "msg3", conversationId: "conv1", senderId: "p2", senderName: "Sarah Chen", text: "See you Saturday morning!", createdAt: "2026-02-17T08:30:00Z", readBy: ["p2"] },
  // conv2: Alex <-> Lisa
  { id: "msg4", conversationId: "conv2", senderId: "p1", senderName: "Alex Johnson", text: "Hey Lisa, want to play pickleball this Saturday?", createdAt: "2026-02-16T18:00:00Z", readBy: ["p1", "p6"] },
  { id: "msg5", conversationId: "conv2", senderId: "p6", senderName: "Lisa Park", text: "The courts at Val Vista are great for pickleball", createdAt: "2026-02-16T19:00:00Z", readBy: ["p6", "p1"] },
  // conv3: AI intro for Alex & Sarah
  { id: "msg6", conversationId: "conv3", senderId: "ai", senderName: "PlayMatch AI", text: "Hey Sarah and Alex! You're both 3.5 NTRP players who love playing on Mon/Wed/Sat mornings. Want to set up a match this week?", createdAt: "2026-02-14T09:00:00Z", readBy: ["ai", "p1", "p2"], isAI: true },
  // conv4: AI follow-up for Alex & Kevin
  { id: "msg7", conversationId: "conv4", senderId: "ai", senderName: "PlayMatch AI", text: "Hey Alex and Kevin! You're both competitive players who enjoy evening tennis. I think you'd have a great match!", createdAt: "2026-02-09T12:00:00Z", readBy: ["ai", "p1", "p13"], isAI: true },
  { id: "msg8", conversationId: "conv4", senderId: "p1", senderName: "Alex Johnson", text: "Sounds good! Kevin, are you free this Tuesday evening?", createdAt: "2026-02-09T13:00:00Z", readBy: ["p1", "p13"] },
  { id: "msg9", conversationId: "conv4", senderId: "p13", senderName: "Kevin Nguyen", text: "Tuesday works! 7pm at Pleasanton Tennis Park?", createdAt: "2026-02-09T14:00:00Z", readBy: ["p13", "p1"] },
  { id: "msg10", conversationId: "conv4", senderId: "ai", senderName: "PlayMatch AI", text: "How did your match with Kevin go? Report your score! 🎾", createdAt: "2026-02-11T10:00:00Z", readBy: ["ai"], isAI: true },
];

export const notifications: Notification[] = [
  { id: "n1", userId: "p1", type: "new_message", title: "New message from Sarah", body: "See you Saturday morning!", read: false, createdAt: "2026-02-17T08:30:00Z", link: "/dashboard/messages/conv1" },
  { id: "n2", userId: "p1", type: "match_confirmed", title: "Match Confirmed!", body: "Your match with Sarah Chen on Feb 20 at 9:00 AM is confirmed.", read: false, createdAt: "2026-02-16T12:00:00Z", link: "/dashboard/open-matches" },
  { id: "n3", userId: "p1", type: "ai_suggestion", title: "New Match Suggestion", body: "PlayMatch AI found a great partner for you — Lisa Park (3.5 NTRP)!", read: true, createdAt: "2026-02-15T14:00:00Z", link: "/dashboard/messages/conv2" },
  { id: "n4", userId: "p1", type: "match_reminder", title: "Match Tomorrow!", body: "Your match with Sarah Chen is tomorrow at 9:00 AM at Pleasanton Tennis Park.", read: true, createdAt: "2026-02-19T18:00:00Z" },
  { id: "n5", userId: "p1", type: "match_invitation", title: "Match Invitation", body: "Mike Rodriguez invited you to play tennis on Feb 25.", read: true, createdAt: "2026-02-14T10:00:00Z", link: "/dashboard/open-matches" },
  { id: "n6", userId: "p1", type: "ai_suggestion", title: "Post-Match Follow Up", body: "How did your match with Kevin go? Don't forget to report your score!", read: false, createdAt: "2026-02-11T10:00:00Z", link: "/dashboard/messages/conv4" },
];

export function getPlayerById(id: string): Player | undefined {
  return players.find((p) => p.id === id);
}

export function getMatchesForPlayer(playerId: string): Match[] {
  return matches.filter((m) => m.player1Id === playerId || m.player2Id === playerId);
}

export function getOpponent(match: Match, playerId: string): Player | undefined {
  const opponentId = match.player1Id === playerId ? match.player2Id : match.player1Id;
  return getPlayerById(opponentId);
}

export function getCompatiblePlayers(playerId: string): { player: Player; score: number; explanation: string }[] {
  const user = getPlayerById(playerId);
  if (!user) return [];
  return players
    .filter((p) => p.id !== playerId)
    .map((p) => {
      const ratingDiff = Math.abs(p.ntrpRating - user.ntrpRating);
      const overlap = p.availability.filter((d) => user.availability.includes(d)).length;
      const timeOverlap = p.preferredTimes.filter((t) => user.preferredTimes.includes(t)).length;
      const sportMatch = p.sport === user.sport || p.sport === "both" || user.sport === "both";
      let score = 100 - ratingDiff * 20 + overlap * 5 + timeOverlap * 5 + (sportMatch ? 10 : -10);
      score = Math.min(99, Math.max(40, Math.round(score)));
      const parts = [];
      if (ratingDiff <= 0.5) parts.push("Very close skill level");
      else if (ratingDiff <= 1.0) parts.push("Similar skill range");
      else parts.push("Skill gap offers challenge");
      if (overlap >= 3) parts.push("great schedule overlap");
      else if (overlap >= 1) parts.push("some schedule overlap");
      if (sportMatch) parts.push("compatible sport preferences");
      return { player: p, score, explanation: parts.join(", ") + "." };
    })
    .sort((a, b) => b.score - a.score);
}
