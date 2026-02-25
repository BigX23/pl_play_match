import type { UserProfile, DayAvailability, GameType, SportType, MatchFormat, AgeRange, PartnerPreferences } from "./matching-engine";

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

function makeDayAvail(day: string, enabled: boolean, slots: { start: number; end: number }[] = []): DayAvailability {
  return { day, enabled, slots };
}

function makeWeek(schedule: Record<string, { start: number; end: number }[]>): DayAvailability[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((d) => makeDayAvail(d, !!schedule[d], schedule[d] || []));
}

export const currentUser: Player = {
  id: "p1",
  name: "Alex Johnson",
  email: "alex@example.com",
  ntrpRating: 3.5,
  avatar: "🎾",
  location: "Pleasanton, CA",
  availability: ["Mon", "Wed", "Fri", "Sat"],
  preferredTimes: ["Morning", "Evening"],
  sport: "both",
  matchesPlayed: 47,
  wins: 28,
  losses: 19,
  bio: "Weekend warrior who loves competitive tennis and casual pickleball.",
  joinedDate: "2025-03-15",
  firstName: "Alex",
  lastName: "Johnson",
  age: 34,
  gender: "Male",
  aboutMe: "Weekend warrior who loves competitive tennis and casual pickleball.",
  sports: ["tennis", "pickleball"],
  matchFormats: ["singles", "doubles"],
  gameType: "slightly-competitive",
  weeklyAvailability: makeWeek({
    Mon: [{ start: 9, end: 12 }],
    Wed: [{ start: 18, end: 20 }],
    Fri: [{ start: 17, end: 19 }],
    Sat: [{ start: 8, end: 12 }],
  }),
  partnerPreferences: {
    ageRange: "10",
    ntrpMin: 3.0,
    ntrpMax: 4.5,
    gameTypes: ["slightly-competitive", "recreational"],
    sports: ["tennis", "pickleball"],
    matchFormats: ["singles", "doubles"],
    genderPreference: "No Preference" as const,
  },
  profileComplete: true,
};

