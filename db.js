const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("quiet-connect.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      talkFrequency TEXT,
      aloneTime TEXT,
      style TEXT,
      matched INTEGER DEFAULT 0,
      matchToken TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matchToken TEXT,
      sender TEXT,
      message TEXT
    )
  `);
});

module.exports = db;
