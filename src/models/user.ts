import { db } from '../database/index.js';
import type { Locale } from '../i18n/index.js';
import type { User } from './types.js';

export function upsertUser(id: number, first_name: string, username?: string): void {
  db.run(
    `INSERT INTO users (id, first_name, username) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name, username = excluded.username`,
    [id, first_name, username ?? null],
  );
}

export function getUser(id: number): User | undefined {
  return db.query<User, [number]>('SELECT * FROM users WHERE id = ?').get(id) ?? undefined;
}

export function setUserLanguage(id: number, lang: Locale): void {
  db.run('UPDATE users SET language = ? WHERE id = ?', [lang, id]);
}

/** Returns the user's saved language, defaulting to 'en'. Sync — SQLite is in-process. */
export function getUserLocale(id: number): Locale {
  const row = db
    .query<{ language: string }, [number]>('SELECT language FROM users WHERE id = ?')
    .get(id);
  return (row?.language === 'vi' ? 'vi' : 'en') as Locale;
}
