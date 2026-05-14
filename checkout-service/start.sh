#!/bin/sh

echo "uruchamianie migracji sequelize..."
npx sequelize-cli db:migrate

echo "startuje checkout-service..."
exec node app.js