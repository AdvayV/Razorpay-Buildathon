"use client";

import { useCallback, useEffect, useState } from "react";

type Item = {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  quantity: number;
  accent: string;
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
};

type AuditEvent = {
  id: string;
  at: string;
  type: string;
  summary: string;
  level: "info" | "success" | "warning" | "error";
};

const samples = [
  "I need a focused morning routine under ₹2,500",
  "Find a calming tea gift below ₹1,800",
  "Build me a useful tea set under ₹2,000",
];

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export default function Home() {
  const [message, setMessage] = useState(samples[0]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

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
              <div className="agent-said">
                <span className="mini-mark">✦</span>
                <div><b>Agent’s reasoning</b><p>{recommendation.explanation}</p></div>
              </div>

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
                    <div className="product-number">0{index + 1}</div>
                    <div className="product-art"><span>{item.name.split(" ")[0]}</span></div>
                    <div className="product-copy">
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <strong>{money(item.pricePaise)}</strong>
                    </div>
                  </article>
                ))}
              </div>

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

          <div className="timeline">
            {audit.length === 0 ? (
              <p className="audit-empty">Ask the agent to begin the audit trail.</p>
            ) : audit.slice(0, 10).map((event) => (
              <div className="event" key={event.id}>
                <span className={`event-dot ${event.level}`} />
                <div>
                  <time>{new Date(event.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                  <strong>{event.summary}</strong>
                  <code>{event.type}</code>
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
