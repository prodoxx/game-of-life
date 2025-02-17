FROM node:20-slim as base

RUN npm install -g pnpm@8.15.8

WORKDIR /app

# Development stage
FROM base as development
ENV NODE_ENV=development

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY app/package.json ./app/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY shared ./shared/
COPY app ./app/

WORKDIR /app/app
CMD ["pnpm", "dev"]

# build stage
FROM base as build

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY app/package.json ./app/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY shared ./shared/
COPY app ./app/

# Build shared package first
WORKDIR /app/shared
RUN pnpm build

# Then build app
WORKDIR /app/app
RUN pnpm build

# production stage
FROM nginx:alpine

RUN apk add --no-cache curl

COPY app/nginx.conf /etc/nginx/conf.d/default.conf

# copy built files
COPY --from=build /app/app/dist /usr/share/nginx/html

EXPOSE 80

# healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# start nginx
CMD ["nginx", "-g", "daemon off;"] 