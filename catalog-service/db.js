// t1: wczytanie zmiennych srodowiskowych z pliku .env
require('dotenv').config();
const { Pool } = require('pg');

// t1: singleton - jedna wspolna pula polaczen dla calej aplikacji
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// t1: mapowanie kodow bledow postgres na kody statusu http
const mapPgErrorToHttp = (error) => {
  switch (error.code) {
    case '23505': // unikalne naruszenie (np. proba dodania tego samego sku)
      return { status: 409, message: 'konflikt: taki rekord juz istnieje w bazie' };
    case '23503': // naruszenie klucza obcego (np. kategoria nie istnieje)
      return { status: 400, message: 'blad zapytania: brak powiazanego rekordu' };
    case '42P01': // tabela nie istnieje
      return { status: 500, message: 'blad serwera: brak wymaganej tabeli' };
    default:
      return { status: 500, message: 'wewnetrzny blad bazy danych' };
  }
};

// t1: funkcja wrapper uzywajaca zapytan parametryzowanych ($1, $2)
const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    const mappedError = mapPgErrorToHttp(err);
    const customError = new Error(mappedError.message);
    customError.status = mappedError.status;
    // szczegoly bledu dla debugowania
    customError.details = err.detail || err.message;
    throw customError;
  }
};

module.exports = { query };