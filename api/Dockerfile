FROM node:20-slim as base

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Development stage
FROM base as development
ENV NODE_ENV=development

COPY package*.json ./
RUN pnpm install

COPY . .

CMD ["pnpm", "dev"]

# Builder stage
FROM base as builder
ENV NODE_ENV=production

COPY package*.json ./
RUN pnpm install

COPY . .
RUN pnpm build

# Production stage
FROM base as production
ENV NODE_ENV=production

COPY package*.json ./
RUN pnpm install --prod

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["pnpm", "start"]
