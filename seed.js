const pool = require('./ps-db');

const characters = [
  {name: "Thorin Oakenshield", race: "Dwarf", class: "Fighter", level: 3, alignment: "Lawful Good", background: "Soldier", str: 16, dex: 12, con: 15, int: 10, wis: 11, cha: 9},
  {name: "Elara Moonshadow", race: "Elf", class: "Rogue", level: 2, alignment: "Chaotic Neutral", background: "Criminal", str: 9, dex: 17, con: 12, int: 13, wis: 10, cha: 14},
  {name: "Milo Underbough", race: "Halfling", class: "Bard", level: 1, alignment: "Neutral Good", background: "Entertainer", str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 16},
  {name: "Seraphina Brightwood", race: "Human", class: "Cleric", level: 2, alignment: "Lawful Neutral", background: "Acolyte", str: 10, dex: 11, con: 13, int: 12, wis: 16, cha: 14},
  {name: "Drogar Stonefist", race: "Half-Orc", class: "Barbarian", level: 3, alignment: "Chaotic Good", background: "Outlander", str: 17, dex: 13, con: 16, int: 8, wis: 10, cha: 9}
];

async function seed() {
  for (const char of characters) {
    const {name, race, class: charClass, level, alignment, background, str, dex, con, int, wis, cha} = char;

    try {
      await pool.query(
        `INSERT INTO characters
          (name, race, class, level, alignment, background, str, dex, con, int, wis, cha)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [name, race, charClass, level, alignment, background, str, dex, con, int, wis, cha]
      );
      console.log(`Dodano postać: ${name}`);
    } catch (err) {
      console.error('Błąd dodawania postaci:', err.message);
    }
  }
  pool.end();
}

seed();
