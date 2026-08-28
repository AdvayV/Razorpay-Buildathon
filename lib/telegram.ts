export type TelegramMessage = {
  title: string;
  lines: Array<string | undefined>;
  level?: "success" | "warning" | "error" | "info";
};

export type TelegramResult =
  | { sent: true; messageId?: number }
  | { sent: false; reason: string };

const icons = {
  success: "✅",
  warning: "⚠️",
  error: "❌",
  info: "ℹ️",
};

export function isTelegramConfigured() {
  return Boolean(
    process.env.TELEGRAM_NOTIFICATIONS === "true" &&
      process.env.TELEGRAM_BOT_TOKEN &&
      process.env.TELEGRAM_CHAT_ID,
  );
}

export async function sendTelegramMessage(message: TelegramMessage): Promise<TelegramResult> {
  if (process.env.TELEGRAM_NOTIFICATIONS !== "true") {
    return { sent: false, reason: "Telegram notifications are disabled." };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { sent: false, reason: "Telegram bot token or chat ID is missing." };
  }

  const text = [
    `${icons[message.level ?? "info"]} ${message.title}`,
    "",
    ...message.lines.filter((line): line is string => Boolean(line)),
  ].join("\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (!response.ok || !payload.ok) {
      return { sent: false, reason: payload.description ?? `Telegram returned HTTP ${response.status}.` };
    }
    return { sent: true, messageId: payload.result?.message_id };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "Telegram request failed.",
    };
  }
}
