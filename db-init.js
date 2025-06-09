const pool = require('./ps-db');
const bcrypt = require('bcrypt');

async function createTables() {
  try {
    // Tabela użytkowników
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        character_class VARCHAR(50) NOT NULL,
        is_admin BOOLEAN DEFAULT false
      );
    `);

    // Tabela postaci
    await pool.query(`
      CREATE TABLE IF NOT EXISTS characters (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        race VARCHAR(50) NOT NULL,
        class VARCHAR(50) NOT NULL,
        level INT DEFAULT 1,
        alignment VARCHAR(50),
        background VARCHAR(100),
        str INT DEFAULT 10,
        dex INT DEFAULT 10,
        con INT DEFAULT 10,
        int INT DEFAULT 10,
        wis INT DEFAULT 10,
        cha INT DEFAULT 10,
        unassigned_points INT DEFAULT 0
      );
    `);

    // Tabela sesji
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

    // Tworzenie użytkownika admin
    const adminUsername = 'admin';
    const adminPassword = 'admin';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await pool.query(`
      INSERT INTO users (username, password, character_class, is_admin)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (username) DO NOTHING
    `, [adminUsername, hashedPassword, 'GM']);

    console.log('✅ Tabele i konto admina zostały utworzone pomyślnie!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Błąd podczas tworzenia tabel lub admina:', error);
    process.exit(1);
  }
}

createTables();
