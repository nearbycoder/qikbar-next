FROM oven/bun:1 AS build
WORKDIR /app
COPY . .
ARG SITE_URL
ENV SITE_URL=${SITE_URL}
RUN bun install --frozen-lockfile && bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/web/server.ts ./apps/web/server.ts
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "apps/web/server.ts"]
