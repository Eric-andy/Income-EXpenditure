require('dotenv').config();
const session = require('express-session');
const { authRouter, requireAuth } = require('./auth');
const methodOverride = require('method-override');

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const db = new sqlite3.Database('./public/database.db');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));
app.use(methodOverride('_method'));

// Auth routes
app.use(authRouter);

// Require authentication for all routes except login/logout
app.use((req, res, next) => {
  if (
    req.path === '/login' ||
    req.path === '/logout' ||
    req.path.startsWith('/public')
  ) {
    return next();
  }
  return requireAuth(req, res, next);
});


// Create tables if not exist
const createTable = `
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL
);
`;
db.run(createTable);


// Home page: summary only
app.get('/', (req, res) => {
  db.all('SELECT * FROM records', [], (err, rows) => {
    if (err) return res.status(500).send('Database error');
    const income = rows.filter(r => r.type === 'income').reduce((a, b) => a + b.amount, 0);
    const expenditure = rows.filter(r => r.type === 'expenditure').reduce((a, b) => a + b.amount, 0);
    res.render('index', { records: [], income, expenditure });
  });
});

// Income page: list income records and form
app.get('/income', (req, res) => {
  db.all('SELECT * FROM records WHERE type = ? ORDER BY date DESC', ['income'], (err, rows) => {
    if (err) return res.status(500).send('Database error');
    res.render('income', { records: rows });
  });
});

// Expenditure page: list expenditure records and form
app.get('/expenditure', (req, res) => {
  db.all('SELECT * FROM records WHERE type = ? ORDER BY date DESC', ['expenditure'], (err, rows) => {
    if (err) return res.status(500).send('Database error');
    res.render('expenditure', { records: rows });
  });
});

// Add record form

// Add record selection page
app.get('/add', (req, res) => {
  res.render('add');
});

// Remove /add/income and /add/expenditure GET routes (handled in /income and /expenditure pages)

// Add record POST

// Add income POST
app.post('/income', (req, res) => {
  const { source, description, amount, date } = req.body;
  if (parseFloat(amount) < 0) {
    return res.status(400).send('Amount cannot be negative');
  }
  db.run('INSERT INTO records (type, source, description, amount, date) VALUES (?, ?, ?, ?, ?)', ['income', source, description, amount, date], (err) => {
    if (err){ 
        console.error(err);
        return res.status(500).send('Database error');
    } 
    res.redirect('/income');
  });
});

// Add expenditure POST
app.post('/expenditure', (req, res) => {
  const { source, description, amount, date } = req.body;
  if (parseFloat(amount) < 0) {
    return res.status(400).send('Amount cannot be negative');
  }
  db.run('INSERT INTO records (type, source, description, amount, date) VALUES (?, ?, ?, ?, ?)', ['expenditure', source, description, amount, date], (err) => {
    if (err) return res.status(500).send('Database error');
    res.redirect('/expenditure');
  });
});

// Delete record
app.post('/delete/:id', (req, res) => {
  db.run('DELETE FROM records WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).send('Database error');
    res.redirect('/');
  });
});


// Edit income GET
app.get('/income/:id/edit', (req, res) => {
  db.get('SELECT * FROM records WHERE id = ? AND type = ?', [req.params.id, 'income'], (err, row) => {
    if (err || !row) return res.status(404).send('Income record not found');
    res.render('edit_income', { record: row });
  });
});

// Edit income PUT
app.put('/income/:id', (req, res) => {
  const { source, description, amount, date } = req.body;
  if (parseFloat(amount) < 0) {
    return res.status(400).send('Amount cannot be negative');
  }
  db.run('UPDATE records SET source = ?, description = ?, amount = ?, date = ? WHERE id = ? AND type = ?', [source, description, amount, date, req.params.id, 'income'], (err) => {
    if (err) return res.status(500).send('Database error');
    res.redirect('/income');
  });
});

// Edit expenditure GET
app.get('/expenditure/:id/edit', (req, res) => {
  db.get('SELECT * FROM records WHERE id = ? AND type = ?', [req.params.id, 'expenditure'], (err, row) => {
    if (err || !row) return res.status(404).send('Expenditure record not found');
    res.render('edit_expenditure', { record: row });
  });
});

// Edit expenditure PUT
app.put('/expenditure/:id', (req, res) => {
  const { source, description, amount, date } = req.body;
  if (parseFloat(amount) < 0) {
    return res.status(400).send('Amount cannot be negative');
  }
  db.run('UPDATE records SET source = ?, description = ?, amount = ?, date = ? WHERE id = ? AND type = ?', [source, description, amount, date, req.params.id, 'expenditure'], (err) => {
    if (err) return res.status(500).send('Database error');
    res.redirect('/expenditure');
  });
});

// Report page: select dates and show report
app.get('/report', requireAuth, (req, res) => {
  const from = req.query.from || '';
  const to = req.query.to || '';
  const sourceType = req.query.sourceType || '';
  const sourceName = req.query.sourceName || '';
  if (!from || !to) {
    return res.render('report', { records: [], income: 0, expenditure: 0, from, to, sourceType, sourceName, sumSource: 0 });
  }
  db.all('SELECT * FROM records WHERE date >= ? AND date <= ? ORDER BY date ASC', [from, to], (err, rows) => {
    if (err) return res.status(500).send('Database error');
    const income = rows.filter(r => r.type === 'income').reduce((a, b) => a + b.amount, 0);
    const expenditure = rows.filter(r => r.type === 'expenditure').reduce((a, b) => a + b.amount, 0);
    let filteredRows = rows;
    let sumSource = 0;
    if (sourceType && sourceName) {
      filteredRows = rows.filter(r => r.type === sourceType && r.source === sourceName);
      sumSource = filteredRows.reduce((a, b) => a + b.amount, 0);
    } else if (sourceType) {
      filteredRows = rows.filter(r => r.type === sourceType);
    } else if (sourceName) {
      filteredRows = rows.filter(r => r.source === sourceName);
    }
    res.render('report', {
      records: filteredRows,
      income,
      expenditure,
      from,
      to,
      sourceType,
      sourceName,
      sumSource
    });
  });
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
