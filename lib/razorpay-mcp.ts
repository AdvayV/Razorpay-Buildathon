import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

type ToolSchema = {
  name: string;
  inputSchema?: { properties?: Record<string, unknown>; required?: string[] };
};

function merchantToken() {
  if (process.env.RAZORPAY_MERCHANT_TOKEN) return process.env.RAZORPAY_MERCHANT_TOKEN;
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) return null;
  return Buffer.from(`${key}:${secret}`).toString("base64");
}

function readTextContent(content: unknown) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((part): part is { type: "text"; text: string } => {
      if (!part || typeof part !== "object") return false;
      const value = part as { type?: unknown; text?: unknown };
      return value.type === "text" && typeof value.text === "string";
    })
    .map((part) => part.text)
    .join("\n");
}

function findValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  if (!Array.isArray(value) && key in value) return (value as Record<string, unknown>)[key];
  for (const child of Object.values(value)) {
    const found = findValue(child, key);
    if (found !== undefined) return found;
  }
}

function paymentLinkArguments(tool: ToolSchema, input: PaymentLinkInput) {
  const expiresAt = Math.floor(Date.now() / 1000) + 20 * 60;
  const candidates: Record<string, unknown> = {
    amount: input.amountPaise,
    currency: "INR",
    description: input.description.slice(0, 255),
    reference_id: input.referenceId.slice(0, 40),
    expire_by: expiresAt,
    customer_name: input.customer?.name,
    customer_email: input.customer?.email,
    customer_contact: input.customer?.contact,
    notify_sms: false,
    notify_email: false,
    reminder_enable: false,
    notes: { action_id: input.actionId, source: "revenue-pilot-agent" },
  };
  const properties = tool.inputSchema?.properties;
  const args = properties
    ? Object.fromEntries(Object.entries(candidates).filter(([key, value]) => key in properties && value !== undefined))
    : candidates;

  for (const key of tool.inputSchema?.required ?? []) {
    if (args[key] === undefined) throw new Error(`Razorpay MCP requires an unsupported field: ${key}`);
  }
  return args;
}

export type PaymentLinkInput = {
  actionId: string;
  amountPaise: number;
  description: string;
  referenceId: string;
  customer?: { name?: string; email?: string; contact?: string };
};

export async function createPaymentLinkWithMcp(input: PaymentLinkInput) {
  const token = merchantToken();
  if (!token) throw new Error("Razorpay test credentials are not configured.");

  const client = new Client({ name: "revenue-pilot", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(process.env.RAZORPAY_MCP_URL ?? "https://mcp.razorpay.com/mcp"),
    { requestInit: { headers: { Authorization: `Basic ${token}` } } },
  );

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const tool = tools.find((candidate) => candidate.name === "create_payment_link") as ToolSchema | undefined;
    if (!tool) throw new Error("The Razorpay MCP server did not expose create_payment_link.");

    const result = await client.callTool({
      name: tool.name,
      arguments: paymentLinkArguments(tool, input),
    });
    const text = readTextContent(result.content);
    if (result.isError) throw new Error(text || "Razorpay MCP rejected the payment link request.");

    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {
      // Some MCP servers return a human-readable response rather than raw JSON.
    }
    const shortUrl = findValue(payload, "short_url");
    const id = findValue(payload, "id");
    if (typeof shortUrl !== "string") throw new Error("Razorpay MCP returned no checkout URL.");
    return { url: shortUrl, paymentLinkId: typeof id === "string" ? id : undefined, provider: "razorpay-mcp" as const };
  } finally {
    await client.close().catch(() => undefined);
  }
}
