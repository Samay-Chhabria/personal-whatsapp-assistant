import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_DIR = path.join(__dirname, '../data')
const DB_PATH = path.join(DB_DIR, 'assistant.db')

let db: Database.Database | null = null

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return db
}

// --- Contact Profile Type ---

export interface ContactProfile {
  stableId: string
  displayName?: string
  relationship?: string
  preferredLanguage?: string
  tone?: string
  formality?: string
  humorLevel?: string
  typicalResponseLength?: string
  styleNotes?: string
}

// --- Database Init ---

export function initializeDatabase(): Database.Database {
  if (db) return db

  try {
    ensureDir(DB_DIR)
    db = new Database(DB_PATH)

    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stable_id TEXT UNIQUE NOT NULL,
        display_name TEXT,
        relationship TEXT,
        preferred_language TEXT,
        tone TEXT,
        formality TEXT,
        humor_level TEXT,
        typical_response_length TEXT,
        style_notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
      );

      CREATE TABLE IF NOT EXISTS facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(contact_id, key),
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
      );
    `)

    console.log(`[Memory] Database initialized at ${DB_PATH}`)
    return db
  } catch (error) {
    console.error('[Memory] Failed to initialize database:', (error as Error).message)
    throw error
  }
}

function getOrCreateContactId(stableId: string): number {
  const d = getDb()

  let row = d.prepare('SELECT id FROM contacts WHERE stable_id = ?').get(stableId) as { id: number } | undefined
  if (row) return row.id

  const result = d.prepare('INSERT INTO contacts (stable_id) VALUES (?)').run(stableId)
  return Number(result.lastInsertRowid)
}

// --- Personal Facts ---

export async function addMemory(userId: string, key: string, value: unknown): Promise<void> {
  const d = getDb()
  const contactId = getOrCreateContactId(userId)
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value)

  d.prepare(`
    INSERT INTO facts (contact_id, key, value, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(contact_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(contactId, key, stringValue)
}

export function getPersonalFacts(userId: string): Record<string, unknown> {
  const d = getDb()
  const contactRow = d.prepare('SELECT id FROM contacts WHERE stable_id = ?').get(userId) as { id: number } | undefined
  if (!contactRow) return {}

  const rows = d.prepare('SELECT key, value FROM facts WHERE contact_id = ?').all(contactRow.id) as Array<{ key: string; value: string | null }>

  const result: Record<string, unknown> = {}
  for (const row of rows) {
    if (row.value === null) {
      result[row.key] = null
    } else {
      try {
        result[row.key] = JSON.parse(row.value)
      } catch {
        result[row.key] = row.value
      }
    }
  }
  return result
}

// --- Conversation Messages ---

export function addConversationMessage(userId: string, role: string, content: string): void {
  const d = getDb()
  const contactId = getOrCreateContactId(userId)

  let normalizedRole = role
  if (role === 'human') normalizedRole = 'user'
  else if (role === 'ai') normalizedRole = 'assistant'

  d.prepare('INSERT INTO messages (contact_id, role, content) VALUES (?, ?, ?)').run(contactId, normalizedRole, content)
}

export async function getConversationHistory(userId: string, limit?: number): Promise<Array<{ role: string; content: string }>> {
  const d = getDb()
  const contactRow = d.prepare('SELECT id FROM contacts WHERE stable_id = ?').get(userId) as { id: number } | undefined
  if (!contactRow) return []

  if (limit && limit > 0) {
    const rows = d.prepare(
      'SELECT role, content FROM (SELECT id, role, content FROM messages WHERE contact_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC'
    ).all(contactRow.id, limit) as Array<{ role: string; content: string }>
    return rows
  }

  const rows = d.prepare('SELECT role, content FROM messages WHERE contact_id = ? ORDER BY id ASC').all(contactRow.id) as Array<{ role: string; content: string }>
  return rows
}

// --- Contact Profile ---

function rowToProfile(row: Record<string, unknown>): ContactProfile {
  return {
    stableId: row.stable_id as string,
    displayName: (row.display_name as string) || undefined,
    relationship: (row.relationship as string) || undefined,
    preferredLanguage: (row.preferred_language as string) || undefined,
    tone: (row.tone as string) || undefined,
    formality: (row.formality as string) || undefined,
    humorLevel: (row.humor_level as string) || undefined,
    typicalResponseLength: (row.typical_response_length as string) || undefined,
    styleNotes: (row.style_notes as string) || undefined,
  }
}

export function getContactProfile(stableId: string): ContactProfile | null {
  const d = getDb()
  const row = d.prepare('SELECT * FROM contacts WHERE stable_id = ?').get(stableId) as Record<string, unknown> | undefined
  if (!row) return null
  return rowToProfile(row)
}

export function upsertContactProfile(stableId: string, profile: Omit<ContactProfile, 'stableId'>): ContactProfile {
  const d = getDb()
  getOrCreateContactId(stableId)

  d.prepare(`
    UPDATE contacts SET
      display_name = COALESCE(?, display_name),
      relationship = COALESCE(?, relationship),
      preferred_language = COALESCE(?, preferred_language),
      tone = COALESCE(?, tone),
      formality = COALESCE(?, formality),
      humor_level = COALESCE(?, humor_level),
      typical_response_length = COALESCE(?, typical_response_length),
      style_notes = COALESCE(?, style_notes),
      updated_at = datetime('now')
    WHERE stable_id = ?
  `).run(
    profile.displayName ?? null,
    profile.relationship ?? null,
    profile.preferredLanguage ?? null,
    profile.tone ?? null,
    profile.formality ?? null,
    profile.humorLevel ?? null,
    profile.typicalResponseLength ?? null,
    profile.styleNotes ?? null,
    stableId,
  )

  return getContactProfile(stableId)!
}

export function updateContactProfile(stableId: string, partial: Partial<Omit<ContactProfile, 'stableId'>>): ContactProfile | null {
  const d = getDb()
  const existing = d.prepare('SELECT id FROM contacts WHERE stable_id = ?').get(stableId) as { id: number } | undefined
  if (!existing) return null

  const fields: string[] = []
  const values: unknown[] = []

  if (partial.displayName !== undefined) { fields.push('display_name = ?'); values.push(partial.displayName) }
  if (partial.relationship !== undefined) { fields.push('relationship = ?'); values.push(partial.relationship) }
  if (partial.preferredLanguage !== undefined) { fields.push('preferred_language = ?'); values.push(partial.preferredLanguage) }
  if (partial.tone !== undefined) { fields.push('tone = ?'); values.push(partial.tone) }
  if (partial.formality !== undefined) { fields.push('formality = ?'); values.push(partial.formality) }
  if (partial.humorLevel !== undefined) { fields.push('humor_level = ?'); values.push(partial.humorLevel) }
  if (partial.typicalResponseLength !== undefined) { fields.push('typical_response_length = ?'); values.push(partial.typicalResponseLength) }
  if (partial.styleNotes !== undefined) { fields.push('style_notes = ?'); values.push(partial.styleNotes) }

  if (fields.length === 0) return getContactProfile(stableId)

  fields.push('updated_at = datetime(\'now\')')
  values.push(stableId)

  d.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE stable_id = ?`).run(...values)

  return getContactProfile(stableId)
}

export function clearContactProfile(stableId: string): void {
  const d = getDb()
  d.prepare(`
    UPDATE contacts SET
      display_name = NULL,
      relationship = NULL,
      preferred_language = NULL,
      tone = NULL,
      formality = NULL,
      humor_level = NULL,
      typical_response_length = NULL,
      style_notes = NULL,
      updated_at = datetime('now')
    WHERE stable_id = ?
  `).run(stableId)
}

// --- Contact Context Builder ---

export function buildContactContext(profile: ContactProfile | null): string {
  if (!profile) return ''

  const lines: string[] = []

  if (profile.displayName) lines.push(`- Name: ${profile.displayName}`)
  if (profile.relationship) lines.push(`- Relationship: ${profile.relationship}`)
  if (profile.preferredLanguage) lines.push(`- Preferred language: ${profile.preferredLanguage}`)
  if (profile.tone) lines.push(`- Tone: ${profile.tone}`)
  if (profile.formality) lines.push(`- Formality: ${profile.formality}`)
  if (profile.humorLevel) lines.push(`- Humor: ${profile.humorLevel}`)
  if (profile.typicalResponseLength) lines.push(`- Typical response length: ${profile.typicalResponseLength}`)
  if (profile.styleNotes) lines.push(`- Style notes: ${profile.styleNotes}`)

  if (lines.length === 0) return ''

  return `CONTACT-SPECIFIC COMMUNICATION STYLE:\n${lines.join('\n')}`
}

// --- Contact Profile Seeding ---

export function seedContactProfiles(configuredProfiles: Array<{ stableId: string } & Record<string, unknown>>): number {
  const d = getDb()
  let seeded = 0

  for (const config of configuredProfiles) {
    const existing = d.prepare(
      'SELECT display_name, relationship, preferred_language, tone, formality, humor_level, typical_response_length, style_notes FROM contacts WHERE stable_id = ?'
    ).get(config.stableId) as Record<string, unknown> | undefined

    const hasProfile = existing && (
      existing.display_name || existing.relationship || existing.preferred_language ||
      existing.tone || existing.formality || existing.humor_level ||
      existing.typical_response_length || existing.style_notes
    )

    if (hasProfile) continue

    getOrCreateContactId(config.stableId)

    d.prepare(`
      UPDATE contacts SET
        display_name = ?,
        relationship = ?,
        preferred_language = ?,
        tone = ?,
        formality = ?,
        humor_level = ?,
        typical_response_length = ?,
        style_notes = ?,
        updated_at = datetime('now')
      WHERE stable_id = ?
    `).run(
      config.displayName ?? null,
      config.relationship ?? null,
      config.preferredLanguage ?? null,
      config.tone ?? null,
      config.formality ?? null,
      config.humorLevel ?? null,
      config.typicalResponseLength ?? null,
      config.styleNotes ?? null,
      config.stableId,
    )

    seeded++
  }

  if (seeded > 0) {
    console.log(`[Memory] Seeded ${seeded} contact profile(s)`)
  }

  return seeded
}

// --- Clear ---

export function clearMemory(userId: string): void {
  const d = getDb()
  const contactRow = d.prepare('SELECT id FROM contacts WHERE stable_id = ?').get(userId) as { id: number } | undefined
  if (!contactRow) return

  d.prepare('DELETE FROM messages WHERE contact_id = ?').run(contactRow.id)
  d.prepare('DELETE FROM facts WHERE contact_id = ?').run(contactRow.id)
  // Keep the contact row to preserve stable_id identity
}

// --- Lifecycle ---

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('[Memory] Database closed')
  }
}

// --- Re-exports from extraction ---

export { extractPersonalFacts, isFactAbout } from './extraction'
