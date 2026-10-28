# Smart Research Agent

A Mastra-based AI agent with web search, file I/O, database queries, and MCP tool integrations — built for deployment on AWS Bedrock AgentCore.

## Capabilities

Every tool but the filesystem MCP server runs behind an **AgentCore gateway**: the agent loads them from the gateway over MCP.

### Gateway Tools (`research-tools` target, one Lambda)
| Tool | Description |
|------|-------------|
| **Web Search** | Search the web via Brave Search API |
| **Fetch & Summarize** | Fetch any URL and extract text content |
| **Read File** | Read files from the workspace |
| **Write File** | Write reports and data to the workspace |
| **DB Query** | Run read-only SQL queries against PostgreSQL |
| **Calculator** | Evaluate mathematical expressions |

### MCP Servers
| Server | Where | Description |
|--------|-------|-------------|
| **GitHub** (remote, `https://api.githubcopilot.com/mcp/`) | Gateway `github` target | Browse repos, issues, PRs, code |
| **Filesystem** (`@modelcontextprotocol/server-filesystem`) | In the agent's container (stdio) | Navigate and read files on the host |

## Project Structure

```
├── app/ResearchAgent/                # The agent (AgentCore runtime code)
│   ├── agent.ts                      # Entry point: renews the gateway token per invocation
│   └── src/mastra/
│       ├── agents/research-agent.ts  # Agent definition: gateway + filesystem tools
│       ├── mcp/gateway.ts            # Gateway MCP client and its Cognito token
│       ├── mcp/client.ts             # Local filesystem MCP server
│       └── index.ts                  # Mastra instance
├── gateway/research_tools/           # The gateway's research-tools Lambda
│   ├── handler.ts                    # Runs the tool the gateway names
│   ├── tool_schema.json              # The tools' schemas, as the gateway lists them
│   └── tools/                        # web-search, summarize, file-ops, db-query, calculator
├── agentcore/
│   ├── agentcore.json                # AgentCore project config
│   ├── aws-targets.json              # Deployment target
│   └── cdk/lib/research-gateway-tools.ts  # Gateway targets, Lambda and identities
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

The gateway (`gateway-quick-start-54ab07`, account 643254130632) is created outside this project; its id, URL, role, Cognito
sign-in and the GitHub token's provider are the `researchGateway` context in `agentcore/cdk/cdk.json`. Before the first
deploy, store a GitHub token in AgentCore Identity as the `github-mcp` API key provider (the gateway sends it to GitHub's
MCP server):

```bash
printf '%s' "$GITHUB_TOKEN" > /tmp/github-token && \
  aws bedrock-agentcore-control create-api-key-credential-provider --name github-mcp \
    --api-key "file:///tmp/github-token" --query credentialProviderArn; rm -f /tmp/github-token
```

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
| `SEARCH_API_KEY` | For web search | Brave Search API key, on the tools Lambda |
| `DATABASE_URL` | For DB queries | PostgreSQL connection string, on the tools Lambda |
| `WORKSPACE_DIR` | No | File workspace path (default: `/tmp/workspace`), on the Lambda and the agent's filesystem server |

The stack sets the agent's `RESEARCH_GATEWAY_*` variables; the GitHub token is in AgentCore Identity (see above).

## Architecture

The agent uses **Mastra** as its AI framework with **Amazon Bedrock** (Claude Sonnet) as the LLM provider. It combines:

1. **Gateway tools** — custom TypeScript tools for web search, file I/O, database access, and computation, in a Lambda behind the AgentCore gateway, and GitHub's remote MCP server as a gateway target. The agent signs in to the gateway with a Cognito token from AgentCore Identity
2. **Local MCP tools** — the filesystem MCP server, run in the agent's container
3. **AgentCore Runtime** — AWS-managed serverless microVM environment with automatic OpenTelemetry instrumentation

The OTel auto-instrumentation means every tool call, LLM invocation, and agent step is traced and visible in CloudWatch Transaction Search — no manual tracing code needed.
