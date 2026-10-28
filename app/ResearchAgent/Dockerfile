FROM public.ecr.aws/docker/library/node:22-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM public.ecr.aws/docker/library/node:22-slim

WORKDIR /app
ENV AWS_REGION=us-east-1
ENV WORKSPACE_DIR=/tmp/workspace

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

RUN mkdir -p /tmp/workspace && \
    useradd -m bedrock_agentcore && \
    chown -R bedrock_agentcore:bedrock_agentcore /tmp/workspace

USER bedrock_agentcore

EXPOSE 8080 8000 9000

CMD ["node", "--require", "@aws/aws-distro-opentelemetry-node-autoinstrumentation/register", "dist/agent.js"]
