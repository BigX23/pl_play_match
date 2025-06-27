import * as sqlite3 from 'sqlite3';

interface UserProfile {
  user_id: number; // Changed from email to user_id
  email?: string; // Email can still be stored, but user_id is the link
  sportPreference?: string;
  age?: number;
  skillLevel?: string;
  gender?: string;
  typeOfPlayer?: string;
  preferredPlayingTimes?: string;
  howOftenTheyPlay?: string;
  gameType?: string;
  notes?: string;
  phoneNumber?: string;
}


const db = new sqlite3.Database('./mydatabase.sqlite'); // Changed to mydatabase.sqlite

export const createUser = (email: string, hashedPassword: string): Promise<{ id: number }> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO users (email, hashedPassword) VALUES (?, ?)');
    // Important: Use a standard function() callback here to access `this.lastID`
    stmt.run(email, hashedPassword, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID });
      }
    });
    stmt.finalize();
  });
};

export const getUserByEmail = (email: string): Promise<{ id: number, email: string, hashedPassword: string } | undefined> => {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, email, hashedPassword FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as { id: number, email: string, hashedPassword: string } | undefined);
      }
    });
  });
};

export const createUserProfile = (profile: UserProfile): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Ensure user_id is part of the profile object passed to this function.
    // The 'email' column in user_profiles is now optional if it's primarily stored in the users table.
    // The schema in sqlite-setup.ts has 'email TEXT' in user_profiles.
    const stmt = db.prepare('INSERT INTO user_profiles (user_id, email, sportPreference, age, skillLevel, gender, typeOfPlayer, preferredPlayingTimes, howOftenTheyPlay, gameType, notes, phoneNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(
      profile.user_id,
      profile.email, // Assuming email is still passed in UserProfile and desired in user_profiles table
      profile.sportPreference,
      profile.age,
      profile.skillLevel,
      profile.gender,
      profile.typeOfPlayer,
      profile.preferredPlayingTimes,
      profile.howOftenTheyPlay,
      profile.gameType,
      profile.notes,
      profile.phoneNumber,
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
    stmt.finalize();
  });
};

export const getUserProfileByUserId = (userId: number): Promise<UserProfile | undefined> => {
  return new Promise((resolve, reject) => {
    // Ensure all fields from UserProfile interface (like user_id, email) are selected if needed.
    // The schema has user_id as the link, email is also present.
    db.get('SELECT user_id, email, sportPreference, age, skillLevel, gender, typeOfPlayer, preferredPlayingTimes, howOftenTheyPlay, gameType, notes, phoneNumber FROM user_profiles WHERE user_id = ?',
           [userId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as UserProfile | undefined);
      }
    });
  });
};

// Renamed parameter from email to userId for clarity, as updates are based on user_id
export const updateUserProfile = (userId: number, profile: Partial<Omit<UserProfile, 'user_id'>>): Promise<void> => {
  return new Promise((resolve, reject) => {
    let query = 'UPDATE user_profiles SET ';
    const fields: string[] = [];
    const values: any[] = [];
    for (const key in profile) {
      if (profile.hasOwnProperty(key)) {
        // Skip user_id from being added to the SET clause, it's used in WHERE
        if (key === 'user_id') {
            continue;
        }
        fields.push(`${key} = ?`);
        values.push((profile as any)[key]);
      }
    }

    if (fields.length === 0) {
      console.log("No fields to update for user_id:", userId);
      return resolve(); // No fields to update
    }

    query += fields.join(', ') + ' WHERE user_id = ?';
    values.push(userId);

    db.run(query, values, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Add other necessary data interaction functions here
// For example, functions for updating profile information, handling matches, etc.

// --- Session Management Functions ---

interface Session {
  id: string;
  userId: number;
  email: string;
  expiresAt: Date;
}

export const createSession = (sessionId: string, userId: number, email: string, expiresInMs: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const expiresAt = new Date(Date.now() + expiresInMs);
    const stmt = db.prepare('INSERT INTO sessions (id, user_id, email, expires_at) VALUES (?, ?, ?, ?)');
    stmt.run(sessionId, userId, email, expiresAt.toISOString(), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
    stmt.finalize();
  });
};

export const getSessionById = (sessionId: string): Promise<Session | undefined> => {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, user_id AS userId, email, expires_at AS expiresAt FROM sessions WHERE id = ?', [sessionId], (err, row: any) => {
      if (err) {
        reject(err);
      } else {
        if (row) {
          resolve({ ...row, expiresAt: new Date(row.expiresAt) });
        } else {
          resolve(undefined);
        }
      }
    });
  });
};

export const deleteSessionById = (sessionId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(sessionId, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
    stmt.finalize();
  });
};

// Function to retrieve user by ID, which might be useful for session validation
export const getUserById = (userId: number): Promise<{ id: number, email: string, hashedPassword?: string } | undefined> => {
  return new Promise((resolve, reject) => {
    // Select necessary fields, excluding password if not needed for this context
    db.get('SELECT id, email, hashedPassword FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as { id: number, email: string, hashedPassword?: string } | undefined);
      }
    });
  });
};