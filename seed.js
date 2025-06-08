const pool = require('./ps-db');

const characters = [
    {id: 1, name: "Thorin Oakenshield", race: "Dwarf", class: "Fighter", level: 3, alignment: "Lawful Good", background: "Soldier", stats: {str: 16, dex: 12, con: 15, int: 10, wis: 11, cha: 9}},
    {id: 2, name: "Elara Moonshadow", race: "Elf", class: "Rogue", level: 2, alignment: "Chaotic Neutral", background: "Criminal", stats: {str: 9, dex: 17, con: 12, int: 13, wis: 10, cha: 14}},
    {id: 3, name: "Milo Underbough", race: "Halfling", class: "Bard", level: 1, alignment: "Neutral Good", background: "Entertainer", stats: {str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 16}},
    {id: 4, name: "Seraphina Brightwood", race: "Human", class: "Cleric", level: 2, alignment: "Lawful Neutral", background: "Acolyte", stats: {str: 10, dex: 11, con: 13, int: 12, wis: 16, cha: 14}},
    {id: 5, name: "Drogar Stonefist", race: "Half-Orc", class: "Barbarian", level: 3, alignment: "Chaotic Good", background: "Outlander", stats: {str: 17, dex: 13, con: 16, int: 8, wis: 10, cha: 9}}
];