#!/bin/sh

echo "uruchamianie migracji prisma..."

# probujemy wykonac migracje
OUTPUT=$(npx prisma migrate deploy 2>&1)
echo "$OUTPUT"

if echo "$OUTPUT" | grep -q "P3005"; then
  echo "wykryto istniejaca baze bez historii - tworze tabele recznie i wykonuje baseline..."
  
  # wykonaj SQL pierwszej migracji bezposrednio
  npx prisma db execute --file prisma/migrations/20260416202609_init_catalog/migration.sql --schema prisma/schema.prisma
  
  # oznacz pierwsza migracje jako wykonana
  npx prisma migrate resolve --applied 20260416202609_init_catalog
  
  # wykonaj pozostale migracje
  npx prisma migrate deploy
fi

echo "uruchamianie migracji knex..."
npx knex migrate:latest

echo "uruchamianie seedow knex..."
npx knex seed:run

echo "startuje catalog-service..."
exec node app.js