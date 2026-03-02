import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../../data/memory.db');

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT,
    platform TEXT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Level 8: Knowledge Graph table
  CREATE TABLE IF NOT EXISTS knowledge_graph (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(subject, predicate, object)
  );

  -- Level 8: Vector Memory table (Base for RAG)
  CREATE TABLE IF NOT EXISTS vector_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      embedding BLOB NOT NULL,
      metadata TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content,
    content='messages',
    content_rowid='id'
  );

  -- Triggers to keep FTS index synced
  CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
  END;
  CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
  END;
  CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
    INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
  END;

  CREATE TABLE IF NOT EXISTS explicit_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fact TEXT NOT NULL UNIQUE,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Level 11: Habit Tracking table
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    frequency TEXT DEFAULT 'daily', -- 'daily', 'weekly'
    goal_count INTEGER DEFAULT 1,
    current_count INTEGER DEFAULT 0,
    last_reset DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_logged DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sender_id, platform, name)
  );

  -- Level 11: Notification queue
  CREATE TABLE IF NOT EXISTS notification_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    message TEXT NOT NULL,
    scheduled_for DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Helper to save conversation history
export function saveMessage(role: 'user' | 'assistant', content: string, senderId?: string, platform?: string, usage?: any) {
  const stmt = db.prepare('INSERT INTO messages (role, content, sender_id, platform, prompt_tokens, completion_tokens, total_tokens) VALUES (?, ?, ?, ?, ?, ?, ?)');
  stmt.run(role, content, senderId || null, platform || null, usage?.promptTokens || null, usage?.completionTokens || null, usage?.totalTokens || null);
}

// Helper to fetch last N messages for context, isolated by user and platform
export function getRecentHistory(senderId: string, platform: string, limit = 10): { role: 'user' | 'assistant', content: string }[] {
  const stmt = db.prepare('SELECT role, content FROM messages WHERE sender_id = ? AND platform = ? ORDER BY id DESC LIMIT ?');
  const rows = stmt.all(senderId, platform, limit) as { role: 'user' | 'assistant', content: string }[];
  return rows.reverse(); // Return in chronological order
}
