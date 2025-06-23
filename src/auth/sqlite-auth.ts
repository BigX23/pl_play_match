// src/auth/sqlite-auth.ts

import { createUser, getUserByEmail } from "../db/sqlite-data";
import { initializeDatabase } from "../db/sqlite-setup";
import bcrypt from 'bcrypt';

// Function to hash password
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10; // Adjust salt rounds as needed
  return bcrypt.hash(password, saltRounds);
};

export const signUp = async (email, password) => {
  try {
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    await initializeDatabase(); // Ensure database is initialized
    const hashedPassword = await hashPassword(password);
    const user = await createUser(email, hashedPassword); // Pass hashed password to createUser
    return user;
  } catch (error) {
    console.error("Error signing up:", error.message);
    throw error;
  }
};

// Sign out (placeholder)
export const signOutUser = async (sessionId: string) => {
  try {
    // Implement session invalidation here
    // FIX HERE: Changed from template literal to string concatenation
    console.warn("signOutUser is not fully implemented. Session ID: " + sessionId);
  } catch (error) {
    console.error("Error signing out:", error.message);
    throw error;
  }
};

// Function to compare password with hash
const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Sign in with email and password
export const signIn = async (email, password) => {
  try {
    await initializeDatabase(); // Ensure database is initialized
    const user = await getUserByEmail(email);

    if (!user) {
      throw new Error("User not found");
    }

    // Compare the provided password with the stored hash
    const passwordMatch = await comparePassword(password, user.password); // Assuming user.password stores the hashed password

    return passwordMatch ? user : null;

  } catch (error) {
    console.error("Error signing in:", error.message);
    throw error;
  }
};