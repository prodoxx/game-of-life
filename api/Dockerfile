FROM node:20-slim as base

# Install pnpm
RUN npm install -g pnpm@8.15.8

WORKDIR /app

# Development stage
FROM base as development
ENV NODE_ENV=development

COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

CMD ["pnpm", "dev"]

# build stage
FROM base as builder
ENV NODE_ENV=production

COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# production stage
FROM node:20-slim as production

RUN npm install -g pnpm@8.15.8

WORKDIR /app

COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --prod

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "start"]
