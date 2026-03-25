FROM node:22-alpine AS base

WORKDIR /app

RUN apk add --no-cache bash libc6-compat

COPY package*.json ./
RUN npm install

COPY . /app

FROM base AS development
RUN chmod +x /app/scripts/*.sh
CMD ["/app/scripts/start-dev.sh"]

FROM base AS builder
ENV NODE_ENV=production
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_DEFAULT_WEEK_START
ENV NEXT_PUBLIC_APP_NAME="${NEXT_PUBLIC_APP_NAME}" \
    NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL}" \
    NEXT_PUBLIC_DEFAULT_WEEK_START="${NEXT_PUBLIC_DEFAULT_WEEK_START}"
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache bash libc6-compat
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
RUN chmod +x /app/scripts/*.sh
CMD ["/app/scripts/start-prod.sh"]
