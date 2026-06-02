FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000 4000
CMD ["sh", "-c", "node resource-server.js & node client.js"]
