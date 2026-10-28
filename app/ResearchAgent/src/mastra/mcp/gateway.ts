import { BedrockAgentCoreClient, GetWorkloadAccessTokenCommand } from "@aws-sdk/client-bedrock-agentcore";
import { MCPClient } from "@mastra/mcp";
import { withAccessToken } from "bedrock-agentcore/identity";

// Every tool but the local filesystem runs behind the AgentCore gateway; the
// stack sets its MCP URL and the targets of this agent's tools
const GATEWAY_URL = requiredEnv("RESEARCH_GATEWAY_URL");
const GATEWAY_TARGETS = requiredEnv("RESEARCH_GATEWAY_TARGETS").split(",");
// The gateway takes a Cognito token, fetched machine-to-machine through
// AgentCore Identity as a workload identity the stack creates (the runtime
// passes its own only to callers that name a user)
const GATEWAY_WORKLOAD = requiredEnv("RESEARCH_GATEWAY_WORKLOAD");
const GATEWAY_CREDENTIAL_PROVIDER = requiredEnv("RESEARCH_GATEWAY_CREDENTIAL_PROVIDER");
const GATEWAY_SCOPES = requiredEnv("RESEARCH_GATEWAY_SCOPES").split(",");
// Mastra names a server's tool "<server>_<tool>"; the gateway names it "<target>___<tool>"
const SERVER_NAME = "gateway";
const TARGET_SEPARATOR = "___";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: the stack sets it for the gateway`);
  return value;
}

const agentCore = new BedrockAgentCoreClient({});
let gatewayToken = "";

const gateway = new MCPClient({
  id: "research-gateway",
  servers: {
    [SERVER_NAME]: {
      url: new URL(GATEWAY_URL),
      // Reads the token on every request, so a renewed one is used at once
      fetch: (url, init) => {
        const headers = new Headers(init?.headers);
        headers.set("Authorization", `Bearer ${gatewayToken}`);
        return fetch(url, { ...init, headers });
      },
    },
  },
});

/** Renews the gateway token; called on each invocation, before the tools are used. */
export async function refreshGatewayToken(): Promise<void> {
  const { workloadAccessToken } = await agentCore.send(
    new GetWorkloadAccessTokenCommand({ workloadName: GATEWAY_WORKLOAD })
  );
  if (!workloadAccessToken) throw new Error(`No workload access token for ${GATEWAY_WORKLOAD}`);

  gatewayToken = await withAccessToken({
    providerName: GATEWAY_CREDENTIAL_PROVIDER,
    scopes: GATEWAY_SCOPES,
    authFlow: "M2M",
    workloadIdentityToken: workloadAccessToken,
  })(async (token: string) => token)();
}

let tools: Awaited<ReturnType<MCPClient["listTools"]>> | undefined;

/**
 * The tools of this agent's gateway targets. The gateway may serve other
 * agents' targets too, which this agent leaves out.
 */
export async function listGatewayTools() {
  tools ??= Object.fromEntries(
    Object.entries(await gateway.listTools()).filter(([name]) => {
      const target = name.slice(`${SERVER_NAME}_`.length).split(TARGET_SEPARATOR)[0];
      return GATEWAY_TARGETS.includes(target);
    })
  );
  return tools;
}
