// src/auth/sqlite-auth.ts

import { createUser, getUserByEmail, deleteSessionById } from "../db/sqlite-data"; // Consolidated import
import { initializeDatabase } from "../db/sqlite-setup";
import bcrypt from 'bcrypt';

// Function to hash password
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10; // Adjust salt rounds as needed
  return bcrypt.hash(password, saltRounds);
};

export const signUp = async (email: string, password: string): Promise<{ id: number, email: string }> => {
  try {
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    await initializeDatabase(); // Ensure database is initialized
    const hashedPassword = await hashPassword(password);
    const createdUser = await createUser(email, hashedPassword); // This returns { id: number }
    // Return an object that includes the email as well, consistent with signIn response
    return { id: createdUser.id, email: email };
  } catch (error) {
    console.error("Error signing up:", error.message);
    throw error;
  }
};

// Note: deleteSessionById was already added to the consolidated import at the top.
// The duplicated import statement that was here has been removed.

// ... (other code remains the same)

// Sign out - This function would be used for server-side initiated signouts.
// Client-side signout is handled by calling the /api/logout endpoint.
export const signOutUser = async (sessionId: string): Promise<void> => {
  try {
    if (!sessionId) {
      console.warn("No session ID provided for signOutUser.");
      return;
    }
    await initializeDatabase(); // Ensure database is initialized, though less critical for delete
    await deleteSessionById(sessionId);
    console.log(`Session ${sessionId} invalidated from server-side call.`);
  } catch (error) {
    console.error("Error signing out user by session ID:", error.message);
    throw error; // Re-throw to allow caller to handle
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