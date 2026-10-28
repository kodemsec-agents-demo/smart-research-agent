// Searches the web through the Brave Search API
export async function webSearch({
  query,
  maxResults = 5,
}: {
  query: string;
  maxResults?: number;
}) {
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
}
