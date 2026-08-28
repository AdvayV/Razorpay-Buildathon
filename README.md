# Revenue Pilot

An explainable agentic storefront for the Razorpay Buildathon. A buyer describes what they need, the agent recommends a bounded cart, and only an explicit approval can create a Razorpay test-mode payment link.

## What the MVP proves

- Agent-readable catalog and natural-language product discovery
- Revenue growth through a budget-aware cross-sell
- A human approval gate before every money action
- Server-side catalog pricing, quantity rules and a ₹10,000 hard limit
- Razorpay's hosted MCP server using `create_payment_link`
- HMAC-SHA256 webhook verification and duplicate-event protection
- A visible audit trail explaining recommendations, gates and outcomes
- A graceful MCP failure demo where no payment link is issued

## Run it now

Node.js 22 is already available on this machine. Docker is not required.

```powershell
npm.cmd install
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000). The default behavior is mock mode, so the complete local demo works without credentials or real money.

## Connect Razorpay test mode

1. Copy `.env.example` to `.env.local`.
2. In the Razorpay Dashboard, switch to **Test Mode** and open **Account & Settings → API Keys**.
3. Paste only test values into `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
4. Set `PAYMENTS_MOCK_MODE=false`.
5. Restart `npm.cmd run dev`.

The backend derives a temporary Basic merchant token and connects directly to `https://mcp.razorpay.com/mcp`. Credentials remain server-side. Never commit `.env.local`.

## Enable the webhook

The endpoint is:

```text
POST https://YOUR-PUBLIC-HOST/api/webhooks/razorpay
```

Configure it in **Razorpay Dashboard → Accounts & Settings → Webhooks** while the Dashboard is in Test Mode:

1. Enter the public HTTPS endpoint. Razorpay cannot call `localhost` directly.
2. Create a webhook secret that is different from your API secret.
3. Store that same value as `RAZORPAY_WEBHOOK_SECRET`.
4. Enable at least `payment_link.paid` and `payment.failed`.
5. Use test-mode OTP `754081` if Razorpay asks for one.

For a local webhook demo, expose the app with a supported tunnel such as zrok, then use its HTTPS URL. The webhook route validates the signature against the untouched request body, recognizes duplicate `x-razorpay-event-id` values, and responds quickly.

## Enable Telegram merchant alerts

1. Create a bot using the official `@BotFather` and send `/start` to the new bot.
2. Put the private bot token and numeric chat ID in `.env.local`.
3. Set `TELEGRAM_NOTIFICATIONS=true` and restart the app.

```env
TELEGRAM_BOT_TOKEN=123456789:replace_with_your_token
TELEGRAM_CHAT_ID=123456789
TELEGRAM_NOTIFICATIONS=true
```

The app sends server-side alerts for created payment links, verified Razorpay events, demo payment results and safely stopped checkouts. Telegram delivery runs after the payment response and cannot expose the token to the browser.

## Architecture

```text
Buyer request
    ↓
Recommendation agent ───→ explainable cart + cross-sell
    ↓                              ↓
Explicit approval          live audit trail
    ↓                              ↑
Server policy gate ────────────────┤
    ↓                              │
Razorpay hosted MCP                │
    ↓                              │
Test payment link                  │
    ↓                              │
Signed Razorpay webhook ───────────┘
```

The MCP server performs the outbound Razorpay action. The webhook independently confirms what happened afterward; a browser redirect is not trusted as payment proof.

## Two-minute judge demo

1. Enter: “I need a focused morning routine under ₹2,500.”
2. Show the four-step **Understand → Rank → Grow → Gate** decision trace.
3. Point out the cross-sell amount and percentage revenue uplift, then the three active safety boundaries.
4. Click **Approve & create payment link** and complete the mock/test checkout.
5. Return to show the success event in the audit trail.
6. Click **Test graceful MCP failure** and show that the agent reports no charge and records the failure.

## Useful commands

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

The project scripts launch Node with the Windows system certificate store. This is required on the current development network and keeps Razorpay MCP TLS verification enabled.

Official references: [Razorpay MCP server](https://github.com/razorpay/razorpay-mcp-server), [Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/), and [webhook setup](https://razorpay.com/docs/webhooks/setup-edit-payments/).
