# The voice agent is its own process, so it is its own image: it holds a
# long-lived WebSocket per call and must not be restarted by a backend deploy.
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/llm/ packages/llm/
COPY packages/conversation-relay/ packages/conversation-relay/
RUN corepack enable && corepack prepare pnpm@10 --activate && pnpm install --frozen-lockfile
RUN pnpm --filter @twilio-preso/shared build
RUN pnpm --filter @twilio-preso/llm build
RUN pnpm --filter @twilio-preso/conversation-relay build

FROM node:22-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/llm/package.json ./packages/llm/
COPY --from=builder /app/packages/llm/dist ./packages/llm/dist
COPY --from=builder /app/packages/conversation-relay/package.json ./packages/conversation-relay/
COPY --from=builder /app/packages/conversation-relay/dist ./packages/conversation-relay/dist
RUN pnpm install --frozen-lockfile --prod \
  --filter @twilio-preso/conversation-relay --filter @twilio-preso/shared --filter @twilio-preso/llm
WORKDIR /app/packages/conversation-relay
EXPOSE 3003
ENV CONVERSATION_RELAY_PORT=3003
CMD ["node", "dist/index.js"]
