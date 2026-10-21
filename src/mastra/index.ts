import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { researchAgent } from "./agents/research-agent.js";

export const mastra = new Mastra({
  agents: { researchAgent },
  logger: new PinoLogger({
    name: "SmartResearchAgent",
    level: "info",
  }),
});
