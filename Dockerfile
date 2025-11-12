FROM node:20-alpine AS base

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./

# Install dependencies
RUN npm ci

# Copy source code
COPY client ./client
COPY server ./server
COPY shared ./shared

# Build client
RUN npm run build

# Build server (compile TypeScript to JavaScript)
RUN npx tsc --project tsconfig.json

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application (client build output)
COPY --from=builder /app/dist ./dist

# Copy compiled server code (if using separate server build)
# or source files if running with tsx/ts-node
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Note: Running TypeScript files directly with tsx in production
# If you prefer compiled JavaScript, update build process and use:
# CMD ["node", "dist/server/index.js"]
CMD ["node", "--import", "tsx", "server/index.ts"]
