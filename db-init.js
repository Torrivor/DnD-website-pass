const pool = require('./ps-db');

async function createTables() {
  try {
    // Tabela użytkowników
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        character_class VARCHAR(50) NOT NULL
      );
    `);

    // Tabela postaci (związana z użytkownikiem)
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
        cha INT DEFAULT 10
      );
    `);

    // Tabela sesji (connect-pg-simple)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
    `);

    // Indeks na kolumnę expire
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

    console.log('Tabele zostały utworzone pomyślnie!');
    process.exit(0);
  } catch (error) {
    console.error('Błąd podczas tworzenia tabel:', error);
    process.exit(1);
  }
}

createTables();
