import * as sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./mydatabase.sqlite'); // You can name your database file as needed

export function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE,
          hashedPassword TEXT
        )
      `, (err) => {
        if (err) {
          console.error('Error creating users table:', err.message);
          reject(err);
        } else {
          console.log('Users table checked/created successfully.');
          // Chain table creations: users -> user_profiles -> sessions
          createUserProfileTable()
            .then(() => createSessionsTable())
            .then(resolve)
            .catch(reject);
        }
      });
    });
  });
}

export function createUserProfileTable(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS user_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE, -- Changed from email to user_id for foreign key
          sportPreference TEXT,
          age INTEGER,
          skillLevel TEXT,
          gender TEXT,
          typeOfPlayer TEXT,
          preferredPlayingTimes TEXT,
          howOftenTheyPlay TEXT,
          gameType TEXT,
          notes TEXT,
          phoneNumber TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) -- Linking to users.id
        )
      `, (err) => {
        if (err) {
          console.error('Error creating user_profiles table:', err.message);
          reject(err);
        } else {
          console.log('User profiles table checked/created successfully.');
          resolve();
        }
      });
    });
  });
}

export function createSessionsTable(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          email TEXT NOT NULL, -- Storing email for convenience, though user_id is the link
          expires_at DATETIME NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating sessions table:', err.message);
          reject(err);
        } else {
          console.log('Sessions table checked/created successfully.');
          resolve();
        }
      });
    });
  });
}

// Note: user_profiles table schema was updated to use user_id as a foreign key to users.id,
// replacing the previous email-based foreign key. This enhances relational integrity.
// Corresponding changes in src/db/sqlite-data.ts handle data interaction with this new schema.
// Sessions table has also been added.
// All table creations are chained in initializeDatabase.

export function createUserProfileTable(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS user_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE, -- Ensures one-to-one with users table
          email TEXT, -- Storing email is optional, can be fetched via JOIN with users table. Kept for now.
          sportPreference TEXT,
          age INTEGER,
          skillLevel TEXT,
          gender TEXT,
          typeOfPlayer TEXT,
          preferredPlayingTimes TEXT,
          howOftenTheyPlay TEXT,
          gameType TEXT,
          notes TEXT,
          phoneNumber TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating user_profiles table:', err.message);
          reject(err);
        } else {
          console.log('User profiles table checked/created successfully.');
          resolve();
        }
      });
    });
  });
}

export function createSessionsTable(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          email TEXT NOT NULL, -- Storing email for convenience, can also be joined
          expires_at DATETIME NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating sessions table:', err.message);
          reject(err);
        } else {
          console.log('Sessions table checked/created successfully.');
          resolve();
        }
      });
    });
  });
}
          sportPreference TEXT,
          age INTEGER,
          skillLevel TEXT,
          gender TEXT,
          typeOfPlayer TEXT,
          preferredPlayingTimes TEXT,
          howOftenTheyPlay TEXT,
          gameType TEXT,
          notes TEXT,
          phoneNumber TEXT,
          FOREIGN KEY (email) REFERENCES users(email)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating user_profiles table:', err.message);
          reject(err);
        } else {
          console.log('User profiles table checked/created successfully.');
          resolve();
        }
      });
    });
  });
}