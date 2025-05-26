
import type { NextApiRequest, NextApiResponse } from 'next';
import { createUser, createUserProfile } from '../../../db/sqlite-data'; // Adjust the import path as needed
 
export default async function handler (
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const { email, password, sportPreference, age, skillLevel, gender, typeOfPlayer, preferredPlayingTimes, howOftenTheyPlay, gameType, notes, phoneNumber } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
      // Create the user
      await createUser(email, password);

      // Create the user profile
      await createUserProfile({
        email, // Make sure to pass the email for the profile
        sportPreference,
        age,
        skillLevel,
        gender,
        typeOfPlayer,
        preferredPlayingTimes: typeof preferredPlayingTimes === 'object' ? JSON.stringify(preferredPlayingTimes) : preferredPlayingTimes,
        howOftenTheyPlay,
        gameType,
        notes,
        phoneNumber,
      });

      res.status(201).json({ message: 'User and profile created successfully' });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Error registering user', error: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
