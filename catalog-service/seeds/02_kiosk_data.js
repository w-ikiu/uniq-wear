exports.seed = async function(knex) {
  // czyszczenie tabel przed wstawieniem nowych danych
  await knex('daily_limits').del();
  await knex('dietary_tags').del();

  // wstawianie tagow dietetycznych
  await knex('dietary_tags').insert([
    { name: 'wege' },
    { name: 'bez laktozy' },
    { name: 'ostre' }
  ]);

  // wstawianie limitow dziennych (np. dzis mamy tylko 50 porcji wolowiny)
  await knex('daily_limits').insert([
    { sku: 'BURGER-CHEESE-STD', limit_count: 50, current_usage: 0 },
    { sku: 'COFFEE-LATTE-BIG', limit_count: 100, current_usage: 0 }
  ]);
};