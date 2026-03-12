const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/todos.db');
const db = new sqlite3.Database(dbPath);

// Initialize database and create table
db.serialize(() => {
  // Create todos table
  db.run(`CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating todos table:', err.message);
    } else {
      console.log('Todos table ready');
    }
  });

  // Create trigger to update updated_at on any UPDATE
  db.run(`CREATE TRIGGER IF NOT EXISTS update_todos_updated_at
    AFTER UPDATE ON todos
    FOR EACH ROW
    BEGIN
      UPDATE todos SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
    END`, (err) => {
    if (err) {
      console.error('Error creating update trigger:', err.message);
    } else {
      console.log('Update trigger ready');
    }
  });
});

module.exports = db;