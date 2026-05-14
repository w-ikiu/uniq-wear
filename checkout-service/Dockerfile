# etap 1: builder (instalacja wszystkich zaleznosci)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# etap 2: produkcja (tylko to co niezbedne, lzejszy obraz)
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# kopiujemy gotowe pliki z etapu builder
COPY --from=builder /app ./

EXPOSE 3002

CMD ["node", "app.js"]