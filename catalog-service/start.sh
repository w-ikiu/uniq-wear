#!/bin/sh

echo "uruchamianie migracji prisma..."
npx prisma migrate deploy

echo "startuje catalog-service..."
exec node app.js