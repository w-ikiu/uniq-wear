exports.up = function(knex) {
  // t2: migracja addytywna - tagi dietetyczne i limity dzienne
  return knex.schema
    .createTable('dietary_tags', table => {
      table.increments('id').primary();
      table.string('name').notNullable().unique();
    })
    .createTable('daily_limits', table => {
      table.increments('id').primary();
      table.string('sku').notNullable().unique();
      table.integer('limit_count').notNullable(); // np. max 50 burgerow dziennie
      table.integer('current_usage').defaultTo(0);
    });
};

exports.down = function(knex) {
  // usuwanie tabel przy wycofywaniu zmian
  return knex.schema.dropTable('daily_limits').dropTable('dietary_tags');
};