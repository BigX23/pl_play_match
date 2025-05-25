import { createUser, getUserByEmail } from '../db/sqlite-data';
import { initializeDatabase } from '../db/sqlite-setup';

// Sign up with email and password
export const signUp = async (email, password) => {
  try {
    if (password.length < 6) {
            throw new Error("Password must be at least 6 characters");
        }
    await initializeDatabase(); // Ensure database is initialized
    const user = await createUser(email, password);
    return user;
  } catch (error) {
    console.error("Error signing up:", error.message);
    throw error;
  }
};

// Create user document in Firestore
export const createUserDocument = async (userId: string, userData: any) => {
    try {
        // This function is no longer needed with SQLite, as user data is stored directly in the users table
        console.warn("createUserDocument is deprecated with SQLite and does nothing.");
    } catch (error) {
        console.error("Error creating user document:", error);
        throw error;
    }
};

// Sign in with email and password
export const signIn = async (email, password) => {
  try {
    await initializeDatabase(); // Ensure database is initialized
    const user = await getUserByEmail(email);

    if (!user) {
      throw new Error("User not found");
    }

    // In a real application, you would compare the hashed password here.
    // For this example, we'll assume a direct password match for simplicity.
    return user.password === password ? user : null;
  } catch (error) {
    console.error("Error signing in:", error.message);
    throw error;
  }
};

// Sign in with Google
export const signInWithGoogle = async () => {
  // This function is not directly supported with a simple SQLite implementation.
  // You would need to implement a different OAuth flow and store user information accordingly.
  try {
    console.warn("signInWithGoogle is not implemented with SQLite.");
  } catch (error) {
    console.error("Error signing in with Google:", error.message);
    throw error;
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    // With a simple SQLite setup, session management would be handled differently
    console.warn("signOutUser is not implemented with SQLite.");
  } catch (error) {
    console.error("Error signing out:", error.message);
    throw error;
  }
};
