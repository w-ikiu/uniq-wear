exports.seed = async function(knex) {
  // czyszczenie tabel przed dodaniem danych (wazne dla idempotentnosci)
  await knex('promotions').del();
  await knex('brands').del();

  // wstawianie domenowych danych o markach
  await knex('brands').insert([
    { name: 'nike' },
    { name: 'adidas' },
    { name: 'jordan' }
  ]);

  // wstawianie przykladowych kodow rabatowych
  await knex('promotions').insert([
    { code: 'drop2026', discount_percent: 15 },
    { code: 'hype10', discount_percent: 10 }
  ]);
};