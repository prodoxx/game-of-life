FROM node:20-slim as base

# Install pnpm
RUN npm install -g pnpm@8.15.8

WORKDIR /app

# Development stage
FROM base as development
ENV NODE_ENV=development

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY api/package.json ./api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY shared ./shared/
COPY api ./api/

WORKDIR /app/api
CMD ["pnpm", "dev"]

# build stage
FROM base as builder

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY api/package.json ./api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY shared ./shared/
COPY api ./api/

# Build shared package first
WORKDIR /app/shared
RUN pnpm build

# Then build API
WORKDIR /app/api
RUN pnpm build

# production stage
FROM node:20-slim as production

ENV REDIS_URL=${REDIS_URL}
ENV APP_BASE_URL=${APP_BASE_URL}

RUN npm install -g pnpm@8.15.8

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY api/package.json ./api/

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/shared/dist ./shared/dist

WORKDIR /app/api
ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "start"]
