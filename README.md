# Commergent

A Razorpay Buildathon storefront that turns a household shopping request into an explainable basket. It ranks products against a local catalog, estimates when each pack will run out, and shows how a negotiated discount affects the total. The buyer reviews and approves a one-time checkout.

[Hosted demo](https://razorpay-buildathon-theta.vercel.app) · [Walkthrough and decision flow](FLOW_OF_EVENTS.md)

## What the demo shows

| Feature | Behavior |
| --- | --- |
| Basket recommendations | Groq can parse intent when configured. The built-in parser provides a credential-free fallback. |
| Household estimates | Pack size, per-person serving size, and frequency determine estimated usage and a stock-review date. Download the reminder as an .ics calendar file. |
| Retailer comparison | Prices, fees, stock, delivery times, and demand signals are simulated scenarios. The comparison displays hypothetical price-match opportunities. |
| Negotiated discounts | The server evaluates margins and signs a short-lived offer bound to the checkout action and basket. |
| Checkout | The buyer explicitly approves one order. The server applies catalog prices, validates the voucher, and enforces a ₹10,000 transaction ceiling. Mock mode opens a local payment simulator. Test mode can request a one-time Razorpay payment link through Hosted MCP. |

The stock-review reminder requires the buyer to place a new order. Checkout pricing uses the server catalog and any validated negotiated discount.

## Two-minute walkthrough

1. Enter “Coffee and breakfast for a two-member household having two cups daily under ₹750.”
2. Review the household usage assumptions and adjust members or servings. Download the stock-review reminder.
3. Compare the landed costs from the simulated retailer scenarios. Inspect the separate item, delivery, and handling components.
4. Request a 10% bundle discount and read the merchant's margin-based decision. Review the total and approve a one-time checkout in mock mode.
5. Open the mock payment screen and inspect the decision trail. Use **Test graceful MCP failure** to demonstrate the error path.

## Run locally

Requires Node.js 24, npm, and Git. The default mock flow runs with zero payment or model credentials.

```bash
git clone https://github.com/AdvayV/Razorpay-Buildathon.git
cd Razorpay-Buildathon
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). For local development leave `PAYMENTS_MOCK_MODE` enabled. See [the environment template](.env.example) for optional Groq or Telegram settings. The Razorpay sandbox path requires test credentials and a separate deal signing secret. Use a dedicated webhook secret to exercise webhook signature verification.

```bash
npm run lint
npm run build
npm run typecheck
```

The build generates Next.js route types before the standalone TypeScript check.

## Repository guide

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Storefront, recommendations, landed-cost comparison, and decision trail |
| `lib/consumption-engine.ts` | Household usage and restock estimates |
| `lib/market-comparison.ts` and `lib/quick-commerce.ts` | Simulated retailer offers |
| `lib/negotiation.ts` and `lib/deal-passport.ts` | Margin checks and signed, cart-bound deals |
| `app/api/checkout/route.ts` and `lib/policy.ts` | Approval and server-side pricing gates |
| `app/api/replenishment/calendar/route.ts` | Stock-review calendar export |
| `app/api/webhooks/razorpay/route.ts` | Signature validation and event handling |
| `lib/audit.ts` | Process-local demo audit events and duplicate tracking |

The public-facing flow is a buildathon prototype. Audit entries, duplicate webhook tracking, and checkout results are stored in memory. A deployment that handles real payments needs durable, atomic idempotency and persistent audit records.
