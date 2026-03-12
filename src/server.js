const express = require('express');
const path = require('path');

// Initialize database first
const db = require('./database');

function transformTask(row) {
  if (!row) return row;
  return {
    ...row,
    completed: row.completed === 1
  };
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req, res) => {
  res.send('Welcome to the Todo API');
});

// Task routes
app.get('/tasks', (req, res) => {
   const limit = parseInt(req.query.limit) || 0;
   const offset = parseInt(req.query.offset) || 0;
   
   let query = 'SELECT * FROM todos ORDER BY created_at DESC, id DESC';
   let params = [];
   
   if (limit > 0) {
     query += ' LIMIT ? OFFSET ?';
     params.push(limit, offset);
   }
   
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error fetching tasks:', err.message);
        return res.status(500).json({ error: 'Failed to fetch tasks' });
      }
      const transformedRows = rows.map(transformTask);
      res.json(transformedRows);
    });
 });

app.post('/tasks', (req, res) => {
   const { title, description } = req.body;
   
   // Validation
   if (!title || typeof title !== 'string') {
     return res.status(400).json({ error: 'Title is required and must be a string' });
   }
   const trimmedTitle = title.trim();
   if (trimmedTitle === '') {
     return res.status(400).json({ error: 'Title cannot be empty' });
   }
   if (trimmedTitle.length > 200) {
     return res.status(400).json({ error: 'Title must be 200 characters or less' });
   }
   
    let trimmedDescription = null;
   if (description !== undefined) {
     if (typeof description !== 'string') {
       return res.status(400).json({ error: 'Description must be a string' });
     }
     trimmedDescription = description.trim();
     if (trimmedDescription.length > 1000) {
       return res.status(400).json({ error: 'Description must be 1000 characters or less' });
     }
   }
   
   db.run('INSERT INTO todos (title, description) VALUES (?, ?)', [trimmedTitle, trimmedDescription], function(err) {
    if (err) {
      console.error('Error creating task:', err.message);
      return res.status(500).json({ error: 'Failed to create task' });
    }
     db.get('SELECT * FROM todos WHERE id = ?', [this.lastID], (err, row) => {
       if (err) {
         return res.status(500).json({ error: err.message });
       }
       const transformedRow = transformTask(row);
       res.status(201).json(transformedRow);
     });
  });
});

app.get('/tasks/:id', (req, res) => {
   const taskId = parseInt(req.params.id);
   if (isNaN(taskId) || taskId <= 0) {
     return res.status(400).json({ error: 'Invalid task ID' });
   }
    db.get('SELECT * FROM todos WHERE id = ?', [taskId], (err, row) => {
     if (err) {
       console.error('Error fetching task:', err.message);
       return res.status(500).json({ error: 'Failed to fetch task' });
     }
     if (!row) {
       return res.status(404).json({ error: 'Task not found' });
     }
     const transformedRow = transformTask(row);
     res.json(transformedRow);
   });
});

app.put('/tasks/:id', (req, res) => {
   const { title, description, completed } = req.body;
   const fields = [];
   const values = [];

   // Validate task ID
   const taskId = parseInt(req.params.id);
   if (isNaN(taskId) || taskId <= 0) {
     return res.status(400).json({ error: 'Invalid task ID' });
   }

   if (title !== undefined) {
     if (typeof title !== 'string') {
       return res.status(400).json({ error: 'Title must be a string' });
     }
     const trimmedTitle = title.trim();
     if (trimmedTitle === '') {
       return res.status(400).json({ error: 'Title cannot be empty' });
     }
     if (trimmedTitle.length > 200) {
       return res.status(400).json({ error: 'Title must be 200 characters or less' });
     }
     fields.push('title = ?');
     values.push(trimmedTitle);
   }
   if (description !== undefined) {
     if (typeof description !== 'string') {
       return res.status(400).json({ error: 'Description must be a string' });
     }
     const trimmedDescription = description.trim();
     if (trimmedDescription.length > 1000) {
       return res.status(400).json({ error: 'Description must be 1000 characters or less' });
     }
     fields.push('description = ?');
     values.push(trimmedDescription);
   }
   if (completed !== undefined) {
     if (typeof completed !== 'boolean') {
       return res.status(400).json({ error: 'Completed must be a boolean' });
     }
     fields.push('completed = ?');
     values.push(completed ? 1 : 0);
   }

   if (fields.length === 0) {
     return res.status(400).json({ error: 'No fields to update' });
   }

   values.push(taskId);
   const sql = `UPDATE todos SET ${fields.join(', ')} WHERE id = ?`;
   db.run(sql, values, function(err) {
    if (err) {
      console.error('Error updating task:', err.message);
      return res.status(500).json({ error: 'Failed to update task' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
      db.get('SELECT * FROM todos WHERE id = ?', [taskId], (err, row) => {
       if (err) {
         return res.status(500).json({ error: err.message });
       }
       const transformedRow = transformTask(row);
       res.json(transformedRow);
     });
  });
});

app.delete('/tasks/:id', (req, res) => {
   const taskId = parseInt(req.params.id);
   if (isNaN(taskId) || taskId <= 0) {
     return res.status(400).json({ error: 'Invalid task ID' });
   }
   db.run('DELETE FROM todos WHERE id = ?', [taskId], function(err) {
    if (err) {
      console.error('Error deleting task:', err.message);
      return res.status(500).json({ error: 'Failed to delete task' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted', id: parseInt(req.params.id) });
  });
});

// Serve static files (frontend) after API routes
app.use(express.static(path.join(__dirname, '../public')));

// Start server only if not in test mode
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;