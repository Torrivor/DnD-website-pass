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
  if (!req.session.user) {
    return res.redirect('/'); // jeśli brak sesji, przekieruj na stronę logowania
  }
  next();
}

// Middleware do sprawdzania czy jest admin
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.isAdmin) {
    next();
  } else {
    res.status(403).send('Brak dostępu');
  }
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

// API: zwraca użytkowników + postaci (tylko admin)
app.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT users.username, users.character_class, characters.id AS character_id,
             characters.name, characters.race, characters.level, characters.unassigned_points
      FROM users
      JOIN characters ON users.id = characters.user_id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).send('Błąd serwera');
  }
});

// Podniesienie poziomu + dodanie punktów (admin)
app.post('/admin/level-up/:characterId', requireAdmin, async (req, res) => {
  const { characterId } = req.params;
  try {
    await dbPool.query(`
      UPDATE characters
      SET level = level + 1,
          unassigned_points = unassigned_points + 2
      WHERE id = $1
    `, [characterId]);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send('Błąd serwera');
  }
});

// Dodawanie punktów do statystyk (admin)
// ...existing code...
app.post('/admin/add-stat', requireAdmin, async (req, res) => {
  const { characterId, stat, amount } = req.body;
  const allowedStats = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  if (!allowedStats.includes(stat)) return res.status(400).send('Niepoprawna statystyka');
  if (!Number.isInteger(amount) || amount <= 0) return res.status(400).send('Niepoprawna ilość');

  try {
    const result = await dbPool.query(`
      UPDATE characters
      SET ${stat} = ${stat} + $1
      WHERE id = $2
      RETURNING *
    `, [amount, characterId]);
    if (result.rowCount === 0) return res.status(404).send('Nie znaleziono postaci');
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send('Błąd serwera');
  }
});
// Edycja postaci (admin) — aktualizacja pól
// Uwaga: nie ma walidacji pól, więc admin może ustawić cokolwiek
app.post('/admin/edit-character', requireAdmin, async (req, res) => {
  const { characterId, fields } = req.body;
  // fields: obiekt { pole: wartość, ... }
  const allowedFields = [
  'name', 'race', 'class', 'level', 'alignment', 'background',
  'str', 'dex', 'con', 'int', 'wis', 'cha', 'unassigned_points'
];

  // Filtrowanie tylko dozwolonych pól
  const updates = [];
  const values = [];
  let idx = 1;
  for (const key in fields) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = $${idx++}`);
      values.push(fields[key]);
    }
  }
  if (updates.length === 0) return res.status(400).send('Brak dozwolonych pól do edycji');

  values.push(characterId);

  try {
    const result = await dbPool.query(
      `UPDATE characters SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rowCount === 0) return res.status(404).send('Nie znaleziono postaci');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Błąd edycji:', err);
    res.status(500).send('Błąd serwera');
  }
});

// Rejestracja użytkownika — po rejestracji od razu loguje i przekierowuje na dashboard
app.post('/register', async (req, res) => {
  const { username, password, characterClass, race } = req.body;

  if (!username || !password || !characterClass || !race) {
    return res.status(400).send('Wszystkie pola są wymagane.');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Dodaj użytkownika
    const userResult = await dbPool.query(
      'INSERT INTO users (username, password, character_class) VALUES ($1, $2, $3) RETURNING id',
      [username, hashedPassword, characterClass]
    );
    const userId = userResult.rows[0].id;

    // Dodaj powiązaną postać
    await dbPool.query(
      `INSERT INTO characters (user_id, name, race, class, level, alignment, background, str, dex, con, int, wis, cha, unassigned_points)
       VALUES ($1, $2, $3, $4, 1, 'Neutralny', 'Brak', 10, 10, 10, 10, 10, 10, 0)`,
      [userId, username, race, characterClass]
    );

    // Ustaw sesję — zaloguj użytkownika
    req.session.user = {
      id: userId,
      username,
      isAdmin: false,
    };
    req.session.userId = userId;

    // Przekieruj na dashboard
    res.redirect('/dashboard.html');
  } catch (err) {
    console.error('❌ Błąd rejestracji:', err.message);
    res.status(500).send('❌ Błąd rejestracji: ' + err.message);
  }
});

// Logowanie użytkownika/admina
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await dbPool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).send('Nieprawidłowy login');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).send('Nieprawidłowe hasło');
    }

    // Ustawienie sesji
    req.session.user = {
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin || false,
    };
    req.session.userId = user.id;

    // Przekierowanie w zależności od roli
    if (user.is_admin) {
      res.redirect('/admin.html');
    } else {
      res.redirect('/dashboard.html');
    }

  } catch (err) {
    console.error(err);
    res.status(500).send('Błąd logowania');
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
app.get('/api/user-data', requireLogin, async (req, res) => {
  try {
    const userResult = await dbPool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.session.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono użytkownika' });
    }

    const user = userResult.rows[0];

    const characterResult = await dbPool.query(
      'SELECT * FROM characters WHERE user_id = $1',
      [user.id]
    );

    const char = characterResult.rows[0] || {};

    res.json({
      username: user.username,
      class: char.class || 'Brak',
      race: char.race || 'Brak',
      level: char.level || 1,
      unassigned_points: char.unassigned_points || 0,
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

app.post('/user/add-stat', requireLogin, async (req, res) => {
  const { stat, amount } = req.body;
  const allowedStats = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  if (!allowedStats.includes(stat)) return res.status(400).send('Niepoprawna statystyka');
  if (!Number.isInteger(amount) || amount <= 0) return res.status(400).send('Niepoprawna ilość');

  try {
    // Pobierz postać użytkownika
    const charResult = await dbPool.query('SELECT * FROM characters WHERE user_id = $1', [req.session.user.id]);
    if (charResult.rows.length === 0) return res.status(404).send('Postać nie znaleziona');

    const character = charResult.rows[0];

    if (character.unassigned_points < amount) {
      return res.status(400).send('Za mało punktów do rozdysponowania');
    }

    // Aktualizacja statystyki i zmniejszenie punktów
    await dbPool.query(`
      UPDATE characters
      SET ${stat} = ${stat} + $1,
          unassigned_points = unassigned_points - $1
      WHERE id = $2
    `, [amount, character.id]);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Błąd serwera');
  }
  });


app.listen(PORT, () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});
