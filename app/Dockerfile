# build stage
FROM node:20-slim as build

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# copy source files
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