// Fetches a web page and returns the start of its text content
export async function fetchAndSummarize({
  url,
  maxChars = 5000,
}: {
  url: string;
  maxChars?: number;
}) {
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
}
