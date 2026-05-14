# etap 1: builder (instalacja wszystkich zaleznosci i generowanie prismy)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# wymog: wygenerowanie klienta bazy danych prisma wewnatrz kontenera
RUN npx prisma generate

# etap 2: produkcja (tylko to co niezbedne do dzialania, dla lekkiego obrazu)
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# kopiujemy gotowe pliki z pierwszego etapu
COPY --from=builder /app ./

EXPOSE 3001

COPY start.sh .
RUN chmod +x start.sh
CMD ["sh", "start.sh"]