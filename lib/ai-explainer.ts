import "server-only";

export type ExplanationNarrative = {
  text: string;
  source: "deterministic" | "hugging-face" | "deterministic-fallback";
  sourceLabel: string;
  model?: string;
  note: string;
};

type ExplanationInput = {
  deterministicText: string;
  facts: Record<string, unknown>;
};

export async function buildOptionalNarrative(input: ExplanationInput): Promise<ExplanationNarrative> {
  if (process.env.AI_EXPLANATIONS !== "true") {
    return {
      text: input.deterministicText,
      source: "deterministic",
      sourceLabel: "Local scoring engine",
      note: "Generated directly from the displayed scorecard; no external AI call was made.",
    };
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    return {
      text: input.deterministicText,
      source: "deterministic-fallback",
      sourceLabel: "Local fallback",
      note: "Hugging Face was enabled but no server-side HF_TOKEN was configured.",
    };
  }

  const model = process.env.HF_EXPLANATION_MODEL ?? "google/gemma-2-2b-it:cheapest";

  try {
    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 140,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: "You edit commerce explanations. Use only supplied facts. Write two short sentences. Never say an order, payment link, or charge exists before approval. Do not add benefits, prices, trends, or causal claims that are absent from the facts.",
          },
          {
            role: "user",
            content: `Rewrite these machine-generated facts clearly for a buyer:\n${JSON.stringify(input.facts)}`,
          },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });

    if (!response.ok) throw new Error("Hugging Face request failed.");
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim().length < 20) {
      throw new Error("Hugging Face returned no usable explanation.");
    }

    return {
      text: text.trim().slice(0, 700),
      source: "hugging-face",
      sourceLabel: "Hugging Face narrative layer",
      model,
      note: "The scorecard remains the source of truth; AI only rewrote supplied facts.",
    };
  } catch {
    return {
      text: input.deterministicText,
      source: "deterministic-fallback",
      sourceLabel: "Local fallback",
      model,
      note: "The external explainer was unavailable, so the verified local explanation was used.",
    };
  }
}
