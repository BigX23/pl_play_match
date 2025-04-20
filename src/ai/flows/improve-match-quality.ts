'use server';

/**
 * @fileOverview Implements the AI matchmaking flow, considering user's preferred playing style.
 *
 * - improveMatchQuality - A function that improves match quality based on playing style preferences.
 * - ImproveMatchQualityInput - The input type for the improveMatchQuality function.
 * - ImproveMatchQualityOutput - The return type for the improveMatchQuality function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ImproveMatchQualityInputSchema = z.object({
  userProfile: z.object({
    sportPreference: z.enum(['Tennis', 'Pickleball', 'Both']).describe('Sport preference of the user.'),
    age: z.number().describe('Age of the user.'),
    skillLevel: z.string().describe('Skill level of the user (e.g., NTRP rating).'),
    gender: z.string().describe('Gender of the user.'),
    playingStyle: z.string().describe('Preferred playing style of the user (e.g., baseline, net play, aggressive, defensive).'),
    partnerPreferences: z.object({
      skillLevel: z.string().describe('Preferred skill level of the partner.'),
      gender: z.string().describe('Preferred gender of the partner.'),
      ageRange: z.string().describe('Preferred age range of the partner.'),
    }).describe('Preferences for the partner.'),
  }).describe('User profile information.'),
  potentialMatchProfile: z.object({
    sportPreference: z.enum(['Tennis', 'Pickleball', 'Both']).describe('Sport preference of the potential match.'),
    age: z.number().describe('Age of the potential match.'),
    skillLevel: z.string().describe('Skill level of the potential match (e.g., NTRP rating).'),
    gender: z.string().describe('Gender of the potential match.'),
    playingStyle: z.string().describe('Preferred playing style of the potential match (e.g., baseline, net play, aggressive, defensive).'),
  }).describe('Profile information of the potential match.'),
}).describe('Input for improving match quality.');

export type ImproveMatchQualityInput = z.infer<typeof ImproveMatchQualityInputSchema>;

const ImproveMatchQualityOutputSchema = z.object({
  matchScore: z.number().describe('A score (0-100) indicating the quality of the match based on playing style compatibility.'),
  explanation: z.string().describe('Explanation of how the match score was determined based on playing styles.'),
}).describe('Output containing match score and explanation.');

export type ImproveMatchQualityOutput = z.infer<typeof ImproveMatchQualityOutputSchema>;

export async function improveMatchQuality(input: ImproveMatchQualityInput): Promise<ImproveMatchQualityOutput> {
  return improveMatchQualityFlow(input);
}

const improveMatchQualityPrompt = ai.definePrompt({
  name: 'improveMatchQualityPrompt',
  input: {
    schema: ImproveMatchQualityInputSchema,
  },
  output: {
    schema: ImproveMatchQualityOutputSchema,
  },
  prompt: `You are an AI matchmaking expert. Analyze the playing styles of two players and determine a match score (0-100) based on their compatibility.

User Profile:
Sport Preference: {{{userProfile.sportPreference}}}
Age: {{{userProfile.age}}}
Skill Level: {{{userProfile.skillLevel}}}
Gender: {{{userProfile.gender}}}
Playing Style: {{{userProfile.playingStyle}}}
Partner Preferences: {{{userProfile.partnerPreferences.skillLevel}}}, {{{userProfile.partnerPreferences.gender}}}, {{{userProfile.partnerPreferences.ageRange}}}

Potential Match Profile:
Sport Preference: {{{potentialMatchProfile.sportPreference}}}
Age: {{{potentialMatchProfile.age}}}
Skill Level: {{{potentialMatchProfile.skillLevel}}}
Gender: {{{potentialMatchProfile.gender}}}
Playing Style: {{{potentialMatchProfile.playingStyle}}}

Consider how well their playing styles complement each other. For example, a baseline player might pair well with a net player. An aggressive player might pair well with a defensive player. Consider sport preference, age, skill level and gender as well.

Provide a match score (0-100) and a brief explanation of your reasoning.
`,
});

const improveMatchQualityFlow = ai.defineFlow<
  typeof ImproveMatchQualityInputSchema,
  typeof ImproveMatchQualityOutputSchema
>({
  name: 'improveMatchQualityFlow',
  inputSchema: ImproveMatchQualityInputSchema,
  outputSchema: ImproveMatchQualityOutputSchema,
},
async input => {
  const {output} = await improveMatchQualityPrompt(input);
  return output!;
});


