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
          // Call createUserProfileTable after users table is checked/created
          createUserProfileTable().then(resolve).catch(reject);
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
          email TEXT UNIQUE,
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