require('dotenv').config();
const session = require('express-session');
const { authRouter, requireAuth } = require('./auth');
const methodOverride = require('method-override');

const express = require('express');
const path = require('path');
const { Pool,types } = require('pg');
const bodyParser = require('body-parser');

const app = express();
// Override for NUMERIC (OID 1700) — parse as float
types.setTypeParser(1700, (val) => {
  return val === null ? null : parseFloat(val);
});
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: process.env.SSL,
  } 
});

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
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  source VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL
);
`;
db.query(createTable).catch(err => console.error('Error creating table:', err));

// Home page: summary only
app.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM records');
    const income = rows.filter(r => r.type === 'income').reduce((a, b) => a + parseFloat(b.amount), 0);
    const expenditure = rows.filter(r => r.type === 'expenditure').reduce((a, b) => a + parseFloat(b.amount), 0);
    res.render('index', { records: [], income, expenditure });
  } catch (err) {
    return res.status(500).send('Database error');
  }
});

// Income page: list income records and form
app.get('/income', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM records WHERE type = $1 ORDER BY date DESC', ['income']);
    res.render('income', { records: rows });
  } catch (err) {
    return res.status(500).send('Database error');
  }
});

// Expenditure page: list expenditure records and form
app.get('/expenditure', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM records WHERE type = $1 ORDER BY date DESC', ['expenditure']);
    res.render('expenditure', { records: rows });
  } catch (err) {
    return res.status(500).send('Database error');
  }
});

// Add record selection page
app.get('/add', (req, res) => {
  res.render('add');
});

// Add income POST
app.post('/income', async (req, res) => {
  const { source, description, amount, date } = req.body;
  if (parseFloat(amount) < 0) {
    return res.status(400).send('Amount cannot be negative');
  }
  try {
    await db.query('INSERT INTO records (type, source, description, amount, date) VALUES ($1, $2, $3, $4, $5)', ['income', source, description, amount, date]);
    res.redirect('/income');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Database error');
  }
});

// Add expenditure POST
app.post('/expenditure', async (req, res) => {
  const { source, description, amount, date } = req.body;
  if (parseFloat(amount) < 0) {
    return res.status(400).send('Amount cannot be negative');
  }
  try {
    await db.query('INSERT INTO records (type, source, description, amount, date) VALUES ($1, $2, $3, $4, $5)', ['expenditure', source, description, amount, date]);
    res.redirect('/expenditure');
  } catch (err) {
    return res.status(500).send('Database error');
  }
});

// Delete record
app.post('/delete/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM records WHERE id = $1', [req.params.id]);
    res.redirect('/');
  } catch (err) {
    return res.status(500).send('Database error');
  }
});

// Edit income GET
app.get('/income/:id/edit', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM records WHERE id = $1 AND type = $2', [req.params.id, 'income']);
    if (!rows[0]) return res.status(404).send('Income record not found');
    res.render('edit_income', { record: rows[0] });
  } catch (err) {
    return res.status(500).send('Database error');
  }
});

// Edit income PUT
app.put('/income/:id', async (req, res) => {
  const { source, description, amount, date } = req.body;
  if (parseFloat(amount) < 0) {
    return res.status(400).send('Amount cannot be negative');
  }
  try {
    await db.query('UPDATE records SET source = $1, description = $2, amount = $3, date = $4 WHERE id = $5 AND type = $6', [source, description, amount, date, req.params.id, 'income']);
    res.redirect('/income');
  } catch (err) {
    return res.status(500).send('Database error');
  }
});

// Edit expenditure GET
app.get('/expenditure/:id/edit', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM records WHERE id = $1 AND type = $2', [req.params.id, 'expenditure']);
    if (!rows[0]) return res.status(404).send('Expenditure record not found');
    res.render('edit_expenditure', { record: rows[0] });
  } catch (err) {
    return res.status(500).send('Database error');
  }
});

// Edit expenditure PUT
app.put('/expenditure/:id', async (req, res) => {
  const { source, description, amount, date } = req.body;
  if (parseFloat(amount) < 0) {
    return res.status(400).send('Amount cannot be negative');
  }
  try {
    await db.query('UPDATE records SET source = $1, description = $2, amount = $3, date = $4 WHERE id = $5 AND type = $6', [source, description, amount, date, req.params.id, 'expenditure']);
    res.redirect('/expenditure');
  } catch (err) {
    return res.status(500).send('Database error');
  }
});

// Report page: select dates and show report
app.get('/report', requireAuth, async (req, res) => {
  const from = req.query.from || '';
  const to = req.query.to || '';
  const sourceType = req.query.sourceType || '';
  const sourceName = req.query.sourceName || '';
  if (!from || !to) {
    return res.render('report', { records: [], income: 0, expenditure: 0, from, to, sourceType, sourceName, sumSource: 0 });
  }
  try {
    const { rows } = await db.query('SELECT * FROM records WHERE date >= $1 AND date <= $2 ORDER BY date ASC', [from, to]);
    const income = rows.filter(r => r.type === 'income').reduce((a, b) => a + parseFloat(b.amount), 0);
    const expenditure = rows.filter(r => r.type === 'expenditure').reduce((a, b) => a + parseFloat(b.amount), 0);
    let filteredRows = rows;
    let sumSource = 0;
    if (sourceType && sourceName) {
      filteredRows = rows.filter(r => r.type === sourceType && r.source === sourceName);
      sumSource = filteredRows.reduce((a, b) => a + parseFloat(b.amount), 0);
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
  } catch (err) {
    return res.status(500).send('Database error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
