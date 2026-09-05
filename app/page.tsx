"use client";

import { useCallback, useEffect, useState } from "react";

type Item = {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  category: string;
  packSize: string;
  quantity: number;
  accent: string;
  demand: DemandSignal;
  selectionEvidence?: CandidateEvidence;
  marketComparison: MarketComparison | null;
  quickCommerce?: QuickCommerceComparison | null;
  consumptionForecast?: ConsumptionForecast | null;
};

type QuickCommercePlatform = "local-store" | "bigbasket" | "blinkit" | "zepto" | "amazon-fresh";

type PlatformOffer = {
  platformId: QuickCommercePlatform;
  platformName: string;
  itemPricePaise: number;
  deliveryFeePaise: number;
  surgeAndHandlingPaise: number;
  totalLandedCostPaise: number;
  deliveryTimeDisplay: string;
  deliveryMinutesEst: number;
  stockStatus: "in-stock" | "low-stock" | "out-of-stock";
  isCheapestLandedCost: boolean;
  isFastestDelivery: boolean;
  notes: string;
};

type QuickCommerceComparison = {
  itemId: string;
  itemName: string;
  packSize: string;
  category: string;
  asOf: string;
  sourceLabel: string;
  disclaimer: string;
  offers: PlatformOffer[];
  lowestLandedCostPlatform: string;
  lowestLandedCostPaise: number;
  localStoreLandedCostPaise: number;
  localStoreDiffPaise: number;
  priceMatchApplied: boolean;
  priceMatchDiscountPaise: number;
  priceMatchAdjustedPricePaise: number;
  arbitrageSummary: string;
};

type ConsumptionForecast = {
  itemId: string;
  itemName: string;
  packQuantityNum: number;
  packUnit: string;
  familyMembers: number;
  dailyServingsPerMember: number;
  servingSize: number;
  dailyBurnRate: number;
  daysLifespan: number;
  reorderBufferDays: number;
  recommendedReminderDays: number;
  nextDeliveryDate: string;
  nextDeliveryIso: string;
  formulaExplanation: string;
  benchmarkSource: string;
  confidence: "illustrative";
};

type MarketOffer = {
  id: string;
  channel: "local-merchant" | "amazon" | "flipkart" | "direct-brand";
  seller: string;
  itemPricePaise: number;
  shippingPaise: number;
  landedPricePaise: number;
  estimatedDeliveryDays: number;
  trustScore: number;
  availability: "in-stock" | "limited";
  checkoutEligible: boolean;
  verificationUrl?: string;
};

type MarketComparison = {
  itemId: string;
  productName: string;
  asOf: string;
  sourceLabel: string;
  disclaimer: string;
  methodology: string;
  offers: MarketOffer[];
  cheapestOfferId: string;
  fastestOfferId: string;
  mostTrustedOfferId: string;
  localMerchantOfferId: string;
  localDifferencePaise: number;
  localDeliveryAdvantageDays: number;
  insight: string;
};

type DemandSignal = {
  direction: "rising" | "stable" | "falling";
  changePercent: number;
  interestScore: number;
  sourceLabel: string;
  asOf: string;
  exploreUrl: string;
};

type CandidateEvidence = {
  itemId: string;
  name: string;
  pricePaise: number;
  matchedTags: string[];
  relevancePoints: number;
  demandDirection: "rising" | "stable" | "falling";
  demandChangePercent: number;
  demandPoints: number;
  totalScore: number;
  fitsBuyerBudget: boolean;
  outcome: "selected-primary" | "selected-add-on" | "not-selected";
  reason: string;
  scoreGapToWinner: number;
  rejectionCategory: "over-full-budget" | "over-remaining-budget" | "incompatible-tags" | "lower-ranked" | null;
};

type NegotiationResult = {
  status: "accepted" | "counter-offered" | "rejected";
  originalTotalPaise: number;
  finalTotalPaise: number;
  discountPaise: number;
  discountPercent: number;
  voucher?: {
    code: string;
    discountPaise: number;
    discountPercent: number;
    reason: string;
    expiresAt: number;
    passport: string;
    securityMode: "configured-hmac" | "demo-hmac";
  };
  merchantRationale: string;
  agentDialogue: Array<{ speaker: "Buyer Agent" | "Merchant Sentinel"; message: string }>;
};

