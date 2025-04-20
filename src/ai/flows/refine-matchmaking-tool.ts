'use server';
/**
 * @fileOverview A flow that incorporates user feedback on previous matches to refine the AI matchmaking tool and improve future recommendations.
 *
 * - refineMatchmaking - A function that handles the refinement of matchmaking based on feedback.
 * - RefineMatchmakingInput - The input type for the refineMatchmaking function.
 * - RefineMatchmakingOutput - The return type for the refineMatchmaking function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const RefineMatchmakingInputSchema = z.object({
  userId: z.string().describe('The ID of the user providing feedback.'),
  matchId: z.string().describe('The ID of the match being reviewed.'),
  feedback: z.enum(['up', 'down']).describe('The feedback on the match (up for positive, down for negative).'),
  currentMatchScore: z.number().describe('The current match score between the users prior to feedback.'),
  userProfile: z.object({
    sportPreference: z.enum(['Tennis', 'Pickleball', 'Both']).describe('Sport preference of the user.'),
    age: z.number().describe('Age of the user.'),
    skillLevel: z.string().describe('Skill level of the user (e.g., NTRP rating).'),
    gender: z.string().describe('Gender of the user.'),
    typeOfPlayer: z.enum(['Recreational', 'Somewhat Competitive', 'Really Competitive']).describe('Type of player.'),
    preferredPlayingTimes: z.string().describe('Preferred playing times of the user.'),
    howOftenTheyPlay: z.string().describe('How often the user plays (e.g., Once per month or less).'),
    playingStyle: z.string().describe('The user specified playing style'),
  }).describe('The user profile providing the feedback'),
  matchedUserProfile: z.object({
    sportPreference: z.enum(['Tennis', 'Pickleball', 'Both']).describe('Sport preference of the matched user.'),
    age: z.number().describe('Age of the matched user.'),
    skillLevel: z.string().describe('Skill level of the matched  user (e.g., NTRP rating).'),
    gender: z.string().describe('Gender of the matched user.'),
    typeOfPlayer: z.enum(['Recreational', 'Somewhat Competitive', 'Really Competitive']).describe('Type of player.'),
    preferredPlayingTimes: z.string().describe('Preferred playing times of the matched user.'),
    howOftenTheyPlay: z.string().describe('How often the matched user plays (e.g., Once per month or less).'),
    playingStyle: z.string().describe('The matched user specified playing style'),
  }).describe('The matched user profile'),
});
export type RefineMatchmakingInput = z.infer<typeof RefineMatchmakingInputSchema>;

const RefineMatchmakingOutputSchema = z.object({
  adjustedMatchScore: z.number().describe('The adjusted match score after incorporating feedback.'),
  explanation: z.string().describe('Explanation of how the feedback affected the match score.'),
});
export type RefineMatchmakingOutput = z.infer<typeof RefineMatchmakingOutputSchema>;

export async function refineMatchmaking(input: RefineMatchmakingInput): Promise<RefineMatchmakingOutput> {
  return refineMatchmakingFlow(input);
}

const refineMatchmakingPrompt = ai.definePrompt({
  name: 'refineMatchmakingPrompt',
  input: {
    schema: z.object({
      userId: z.string().describe('The ID of the user providing feedback.'),
      matchId: z.string().describe('The ID of the match being reviewed.'),
      feedback: z.enum(['up', 'down']).describe('The feedback on the match (up for positive, down for negative).'),
      currentMatchScore: z.number().describe('The current match score between the users prior to feedback.'),
      userProfile: z.object({
        sportPreference: z.enum(['Tennis', 'Pickleball', 'Both']).describe('Sport preference of the user.'),
        age: z.number().describe('Age of the user.'),
        skillLevel: z.string().describe('Skill level of the user (e.g., NTRP rating).'),
        gender: z.string().describe('Gender of the user.'),
        typeOfPlayer: z.enum(['Recreational', 'Somewhat Competitive', 'Really Competitive']).describe('Type of player.'),
        preferredPlayingTimes: z.string().describe('Preferred playing times of the user.'),
        howOftenTheyPlay: z.string().describe('How often the user plays (e.g., Once per month or less).'),
        playingStyle: z.string().describe('The user specified playing style'),
      }).describe('The user profile providing the feedback'),
      matchedUserProfile: z.object({
        sportPreference: z.enum(['Tennis', 'Pickleball', 'Both']).describe('Sport preference of the matched user.'),
        age: z.number().describe('Age of the matched user.'),
        skillLevel: z.string().describe('Skill level of the matched  user (e.g., NTRP rating).'),
        gender: z.string().describe('Gender of the matched user.'),
        typeOfPlayer: z.enum(['Recreational', 'Somewhat Competitive', 'Really Competitive']).describe('Type of player.'),
        preferredPlayingTimes: z.string().describe('Preferred playing times of the matched user.'),
        howOftenTheyPlay: z.string().describe('How often the matched user plays (e.g., Once per month or less).'),
        playingStyle: z.string().describe('The matched user specified playing style'),
      }).describe('The matched user profile'),
    }),
  },
  output: {
    schema: z.object({
      adjustedMatchScore: z.number().describe('The adjusted match score after incorporating feedback.'),
      explanation: z.string().describe('Explanation of how the feedback affected the match score.'),
    }),
  },
  prompt: `You are an AI matchmaking expert refining match scores based on user feedback.

  User Feedback: {{{feedback}}}
  Current Match Score: {{{currentMatchScore}}}

  User Profile: {{{userProfile}}}
  Matched User Profile: {{{matchedUserProfile}}}

  Based on the feedback, adjust the match score and explain the adjustment. If the feedback is 'up', slightly increase the score, especially if the users have similar playing styles and preferences. If the feedback is 'down', significantly decrease the score, particularly if there are mismatches in skill level, playing style, or preferences. Return both the adjusted score and the explanation. Be sure to return the adjusted match score as a number between 0 and 100.
  `,
});

const refineMatchmakingFlow = ai.defineFlow<
  typeof RefineMatchmakingInputSchema,
  typeof RefineMatchmakingOutputSchema
>({
  name: 'refineMatchmakingFlow',
  inputSchema: RefineMatchmakingInputSchema,
  outputSchema: RefineMatchmakingOutputSchema,
}, async input => {
  const {output} = await refineMatchmakingPrompt(input);
  return output!;
});