export const players: Player[] = [
  currentUser,
  {
    id: "p2", name: "Sarah Chen", email: "sarah@example.com", ntrpRating: 3.5, avatar: "💪", location: "Pleasanton, CA", availability: ["Mon", "Wed", "Sat"], preferredTimes: ["Morning"], sport: "tennis", matchesPlayed: 62, wins: 38, losses: 24, bio: "Former college player getting back into the game.", joinedDate: "2024-11-20",
    firstName: "Sarah", lastName: "Chen", age: 31, gender: "Female", sports: ["tennis"], matchFormats: ["singles"], gameType: "slightly-competitive",
    weeklyAvailability: makeWeek({ Mon: [{ start: 8, end: 11 }], Wed: [{ start: 9, end: 12 }], Sat: [{ start: 8, end: 11 }] }),
    partnerPreferences: { ageRange: "5", ntrpMin: 3.0, ntrpMax: 4.0, gameTypes: ["slightly-competitive"], sports: ["tennis"], matchFormats: ["singles", "doubles"], genderPreference: "No Preference" as const },
    profileComplete: true,
  },
  {
    id: "p3", name: "Mike Rodriguez", email: "mike@example.com", ntrpRating: 4.0, avatar: "🔥", location: "Dublin, CA", availability: ["Tue", "Thu", "Sat", "Sun"], preferredTimes: ["Morning", "Afternoon"], sport: "both", matchesPlayed: 89, wins: 55, losses: 34, bio: "Competitive player looking for quality matches.", joinedDate: "2024-08-10",
    firstName: "Mike", lastName: "Rodriguez", age: 38, gender: "Male", sports: ["tennis", "pickleball"], matchFormats: ["singles", "doubles"], gameType: "hardcore-competitive",
    weeklyAvailability: makeWeek({ Tue: [{ start: 7, end: 10 }], Thu: [{ start: 7, end: 10 }], Sat: [{ start: 9, end: 14 }], Sun: [{ start: 9, end: 14 }] }),
    partnerPreferences: { ageRange: "10", ntrpMin: 3.5, ntrpMax: 4.5, gameTypes: ["slightly-competitive", "hardcore-competitive"], sports: ["tennis", "pickleball"], matchFormats: ["singles"], genderPreference: "No Preference" as const },
    profileComplete: true,
  },
  {
    id: "p4", name: "Emily Watson", email: "emily@example.com", ntrpRating: 3.0, avatar: "🏓", location: "Pleasanton, CA", availability: ["Mon", "Fri", "Sun"], preferredTimes: ["Evening"], sport: "pickleball", matchesPlayed: 31, wins: 18, losses: 13, bio: "Pickleball enthusiast, always up for a fun game!", joinedDate: "2025-01-05",
    firstName: "Emily", lastName: "Watson", age: 45, gender: "Female", sports: ["pickleball"], matchFormats: ["doubles"], gameType: "recreational",
    weeklyAvailability: makeWeek({ Mon: [{ start: 17, end: 20 }], Fri: [{ start: 17, end: 20 }], Sun: [{ start: 10, end: 14 }] }),
    partnerPreferences: { ageRange: "10", ntrpMin: 2.5, ntrpMax: 3.5, gameTypes: ["recreational", "slightly-competitive"], sports: ["pickleball"], matchFormats: ["doubles"], genderPreference: "No Preference" as const },
    profileComplete: true,
  },
  {
    id: "p5", name: "David Kim", email: "david@example.com", ntrpRating: 4.5, avatar: "🏆", location: "Livermore, CA", availability: ["Wed", "Sat", "Sun"], preferredTimes: ["Morning", "Afternoon"], sport: "tennis", matchesPlayed: 124, wins: 82, losses: 42, bio: "Tournament player, happy to rally with all levels.", joinedDate: "2024-06-01",
    firstName: "David", lastName: "Kim", age: 29, gender: "Male", sports: ["tennis"], matchFormats: ["singles"], gameType: "hardcore-competitive",
    weeklyAvailability: makeWeek({ Wed: [{ start: 6, end: 9 }], Sat: [{ start: 8, end: 13 }], Sun: [{ start: 8, end: 13 }] }),
    partnerPreferences: { ageRange: "any", ntrpMin: 3.5, ntrpMax: 5.5, gameTypes: ["slightly-competitive", "hardcore-competitive"], sports: ["tennis"], matchFormats: ["singles"], genderPreference: "No Preference" as const },
    profileComplete: true,
  },
  {
    id: "p6", name: "Lisa Park", email: "lisa@example.com", ntrpRating: 3.5, avatar: "⭐", location: "Pleasanton, CA", availability: ["Tue", "Thu", "Sat"], preferredTimes: ["Morning", "Evening"], sport: "both", matchesPlayed: 43, wins: 25, losses: 18, bio: "Love both sports! Looking for regular hitting partners.", joinedDate: "2024-12-15",
    firstName: "Lisa", lastName: "Park", age: 33, gender: "Female", sports: ["tennis", "pickleball"], matchFormats: ["singles", "doubles"], gameType: "slightly-competitive",
    weeklyAvailability: makeWeek({ Tue: [{ start: 9, end: 11 }], Thu: [{ start: 9, end: 11 }], Sat: [{ start: 8, end: 12 }, { start: 17, end: 19 }] }),
    partnerPreferences: { ageRange: "10", ntrpMin: 3.0, ntrpMax: 4.0, gameTypes: ["recreational", "slightly-competitive"], sports: ["tennis", "pickleball"], matchFormats: ["singles", "doubles"], genderPreference: "No Preference" as const },
    profileComplete: true,
  },
  {
    id: "p7", name: "James Taylor", email: "james@example.com", ntrpRating: 2.5, avatar: "🦊", location: "San Ramon, CA", availability: ["Mon", "Wed", "Fri"], preferredTimes: ["Evening"], sport: "tennis", matchesPlayed: 15, wins: 6, losses: 9, bio: "Beginner looking to improve. Patient partners welcome!", joinedDate: "2025-02-01",
    firstName: "James", lastName: "Taylor", age: 27, gender: "Male", sports: ["tennis"], matchFormats: ["singles"], gameType: "recreational",
    weeklyAvailability: makeWeek({ Mon: [{ start: 18, end: 21 }], Wed: [{ start: 18, end: 21 }], Fri: [{ start: 18, end: 21 }] }),
    partnerPreferences: { ageRange: "5", ntrpMin: 2.0, ntrpMax: 3.5, gameTypes: ["recreational", "slightly-competitive"], sports: ["tennis"], matchFormats: ["singles"], genderPreference: "No Preference" as const },
    profileComplete: true,
  },
  {
    id: "p8", name: "Maria Garcia", email: "maria@example.com", ntrpRating: 3.0, avatar: "🌟", location: "Pleasanton, CA", availability: ["Tue", "Sat", "Sun"], preferredTimes: ["Morning"], sport: "pickleball", matchesPlayed: 52, wins: 30, losses: 22, bio: "Retired and loving pickleball life.", joinedDate: "2024-09-20",
    firstName: "Maria", lastName: "Garcia", age: 62, gender: "Female", sports: ["pickleball"], matchFormats: ["doubles"], gameType: "recreational",
    weeklyAvailability: makeWeek({ Tue: [{ start: 8, end: 11 }], Sat: [{ start: 8, end: 11 }], Sun: [{ start: 8, end: 11 }] }),
    partnerPreferences: { ageRange: "any", ntrpMin: 2.5, ntrpMax: 3.5, gameTypes: ["recreational"], sports: ["pickleball"], matchFormats: ["doubles"], genderPreference: "No Preference" as const },
    profileComplete: true,
  },
  {
    id: "p9", name: "Robert Brown", email: "robert@example.com", ntrpRating: 4.0, avatar: "🦁", location: "Dublin, CA", availability: ["Mon", "Wed", "Fri", "Sun"], preferredTimes: ["Afternoon", "Evening"], sport: "tennis", matchesPlayed: 78, wins: 45, losses: 33, bio: "Serious about improving my game.", joinedDate: "2024-07-12",
    firstName: "Robert", lastName: "Brown", age: 41, gender: "Male", sports: ["tennis"], matchFormats: ["singles"], gameType: "hardcore-competitive",
    weeklyAvailability: makeWeek({ Mon: [{ start: 14, end: 17 }], Wed: [{ start: 14, end: 17 }], Fri: [{ start: 14, end: 17 }], Sun: [{ start: 10, end: 14 }] }),
    partnerPreferences: { ageRange: "10", ntrpMin: 3.5, ntrpMax: 5.0, gameTypes: ["slightly-competitive", "hardcore-competitive"], sports: ["tennis"], matchFormats: ["singles"], genderPreference: "No Preference" as const },
    profileComplete: true,
  },
  {
    id: "p10", name: "Jennifer Lee", email: "jennifer@example.com", ntrpRating: 3.5, avatar: "🎯", location: "Pleasanton, CA", availability: ["Tue", "Thu"], preferredTimes: ["Morning"], sport: "both", matchesPlayed: 36, wins: 20, losses: 16, bio: "Mom of two who plays whenever possible!", joinedDate: "2025-01-22",
    firstName: "Jennifer", lastName: "Lee", age: 36, gender: "Female", sports: ["tennis", "pickleball"], matchFormats: ["doubles"], gameType: "recreational",
    weeklyAvailability: makeWeek({ Tue: [{ start: 9, end: 11 }], Thu: [{ start: 9, end: 11 }] }),
    partnerPreferences: { ageRange: "5", ntrpMin: 3.0, ntrpMax: 4.0, gameTypes: ["recreational", "slightly-competitive"], sports: ["tennis", "pickleball"], matchFormats: ["doubles"], genderPreference: "No Preference" as const },
    profileComplete: true,
  },
  {
    id: "p11", name: "Chris Martinez", email: "chris@example.com", ntrpRating: 5.0, avatar: "🚀", location: "Livermore, CA", availability: ["Sat", "Sun"], preferredTimes: ["Morning", "Afternoon"], sport: "tennis", matchesPlayed: 200, wins: 145, losses: 55, bio: "Former D1 player, coaching on the side.", joinedDate: "2024-05-01",
    firstName: "Chris", lastName: "Martinez", age: 32, gender: "Male", sports: ["tennis"], matchFormats: ["singles"], gameType: "hardcore-competitive",
    weeklyAvailability: makeWeek({ Sat: [{ start: 7, end: 13 }], Sun: [{ start: 7, end: 13 }] }),
    partnerPreferences: { ageRange: "any", ntrpMin: 4.0, ntrpMax: 5.5, gameTypes: ["hardcore-competitive"], sports: ["tennis"], matchFormats: ["singles"], genderPreference: "No Preference" as const },
    profileComplete: true,
  },
  {
    id: "p12", name: "Amanda White", email: "amanda@example.com", ntrpRating: 3.0, avatar: "🌈", location: "San Ramon, CA", availability: ["Mon", "Wed", "Sat"], preferredTimes: ["Evening"], sport: "both", matchesPlayed: 28, wins: 14, losses: 14, bio: "Even win/loss record — I keep things interesting!", joinedDate: "2024-10-30",
    firstName: "Amanda", lastName: "White", age: 39, gender: "Female", sports: ["tennis", "pickleball"], matchFormats: ["singles", "doubles"], gameType: "slightly-competitive",
    weeklyAvailability: makeWeek({ Mon: [{ start: 18, end: 20 }], Wed: [{ start: 18, end: 20 }], Sat: [{ start: 10, end: 13 }] }),
    partnerPreferences: { ageRange: "10", ntrpMin: 2.5, ntrpMax: 3.5, gameTypes: ["recreational", "slightly-competitive"], sports: ["tennis", "pickleball"], matchFormats: ["singles", "doubles"], genderPreference: "No Preference" as const },
    profileComplete: true,
  },
  {
    id: "p13", name: "Kevin Nguyen", email: "kevin@example.com", ntrpRating: 4.0, avatar: "💎", location: "Pleasanton, CA", availability: ["Tue", "Thu", "Sat"], preferredTimes: ["Morning", "Evening"], sport: "tennis", matchesPlayed: 95, wins: 58, losses: 37, bio: "Tennis is therapy. Let's hit!", joinedDate: "2024-04-18",
    firstName: "Kevin", lastName: "Nguyen", age: 37, gender: "Male", sports: ["tennis"], matchFormats: ["singles", "doubles"], gameType: "slightly-competitive",
    weeklyAvailability: makeWeek({ Tue: [{ start: 7, end: 9 }], Thu: [{ start: 7, end: 9 }], Sat: [{ start: 8, end: 12 }, { start: 17, end: 19 }] }),
    partnerPreferences: { ageRange: "10", ntrpMin: 3.0, ntrpMax: 4.5, gameTypes: ["slightly-competitive", "hardcore-competitive"], sports: ["tennis"], matchFormats: ["singles", "doubles"], genderPreference: "No Preference" as const },
    profileComplete: true,
  },
  {
    id: "p14", name: "Rachel Adams", email: "rachel@example.com", ntrpRating: 2.5, avatar: "🐬", location: "Dublin, CA", availability: ["Wed", "Fri", "Sun"], preferredTimes: ["Afternoon"], sport: "pickleball", matchesPlayed: 20, wins: 10, losses: 10, bio: "Just started pickleball and I'm hooked!", joinedDate: "2025-02-10",
    firstName: "Rachel", lastName: "Adams", age: 28, gender: "Female", sports: ["pickleball"], matchFormats: ["doubles"], gameType: "recreational",
    weeklyAvailability: makeWeek({ Wed: [{ start: 13, end: 16 }], Fri: [{ start: 13, end: 16 }], Sun: [{ start: 10, end: 14 }] }),
    partnerPreferences: { ageRange: "5", ntrpMin: 2.0, ntrpMax: 3.0, gameTypes: ["recreational"], sports: ["pickleball"], matchFormats: ["doubles"], genderPreference: "No Preference" as const },
    profileComplete: true,
  },
];