type Recommendation = {
  actionId: string;
  budgetPaise: number;
  inferredTags: string[];
  householdProfile?: {
    familyMembers: number;
    dailyServingsPerMember: number;
  };
  items: Item[];
  totalPaise: number;
  primaryRevenuePaise: number;
  incrementalRevenuePaise: number;
  upliftPercent: number;
  explanation: string;
  intelligenceSource?: "groq-llm" | "deterministic-fallback";
  provenance: Array<{ label: string; status: string; detail: string }>;
  decisionTrace: Array<{ step: string; detail: string }>;
  boundaries: string[];
  demandOverview: {
    source: "demo-snapshot";
    sourceLabel: string;
    disclaimer: string;
    topRising: { name: string; changePercent: number };
    topFalling: { name: string; changePercent: number };
  };
  decisionEvidence: {
    scoringFormula: string;
    inferredTags: string[];
    buyerBudgetPaise: number;
    remainingAfterPrimaryPaise: number;
    demandChangedPrimaryChoice: boolean;
    counterfactual: string;
    candidates: CandidateEvidence[];
    summary: {
      candidatesEvaluated: number;
      selectedCount: number;
      rejectedCount: number;
      overBudgetCount: number;
      incompatibleCount: number;
      matchedTagCount: number;
      budgetUtilizationPercent: number;
      requestedBudgetPaise: number;
      budgetWasCapped: boolean;
      budgetCapPaise: number;
      scoreLeaderMargin: number;
    };
  };
  moneyAction: {
    state: "awaiting-buyer-approval";
    proposedAction: "create_payment_link";
    statement: string;
    afterApproval: string;
  };
};

type AuditEvent = {
  id: string;
  at: string;
  type: string;
  summary: string;
  level: "info" | "success" | "warning" | "error";
  detail?: Record<string, unknown>;
};

type AuditFilter = "all" | "recommendation" | "money" | "market" | "webhook" | "system";

const samples = [
  "Coffee and breakfast for a 2-member household having 2 cups daily under ₹750",
  "Daily skincare routine with gentle face wash and SPF 50 sunscreen for 2 people below ₹950",
  "Basmati rice, cooking oil and kitchen essentials for a family of 4 under ₹1,400",
  "Fresh vegetables, tomatoes and fruit basket for weekly cooking under ₹900",
  "Laundry detergent and daily cleaning essentials for household under ₹600",
];

function demandLabel(signal: DemandSignal) {
  const arrow = signal.direction === "rising" ? "↑" : signal.direction === "falling" ? "↓" : "→";
  const change = `${signal.changePercent > 0 ? "+" : ""}${signal.changePercent}%`;
  return `${arrow} ${change} ${signal.direction}`;
}

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function auditCategory(type: string): Exclude<AuditFilter, "all"> {
  if (type.startsWith("webhook.")) return "webhook";
  if (type.startsWith("market.")) return "market";
  if (type.startsWith("money.")) return "money";
  if (type.startsWith("agent.")) return "recommendation";
  return "system";
}

