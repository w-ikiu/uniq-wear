# obraz bazowy node.js w wersji alpine (bardzo lekki)
FROM node:22-alpine

# katalog roboczy wewnatrz kontenera
WORKDIR /app

# kopiujemy pliki zaleznosci
COPY package*.json ./

# instalujemy tylko zaleznosci produkcyjne (pomijamy sequelize-cli)
RUN npm install --omit=dev

# kopiujemy cala reszte kodu
COPY . .

# wystawiamy port 3002 na zewnatrz kontenera
EXPOSE 3002

# komenda uruchamiajaca aplikacje
CMD ["node", "app.js"]