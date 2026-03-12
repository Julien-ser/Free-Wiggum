const request = require('supertest');
const app = require('../src/server');
const db = require('../src/database');

// Helper to clear the database before each test
const clearDatabase = () => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM todos', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Helper to seed test data
const seedTask = (title, description = '', completed = 0) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO todos (title, description, completed) VALUES (?, ?, ?)',
      [title, description, completed],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, title, description, completed });
      }
    );
  });
};

describe('Todo API', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe('GET /', () => {
    it('should return welcome message', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.text).toBe('Welcome to the Todo API');
    });
  });

  describe('GET /tasks', () => {
    it('should return empty array when no tasks exist', async () => {
      const response = await request(app).get('/tasks');

      if (response.status !== 200) {
        console.log('GET /tasks failed:', response.status, response.body);
      }

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all tasks sorted by created_at DESC', async () => {
      const task1 = await seedTask('Task 1', 'First task');
      const task2 = await seedTask('Task 2', 'Second task');
      const task3 = await seedTask('Task 3', 'Third task');

      const response = await request(app).get('/tasks');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      // Should be in DESC order (newest first)
      expect(response.body[0].id).toBe(task3.id);
      expect(response.body[1].id).toBe(task2.id);
      expect(response.body[2].id).toBe(task1.id);
    });

    it('should support pagination with limit and offset', async () => {
      for (let i = 1; i <= 5; i++) {
        await seedTask(`Task ${i}`, `Description ${i}`);
      }

      const response = await request(app).get('/tasks?limit=2&offset=2');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      // With DESC order (newest first): Task 5,4,3,2,1. offset=2 skips Task 5,4 -> returns Task 3,2
      expect(response.body[0].title).toBe('Task 3');
      expect(response.body[1].title).toBe('Task 2');
    });

    it('should ignore limit when 0 or negative', async () => {
      await seedTask('Task 1', 'Description 1');
      await seedTask('Task 2', 'Description 2');

      const response = await request(app).get('/tasks?limit=0');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });
  });

  describe('POST /tasks', () => {
    it('should create a new task with valid data', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ title: 'New Task', description: 'Task description' });

      if (response.status !== 201) {
        console.log('POST /tasks failed:', response.status, response.body);
      }

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        title: 'New Task',
        description: 'Task description',
        completed: false,
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
      expect(response.body).toHaveProperty('id');
    });

    it('should create task with title only', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ title: 'Title Only' });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Title Only');
      expect(response.body.description).toBeNull();
    });

    it('should trim whitespace from title and description', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ title: '  Trimmed Title  ', description: '  Trimmed Desc  ' });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Trimmed Title');
      expect(response.body.description).toBe('Trimmed Desc');
    });

    it('should reject missing title', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ description: 'No title' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title is required and must be a string');
    });

    it('should reject empty title after trimming', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ title: '   ', description: 'Description' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title cannot be empty');
    });

    it('should reject title that is not a string', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ title: 123 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title is required and must be a string');
    });

    it('should reject title exceeding 200 characters', async () => {
      const longTitle = 'a'.repeat(201);
      const response = await request(app)
        .post('/tasks')
        .send({ title: longTitle });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title must be 200 characters or less');
    });

    it('should reject description that is not a string', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ title: 'Valid Title', description: 456 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Description must be a string');
    });

    it('should reject description exceeding 1000 characters', async () => {
      const longDesc = 'a'.repeat(1001);
      const response = await request(app)
        .post('/tasks')
        .send({ title: 'Valid Title', description: longDesc });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Description must be 1000 characters or less');
    });
  });

  describe('GET /tasks/:id', () => {
    it('should retrieve a specific task by ID', async () => {
      const task = await seedTask('Test Task', 'Test Description');

      const response = await request(app).get(`/tasks/${task.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: task.id,
        title: 'Test Task',
        description: 'Test Description',
        completed: false
      });
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app).get('/tasks/9999');
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Task not found');
    });

    it('should return 400 for invalid task ID (non-numeric)', async () => {
      const response = await request(app).get('/tasks/abc');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid task ID');
    });

    it('should return 400 for negative task ID', async () => {
      const response = await request(app).get('/tasks/-1');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid task ID');
    });

    it('should return 400 for zero task ID', async () => {
      const response = await request(app).get('/tasks/0');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid task ID');
    });
  });

  describe('PUT /tasks/:id', () => {
    it('should update task title', async () => {
      const task = await seedTask('Original Title', 'Original Desc');

      const response = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.description).toBe('Original Desc');
    });

    it('should update task description', async () => {
      const task = await seedTask('Original Title', 'Original Desc');

      const response = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ description: 'Updated Desc' });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('Updated Desc');
      expect(response.body.title).toBe('Original Title');
    });

    it('should update task completed status', async () => {
      const task = await seedTask('Task', 'Description', 0);

      const response = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ completed: true });

      expect(response.status).toBe(200);
      expect(response.body.completed).toBe(true);
    });

    it('should update multiple fields at once', async () => {
      const task = await seedTask('Title', 'Desc', 0);

      const response = await request(app)
        .put(`/tasks/${task.id}`)
        .send({
          title: 'New Title',
          description: 'New Desc',
          completed: true
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        title: 'New Title',
        description: 'New Desc',
        completed: true
      });
    });

    it('should trim whitespace from updated fields', async () => {
      const task = await seedTask('Title', 'Desc');

      const response = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: '  Updated Title  ' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
    });

    it('should return 404 when updating non-existent task', async () => {
      const response = await request(app)
        .put('/tasks/9999')
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Task not found');
    });

    it('should return 400 when no fields provided', async () => {
      const task = await seedTask('Title', 'Desc');

      const response = await request(app)
        .put(`/tasks/${task.id}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No fields to update');
    });

    it('should reject invalid task ID', async () => {
      const response = await request(app)
        .put('/tasks/abc')
        .send({ title: 'Title' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid task ID');
    });

    it('should validate title is string when updating', async () => {
      const task = await seedTask('Title', 'Desc');

      const response = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: 123 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title must be a string');
    });

    it('should validate description is string when updating', async () => {
      const task = await seedTask('Title', 'Desc');

      const response = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ description: 456 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Description must be a string');
    });

    it('should validate completed is boolean when updating', async () => {
      const task = await seedTask('Title', 'Desc');

      const response = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ completed: 'yes' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Completed must be a boolean');
    });

    it('should validate title length when updating', async () => {
      const task = await seedTask('Title', 'Desc');
      const longTitle = 'a'.repeat(201);

      const response = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: longTitle });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title must be 200 characters or less');
    });

    it('should validate description length when updating', async () => {
      const task = await seedTask('Title', 'Desc');
      const longDesc = 'a'.repeat(1001);

      const response = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ description: longDesc });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Description must be 1000 characters or less');
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should delete an existing task', async () => {
      const task = await seedTask('To Delete', 'Description');

      const response = await request(app).delete(`/tasks/${task.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'Task deleted',
        id: task.id
      });

      // Verify task is gone
      const getResponse = await request(app).get(`/tasks/${task.id}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 when deleting non-existent task', async () => {
      const response = await request(app).delete('/tasks/9999');
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Task not found');
    });

    it('should return 400 for invalid task ID', async () => {
      const response = await request(app).delete('/tasks/abc');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid task ID');
    });

    it('should return 400 for negative task ID', async () => {
      const response = await request(app).delete('/tasks/-1');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid task ID');
    });
  });
});
