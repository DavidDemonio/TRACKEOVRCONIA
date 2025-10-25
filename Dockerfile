# syntax=docker/dockerfile:1

FROM node:20-bullseye AS base
WORKDIR /app
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json .eslintrc.cjs ./
COPY apps/server/package.json apps/server/tsconfig.json apps/server/tsconfig.build.json apps/server/vitest.config.ts apps/server/ ./apps/server/
COPY apps/web/package.json apps/web/tsconfig.json apps/web/vite.config.ts apps/web/vitest.config.ts apps/web/tailwind.config.ts apps/web/postcss.config.js ./apps/web/
COPY packages ./packages
COPY tools/package.json ./tools/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM node:20-bullseye AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
COPY --from=deps /app/pnpm-lock.yaml ./
COPY package.json pnpm-workspace.yaml tsconfig.base.json .eslintrc.cjs ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY tools ./tools
RUN pnpm install --filter server --prod --frozen-lockfile
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
EXPOSE 4000
CMD ["node", "apps/server/dist/index.js"]
