import * as sqlite3 from 'sqlite3';

interface UserProfile {
  email: string;
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

export const createUser = (email: string, hashedPassword: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO users (email, hashedPassword) VALUES (?, ?)');
    stmt.run(email, hashedPassword, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
    stmt.finalize();
  });
};

export const getUserByEmail = (email: string): Promise<{ email: string, hashedPassword: string } | undefined> => {
  return new Promise((resolve, reject) => {
    db.get('SELECT email, hashedPassword FROM users WHERE email = ?', [email], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as { email: string, password: string } | undefined);
      }
    });
  });
};

export const createUserProfile = (profile: UserProfile): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO user_profiles (email, sportPreference, age, skillLevel, gender, typeOfPlayer, preferredPlayingTimes, howOftenTheyPlay, gameType, notes, phoneNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(
      profile.email,
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

export const getUserProfileByEmail = (email: string): Promise<UserProfile | undefined> => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM user_profiles WHERE email = ?', [email], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as UserProfile | undefined);
      }
    });
  });
};

export const updateUserProfile = (email: string, profile: Partial<UserProfile>): Promise<void> => {
  return new Promise((resolve, reject) => {
    let query = 'UPDATE user_profiles SET ';
    const fields: string[] = [];
    const values: any[] = [];
    for (const key in profile) {
      if (profile.hasOwnProperty(key)) {
        fields.push(`${key} = ?`);
        values.push((profile as any)[key]);
      }
    }
    query += fields.join(', ') + ' WHERE email = ?';
    values.push(email);

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