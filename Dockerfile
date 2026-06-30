# ─── Stage 1: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json prisma.config.ts ./
COPY src ./src

RUN DATABASE_URL="postgresql://dummy" npx prisma generate --schema=src/prisma/schema.prisma
RUN npm run build

# ─── Stage 2: Production runtime ────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache openssl dumb-init postgresql-client \
  && addgroup -S bizos && adduser -S bizos -G bizos

ENV NODE_ENV=production
ENV UV_THREADPOOL_SIZE=4

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
  && npm install prisma@^6.9.0 --no-save \
  && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY src/prisma ./src/prisma
COPY prisma.config.ts ./
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && DATABASE_URL="postgresql://dummy" npx prisma generate --schema=src/prisma/schema.prisma \
  && chown -R bizos:bizos /app

USER bizos

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--", "docker-entrypoint.sh"]
CMD ["node", "--max-old-space-size=768", "dist/server.js"]
