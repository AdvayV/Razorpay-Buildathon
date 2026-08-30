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

type Recommendation = {
  actionId: string;
  budgetPaise: number;
  inferredTags: string[];
  items: Item[];
  totalPaise: number;
  primaryRevenuePaise: number;
  incrementalRevenuePaise: number;
  upliftPercent: number;
  explanation: string;
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
  "Coffee and breakfast essentials under Rs. 800",
  "Build a skincare routine with face wash and sunscreen below Rs. 1,200",
  "I need vegetables and kitchen staples under Rs. 1,500",
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
    try {
      const response = await fetch("/api/agent/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRecommendation(data as Recommendation);
      await refreshAudit();
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Agent unavailable." });
    } finally {
      setBusy(false);
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

  return (
    <main>
      <nav className="nav shell">
        <a className="brand" href="#top" aria-label="Revenue Pilot home">
          <span className="brand-mark">R</span>
          <span>Revenue Pilot</span>
        </a>
        <div className="nav-meta">
          <span className="live-dot" /> Razorpay test mode
        </div>
      </nav>

      <section className="hero shell" id="top">
        <div className="eyebrow"><span>✦</span> AGENTIC STOREFRONT / 01</div>
        <h1>Your quietest<br />salesperson is now<br /><em>your sharpest.</em></h1>
        <p className="hero-copy">
          An explainable shopping agent that discovers intent, grows basket size and creates a buyer-approved Razorpay checkout.
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
              <span className="kicker">BUYER AGENT</span>
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
              <p>Your recommendation and its reasoning will appear here.</p>
            </div>
          ) : (
            <div className="recommendation">
              <section className="demand-radar" aria-label="Demand trend summary">
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
                  <b>Buyer-facing explanation · local scoring engine</b>
                  <p>{recommendation.explanation}</p>
                  <small>Generated directly from the displayed scorecard; no external AI call was made.</small>
                </div>
              </div>

              <section className="reasoning-ledger" aria-label="Recommendation evidence">
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

                <div className="decision-controls">
                  <article>
                    <span>BUDGET CONTROL</span>
                    <strong>{money(recommendation.totalPaise)} / {money(recommendation.budgetPaise)}</strong>
                    <p>{money(recommendation.budgetPaise - recommendation.totalPaise)} remains after the proposed cart.</p>
                    {recommendation.decisionEvidence.summary.budgetWasCapped && (
                      <mark>Requested {money(recommendation.decisionEvidence.summary.requestedBudgetPaise)}; capped at {money(recommendation.decisionEvidence.summary.budgetCapPaise)} by policy.</mark>
                    )}
                  </article>
                  <article>
                    <span>REJECTION CONTROL</span>
                    <strong>{recommendation.decisionEvidence.summary.overBudgetCount} budget · {recommendation.decisionEvidence.summary.incompatibleCount} compatibility</strong>
                    <p>Every losing product keeps its score gap, matched tags and exact rejection reason below.</p>
                  </article>
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

                <div className="counterfactual">
                  <strong>Counterfactual check</strong>
                  <p>{recommendation.decisionEvidence.counterfactual}</p>
                </div>

                <details className="candidate-details">
                  <summary>Inspect every candidate and rejection reason</summary>
                  <div className="candidate-table-wrap">
                    <table>
                      <thead><tr><th>Candidate</th><th>Intent</th><th>Demand</th><th>Total</th><th>Outcome</th></tr></thead>
                      <tbody>
                        {recommendation.decisionEvidence.candidates.map((candidate) => (
                          <tr key={candidate.itemId}>
                            <td><strong>{candidate.name}</strong><small>{candidate.reason}</small></td>
                            <td>{candidate.relevancePoints}<small>{candidate.matchedTags.join(", ") || "no direct tag"}</small></td>
                            <td>{candidate.demandPoints > 0 ? "+" : ""}{candidate.demandPoints}<small>{candidate.demandDirection} {candidate.demandChangePercent > 0 ? "+" : ""}{candidate.demandChangePercent}%</small></td>
                            <td>{candidate.totalScore}<small>{candidate.scoreGapToWinner > 0 ? `${candidate.scoreGapToWinner} behind leader` : "leader"}</small></td>
                            <td><span className={`outcome ${candidate.outcome}`}>{candidate.outcome.replaceAll("-", " ")}</span><small>{candidate.rejectionCategory?.replaceAll("-", " ")}</small></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                <div className="money-state">
                  <strong>Money-action status</strong>
                  <p>{recommendation.moneyAction.statement}</p>
                  <small>{recommendation.moneyAction.afterApproval}</small>
                </div>
              </section>

              <div className="agent-plan" aria-label="Agent decision trace">
                {recommendation.decisionTrace.map((decision, index) => (
                  <div key={decision.step}>
                    <span>0{index + 1}</span>
                    <strong>{decision.step}</strong>
                    <p>{decision.detail}</p>
                  </div>
                ))}
              </div>

              <div className="product-grid">
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

              <section className="market-board" aria-label="Market comparison">
                <div className="market-heading">
                  <div><span>MARKET COMPARISON / LANDED COST</span><h3>Would this buyer get a better deal elsewhere?</h3></div>
                  <code>price + shipping</code>
                </div>
                {recommendation.items.map((item) => {
                  const comparison = item.marketComparison;
                  if (!comparison) return null;
                  return (
                    <details className="market-product" key={item.id} open>
                      <summary>
                        <span>{item.name}</span>
                        <small>Snapshot {comparison.asOf}</small>
                      </summary>
                      <div className="market-insight">
                        <strong>Agent verdict</strong>
                        <p>{comparison.insight}</p>
                      </div>
                      <div className="market-table-wrap">
                        <table>
                          <thead><tr><th>Seller</th><th>Item</th><th>Shipping</th><th>Landed</th><th>Delivery</th><th>Trust</th></tr></thead>
                          <tbody>
                            {comparison.offers.map((offer) => (
                              <tr className={offer.checkoutEligible ? "local-offer" : undefined} key={offer.id}>
                                <td>
                                  <strong>{offer.seller}</strong>
                                  <div className="offer-badges">
                                    {offer.id === comparison.cheapestOfferId && <span>LOWEST COST</span>}
                                    {offer.id === comparison.fastestOfferId && <span>FASTEST</span>}
                                    {offer.id === comparison.mostTrustedOfferId && <span>HIGHEST TRUST</span>}
                                    {offer.checkoutEligible && <span>CHECKOUT READY</span>}
                                  </div>
                                  {offer.verificationUrl && <a href={offer.verificationUrl} target="_blank" rel="noreferrer">Review search ↗</a>}
                                </td>
                                <td>{money(offer.itemPricePaise)}</td>
                                <td>{offer.shippingPaise === 0 ? "Free" : money(offer.shippingPaise)}</td>
                                <td><strong>{money(offer.landedPricePaise)}</strong></td>
                                <td>{offer.estimatedDeliveryDays === 1 ? "1 day" : `${offer.estimatedDeliveryDays} days`}</td>
                                <td>{offer.trustScore.toFixed(1)} / 5</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="market-footnote">
                        <p>{comparison.methodology}</p>
                        <small>{comparison.disclaimer}</small>
                        <a href={`/api/market/compare?itemId=${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer">Open agent-readable comparison JSON ↗</a>
                      </div>
                    </details>
                  );
                })}
              </section>

              <div className="approval-box">
                <div>
                  <span>TOTAL / {recommendation.items.length} ITEMS</span>
                  <strong>{money(recommendation.totalPaise)}</strong>
                  {recommendation.incrementalRevenuePaise > 0 && (
                    <mark>+{money(recommendation.incrementalRevenuePaise)} · {recommendation.upliftPercent}% agent uplift</mark>
                  )}
                </div>
                <button className="primary" onClick={() => checkout(false)} disabled={busy}>
                  Approve &amp; create payment link <span>→</span>
                </button>
                <p>Nothing happens without this click. Server re-checks catalog prices and spending limits.</p>
              </div>

              <button className="failure-button" onClick={() => checkout(true)} disabled={busy}>
                Test graceful MCP failure
              </button>
            </div>
          )}
        </div>

        <aside className="audit-panel">
          <div className="panel-heading audit-heading">
            <div><span className="kicker">LIVE AUDIT</span><h2>Every action, legible.</h2></div>
            <button className="refresh" onClick={refreshAudit}>↻</button>
          </div>

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
        </aside>
      </section>

      <footer className="shell">
        <span>REVENUE PILOT © 2026</span>
        <span>RAZORPAY MCP · EXPLAINABLE BY DESIGN</span>
      </footer>
    </main>
  );
}
