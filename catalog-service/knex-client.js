const knex = require('knex');
const config = require('./knexfile');

// inicjalizacja polaczenia knex dla srodowiska development
const db = knex(config.development);

module.exports = db;