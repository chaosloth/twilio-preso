FROM node:22-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/llm/ packages/llm/
COPY packages/backend/ packages/backend/
RUN corepack enable && corepack prepare pnpm@10 --activate && pnpm install --frozen-lockfile
RUN pnpm --filter @twilio-preso/shared build
RUN pnpm --filter @twilio-preso/llm build
RUN pnpm --filter @twilio-preso/backend build

FROM node:22-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/llm/package.json ./packages/llm/
COPY --from=builder /app/packages/llm/dist ./packages/llm/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
RUN pnpm install --frozen-lockfile --prod --filter @twilio-preso/backend --filter @twilio-preso/llm
WORKDIR /app/packages/backend
EXPOSE 3001
ENV PORT=3001
CMD ["node", "dist/index.js"]
