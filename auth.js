const express = require('express');
const router = express.Router();
const session = require('express-session');

const USERNAME = process.env.AUTH_USERNAME;
const PASSWORD = process.env.AUTH_PASSWORD;

router.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.redirect('/login');
}

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === USERNAME && password === PASSWORD) {
    req.session.authenticated = true;
    res.redirect('/');
  } else {
    res.render('login', { error: 'Invalid credentials' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = { authRouter: router, requireAuth };
