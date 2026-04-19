require('dotenv').config();

// konfiguracja polaczenia sequelize z uzyciem zmiennej z pliku .env
module.exports = {
  development: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    logging: false // wylacza spamowanie sql w terminalu
  }
};