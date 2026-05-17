# ============================================================
# Stage 1 — Builder
# Build context is project root (.) so frontend/ and landing/
# are both accessible.
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (layer-cache friendly)
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Copy frontend source and build
COPY frontend ./frontend
RUN cd frontend && npx ng build --configuration production

# ============================================================
# Stage 2 — Server
# Angular 21 outputs to dist/withoutborder/browser/
# ============================================================
FROM nginx:alpine

# Angular SPA
COPY --from=builder /app/frontend/dist/withoutborder/browser /usr/share/nginx/html/app

# Landing page (static files served at /)
COPY landing /usr/share/nginx/html/

# Nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
