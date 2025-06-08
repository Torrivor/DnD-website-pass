const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

const bcrypt = require('bcrypt');

const session = require('express-session');
const bodyParser = require('body-parser');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

// Połączenie z PostgreSQL
const dbPool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres', // ZMIEŃ NA SWOJĄ BAZĘ DANYCH
  password: 'password', // ZMIEŃ NA SWOJE HASŁO
  port: 5432,
});

// Middleware do ochrony tras - sprawdza czy użytkownik jest zalogowany
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/'); // jeśli brak sesji, przekieruj na stronę logowania
  }
  next();
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    store: new pgSession({
      pool: dbPool,
    }),
    secret: 'tajnySekret', // ZMIEŃ NA COŚ SZYFROWANEGO
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 dzień
  })
);

// Statyczne pliki (HTML, CSS)
app.use(express.static(path.join(__dirname, 'public')));

// Routing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rejestracja użytkownika
app.post('/register', async (req, res) => {
  const { username, password, characterClass, race } = req.body;

  try {
    // 1. Hash hasła
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Dodaj użytkownika
    const userResult = await dbPool.query(
      'INSERT INTO users (username, password, character_class) VALUES ($1, $2, $3) RETURNING id',
      [username, hashedPassword, characterClass]
    );

    const userId = userResult.rows[0].id;

    // 3. Dodaj postać powiązaną z użytkownikiem
    await dbPool.query(
      `INSERT INTO characters (user_id, name, race, class)
       VALUES ($1, $2, $3, $4)`,
      [userId, username, race, characterClass]
    );

    res.send('✅ Zarejestrowano pomyślnie!');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Błąd rejestracji: ' + err.message);
  }
});



// Logowanie użytkownika
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await dbPool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (passwordMatch) {
        req.session.userId = user.id;
        res.redirect('/dashboard');  // <- PRZEKIEROWANIE PO SUKCESIE
      } else {
        res.status(401).send('Błędna nazwa użytkownika lub hasło.');
      }
    } else {
      res.status(401).send('Błędna nazwa użytkownika lub hasło.');
    }
  } catch (err) {
    res.status(500).send('Błąd logowania: ' + err.message);
  }
});

// Wylogowanie (POST)
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Błąd wylogowania');
    }
    res.redirect('/');
  });
});

// Chroniony dashboard
app.get('/dashboard', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
// API do pobrania danych użytkownika i jego postaci
app.get('/api/userdata', requireLogin, async (req, res) => {
  try {
    const userResult = await dbPool.query('SELECT id, username FROM users WHERE id = $1', [req.session.userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    const user = userResult.rows[0];

    // UWAGA: tutaj musisz mieć w tabeli characters kolumnę user_id łączącą postać z użytkownikiem
    const charResult = await dbPool.query('SELECT * FROM characters WHERE user_id = $1', [user.id]);
    const character = charResult.rows[0] || null;

    res.json({ user, character });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API do pobrania danych użytkownika i jego postaci
app.get('/api/user-data', requireLogin, async (req, res) => {
  try {
    const userResult = await dbPool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono użytkownika' });
    }

    const user = userResult.rows[0];

    const characterResult = await dbPool.query(
      'SELECT * FROM characters WHERE name = $1',
      [user.username]
    );

    const char = characterResult.rows[0] || {};

    res.json({
      username: user.username,
      class: char.class || 'Brak',
      race: char.race || 'Brak',
      level: char.level || 1,
      classImage: `/images/${(char.class || 'brak').toLowerCase()}.png`,
      raceImage: `/images/${(char.race || 'brak').toLowerCase()}.png`,
      stats: {
        str: char.str || 0,
        dex: char.dex || 0,
        con: char.con || 0,
        int: char.int || 0,
        wis: char.wis || 0,
        cha: char.cha || 0,
      }
    });
  } catch (err) {
    console.error('Błąd API:', err);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
});



app.listen(PORT, () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});
