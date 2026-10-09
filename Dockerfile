# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
ARG CONTACT_API_URL=/api
ENV NEXT_PUBLIC_CONTACT_API_URL=$CONTACT_API_URL
RUN npm run build

FROM node:24-alpine AS runtime-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace backend --include-workspace-root=false

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 WEB_ROOT=/app/public
COPY --from=runtime-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
COPY --from=build --chown=node:node /app/dist ./public
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/dist/main.js"]
