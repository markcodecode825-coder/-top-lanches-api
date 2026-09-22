FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json eslint.config.js prettier.config.js vitest.config.ts ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
COPY prisma ./prisma
RUN npm install --omit=dev \
  && npx prisma generate \
  && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 3333
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
