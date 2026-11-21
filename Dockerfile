FROM oven/bun:1 AS build
WORKDIR /app

# Copy workspace manifests first so Docker caches installed dependencies across code edits.
COPY package.json bun.lock ./
COPY packages/qikbar/package.json ./packages/qikbar/
COPY apps/web/package.json ./apps/web/
COPY apps/video/package.json ./apps/video/
COPY examples/react/package.json ./examples/react/
RUN bun install --frozen-lockfile

COPY packages/qikbar ./packages/qikbar
COPY apps/web ./apps/web
ARG SITE_URL
ENV SITE_URL=${SITE_URL}
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/web/server.ts ./apps/web/server.ts
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "apps/web/server.ts"]
