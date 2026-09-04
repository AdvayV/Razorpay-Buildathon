# Revenue Pilot

An explainable agentic storefront for the Razorpay Buildathon. A buyer describes what they need, the agent recommends a bounded cart, allows multi-agent bargaining, and only an explicit approval can create a Razorpay test-mode payment link.

**Live demo:** [razorpay-buildathon-theta.vercel.app](https://razorpay-buildathon-theta.vercel.app)

The public deployment runs in safe mock-payment mode, so judges can test recommendation, approval, checkout, audit and graceful failure flows without credentials or real money.

## What the MVP proves

- **Hybrid Neuro-Symbolic Agent**: Groq LPU (`llama-3.1-8b-instant`) intent parsing with economical token management and local deterministic fallback.
- **Multi-Agent Negotiation**: Buyer Agent and Merchant Margin Sentinel autonomously negotiate volume/clearance discounts with dynamic voucher generation.
- **Dedicated Transaction Reasoning Trail**: Step-by-step causal lineage for every transaction in the sidebar.
- **Agent-readable catalog and natural-language product discovery**.
- **Explainable demand-aware ranking** with rising, stable and falling signals.
- **Agent-readable Amazon, Flipkart, direct-brand and local landed-cost comparison**.
- **Revenue growth through a budget-aware cross-sell**.
- **Human approval gate** before every money action.
- **Server-side catalog pricing, quantity rules and a ₹10,000 hard limit**.
- **Razorpay's hosted MCP server** using `create_payment_link`.
- **HMAC-SHA256 webhook verification** and duplicate-event protection.
- **Dual-mode sidebar**: Switch between the Transaction Story and the Raw Audit Stream.

## Run it now

Node.js 22 is already available on this machine. Docker is not required.

```powershell
npm.cmd install
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000). The default behavior is mock mode, so the complete local demo works without credentials or real money.

## Connect Groq API (Optional)

1. Open `.env.local`
2. Add your Groq API key:
   ```env
   GROQ_API_KEY=gsk_your_groq_api_key_here
   GROQ_MODEL=llama-3.1-8b-instant
   ```
3. Restart `npm.cmd run dev`.

The system includes:
- Ultra-fast sub-second inference using `llama-3.1-8b-instant`.
- In-memory 10-minute caching to eliminate duplicate token burn.
- Throttling guards to prevent 429 rate limit spikes.
- Automatic fallback to the local deterministic rule engine if no key is present or if rate-limited.

## Connect Razorpay test mode

1. Copy `.env.example` to `.env.local`.
2. In the Razorpay Dashboard, switch to **Test Mode** and open **Account & Settings → API Keys**.
3. Paste only test values into `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
4. Set `PAYMENTS_MOCK_MODE=false`.
5. Restart `npm.cmd run dev`.

The backend derives a temporary Basic merchant token and connects directly to `https://mcp.razorpay.com/mcp`. Credentials remain server-side. Never commit `.env.local`.
