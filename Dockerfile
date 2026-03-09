# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js only
ARG DOMAIN_URL
ARG PUBLIC_API_BASE
ENV DOMAIN_URL=$DOMAIN_URL
ENV PUBLIC_API_BASE=$PUBLIC_API_BASE
RUN npx next build

# ── Stage 3: production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next        ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public       ./public

EXPOSE 3000
CMD ["npm", "start"]