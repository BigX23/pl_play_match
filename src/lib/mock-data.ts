import type { UserProfile, DayAvailability, GameType, SportType, MatchFormat, PartnerPreferences } from "./matching-engine";

export interface Player {
  id: string;
  name: string;
  email: string;
  ntrpRating: number;
  avatar: string;
  photoURL?: string;
  location: string;
  availability: string[];
  preferredTimes: string[];
  sport: "tennis" | "pickleball" | "both";
  matchesPlayed: number;
  wins: number;
  losses: number;
  bio: string;
  joinedDate: string;
  // New onboarding fields
  firstName?: string;
  lastName?: string;
  age?: number;
  gender?: string;
  aboutMe?: string;
  sports?: SportType[];
  matchFormats?: MatchFormat[];
  gameType?: GameType;
  weeklyAvailability?: DayAvailability[];
  partnerPreferences?: PartnerPreferences;
  profileComplete?: boolean;
}

export type MatchStatus = "open" | "pending" | "confirmed" | "scheduled" | "in_progress" | "completed" | "cancelled";

export interface Match {
  id: string;
  player1Id: string;
  player2Id: string;
  player3Id?: string;
  player4Id?: string;
  date: string;
  time: string;
  location: string;
  sport: "tennis" | "pickleball";
  status: MatchStatus;
  score?: string;
  compatibilityScore: number;
  matchExplanation: string;
  matchType?: "singles" | "doubles";
  notes?: string;
  createdBy?: string;
  acceptedBy?: string;
  conversationId?: string;
  cancelledBy?: string;
  cancelReason?: string;
  participants?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MatchRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "accepted" | "declined" | "expired";
  score: number;
  createdAt: string;
  conversationId?: string;
}

export const players: Player[] = [];

export const matches: Match[] = [];

export const matchRequests: MatchRequest[] = [];

export type ConversationType = "direct" | "group";

export interface Conversation {
  id: string;
  participants: string[];
  type: ConversationType;
  name?: string;           // Display name for group chats (e.g. "Match: Alex vs Sarah")
  matchId?: string;        // Link to the match that created this group chat
  createdBy?: string;      // Who initiated the conversation (excluded from unread/push)
  lastMessage: string;
  lastMessageAt: string;
  unread: Record<string, number>; // per-user unread counts, keyed by userId
  createdAt: string;
}

export interface Contact {
  id: string;         // The contact user's ID
  name: string;
  email?: string;
  avatar?: string;
  addedAt: string;
}

// Rally — the system chatbot
export const RALLY_USER: Player = {
  id: "rally",
  name: "Rally",
  email: "rally@playmatch.app",
  ntrpRating: 0,
  avatar: "🎾",
  photoURL: "/images/rally-avatar.png",
  location: "",
  availability: [],
  preferredTimes: [],
  sport: "both",
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  bio: "I'm Rally, your AI match coach! 🎾",
  joinedDate: "2024-01-01",
  firstName: "Rally",
  lastName: "",
  profileComplete: true,
};

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

export type NotificationType = "new_message" | "match_invitation" | "match_confirmed" | "match_reminder" | "ai_suggestion" | "match_request" | "match_accepted" | "match_declined";

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

export const conversations: Conversation[] = [];

export const messages: Message[] = [];

export const notifications: Notification[] = [];

export function getPlayerById(id: string): Player | undefined {
  return players.find((p) => p.id === id);
}

export function getOpponent(match: Match, playerId: string): Player | undefined {
  const opponentId = match.player1Id === playerId ? match.player2Id : match.player1Id;
  return getPlayerById(opponentId);
}

/** Convert a Player to UserProfile for the matching engine */
export function playerToUserProfile(p: Player): UserProfile | null {
  if (!p.profileComplete || !p.firstName || !p.weeklyAvailability || !p.partnerPreferences) return null;
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName || "",
    age: p.age || 30,
    gender: p.gender || "Prefer not to say",
    avatar: p.avatar,
    aboutMe: p.aboutMe || p.bio,
    ntrpRating: p.ntrpRating,
    sports: p.sports || [p.sport === "both" ? "tennis" : p.sport] as SportType[],
    matchFormats: p.matchFormats || ["singles"],
    gameType: p.gameType || "slightly-competitive",
    availability: p.weeklyAvailability,
    partnerPreferences: p.partnerPreferences,
    profileComplete: true,
  };
}
