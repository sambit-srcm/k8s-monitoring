# ---------- build stage ----------
FROM node:22-slim AS build
ARG SERVICE
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY worker/package.json worker/
COPY stats/package.json stats/
RUN pnpm install --frozen-lockfile

COPY shared shared
COPY api api
COPY worker worker
COPY stats stats
RUN pnpm -r build

# Self-contained folder: just this service's prod deps + built shared
RUN pnpm --filter ${SERVICE} deploy --prod --legacy /out

# ---------- runtime stage ----------
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
USER node
# node runs as PID 1 and receives SIGTERM directly (no pnpm/npm wrapper)
CMD ["node", "dist/index.js"]