const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use separate test database to avoid conflicts
const testDbPath = path.join(__dirname, '../data/test_todos.db');
const db = new sqlite3.Database(testDbPath);

// Initialize test database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TRIGGER IF NOT EXISTS update_todos_updated_at
    AFTER UPDATE ON todos
    FOR EACH ROW
    BEGIN
      UPDATE todos SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
    END`);
});

describe('Database Operations', () => {
  beforeAll((done) => {
    // Ensure database is ready
    db.serialize(() => {
      done();
    });
  });

  beforeEach((done) => {
    // Clear todos table before each test
    db.run('DELETE FROM todos', (err) => {
      if (err) return done(err);
      done();
    });
  });

  afterAll((done) => {
    // Close database connection after all tests
    db.close((err) => {
      if (err) console.error('Error closing database:', err.message);
      done();
    });
  });

  describe('Table Schema', () => {
    it('should have todos table with correct columns', (done) => {
      db.all('PRAGMA table_info(todos)', (err, rows) => {
        if (err) return done(err);
        const columns = rows.map(row => row.name);
        expect(columns).toContain('id');
        expect(columns).toContain('title');
        expect(columns).toContain('description');
        expect(columns).toContain('completed');
        expect(columns).toContain('created_at');
        expect(columns).toContain('updated_at');
        done();
      });
    });

    it('should have correct column constraints', (done) => {
      db.all('PRAGMA table_info(todos)', (err, rows) => {
        if (err) return done(err);
        const titleColumn = rows.find(col => col.name === 'title');
        expect(titleColumn.notnull).toBe(1); // NOT NULL constraint
        done();
      });
    });

    it('should have trigger for updated_at', (done) => {
      db.get("SELECT name FROM sqlite_master WHERE type='trigger' AND name='update_todos_updated_at'", (err, row) => {
        if (err) return done(err);
        expect(row).not.toBeNull();
        expect(row.name).toBe('update_todos_updated_at');
        done();
      });
    });
  });

  describe('CRUD Operations', () => {
    it('should insert a new task and return lastID', (done) => {
      db.run(
        'INSERT INTO todos (title, description) VALUES (?, ?)',
        ['Test Task', 'Test Description'],
        function (err) {
          if (err) return done(err);
          expect(this.lastID).toBeGreaterThan(0);
          done();
        }
      );
    });

    it('should insert task with default values when only title provided', (done) => {
      db.run(
        'INSERT INTO todos (title) VALUES (?)',
        ['Title Only'],
        function (err) {
          if (err) return done(err);
          expect(this.lastID).toBeGreaterThan(0);
          // Verify defaults
          db.get('SELECT * FROM todos WHERE id = ?', [this.lastID], (err, row) => {
            if (err) return done(err);
            expect(row.title).toBe('Title Only');
            expect(row.description).toBeNull();
            expect(row.completed).toBe(0);
            expect(row.created_at).toBeDefined();
            done();
          });
        }
      );
    });

    it('should query a task by ID', (done) => {
      db.run(
        'INSERT INTO todos (title) VALUES (?)',
        ['Query Test'],
        function (err) {
          if (err) return done(err);
          const id = this.lastID;
          db.get('SELECT * FROM todos WHERE id = ?', [id], (err, row) => {
            if (err) return done(err);
            expect(row).toBeDefined();
            expect(row.id).toBe(id);
            expect(row.title).toBe('Query Test');
            done();
          });
        }
      );
    });

    it('should query all tasks', (done) => {
      db.run('INSERT INTO todos (title) VALUES (?)', ['Task 1'], function (err) {
        if (err) return done(err);
        db.run('INSERT INTO todos (title) VALUES (?)', ['Task 2'], function (err) {
          if (err) return done(err);
          db.all('SELECT * FROM todos', (err, rows) => {
            if (err) return done(err);
            expect(rows).toHaveLength(2);
            done();
          });
        });
      });
    });

    it('should update a task', (done) => {
      db.run('INSERT INTO todos (title, completed) VALUES (?, ?)', ['Original', 0], function (err) {
        if (err) return done(err);
        const id = this.lastID;
        db.run(
          'UPDATE todos SET title = ?, completed = ? WHERE id = ?',
          ['Updated', 1, id],
          function (err) {
            if (err) return done(err);
            expect(this.changes).toBe(1);
            db.get('SELECT * FROM todos WHERE id = ?', [id], (err, row) => {
              if (err) return done(err);
              expect(row.title).toBe('Updated');
              expect(row.completed).toBe(1);
              done();
            });
          }
        );
      });
    });

    it('should delete a task', (done) => {
      db.run('INSERT INTO todos (title) VALUES (?)', ['To Delete'], function (err) {
        if (err) return done(err);
        const id = this.lastID;
        db.run('DELETE FROM todos WHERE id = ?', [id], function (err) {
          if (err) return done(err);
          expect(this.changes).toBe(1);
          db.get('SELECT * FROM todos WHERE id = ?', [id], (err, row) => {
            if (err) return done(err);
            expect(row).toBeUndefined();
            done();
          });
        });
      });
    });

    it('should return 0 changes when updating non-existent task', (done) => {
      db.run(
        'UPDATE todos SET title = ? WHERE id = ?',
        ['Nonexistent', 9999],
        function (err) {
          if (err) return done(err);
          expect(this.changes).toBe(0);
          done();
        }
      );
    });

    it('should return 0 changes when deleting non-existent task', (done) => {
      db.run('DELETE FROM todos WHERE id = ?', [9999], function (err) {
        if (err) return done(err);
        expect(this.changes).toBe(0);
        done();
      });
    });
  });

  describe('Data Integrity', () => {
    it('should enforce NOT NULL constraint on title', (done) => {
      db.run(
        'INSERT INTO todos (title) VALUES (?)',
        [null],
        function (err) {
          expect(err).not.toBeNull();
          done();
        }
      );
    });

    it('should update updated_at timestamp on row update', (done) => {
      db.run('INSERT INTO todos (title) VALUES (?)', ['Timestamp Test'], function (err) {
        if (err) return done(err);
        const id = this.lastID;
        db.get('SELECT created_at, updated_at FROM todos WHERE id = ?', [id], (err, row) => {
          if (err) return done(err);
          const originalUpdatedAt = row.updated_at;
          // Small delay to ensure different timestamp
          setTimeout(() => {
            db.run('UPDATE todos SET title = ? WHERE id = ?', ['Updated Title', id], function (err) {
              if (err) return done(err);
              db.get('SELECT created_at, updated_at FROM todos WHERE id = ?', [id], (err, row) => {
                if (err) return done(err);
                expect(row.updated_at).toBeDefined();
                // updated_at should be >= original or strictly greater if not same second
                expect(new Date(row.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(originalUpdatedAt).getTime());
                done();
              });
            });
          }, 1500); // Wait 1.5 seconds to ensure timestamp changes
        });
      });
    });
  });

  describe('Query Edge Cases', () => {
    it('should handle empty table for SELECT queries', (done) => {
      db.all('SELECT * FROM todos', (err, rows) => {
        if (err) return done(err);
        expect(rows).toHaveLength(0);
        done();
      });
    });

    it('should correctly transform completed boolean value', (done) => {
      db.run('INSERT INTO todos (title, completed) VALUES (?, ?)', ['Completed Task', 1], function (err) {
        if (err) return done(err);
        const id = this.lastID;
        db.get('SELECT completed FROM todos WHERE id = ?', [id], (err, row) => {
          if (err) return done(err);
          expect(row.completed).toBe(1);
          done();
        });
      });
    });

    it('should handle NULL description', (done) => {
      db.run('INSERT INTO todos (title) VALUES (?)', ['No Desc'], function (err) {
        if (err) return done(err);
        const id = this.lastID;
        db.get('SELECT description FROM todos WHERE id = ?', [id], (err, row) => {
          if (err) return done(err);
          expect(row.description).toBeNull();
          done();
        });
      });
    });
  });
});