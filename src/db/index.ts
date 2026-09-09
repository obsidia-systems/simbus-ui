import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

import { ensureDataDirs } from '@/lib/paths'

import * as schema from './schema'

const DB_PATH = process.env.DATABASE_URL ?? './data/simbus.db'

// Ensure the data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true })
ensureDataDirs()

const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

// Run migrations on startup
migrate(db, { migrationsFolder: './src/db/migrations' })
