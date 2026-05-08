exports.up = function(knex) {
  // druga migracja addytywna: tabela promocji
  return knex.schema.createTable('promotions', table => {
    table.increments('id').primary();
    table.string('code').notNullable().unique();
    table.integer('discount_percent').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('promotions');
};