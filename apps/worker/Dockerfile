# Rhodes BullMQ worker — library ingest/embed + document embed + LLM jobs.
# Build from monorepo root:
#   docker build -f apps/worker/Dockerfile -t rhodes-worker .

FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/worker/package.json apps/worker/
COPY packages/ai/package.json packages/ai/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @rhodes/worker...

FROM base AS build
COPY --from=deps /app /app
COPY apps/worker apps/worker
COPY packages packages
RUN pnpm --filter @rhodes/worker build

FROM base AS runtime
ENV NODE_ENV=production
ENV RHODES_IN_DOCKER=1
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/worker/node_modules /app/apps/worker/node_modules
COPY --from=deps /app/packages /app/packages
COPY --from=build /app/apps/worker/dist /app/apps/worker/dist
COPY --from=build /app/apps/worker/package.json /app/apps/worker/
WORKDIR /app/apps/worker
USER node
CMD ["node", "dist/index.js"]
