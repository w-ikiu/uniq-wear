-- keycloak wymaga osobnej bazy danych — tworzymy ja przy starcie postgresa
-- skrypt uruchamia sie automatycznie przez docker przy pierwszym starcie kontenera
CREATE DATABASE keycloak_db;
