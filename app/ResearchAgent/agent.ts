import { BedrockAgentCoreApp } from "bedrock-agentcore/runtime";
import { mastra } from "./src/mastra/index.js";
import { refreshGatewayToken } from "./src/mastra/mcp/gateway.js";

const app = new BedrockAgentCoreApp({
  invocationHandler: {
    async *process(payload, context) {
      const { prompt } = payload as { prompt: string };
      await refreshGatewayToken();

      const agent = mastra.getAgentById("smart-research-agent");
      const result = await agent.generate(prompt, {
        runId: context?.sessionId,
      });

      yield { data: result.text };
    },
  },
});

app.run({ port: parseInt(process.env.PORT ?? "8080") });
