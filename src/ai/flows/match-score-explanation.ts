'use server';
/**
 * @fileOverview Explains the match score between two users.
 *
 * - explainMatchScore - A function that provides a match score explanation.
 * - ExplainMatchScoreInput - The input type for the explainMatchScore function.
 * - ExplainMatchScoreOutput - The return type for the explainMatchScore function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ExplainMatchScoreInputSchema = z.object({
  userProfile: z.object({
    sportPreference: z.enum(['Tennis', 'Pickleball', 'Both']).describe('The sport preference of the user.'),
    age: z.number().describe('The age of the user.'),
    skillLevel: z.string().describe('The skill level of the user (e.g., NTRP rating).'),
    gender: z.string().describe('The gender of the user.'),
    typeOfPlayer: z.enum(['Recreational', 'Somewhat Competitive', 'Really Competitive']).describe('The type of player.'),
    preferredPlayingTimes: z.string().describe('The preferred playing times of the user.'),
    howOftenTheyPlay: z.string().describe('How often the user plays (e.g., Once per month or less).'),
    partnerSkillLevels: z.string().describe('Preferred partner skill levels.'),
    partnerGender: z.string().describe('Preferred partner gender.'),
    partnerAgeRange: z.string().describe('Preferred partner age range.'),
    partnerContactDetails: z.string().describe('Preferred contact details.'),
    playingStyle: z.string().describe('The playing style of the user (e.g., baseline, net play).'),
  }).describe('The profile of the user.'),
  potentialMatchProfile: z.object({
    sportPreference: z.enum(['Tennis', 'Pickleball', 'Both']).describe('The sport preference of the potential match.'),
    age: z.number().describe('The age of the potential match.'),
    skillLevel: z.string().describe('The skill level of the potential match (e.g., NTRP rating).'),
    gender: z.string().describe('The gender of the potential match.'),
    typeOfPlayer: z.enum(['Recreational', 'Somewhat Competitive', 'Really Competitive']).describe('The type of player.'),
    preferredPlayingTimes: z.string().describe('The preferred playing times of the potential match.'),
    howOftenTheyPlay: z.string().describe('How often the potential match plays (e.g., Once per month or less).'),
    partnerSkillLevels: z.string().describe('Preferred partner skill levels.'),
    partnerGender: z.string().describe('Preferred partner gender.'),
    partnerAgeRange: z.string().describe('Preferred partner age range.'),
    partnerContactDetails: z.string().describe('Preferred contact details.'),
    playingStyle: z.string().describe('The playing style of the potential match (e.g., baseline, net play).'),
  }).describe('The profile of the potential match.'),
  matchScore: z.number().describe('The match score between the user and the potential match (0-100).'),
}).describe('Input for explaining the match score.');
export type ExplainMatchScoreInput = z.infer<typeof ExplainMatchScoreInputSchema>;

const ExplainMatchScoreOutputSchema = z.object({
  explanation: z.string().describe('A brief explanation of why the potential match has the given score.'),
}).describe('Output for explaining the match score.');
export type ExplainMatchScoreOutput = z.infer<typeof ExplainMatchScoreOutputSchema>;

export async function explainMatchScore(input: ExplainMatchScoreInput): Promise<ExplainMatchScoreOutput> {
  return explainMatchScoreFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainMatchScorePrompt',
  input: {
    schema: z.object({
      userProfile: z.object({
        sportPreference: z.enum(['Tennis', 'Pickleball', 'Both']).describe('The sport preference of the user.'),
        age: z.number().describe('The age of the user.'),
        skillLevel: z.string().describe('The skill level of the user (e.g., NTRP rating).'),
        gender: z.string().describe('The gender of the user.'),
        typeOfPlayer: z.enum(['Recreational', 'Somewhat Competitive', 'Really Competitive']).describe('The type of player.'),
        preferredPlayingTimes: z.string().describe('The preferred playing times of the user.'),
        howOftenTheyPlay: z.string().describe('How often the user plays (e.g., Once per month or less).'),
        partnerSkillLevels: z.string().describe('Preferred partner skill levels.'),
        partnerGender: z.string().describe('Preferred partner gender.'),
        partnerAgeRange: z.string().describe('Preferred partner age range.'),
        partnerContactDetails: z.string().describe('Preferred contact details.'),
        playingStyle: z.string().describe('The playing style of the user (e.g., baseline, net play).'),
      }).describe('The profile of the user.'),
      potentialMatchProfile: z.object({
        sportPreference: z.enum(['Tennis', 'Pickleball', 'Both']).describe('The sport preference of the potential match.'),
        age: z.number().describe('The age of the potential match.'),
        skillLevel: z.string().describe('The skill level of the potential match (e.g., NTRP rating).'),
        gender: z.string().describe('The gender of the potential match.'),
        typeOfPlayer: z.enum(['Recreational', 'Somewhat Competitive', 'Really Competitive']).describe('The type of player.'),
        preferredPlayingTimes: z.string().describe('The preferred playing times of the potential match.'),
        howOftenTheyPlay: z.string().describe('How often the potential match plays (e.g., Once per month or less).'),
        partnerSkillLevels: z.string().describe('Preferred partner skill levels.'),
        partnerGender: z.string().describe('Preferred partner gender.'),
        partnerAgeRange: z.string().describe('Preferred partner age range.'),
        partnerContactDetails: z.string().describe('Preferred contact details.'),
        playingStyle: z.string().describe('The playing style of the potential match (e.g., baseline, net play).'),
      }).describe('The profile of the potential match.'),
      matchScore: z.number().describe('The match score between the user and the potential match (0-100).'),
    }),
  },
  output: {
    schema: z.object({
      explanation: z.string().describe('A brief explanation of why the potential match has the given score.'),
    }),
  },
  prompt: `You are an AI matchmaker, skilled at providing the reasons why two users have the match score that they do.

User Profile:
{{userProfile}}

Potential Match Profile:
{{potentialMatchProfile}}

Match Score: {{matchScore}}

Provide a brief explanation of why the potential match has the given score. Focus on the most important factors. For example, sport preference, age, skill level, type of player, preferred playing times, and playing style.
`,
});

const explainMatchScoreFlow = ai.defineFlow<
  typeof ExplainMatchScoreInputSchema,
  typeof ExplainMatchScoreOutputSchema
>({
  name: 'explainMatchScoreFlow',
  inputSchema: ExplainMatchScoreInputSchema,
  outputSchema: ExplainMatchScoreOutputSchema,
}, async input => {
  const {output} = await prompt(input);
  return output!;
});
