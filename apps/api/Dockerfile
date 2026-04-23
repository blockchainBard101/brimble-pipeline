FROM node:20-alpine AS builder

RUN apk add --no-cache curl bash
RUN curl -sSL https://railpack.io/install.sh | bash || true

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine

RUN apk add --no-cache curl bash
RUN curl -sSL https://railpack.io/install.sh | bash || true

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/main"]
