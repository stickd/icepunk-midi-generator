FROM node:22-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:8081
ARG NEXT_PUBLIC_STORAGE_ORIGIN=http://localhost:9010
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STORAGE_ORIGIN=$NEXT_PUBLIC_STORAGE_ORIGIN

COPY --from=deps /app/node_modules node_modules
COPY . .

RUN npm run build

FROM node:22-slim AS runtime

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:8081
ARG NEXT_PUBLIC_STORAGE_ORIGIN=http://localhost:9010
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STORAGE_ORIGIN=$NEXT_PUBLIC_STORAGE_ORIGIN

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/.next .next
COPY --from=build /app/public public
COPY --from=build /app/next.config.ts next.config.ts

RUN npm prune --omit=dev \
    && groupadd --system nextjs \
    && useradd --system --gid nextjs --home-dir /app nextjs \
    && chown -R nextjs:nextjs /app

EXPOSE 3000

USER nextjs

CMD ["npm", "run", "start"]
