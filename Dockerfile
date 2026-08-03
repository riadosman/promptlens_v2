# syntax=docker/dockerfile:1.7
FROM node:26.5.1-bookworm-slim AS toolchain
WORKDIR /workspace
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

FROM toolchain AS migrate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/database/package.json ./packages/database/package.json
RUN pnpm install --frozen-lockfile --filter @promptlens/database...
COPY packages/database ./packages/database
RUN chown -R node:node /workspace /pnpm
ENV NODE_ENV=production
USER node
CMD ["pnpm", "--filter", "@promptlens/database", "db:deploy"]

FROM toolchain AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json eslint.config.mjs ./
COPY apps ./apps
COPY packages ./packages
COPY connectors ./connectors
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm build
RUN pnpm --filter @promptlens/api deploy --prod --legacy /prod/api \
  && pnpm --filter @promptlens/worker deploy --prod --legacy /prod/worker \
  && pnpm --filter @promptlens/web deploy --prod --legacy /prod/web

FROM node:26.5.1-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
USER node

FROM runtime AS api
COPY --from=build --chown=node:node /prod/api ./
EXPOSE 4000
CMD ["node", "dist/main.js"]

FROM runtime AS worker
COPY --from=build --chown=node:node /prod/worker ./
CMD ["node", "dist/main.js"]

FROM runtime AS web
COPY --from=build --chown=node:node /prod/web ./
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start"]
