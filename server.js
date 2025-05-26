const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');

const app = express();
const db = new Database('blog.db');

app.use(cors());
app.use(express.json());

// Tábla létrehozása
db.prepare(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`).run();

// Egyedi index a duplikáció megelőzéséhez
db.prepare(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_post
  ON posts(author, title, category, content)
`).run();

// Töröljük a meglévő adatokat (teszteléshez)
db.prepare('DELETE FROM posts').run();

const now = new Date().toISOString();
const later = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 óra múlva

const users = ['Alice', 'Bob', 'Charlie'];

const insertPost = db.prepare(`
  INSERT OR IGNORE INTO posts (author, title, category, content, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

users.forEach(user => {
  insertPost.run(user, `Bejegyzés 1 ${user}`, 'Tech', `Ez ${user} első bejegyzése.`, now, later);
  insertPost.run(user, `Bejegyzés 2 ${user}`, 'Életmód', `Ez ${user} második bejegyzése.`, now, later);
});

// API végpontok

app.get('/posts', (req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
  res.json(posts);
});

app.get('/posts/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (post) res.json(post);
  else res.status(404).send('Not found');
});

app.post('/posts', (req, res) => {
  const { author, title, category, content } = req.body;
  const now = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      INSERT INTO posts (author, title, category, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(author, title, category, content, now, now);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Ez a bejegyzés már létezik.' });
    } else {
      res.status(500).json({ error: 'Adatbázis hiba.' });
    }
  }
});

app.put('/posts/:id', (req, res) => {
  const { author, title, category, content } = req.body;
  const now = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      UPDATE posts SET author = ?, title = ?, category = ?, content = ?, updated_at = ?
      WHERE id = ?
    `);
    const info = stmt.run(author, title, category, content, now, req.params.id);
    res.json({ changes: info.changes });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Ez a módosított bejegyzés már létezik.' });
    } else {
      res.status(500).json({ error: 'Hiba a módosításkor.' });
    }
  }
});

app.delete('/posts/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM posts WHERE id = ?');
  const info = stmt.run(req.params.id);
  res.json({ deleted: info.changes });
});

app.listen(3000, () => {
  console.log('API running on http://localhost:3000');
});
