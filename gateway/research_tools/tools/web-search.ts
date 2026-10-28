import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const webSearchTool = createTool({
  id: "web-search",
  description:
    "Search the web for current information on a topic. Returns a list of relevant results with titles, snippets, and URLs.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    maxResults: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Maximum number of results to return"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      })
    ),
  }),
  execute: async ({ query, maxResults }) => {
    const endpoint = process.env.SEARCH_API_ENDPOINT ?? "https://api.search.brave.com/res/v1/web/search";
    const apiKey = process.env.SEARCH_API_KEY ?? "";

    const url = new URL(endpoint);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(maxResults));

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!res.ok) {
      return {
        results: [
          {
            title: "Search unavailable",
            url: "",
            snippet: `Search API returned ${res.status}: ${res.statusText}`,
          },
        ],
      };
    }

    const data = (await res.json()) as {
      web?: { results?: Array<{ title: string; url: string; description: string }> };
    };

    const results = (data.web?.results ?? []).slice(0, maxResults).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }));

    return { results };
  },
});
