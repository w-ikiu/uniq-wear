#!/bin/sh

echo "uruchamianie migracji prisma..."

# sprawdz czy tabela migracji istnieje
npx prisma migrate deploy 2>/dev/null || {
  echo "pierwsze uruchomienie - wykonuje baseline..."
  npx prisma migrate resolve --applied 20260416202609_init_catalog
  npx prisma migrate deploy
}

echo "startuje catalog-service..."
exec node app.js