export default function Home() {
  const [message, setMessage] = useState(samples[0]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("all");
  const [sidebarTab, setSidebarTab] = useState<"trail" | "audit">("trail");

  // Household planning state
  const [familyMembers, setFamilyMembers] = useState(2);
  const [dailyServings, setDailyServings] = useState(2);

  // Multi-Agent Negotiation state
  const [negotiationInput, setNegotiationInput] = useState("");
  const [negotiating, setNegotiating] = useState(false);
  const [negotiationResult, setNegotiationResult] = useState<NegotiationResult | null>(null);

  const visibleAudit = audit.filter((event) => auditFilter === "all" || auditCategory(event.type) === auditFilter);
  const auditStats = {
    decisions: audit.filter((event) => event.type === "agent.recommendation").length,
    moneyActions: audit.filter((event) => event.type.startsWith("money.")).length,
    marketComparisons: audit.filter((event) => event.type === "market.comparison_viewed").length,
    webhookAccepted: audit.filter((event) => event.type.startsWith("webhook.") && !event.type.includes("rejected") && !event.type.includes("duplicate")).length,
    webhookRejected: audit.filter((event) => event.type === "webhook.rejected").length,
    stoppedSafely: audit.filter((event) => event.type.includes("blocked") || event.type.includes("failed") || event.type.includes("rejected")).length,
  };

  const refreshAudit = useCallback(async () => {
    const response = await fetch("/api/audit", { cache: "no-store" });
    if (response.ok) setAudit(((await response.json()) as { events: AuditEvent[] }).events);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/audit", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { events: AuditEvent[] }) => {
        if (!cancelled) setAudit(data.events);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function askAgent() {
    setBusy(true);
    setNotice(null);
    setNegotiationResult(null);
    try {
      const response = await fetch("/api/agent/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const rec = data as Recommendation;
      setRecommendation(rec);
      if (rec.householdProfile) {
        setFamilyMembers(rec.householdProfile.familyMembers);
        setDailyServings(rec.householdProfile.dailyServingsPerMember);
      }
      setSidebarTab("trail");
      await refreshAudit();
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Agent unavailable." });
    } finally {
      setBusy(false);
    }
  }

  // Recalculate the planning estimate when household assumptions change
  async function updateHouseholdProfile(newMembers: number, newServings: number) {
    setFamilyMembers(newMembers);
    setDailyServings(newServings);

    if (!recommendation) return;
    const primary = recommendation.items[0];
    if (!primary) return;

    try {
      const response = await fetch("/api/agent/replenish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: primary.id,
          profile: { familyMembers: newMembers, dailyServingsPerMember: newServings },
        }),
      });
      if (response.ok) {
        const forecast = (await response.json()) as ConsumptionForecast;
        setRecommendation((prev) => {
          if (!prev) return null;
          const updatedItems = [...prev.items];
          updatedItems[0] = { ...updatedItems[0], consumptionForecast: forecast };
          return { ...prev, items: updatedItems };
        });
      }
    } catch {
      // Keep existing forecast if update fails
    }
  }

  async function handleNegotiate(customOffer?: string) {
    if (!recommendation) return;
    const offerText = customOffer || negotiationInput;
    if (!offerText.trim()) return;

    setNegotiating(true);
    try {
      const response = await fetch("/api/agent/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: recommendation.actionId,
          items: recommendation.items.map((i) => ({ itemId: i.id, quantity: i.quantity })),
          userOfferText: offerText,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNegotiationResult(data as NegotiationResult);
      await refreshAudit();
    } catch (err) {
      setNotice({ tone: "bad", text: err instanceof Error ? err.message : "Negotiation unavailable." });
    } finally {
      setNegotiating(false);
    }
  }

  async function checkout(simulateFailure = false) {
    if (!recommendation) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: simulateFailure ? `${recommendation.actionId}-failure` : recommendation.actionId,
          approved: true,
          simulateFailure,
          dealPassport: simulateFailure ? undefined : negotiationResult?.voucher?.passport,
          items: recommendation.items.map((item) => ({ itemId: item.id, quantity: item.quantity })),
        }),
      });
      const data = await response.json();
      await refreshAudit();
      if (!response.ok) throw new Error(data.error);
      if (typeof data.url === "string") window.location.assign(data.url);
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Checkout unavailable." });
    } finally {
      setBusy(false);
    }
  }

  const baseTotalPaise = recommendation?.totalPaise ?? 0;
  const negotiationDiscountPaise = negotiationResult?.discountPaise ?? 0;
  const totalDiscountPaise = negotiationDiscountPaise;
  const effectiveTotalPaise = Math.max(100, baseTotalPaise - totalDiscountPaise);

  const primaryForecast = recommendation?.items[0]?.consumptionForecast;
  const primaryQC = recommendation?.items[0]?.quickCommerce;

  return (
    <main>
      <nav className="nav shell">
        <a className="brand" href="#top" aria-label="Commergent home">
          <span className="brand-mark">C</span>
          <span>Commergent</span>
        </a>
        <div className="nav-meta">
          <span className="live-dot" /> Razorpay test mode
        </div>
      </nav>

      <section className="hero shell" id="top">
        <div className="eyebrow"><span>✦</span> AGENTIC STOREFRONT / 01</div>
        <h1>Your quietest<br />salesperson is now<br /><em>your sharpest.</em></h1>
        <p className="hero-copy">
          An explainable shopping agent that ranks products, models household use, compares transparent market scenarios, and gates Razorpay test-mode checkout.
        </p>
        <div className="proof-row">
          <div><strong>100%</strong><span>test-mode money</span></div>
          <div><strong>₹10k</strong><span>hard action limit</span></div>
          <div><strong>1-click</strong><span>buyer approval gate</span></div>
        </div>
      </section>

      <section className="workspace shell">
        <div className="agent-panel">
          <div className="panel-heading">
            <div>
              <span className="kicker">AUTONOMOUS SHOPPING AGENT</span>
              <h2>What are we shopping for?</h2>
            </div>
            <span className="status-chip"><i /> ready</span>
          </div>

          <div className="prompt-box">
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Shopping request" />
            <button className="send" onClick={askAgent} disabled={busy} aria-label="Ask shopping agent">
              {busy ? "···" : "↗"}
            </button>
          </div>
          <div className="sample-row">
            {samples.map((sample, index) => (
              <button key={sample} onClick={() => setMessage(sample)}>0{index + 1}</button>
            ))}
            <span>Try an example</span>
          </div>

          {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}

          {!recommendation ? (
            <div className="empty-state">
              <div className="orbit"><span>✦</span></div>
              <p>Your recommendation, consumption model &amp; quick-commerce radar will appear here.</p>
            </div>
          ) : (
            <div className="recommendation">
              <nav className="result-nav" aria-label="Recommendation sections">
                <a href="#cart">Cart</a><a href="#planning">Planning</a><a href="#market">Market</a><a href="#decision">Decision</a><a href="#deal">Deal</a>
              </nav>
              <section className="reality-layer" aria-label="Data provenance">
                <div className="section-intro"><span>REALITY LAYER</span><h3>Know what is real before acting.</h3></div>
                <div className="provenance-grid">
                  {recommendation.provenance.map((source) => (
                    <article key={source.label}><code>{source.status}</code><strong>{source.label}</strong><p>{source.detail}</p></article>
                  ))}
                </div>
              </section>

              <section className="demand-radar" id="planning" aria-label="Demand trend summary">
                <div>
                  <span>DEMAND RADAR / INDIA</span>
                  <strong>{recommendation.demandOverview.sourceLabel}</strong>
                </div>
                <div className="demand-movers">
                  <p><b>RISING</b>{recommendation.demandOverview.topRising.name} <em>+{recommendation.demandOverview.topRising.changePercent}%</em></p>
                  <p><b>FALLING</b>{recommendation.demandOverview.topFalling.name} <em>{recommendation.demandOverview.topFalling.changePercent}%</em></p>
                </div>
                <small>{recommendation.demandOverview.disclaimer}</small>
              </section>

              <div className="agent-said">
                <span className="mini-mark">✦</span>
                <div>
                  <b>
                    Buyer-facing explanation · {recommendation.intelligenceSource === "groq-llm" ? "Groq LPU Intelligence" : "Local scoring engine"}
                  </b>
                  <p>{recommendation.explanation}</p>
                  <small>
                    {recommendation.intelligenceSource === "groq-llm"
                      ? "Intent parsed with Groq openai/gpt-oss-20b after contact-like text is redacted; product ranking remains deterministic."
                      : "Generated directly from local deterministic scorecard."}
                  </small>
                </div>
              </div>

              {/* Editable household planning estimate */}
              {primaryForecast && (
                <section className="household-card" aria-label="Household Consumption Modeling">
                  <div className="household-header">
                    <span>HOUSEHOLD CONSUMPTION PLANNER · ILLUSTRATIVE</span>
                    <span className="household-badge">Editable Assumptions</span>
                  </div>

                  <div className="household-controls">
                    <label>
                      Family Members:
                      <select
                        value={familyMembers}
                        onChange={(e) => updateHouseholdProfile(Number(e.target.value), dailyServings)}
                      >
                        <option value={1}>1 Person (Solo)</option>
                        <option value={2}>2 Members (Couple)</option>
                        <option value={3}>3 Members (Family)</option>
                        <option value={4}>4 Members (Family of 4)</option>
                        <option value={5}>5+ Members (Joint Family)</option>
                      </select>
                    </label>

                    <label>
                      Daily Usage / Servings:
                      <select
                        value={dailyServings}
                        onChange={(e) => updateHouseholdProfile(familyMembers, Number(e.target.value))}
                      >
                        <option value={1}>1 time / cup per person daily</option>
                        <option value={2}>2 times / cups per person daily</option>
                        <option value={3}>3 times / cups per person daily</option>
                        <option value={4}>4 times / cups per person daily</option>
                      </select>
                    </label>
                  </div>

                  <div className="household-stat-row">
                    <div>
                      <strong>{primaryForecast.servingSize}{primaryForecast.packUnit}</strong>
                      <span>Serving Size</span>
                    </div>
                    <div>
                      <strong>{primaryForecast.dailyBurnRate}{primaryForecast.packUnit}/day</strong>
                      <span>Daily Burn Rate</span>
                    </div>
                    <div>
                      <strong>{primaryForecast.daysLifespan} Days</strong>
                      <span>Pack Lifespan</span>
                    </div>
                    <div>
                      <strong>Day {primaryForecast.recommendedReminderDays}</strong>
                      <span>Review Reminder</span>
                    </div>
                  </div>

                  <div className="household-formula">
                    <strong>🧮 Planning formula:</strong> {primaryForecast.formulaExplanation}
                    <small>Assumption: {primaryForecast.benchmarkSource} • Suggested review: <b>{primaryForecast.nextDeliveryDate}</b></small>
                  </div>
                  <a className="calendar-link" href={`/api/replenishment/calendar?itemId=${encodeURIComponent(primaryForecast.itemId)}&familyMembers=${familyMembers}&dailyServingsPerMember=${dailyServings}`}>
                    Add stock-review reminder to calendar (.ics) →
                  </a>
                </section>
              )}

              {/* Simulated Quick-Commerce benchmark */}
              {primaryQC && (
                <section className="qc-board" id="market" aria-label="Quick-Commerce Radar">
                  <div className="qc-heading">
                    <div>
                      <span>SIMULATED QUICK-COMMERCE SCENARIO · LANDED COST</span>
                      <h3>How does our price compare against BigBasket, Blinkit &amp; Zepto?</h3>
                    </div>
                    <code>Not live data</code>
                  </div>

                  <div className="qc-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Platform</th>
                          <th>Item Price</th>
                          <th>Delivery Fee</th>
                          <th>Surge / Handling</th>
                          <th>Landed Total</th>
                          <th>Delivery Time</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {primaryQC.offers.map((offer) => (
                          <tr key={offer.platformId} className={offer.platformId === "local-store" ? "local-row" : ""}>
                            <td>
                              <strong>{offer.platformName}</strong>
                              <div style={{ fontSize: "8px", color: "var(--muted)", marginTop: "2px" }}>{offer.notes}</div>
                            </td>
                            <td>{money(offer.itemPricePaise)}</td>
                            <td>{offer.deliveryFeePaise === 0 ? "Free" : money(offer.deliveryFeePaise)}</td>
                            <td>{offer.surgeAndHandlingPaise === 0 ? "₹0" : money(offer.surgeAndHandlingPaise)}</td>
                            <td>
                              <strong>{money(offer.totalLandedCostPaise)}</strong>
                              {offer.isCheapestLandedCost && <span className="qc-badge cheapest">Lowest Landed Cost</span>}
                            </td>
                            <td>
                              {offer.deliveryTimeDisplay}
                              {offer.isFastestDelivery && <span className="qc-badge fastest">Quick-Comm</span>}
                            </td>
                            <td>
                              <span style={{ fontSize: "8px", fontWeight: 700, color: "#36570e" }}>{offer.stockStatus}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ padding: "12px 18px", background: "#f5f9eb", borderTop: "1px solid var(--line)", fontSize: "11px", color: "#36570e" }}>
                    <strong>✦ Arbitrage Verdict:</strong> {primaryQC.arbitrageSummary}
                    <small className="source-note">{primaryQC.sourceLabel} · {primaryQC.disclaimer}</small>
                  </div>
                </section>
              )}

              <section className="reasoning-ledger" id="decision" aria-label="Recommendation evidence">
                <div className="ledger-heading">
                  <div><span>EVIDENCE LEDGER</span><h3>Why these products?</h3></div>
                  <code>{recommendation.moneyAction.state.replaceAll("-", " ")}</code>
                </div>

                <div className="formula-card">
                  <strong>Published scoring formula</strong>
                  <p>{recommendation.decisionEvidence.scoringFormula}</p>
                  <small>Detected intent: {recommendation.decisionEvidence.inferredTags.join(" · ")}</small>
                </div>

                <div className="decision-kpis" aria-label="Decision summary">
                  <div><strong>{recommendation.decisionEvidence.summary.candidatesEvaluated}</strong><span>evaluated</span></div>
                  <div><strong>{recommendation.decisionEvidence.summary.selectedCount}</strong><span>selected</span></div>
                  <div><strong>{recommendation.decisionEvidence.summary.rejectedCount}</strong><span>rejected</span></div>
                  <div><strong>{recommendation.decisionEvidence.summary.matchedTagCount}</strong><span>tags matched</span></div>
                  <div><strong>{recommendation.decisionEvidence.summary.scoreLeaderMargin}</strong><span>leader margin</span></div>
                  <div><strong>{recommendation.decisionEvidence.summary.budgetUtilizationPercent}%</strong><span>budget used</span></div>
                </div>

                <div className="selected-evidence">
                  {recommendation.items.map((item) => (
                    <article key={item.id}>
                      <span>{item.selectionEvidence?.outcome === "selected-primary" ? "PRIMARY" : "ADD-ON"}</span>
                      <strong>{item.name}</strong>
                      <div>
                        <code>{item.selectionEvidence?.relevancePoints ?? 0} relevance</code>
                        <b>+</b>
                        <code>{item.selectionEvidence?.demandPoints ?? 0} demand</code>
                        <b>=</b>
                        <code>{item.selectionEvidence?.totalScore ?? 0} total</code>
                      </div>
                      <p>{item.selectionEvidence?.reason}</p>
                    </article>
                  ))}
                </div>
              </section>

              <div className="product-grid" id="cart">
                {recommendation.items.map((item, index) => (
                  <article className={`product-card ${item.accent}`} key={item.id}>
                    <div className="product-topline">
                      <span className="product-number">0{index + 1}</span>
                      <span className={`trend-badge ${item.demand.direction}`}>{demandLabel(item.demand)}</span>
                    </div>
                    <div className="product-art"><span>{item.name.split(" ")[0]}</span></div>
                    <div className="product-copy">
                      <small>{item.category} · {item.packSize}</small>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <div className="product-price-row">
                        <strong>{money(item.pricePaise)}</strong>
                        <a href={item.demand.exploreUrl} target="_blank" rel="noreferrer">Explore trend ↗</a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Multi-Agent Dynamic Negotiation */}
              <section className="negotiation-box" id="deal" aria-label="Agent Negotiation">
                <div className="negotiation-header">
                  <span>MULTI-AGENT NEGOTIATION · DYNAMIC DISCOUNTING</span>
                  <span className="negotiation-badge">Signed Deal Passport</span>
                </div>
                <p style={{ margin: "0 0 10px", fontSize: "12px", color: "var(--muted)" }}>
                  Negotiate a bundle deal. The server checks private unit economics and binds any discount to this action, cart and 15-minute expiry.
                </p>

                <div className="negotiation-chips">
                  <button onClick={() => { setNegotiationInput("Can I get 10% off on this bundle?"); handleNegotiate("Can I get 10% off on this bundle?"); }} disabled={negotiating}>
                    🏷️ 10% Bundle Discount
                  </button>
                  <button onClick={() => { setNegotiationInput("Give for ₹900 total"); handleNegotiate("Give for ₹900 total"); }} disabled={negotiating}>
                    💰 Request ₹900 Deal
                  </button>
                  <button onClick={() => { setNegotiationInput("Clearance volume discount"); handleNegotiate("Clearance volume discount"); }} disabled={negotiating}>
                    📦 Volume Deal
                  </button>
                </div>

                <div className="negotiation-input-row">
                  <input
                    type="text"
                    placeholder="e.g. Can you do 15% discount or ₹850?"
                    value={negotiationInput}
                    onChange={(e) => setNegotiationInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleNegotiate(); }}
                    disabled={negotiating}
                  />
                  <button onClick={() => handleNegotiate()} disabled={negotiating || !negotiationInput.trim()}>
                    {negotiating ? "Evaluating..." : "Propose Offer →"}
                  </button>
                </div>

                {negotiationResult && (
                  <div className="negotiation-dialogue">
                    {negotiationResult.agentDialogue.map((item, idx) => (
                      <div key={idx} className={`dialogue-bubble ${item.speaker === "Buyer Agent" ? "buyer" : "merchant"}`}>
                        <strong>{item.speaker}</strong>
                        <p>{item.message}</p>
                      </div>
                    ))}
                    {negotiationResult.voucher && (
                      <div style={{ marginTop: "6px", padding: "8px", background: "#eef6d6", borderLeft: "3px solid #829d38", fontSize: "11px" }}>
                        <strong style={{ display: "block", color: "#446914" }}>✓ Signed deal: {negotiationResult.voucher.code}</strong>
                        <span>Saved {money(negotiationResult.discountPaise)} ({negotiationResult.discountPercent}% off). Cart-bound · expires in 15 min · {negotiationResult.voucher.securityMode}.</span>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Explicit one-time payment approval */}
              <div className="approval-box">
                <div>
                  <span>TOTAL / {recommendation.items.length} ITEMS</span>
                  <strong>{money(effectiveTotalPaise)}</strong>
                  {totalDiscountPaise > 0 ? (
                    <mark>
                      Saved {money(totalDiscountPaise)} (Base {money(baseTotalPaise)})
                    </mark>
                  ) : (
                    recommendation.incrementalRevenuePaise > 0 && (
                      <mark>+{money(recommendation.incrementalRevenuePaise)} · {recommendation.upliftPercent}% agent uplift</mark>
                    )
                  )}
                </div>

                <button className="primary" onClick={() => checkout(false)} disabled={busy}>
                  {`Approve & create payment link (${money(effectiveTotalPaise)}) →`}
                </button>
                <p>Nothing happens without this click. Server enforces policy bounds, server catalog prices, and spending limits.</p>
              </div>

              <button className="failure-button" onClick={() => checkout(true)} disabled={busy}>
                Test graceful MCP failure
              </button>
            </div>
          )}
        </div>

        <aside className="audit-panel">
          <div className="panel-heading audit-heading">
            <div><span className="kicker">AUDIT &amp; EXPLAINABILITY</span><h2>Every action, legible.</h2></div>
            <button className="refresh" onClick={refreshAudit}>↻</button>
          </div>

          <div className="trail-tabs">
            <button
              className={sidebarTab === "trail" ? "active" : ""}
              onClick={() => setSidebarTab("trail")}
            >
              ✦ Transaction Story
            </button>
            <button
              className={sidebarTab === "audit" ? "active" : ""}
              onClick={() => setSidebarTab("audit")}
            >
              ⚡ Raw Audit Log
            </button>
          </div>

          {sidebarTab === "trail" ? (
            <div className="trail-chain">
              <div className="boundary-card">
                <span className="shield">◇</span>
                <div>
                  <strong>Why does every action happen?</strong>
                  <p>Step-by-step causal lineage for the current transaction.</p>
                </div>
              </div>

              {recommendation ? (
                <>
                  <div className="trail-node passed">
                    <div className="trail-node-header">
                      <span>01 / INTENT &amp; HOUSEHOLD CONTEXT</span>
                      <code>{recommendation.intelligenceSource === "groq-llm" ? "Groq LLM" : "Local Parser"}</code>
                    </div>
                    <strong>Parsed buyer query &amp; family context</strong>
                    <p>Detected {familyMembers}-member household with {dailyServings} servings/day. Budget cap: {money(recommendation.budgetPaise)}.</p>
                  </div>

                  <div className="trail-node passed">
                    <div className="trail-node-header">
                      <span>02 / RELEVANCE &amp; DEMAND</span>
                      <code>Ranked 1st</code>
                    </div>
                    <strong>{recommendation.items[0]?.name}</strong>
                    <p>
                      Scored {recommendation.items[0]?.selectionEvidence?.totalScore} pts ({recommendation.items[0]?.selectionEvidence?.relevancePoints} relevance + {recommendation.items[0]?.selectionEvidence?.demandPoints} demand). Defeated {recommendation.decisionEvidence.summary.rejectedCount} alternatives.
                    </p>
                  </div>

                  {primaryForecast && (
                    <div className="trail-node passed">
                      <div className="trail-node-header">
                        <span>03 / CONSUMPTION PLANNING</span>
                        <code>{primaryForecast.daysLifespan} Day Lifespan</code>
                      </div>
                      <strong>Illustrative Burn Rate: {primaryForecast.dailyBurnRate}{primaryForecast.packUnit}/day</strong>
                      <p>
                        {primaryForecast.formulaExplanation}
                      </p>
                    </div>
                  )}

                  {primaryQC && (
                    <div className="trail-node passed">
                      <div className="trail-node-header">
                        <span>04 / SIMULATED MARKET SCENARIO</span>
                        <code>Demo Benchmark</code>
                      </div>
                      <strong>Illustrative BigBasket, Blinkit &amp; Zepto comparison</strong>
                      <p>
                        {primaryQC.arbitrageSummary}
                      </p>
                    </div>
                  )}

                  {negotiationResult?.voucher && (
                    <div className="trail-node passed">
                      <div className="trail-node-header">
                        <span>05 / NEGOTIATED DEAL</span>
                        <code>{negotiationResult.voucher.code}</code>
                      </div>
                      <strong>Signed Deal Passport Approved {negotiationResult.discountPercent}% Off</strong>
                      <p>
                        Private economics validated; the discount is signed and bound to this exact cart and action.
                      </p>
                    </div>
                  )}

                  <div className="trail-node passed">
                    <div className="trail-node-header">
                      <span>06 / SERVER POLICY SENTINEL</span>
                      <code>Strict Policy</code>
                    </div>
                    <strong>5 Security Gates Enforced</strong>
                    <p>
                      Server-authoritative catalog pricing, quantity limits (1-3), &le; ₹10,000 ceiling, and explicit human approval requirement.
                    </p>
                  </div>

                  <div className="trail-node active-step">
                    <div className="trail-node-header">
                      <span>07 / RAZORPAY MCP TOOL</span>
                      <code>create_payment_link</code>
                    </div>
                    <strong>
                      Awaiting 1-Click Payment Approval
                    </strong>
                    <p>
                      No charge exists until buyer clicks approve. Invokes Razorpay Hosted MCP and verifies via HMAC-SHA256 webhooks.
                    </p>
                    <small>Action ID: {recommendation.actionId.slice(0, 16)}...</small>
                  </div>
                </>
              ) : (
                <p className="audit-empty" style={{ padding: "20px 0" }}>
                  Ask the agent for products to see the live transaction reasoning trail.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="boundary-card">
                <span className="shield">◇</span>
                <div><strong>Policy guard is active</strong><p>Only catalog items · max ₹10,000 · explicit approval</p></div>
              </div>

              <div className="audit-kpis" aria-label="Audit summary">
                <div><strong>{auditStats.decisions}</strong><span>decisions</span></div>
                <div><strong>{auditStats.moneyActions}</strong><span>money events</span></div>
                <div><strong>{auditStats.marketComparisons}</strong><span>market checks</span></div>
                <div><strong>{auditStats.webhookAccepted}</strong><span>webhooks accepted</span></div>
                <div><strong>{auditStats.webhookRejected}</strong><span>webhooks rejected</span></div>
                <div><strong>{auditStats.stoppedSafely}</strong><span>stopped safely</span></div>
              </div>

              <div className="audit-filters" aria-label="Filter audit events">
                {(["all", "recommendation", "money", "market", "webhook", "system"] as AuditFilter[]).map((filter) => (
                  <button
                    key={filter}
                    className={auditFilter === filter ? "active" : undefined}
                    onClick={() => setAuditFilter(filter)}
                    aria-pressed={auditFilter === filter}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div className="timeline">
                {visibleAudit.length === 0 ? (
                  <p className="audit-empty">No {auditFilter === "all" ? "" : `${auditFilter} `}events yet.</p>
                ) : visibleAudit.slice(0, 14).map((event) => (
                  <div className="event" key={event.id}>
                    <span className={`event-dot ${event.level}`} />
                    <div>
                      <time>{new Date(event.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                      <strong>{event.summary}</strong>
                      <code>{auditCategory(event.type)} / {event.type}</code>
                      {event.detail && (
                        <details className="event-detail">
                          <summary>Inspect evidence</summary>
                          <pre>{JSON.stringify(event.detail, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </section>

      <footer className="shell">
        <span>COMMERGENT © 2026</span>
        <span>RAZORPAY MCP · EXPLAINABLE BY DESIGN</span>
      </footer>
    </main>
  );
}