export const matches: Match[] = [
  { id: "m1", player1Id: "p1", player2Id: "p2", date: "2026-02-20", time: "9:00 AM", location: "Lifetime Activities Pleasanton", sport: "tennis", status: "scheduled", compatibilityScore: 92, matchExplanation: "Same NTRP rating, overlapping availability on Mon/Wed/Sat, both prefer morning play.", participants: ["p1", "p2"], createdBy: "p1" },
  { id: "m2", player1Id: "p1", player2Id: "p6", date: "2026-02-22", time: "6:00 PM", location: "Lifetime Activities Pleasanton", sport: "pickleball", status: "scheduled", compatibilityScore: 88, matchExplanation: "Matching NTRP, both enjoy tennis and pickleball, overlapping Sat availability.", participants: ["p1", "p6"], createdBy: "p1" },
  { id: "m3", player1Id: "p1", player2Id: "p3", date: "2026-02-15", time: "10:00 AM", location: "Lifetime Activities Pleasanton", sport: "tennis", status: "completed", score: "6-4, 3-6, 7-5", compatibilityScore: 78, matchExplanation: "Close NTRP ratings, both competitive players. Slight rating gap makes for a challenging match." },
  { id: "m4", player1Id: "p1", player2Id: "p10", date: "2026-02-12", time: "8:00 AM", location: "Lifetime Activities Pleasanton", sport: "tennis", status: "completed", score: "6-3, 6-4", compatibilityScore: 85, matchExplanation: "Same NTRP, similar play style preferences." },
  { id: "m5", player1Id: "p3", player2Id: "p9", date: "2026-02-25", time: "2:00 PM", location: "Lifetime Activities Pleasanton", sport: "tennis", status: "open", compatibilityScore: 90, matchExplanation: "Same NTRP 4.0, both competitive players.", matchType: "singles", createdBy: "p3" },
  { id: "m6", player1Id: "p5", player2Id: "p11", date: "2026-02-23", time: "10:00 AM", location: "Lifetime Activities Pleasanton", sport: "tennis", status: "open", compatibilityScore: 72, matchExplanation: "Both high-level players. Rating gap provides good challenge.", matchType: "singles", createdBy: "p5" },
  { id: "m7", player1Id: "p4", player2Id: "p8", date: "2026-02-21", time: "9:00 AM", location: "Lifetime Activities Pleasanton", sport: "pickleball", status: "open", compatibilityScore: 94, matchExplanation: "Same NTRP, both pickleball focused.", matchType: "doubles", createdBy: "p4" },
  { id: "m8", player1Id: "p7", player2Id: "p14", date: "2026-02-24", time: "3:00 PM", location: "Lifetime Activities Pleasanton", sport: "pickleball", status: "open", compatibilityScore: 91, matchExplanation: "Both beginners (2.5 NTRP), great for learning together.", matchType: "doubles", createdBy: "p7" },
  { id: "m9", player1Id: "p1", player2Id: "p13", date: "2026-02-10", time: "7:00 PM", location: "Lifetime Activities Pleasanton", sport: "tennis", status: "completed", score: "4-6, 6-3, 6-7(5)", compatibilityScore: 80, matchExplanation: "Close match between 3.5 and 4.0 players. Exciting three-setter!" },
];

