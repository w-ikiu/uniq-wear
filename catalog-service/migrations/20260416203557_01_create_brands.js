exports.up = function(knex) {
  // pierwsza migracja addytywna: tabela marek
  return knex.schema.createTable('brands', table => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  // usuwanie tabeli w przypadku wycofania migracji
  return knex.schema.dropTable('brands');
};