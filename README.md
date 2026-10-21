# Smart Research Agent

A Mastra-based AI agent with web search, file I/O, database queries, and MCP tool integrations — built for deployment on AWS Bedrock AgentCore.

## Capabilities

### Local Tools
| Tool | Description |
|------|-------------|
| **Web Search** | Search the web via Brave Search API |
| **Fetch & Summarize** | Fetch any URL and extract text content |
| **Read File** | Read files from the workspace |
| **Write File** | Write reports and data to the workspace |
| **DB Query** | Run read-only SQL queries against PostgreSQL |
| **Calculator** | Evaluate mathematical expressions |

### MCP Server Tools
| Server | Description |
|--------|-------------|
| **GitHub** (`@modelcontextprotocol/server-github`) | Browse repos, issues, PRs, code |
| **Filesystem** (`@modelcontextprotocol/server-filesystem`) | Navigate and read files on the host |

## Project Structure

```
├── agent.ts                          # AgentCore runtime entry point
├── src/mastra/
│   ├── agents/research-agent.ts      # Agent definition with all tools
│   ├── tools/
│   │   ├── web-search.ts             # Brave Search integration
│   │   ├── summarize.ts              # URL fetcher and text extractor
│   │   ├── file-ops.ts               # Read/write file tools
│   │   ├── db-query.ts               # PostgreSQL query tool
│   │   └── calculator.ts             # Math expression evaluator
│   ├── mcp/client.ts                 # MCP client config (GitHub, filesystem)
│   └── index.ts                      # Mastra instance
├── agentcore/
│   ├── agentcore.json                # AgentCore project config
│   └── aws-targets.json              # Deployment target
├── Dockerfile                        # Multi-stage build for AgentCore Runtime
└── .env.example                      # Environment variables template
```

## Setup

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your API keys

# Build
npm run build

# Run locally (requires Docker)
npx @aws/agentcore dev --runtime ResearchAgent
```

## Deploy to AgentCore

```bash
# Deploy (builds with CodeBuild, pushes to ECR, creates runtime)
npx @aws/agentcore deploy

# Check status
npx @aws/agentcore status

# Invoke
npx @aws/agentcore invoke "Research the latest developments in AI agent frameworks"
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_REGION` | Yes | AWS region (default: `us-east-1`) |
| `SEARCH_API_KEY` | For web search | Brave Search API key |
| `GITHUB_TOKEN` | For GitHub MCP | GitHub personal access token |
| `DATABASE_URL` | For DB queries | PostgreSQL connection string |
| `WORKSPACE_DIR` | No | File workspace path (default: `/tmp/workspace`) |

## Architecture

The agent uses **Mastra** as its AI framework with **Amazon Bedrock** (Claude Sonnet) as the LLM provider. It combines:

1. **Local tools** — custom TypeScript tools for web search, file I/O, database access, and computation
2. **MCP tools** — external tool servers (GitHub, filesystem) connected via the Model Context Protocol
3. **AgentCore Runtime** — AWS-managed serverless microVM environment with automatic OpenTelemetry instrumentation

The OTel auto-instrumentation means every tool call, LLM invocation, and agent step is traced and visible in CloudWatch Transaction Search — no manual tracing code needed.
