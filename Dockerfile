# ============================================================
# Production Dockerfile for KSU Smart Maintain (Kalasin University)
# Multi-stage build: compiles frontend and bundles unified full-stack server
# ============================================================

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/index.html ./
COPY frontend/vite.config.js ./
RUN npm run build

# Stage 2: Runtime Backend & Full Application
FROM node:20-alpine
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/
RUN cd backend && npm install

# Copy backend source
COPY backend/ ./backend/
COPY database_setup.sql ./database_setup.sql

# Copy built frontend dist into location expected by backend/index.js
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Generate Prisma Client
WORKDIR /app/backend
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/university_maintenance?schema=public"
RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "index.js"]
