FROM node:20-slim as base

RUN npm install -g pnpm@8.15.8

WORKDIR /app

# Development stage
FROM base as development
ENV NODE_ENV=development

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# copy source files
COPY . . 

CMD ["pnpm", "dev"]

# build stage
FROM base as build
ENV NODE_ENV=production

COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# production stage
FROM nginx:alpine

RUN apk add --no-cache curl

COPY nginx.conf /etc/nginx/conf.d/default.conf

# copy built files
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# start nginx
CMD ["nginx", "-g", "daemon off;"] 