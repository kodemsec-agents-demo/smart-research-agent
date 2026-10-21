import { BedrockAgentCoreApp } from "bedrock-agentcore/runtime";
import { mastra } from "./src/mastra/index.js";

const app = new BedrockAgentCoreApp({
  invocationHandler: {
    process: async (payload, context) => {
      const { prompt } = payload as { prompt: string };

      const agent = mastra.getAgentById("smart-research-agent");
      const response = await agent.generate(prompt, {
        runId: context.sessionId,
      });

      return response.text;
    },
  },
});

app.run();
