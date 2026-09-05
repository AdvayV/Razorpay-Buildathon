import "server-only";

// Optional intent parsing with rate protection and deterministic local fallback.

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GroqParseResult = {
  inferredTags: string[];
  budgetPaise: number | null;
  explanation: string;
  suggestedAddonCategory?: string;
  source: "groq-llm" | "deterministic-fallback";
};

// In-memory cache to prevent duplicate LLM calls and conserve rate limits / tokens
const queryCache = new Map<string, { result: GroqParseResult; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Throttling guard to prevent rapid burst rate limits
let lastRequestTimestamp = 0;
const MIN_REQUEST_INTERVAL_MS = 500;

function getApiKey(): string | null {
  return process.env.GROQ_API_KEY || null;
}

export function isGroqConfigured(): boolean {
  return !!getApiKey();
}

export async function parseQueryWithGroq(
  userQuery: string,
  availableTags: string[],
): Promise<GroqParseResult> {
  const normalizedQuery = userQuery.trim().toLowerCase();
  const apiKey = getApiKey();

  // 1. Check in-memory cache
  const cached = queryCache.get(normalizedQuery);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached.result, source: "groq-llm" };
  }

  // 2. If no API key configured, use local fallback immediately
  if (!apiKey) {
    return {
      inferredTags: [],
      budgetPaise: null,
      explanation: "",
      source: "deterministic-fallback",
    };
  }

  // 3. Rate-limit throttle guard
  const now = Date.now();
  if (now - lastRequestTimestamp < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - (now - lastRequestTimestamp)));
  }
  lastRequestTimestamp = Date.now();

  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const endpoint = process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions";

  const systemPrompt = `You are the shopping intent parser for an Indian e-commerce store.
Available catalog tags: [${availableTags.join(", ")}].
Extract:
1. inferredTags: list of matching available tags from the list that best match user needs.
2. budgetPaise: integer in paise (e.g. Rs 1000 = 100000 paise). null if not mentioned.
3. explanation: 1-2 sentence buyer-friendly summary of why these tags/products fit.
4. suggestedAddonCategory: optional related category to cross-sell.
Respond ONLY with valid JSON in this structure:
{"inferredTags": ["string"], "budgetPaise": number|null, "explanation": "string", "suggestedAddonCategory": "string"}`;

  const messages: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Buyer request: "${userQuery.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]").replace(/(?:\+91[-\s]?)?[6-9]\d{9}/g, "[phone]")}"` },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout for instant Groq LPU response

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1, // Low temperature for deterministic, structured output
        max_completion_tokens: 700,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const providerError = (await response.text()).slice(0, 500);
      console.warn(`Groq API responded with status ${response.status}. Falling back to local rules. ${providerError}`);
      return {
        inferredTags: [],
        budgetPaise: null,
        explanation: "",
        source: "deterministic-fallback",
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from Groq API");

    const parsed = JSON.parse(content) as {
      inferredTags?: string[];
      budgetPaise?: number | null;
      explanation?: string;
      suggestedAddonCategory?: string;
    };

    const result: GroqParseResult = {
      inferredTags: Array.isArray(parsed.inferredTags)
        ? parsed.inferredTags.filter((t) => availableTags.includes(t))
        : [],
      budgetPaise: typeof parsed.budgetPaise === "number" ? Math.round(parsed.budgetPaise) : null,
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
      suggestedAddonCategory: parsed.suggestedAddonCategory,
      source: "groq-llm",
    };

    // Store in cache
    queryCache.set(normalizedQuery, { result, timestamp: Date.now() });
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn("Groq API call failed or timed out. Falling back to local deterministic engine:", error);
    return {
      inferredTags: [],
      budgetPaise: null,
      explanation: "",
      source: "deterministic-fallback",
    };
  }
}
