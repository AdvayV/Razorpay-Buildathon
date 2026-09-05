# Revenue Pilot

**An Explainable, Policy-Guarded Agentic Storefront for the Razorpay Buildathon**

A buyer describes what they need in natural language, the agent estimates household consumption, explores clearly labelled Quick-Commerce cost scenarios, negotiates a cart-bound signed deal within protected merchant economics, and only creates a **one-time Razorpay Hosted MCP payment link** after explicit approval.

**Live Demo:** [razorpay-buildathon-theta.vercel.app](https://razorpay-buildathon-theta.vercel.app)

> [!NOTE]
> The public deployment runs in safe **Mock Mode by default**, allowing judges and reviewers to test all recommendation, negotiation, consumption modeling, quick-commerce arbitrage, checkout, webhook verification, and audit flows with **zero credentials and zero real-money risk**.

---

## What Makes Revenue Pilot Different

Most e-commerce "AI chatbots" are simple search wrappers that hallucinate prices or blindly pass unverified totals to checkout. **Revenue Pilot** is a complete **Neuro-Symbolic Agentic Commerce Architecture**:

```
Buyer Natural Request
        ↓
Optional Groq Intent Parser (openai/gpt-oss-20b; contact text redacted)
        ↓
Deterministic Scoring Engine (4pts Intent + Demand Adjustment)
        ↓
Household Consumption Engine (Burn rate & pack lifespan calculation)
        ↓
Simulated Quick-Commerce Scenarios (illustrative landed costs)
        ↓
Multi-Agent Negotiation Loop (Buyer Agent ↔ Merchant Margin Sentinel)
        ↓
Server Policy Sentinel (5 Non-negotiable security gates, ₹10k hard limit)
        ↓
Explicit Buyer 1-Click Approval Gate
        ↓
Razorpay Hosted MCP (create_payment_link)
        ↓
HMAC-SHA256 Signed Webhook Verification & 7-Step Causal Audit Trail
```

---

## Core Capabilities & Features

### 1. Intelligent Household Consumption & Serving Engine (`lib/consumption-engine.ts`)
* **Editable Planning Assumptions:**
  * **Coffee:** 10g per cup (SCA standard 1:16 brew ratio).
  * **Tea:** 2.5g CTC/Masala Chai per cup.
  * **Sunscreen:** 1.5ml per application (Dermatological 2-finger rule).
  * **Facial Cleanser:** 1.2ml per pump twice daily.
  * **Rice & Grains:** 85g raw grain per meal per adult (ICMR standards).
  * **Cooking Oil:** 25ml per adult daily.
* **Dynamic Restock Planning:** Computes an illustrative daily burn rate ($\text{Serving Size} \times \text{Servings/Day} \times \text{Family Members}$), pack lifespan, and a stock-review date with a safety buffer.
* **Interactive Household Simulator:** Buyers can dynamically adjust family size (1 to 5+ members) and daily usage frequency directly on the storefront.

### 2. Simulated Quick-Commerce Scenario Explorer (`lib/quick-commerce.ts`)
* **Honest Source Labelling:** Side-by-side illustrative scenarios across **Local Store, BigBasket, Blinkit, Zepto, and Amazon Fresh**; the UI explicitly states that no retailer API is queried.
* **Fee Breakdown:** Models item price, delivery fees, handling, and landed total without using those estimates to alter checkout pricing.
* **Reviewable Opportunity:** A lower competitor scenario is shown as a merchant price-match opportunity, never as an automatically applied discount.

### 3. Multi-Agent Negotiation & Dynamic Discounting (`lib/negotiation.ts`)
* **Autonomous Bargaining:** Buyers can request bundle deals (e.g., *"Can I get 10% off?"* or *"Give for ₹900"*).
* **Merchant Margin Sentinel:** Evaluates unit gross margins and inventory demand signals (higher discount flexibility on falling-demand stock; protected margins on rising-demand items).
* **Signed Deal Passports:** HMAC-signs the action ID, exact cart fingerprint, discount and expiry. Checkout rejects altered or expired deals. In-memory state means this demo does not claim durable single-use enforcement.
* **Agent Dialogue:** Displays the deterministic negotiation exchange between `Buyer Agent` and `Merchant Sentinel`.

### 4. Safe Replenishment Reminder (`app/api/replenishment/calendar/route.ts`)
* Downloads a real `.ics` stock-review event from the editable household estimate.
* The reminder creates no mandate, subscription, order or payment. Checkout remains a one-time Razorpay test payment link.

### 5. Dedicated 7-Step Transaction Reasoning Trail (`app/page.tsx`)
* Dual-mode sidebar displaying:
  1. **01 / Intent & Household Context** (Groq LPU parsed family size and daily servings).
  2. **02 / Relevance & Demand** (4pts intent tag + demand adjustment).
  3. **03 / Consumption & Restock Cadence** (Burn rate calculation & pack lifespan).
  4. **04 / Quick-Commerce Price Radar** (BigBasket/Blinkit landed-cost arbitrage).
  5. **05 / Negotiated Deal** (Multi-agent dynamic discount voucher).
  6. **06 / Server Policy Sentinel** (5 server-enforced safety gates).
  7. **07 / Razorpay MCP Tool Call** (one-time payment link after approval).

### 6. Strict Server-Side Policy & Safety Sentinel (`lib/policy.ts`)
* **Catalog Price Authority:** LLMs never set or modify prices; checkout amounts are computed strictly server-side.
* **₹10,000 Hard Transaction Ceiling:** Any cart exceeding ₹10,000 is automatically blocked.
* **Quantity Bounds:** Strict limit of 1–3 units per item and max 5 unique lines per transaction.
* **HMAC-SHA256 Webhooks:** Cryptographically verified webhook verification (`timingSafeEqual`) and duplicate event suppression (`x-razorpay-event-id`).

---

## Architecture Diagram

```mermaid
flowchart TD
    Buyer([Buyer Input / Prompt]) --> UI[Next.js 16 App Router Frontend]
    UI --> RecommendAPI[/api/agent/recommend]

    subgraph IntelligenceLayer [Intelligence & Profiling Layer]
        RecommendAPI --> Groq[Optional Groq: openai/gpt-oss-20b]
        Groq --> IntentParser[Intent & Family Context Extraction]
        IntentParser --> Fallback[Deterministic Rules Fallback]
    end

    subgraph CommerceEngines [Deterministic Commerce Engines]
        IntentParser --> Scoring[Demand-Aware Scoring: 4pts Tag + Boost]
        Scoring --> Consumption[Consumption Engine: Burn Rate & Restock Cadence]
        Consumption --> QCRadar[Quick-Commerce Radar: Landed Cost vs BigBasket/Zepto]
        QCRadar --> Upsell[Budget-Aware Cross-Sell Bundler]
    end

    subgraph NegotiationLayer [Multi-Agent Negotiation]
        UI --> NegotiateAPI[/api/agent/negotiate]
        NegotiateAPI --> BuyerAgent[Buyer Persona Agent]
        BuyerAgent <--> MerchantSentinel[Merchant Margin Sentinel]
        MerchantSentinel --> DynamicVoucher[Signed Cart-Bound Deal Passport]
    end

    Upsell --> PolicySentinel[Server Policy Sentinel: 5 Safety Gates]
    DynamicVoucher --> PolicySentinel

    PolicySentinel --> ApprovalGate{Explicit Buyer 1-Click Approval}

    subgraph ExecutionLayer [Razorpay Execution Layer]
        ApprovalGate -- Approved --> CheckoutAPI[/api/checkout]
        CheckoutAPI --> ModeCheck{PAYMENTS_MOCK_MODE?}
        ModeCheck -- false --> MCP[Razorpay Hosted MCP: create_payment_link]
        ModeCheck -- true --> MockSim[Safe Mock Screen: /demo-payment]
        MCP --> RzpCheckout[Razorpay Hosted Payment Page: rzp.io/i/...]
    end

    RzpCheckout --> WebhookAPI[/api/webhooks/razorpay]
    WebhookAPI --> SignatureCheck{HMAC-SHA256 Valid?}
    SignatureCheck -- Yes --> AuditLog[Live Audit Trail & Telegram Alert]
    SignatureCheck -- No --> Reject[401 Signature Mismatch]
```

---

## 5 Calibrated Showcase Prompts

| # | Prompt | Demonstrated Capabilities |
| :---: | :--- | :--- |
| **01** | `"Coffee and breakfast for a 2-member household having 2 cups daily under ₹750"` | ☕ **10g/cup burn rate** ($40\text{g/day} \implies 100\text{g}$ lasts ~10 days), fruit cross-sell, Quick-Commerce landed cost check. |
| **02** | `"Daily skincare routine with gentle face wash and SPF 50 sunscreen for 2 people below ₹950"` | 🧴 **1.5ml sunscreen 2-finger rule** & $1.2\text{ml}$ cleanser burn rate, BigBasket price match check. |
| **03** | `"Basmati rice, cooking oil and kitchen essentials for a family of 4 under ₹1,400"` | 🍚 **Multi-member household modeling** and a downloadable stock-review calendar reminder. |
| **04** | `"Fresh vegetables, tomatoes and fruit basket for weekly cooking under ₹900"` | 🍅 **Farm-fresh box & tomatoes** with local store ₹0 delivery winning on True Landed Cost. |
| **05** | `"Laundry detergent and daily cleaning essentials for household under ₹600"` | 🧺 **Home care & volume bargaining** with dynamic Merchant Sentinel discount vouchers. |

---

## 2-Minute Judge Walkthrough

1. **Step 1: Discover & Model Household Need**
   * Click Prompt **01** (`"Coffee and breakfast for a 2-member household having 2 cups daily under ₹750"`).
   * Notice the **Household Consumption Planner** and adjust its assumptions. Download the `.ics` stock-review reminder; it creates no payment.

2. **Step 2: Compare Quick-Commerce Landed Costs**
   * View the **Quick-Commerce Radar table**. Notice how Blinkit and Zepto add ₹25–₹35 delivery + ₹7–₹10 handling fees, making the local store cheaper on **True Landed Cost**.

3. **Step 3: Multi-Agent Bargaining**
   * In the **Multi-Agent Negotiation** box, click **🏷️ 10% Bundle Discount**.
   * Watch the `Merchant Sentinel` approve the discount based on unit gross margins and generate an active voucher code.

4. **Step 4: Signed Deal & 1-Click Checkout**
   * Inspect the signed deal’s cart binding and 15-minute expiry.
   * Click **Approve & create payment link**.

5. **Step 5: Inspect the 7-Step Transaction Reasoning Trail**
   * On the right sidebar, review the **✦ Transaction Story** explaining every rupee charged, demand signal, consumption formula, policy validation, and Razorpay MCP action.

6. **Step 6: Test Graceful Failure Handling**
   * Click **Test graceful MCP failure** to observe how policy stops execution safely without issuing charges or leaking state.

---

## Quickstart & Local Setup

Node.js 20+ is supported. Docker is not required.

```powershell
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Configuration & Environment Variables

Copy `.env.example` to `.env.local`:

```env
# Razorpay Test Mode Credentials
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
RAZORPAY_MCP_URL=https://mcp.razorpay.com/mcp

# Set to false to create real Razorpay test payment links
PAYMENTS_MOCK_MODE=true

# Groq API Configuration (Fast LPU Inference)
# Optional: falls back gracefully to local deterministic NLP if omitted
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b

# Required when PAYMENTS_MOCK_MODE=false
DEAL_SIGNING_SECRET=replace_with_a_long_random_secret

# Telegram Merchant Alerts (Optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_NOTIFICATIONS=false
```

---

## Developer CLI Tool

The project includes a guarded CLI wrapper for direct inspection of Razorpay test orders and payment links:

```powershell
npm run razorpay -- --version
npm run razorpay -- payment-links list --count 5
npm run razorpay -- orders list --count 5
```

---

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── agent/
│   │   │   ├── recommend/route.ts    # Groq intent parsing & scoring
│   │   │   ├── negotiate/route.ts    # Multi-agent dynamic bargaining
│   │   │   └── replenish/route.ts    # Household consumption calculator
│   │   ├── checkout/route.ts         # Policy sentinel & Razorpay MCP checkout
│   │   ├── replenishment/calendar/route.ts # Safe .ics stock-review reminder
│   │   ├── demo-payment/route.ts     # Safe local mock payment processor
│   │   ├── market/
│   │   │   ├── compare/route.ts      # Amazon/Flipkart market comparison JSON
│   │   │   └── quick-commerce/route.ts # BigBasket/Blinkit/Zepto landed cost API
│   │   ├── audit/route.ts            # Live audit event query stream
│   │   └── webhooks/razorpay/route.ts # HMAC-SHA256 signature verification
│   ├── demo-payment/page.tsx         # Local test payment screen
│   ├── globals.css                   # High-contrast editorial dark/light theme
│   ├── layout.tsx                    # Root layout & font definitions
│   └── page.tsx                      # Storefront, radar tables, and transaction trail
├── lib/
│   ├── agent.ts                      # Neuro-symbolic recommendation engine
│   ├── catalog.ts                    # Server-authoritative catalog & prices
│   ├── consumption-engine.ts         # Household serving & burn rate benchmarks
│   ├── demand-trends.ts              # Demand signals & Google Trends integration
│   ├── groq.ts                       # Groq LPU client with cache & throttle
│   ├── market-comparison.ts          # E-commerce marketplace landed-cost logic
│   ├── negotiation.ts                # Multi-agent bargaining & margin sentinel
│   ├── policy.ts                     # Money safety gates & ₹10,000 ceiling
│   ├── deal-passport.ts              # Cart/action/expiry-bound HMAC deals
│   ├── merchant-economics.ts         # Private demo cost and margin floors
│   ├── quick-commerce.ts             # Quick-commerce price radar & arbitrage
│   ├── razorpay-mcp.ts               # Hosted Razorpay MCP client integration
│   └── telegram.ts                   # Telegram alert dispatcher
├── scripts/
│   ├── next-with-system-ca.mjs       # CA-cert wrapped Next.js runner
│   └── razorpay-cli.mjs              # Guarded Razorpay CLI wrapper
├── .env.example                      # Documented environment template
├── package.json                      # Project scripts and dependencies
└── tsconfig.json                     # TypeScript strict configuration
```

---

## Submission Checklist

- [x] **Agentic MCP Integration:** Connects to `https://mcp.razorpay.com/mcp` using `@modelcontextprotocol/client` (`create_payment_link`).
- [x] **Zero-Credential Safe Mode:** Public demo runs in safe mock mode without leaking credentials or requiring judges to pay.
- [x] **Human Approval Gate:** Payment actions require explicit buyer 1-click authorization.
- [x] **Server Price Authority:** Server catalog and policy gates strictly govern checkout totals (₹10,000 ceiling).
- [x] **Household Consumption Planning:** Editable per-use assumptions, pack lifespan estimate and calendar reminder.
- [x] **Reality Layer:** Every source is labelled authoritative, external, local, simulated or assumed.
- [x] **Quick-Commerce Scenarios:** Illustrative landed-cost comparison that never changes checkout pricing.
- [x] **Negotiation:** Signed, cart-bound Deal Passports issued within private demo margin constraints.
- [x] **Webhook Security:** HMAC-SHA256 signature verification with duplicate event suppression.
- [x] **Live Explainability:** 7-step causal transaction reasoning trail in the sidebar.
