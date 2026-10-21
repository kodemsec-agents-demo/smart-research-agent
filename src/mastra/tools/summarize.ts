import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const fetchAndSummarizeTool = createTool({
  id: "fetch-and-summarize",
  description:
    "Fetch a web page by URL and return the first N characters of its text content. Useful for reading articles, documentation, or any publicly accessible page.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to fetch"),
    maxChars: z
      .number()
      .min(100)
      .max(50000)
      .default(5000)
      .describe("Maximum characters of page text to return"),
  }),
  outputSchema: z.object({
    url: z.string(),
    title: z.string(),
    text: z.string(),
    truncated: z.boolean(),
  }),
  execute: async ({ url, maxChars }) => {
    const res = await fetch(url, {
      headers: { "User-Agent": "SmartResearchAgent/1.0" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return {
        url,
        title: "",
        text: `HTTP ${res.status}: ${res.statusText}`,
        truncated: false,
      };
    }

    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? "";

    // Strip HTML tags and collapse whitespace for a rough text extraction
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const truncated = text.length > maxChars;
    return {
      url,
      title,
      text: text.slice(0, maxChars),
      truncated,
    };
  },
});
