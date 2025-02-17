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
# Remove NODE_ENV=production to ensure dev dependencies are installed
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY api/package.json ./api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY shared ./shared/
COPY api ./api/

WORKDIR /app/api
RUN pnpm build

# production stage
FROM node:20-slim as production

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