export const matchRequests: MatchRequest[] = [
  { id: "mr1", fromUserId: "p1", toUserId: "p6", status: "accepted", score: 88, createdAt: "2026-02-15T10:00:00Z", conversationId: "conv2" },
  { id: "mr2", fromUserId: "p1", toUserId: "p12", status: "pending", score: 72, createdAt: "2026-02-17T07:00:00Z" },
  { id: "mr3", fromUserId: "p3", toUserId: "p1", status: "pending", score: 78, createdAt: "2026-02-17T06:00:00Z" },
  { id: "mr4", fromUserId: "p13", toUserId: "p1", status: "pending", score: 80, createdAt: "2026-02-16T14:00:00Z" },
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

export const conversations: Conversation[] = [
  { id: "conv1", participants: ["p1", "p2"], lastMessage: "See you Saturday morning!", lastMessageAt: "2026-02-17T08:30:00Z", unreadCount: 1, createdAt: "2026-02-14T10:00:00Z" },
  { id: "conv2", participants: ["p1", "p6"], lastMessage: "The courts at Val Vista are great for pickleball", lastMessageAt: "2026-02-16T19:00:00Z", unreadCount: 0, createdAt: "2026-02-15T14:00:00Z" },
  { id: "conv3", participants: ["p1", "p2", "ai"], lastMessage: "Hey Sarah and Alex! You're both 3.5 NTRP players who love playing on Mon/Wed/Sat mornings. Want to set up a match this week?", lastMessageAt: "2026-02-14T09:00:00Z", unreadCount: 0, createdAt: "2026-02-14T09:00:00Z" },
  { id: "conv4", participants: ["p1", "p13", "ai"], lastMessage: "How did your match with Kevin go? Report your score! 🎾", lastMessageAt: "2026-02-11T10:00:00Z", unreadCount: 1, createdAt: "2026-02-09T12:00:00Z" },
];

export const messages: Message[] = [
  { id: "msg1", conversationId: "conv1", senderId: "p2", senderName: "Sarah Chen", text: "Hey Alex! Looking forward to our match on the 20th.", createdAt: "2026-02-16T10:00:00Z", readBy: ["p2", "p1"] },
  { id: "msg2", conversationId: "conv1", senderId: "p1", senderName: "Alex Johnson", text: "Me too! I've been practicing my backhand 😄", createdAt: "2026-02-16T10:15:00Z", readBy: ["p1", "p2"] },
  { id: "msg3", conversationId: "conv1", senderId: "p2", senderName: "Sarah Chen", text: "See you Saturday morning!", createdAt: "2026-02-17T08:30:00Z", readBy: ["p2"] },
  { id: "msg4", conversationId: "conv2", senderId: "p1", senderName: "Alex Johnson", text: "Hey Lisa, want to play pickleball this Saturday?", createdAt: "2026-02-16T18:00:00Z", readBy: ["p1", "p6"] },
  { id: "msg5", conversationId: "conv2", senderId: "p6", senderName: "Lisa Park", text: "The courts at Val Vista are great for pickleball", createdAt: "2026-02-16T19:00:00Z", readBy: ["p6", "p1"] },
  { id: "msg6", conversationId: "conv3", senderId: "ai", senderName: "Rally", text: "Hey Sarah and Alex! You're both 3.5 NTRP players who love playing on Mon/Wed/Sat mornings. Want to set up a match this week?", createdAt: "2026-02-14T09:00:00Z", readBy: ["ai", "p1", "p2"], isAI: true },
  { id: "msg7", conversationId: "conv4", senderId: "ai", senderName: "Rally", text: "Hey Alex and Kevin! You're both competitive players who enjoy evening tennis. I think you'd have a great match!", createdAt: "2026-02-09T12:00:00Z", readBy: ["ai", "p1", "p13"], isAI: true },
  { id: "msg8", conversationId: "conv4", senderId: "p1", senderName: "Alex Johnson", text: "Sounds good! Kevin, are you free this Tuesday evening?", createdAt: "2026-02-09T13:00:00Z", readBy: ["p1", "p13"] },
  { id: "msg9", conversationId: "conv4", senderId: "p13", senderName: "Kevin Nguyen", text: "Tuesday works! 7pm at Pleasanton Tennis Park?", createdAt: "2026-02-09T14:00:00Z", readBy: ["p13", "p1"] },
  { id: "msg10", conversationId: "conv4", senderId: "ai", senderName: "Rally", text: "How did your match with Kevin go? Report your score! 🎾", createdAt: "2026-02-11T10:00:00Z", readBy: ["ai"], isAI: true },
];

export const notifications: Notification[] = [
  { id: "n1", userId: "p1", type: "new_message", title: "New message from Sarah", body: "See you Saturday morning!", read: false, createdAt: "2026-02-17T08:30:00Z", link: "/dashboard/messages/conv1" },
  { id: "n2", userId: "p1", type: "match_confirmed", title: "Match Confirmed!", body: "Your match with Sarah Chen on Feb 20 at 9:00 AM is confirmed.", read: false, createdAt: "2026-02-16T12:00:00Z", link: "/dashboard/open-matches" },
  { id: "n3", userId: "p1", type: "ai_suggestion", title: "New Match Suggestion", body: "PlayMatch AI found a great partner for you — Lisa Park (3.5 NTRP)!", read: true, createdAt: "2026-02-15T14:00:00Z", link: "/dashboard/messages/conv2" },
  { id: "n4", userId: "p1", type: "match_reminder", title: "Match Tomorrow!", body: "Your match with Sarah Chen is tomorrow at 9:00 AM at Lifetime Activities Pleasanton.", read: true, createdAt: "2026-02-19T18:00:00Z" },
  { id: "n5", userId: "p1", type: "match_request", title: "New Match Request!", body: "Mike Rodriguez wants to match with you! (78% compatible)", read: false, createdAt: "2026-02-17T06:00:00Z", link: "/dashboard" },
  { id: "n6", userId: "p1", type: "match_request", title: "New Match Request!", body: "Kevin Nguyen wants to match with you! (80% compatible)", read: false, createdAt: "2026-02-16T14:00:00Z", link: "/dashboard" },
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
