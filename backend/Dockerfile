FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY scripts ./scripts

RUN mkdir -p /app/uploads

EXPOSE 3001

CMD ["sh", "-c", "if [ -d prisma/migrations ]; then npx prisma migrate deploy; fi && node src/server.js"]
