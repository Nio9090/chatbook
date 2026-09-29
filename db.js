const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'chatbook.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migración: si la tabla messages existe con el esquema viejo (user_id),
// la borramos y la recreamos con el nuevo (sender_id, recipient_id).
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").all();
if (tables.length > 0) {
  const cols = db.prepare("PRAGMA table_info(messages)").all();
  const hasRecipient = cols.some(c => c.name === 'recipient_id');
  if (!hasRecipient) {
    console.log('Migrando tabla messages al nuevo esquema...');
    db.exec('DROP TABLE messages');
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_pair
    ON messages (sender_id, recipient_id, id);
`);

module.exports = db;