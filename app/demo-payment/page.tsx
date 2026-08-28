"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useState } from "react";

function DemoCheckout() {
  const params = useSearchParams();
  const actionId = params.get("actionId") ?? "demo";
  const amount = Number(params.get("amount") ?? 0);
  const [result, setResult] = useState<"paid" | "failed" | null>(null);

  async function finish(status: "paid" | "failed") {
    await fetch("/api/demo-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId, status }),
    });
    setResult(status);
  }

  return (
    <main className="checkout-page">
      <section className="checkout-card">
        <div className="checkout-brand"><span className="brand-mark">R</span> Revenue Pilot</div>
        {result ? (
          <div className={`checkout-result ${result}`}>
            <div>{result === "paid" ? "✓" : "!"}</div>
            <h1>{result === "paid" ? "Payment confirmed" : "Payment failed safely"}</h1>
            <p>{result === "paid" ? "The agent received a verified success event." : "No order was marked paid. The buyer can retry without duplication."}</p>
            <Link href="/">View the audit trail →</Link>
          </div>
        ) : (
          <>
            <span className="demo-label">LOCAL TEST CHECKOUT</span>
            <h1>{money(amount)}</h1>
            <p>This page simulates Razorpay test checkout until your test credentials are added.</p>
            <button className="primary pay-demo" onClick={() => finish("paid")}>Simulate successful payment</button>
            <button className="failure-button" onClick={() => finish("failed")}>Simulate failed payment</button>
            <small>No real money can move from this screen.</small>
          </>
        )}
      </section>
    </main>
  );
}

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

export default function DemoPaymentPage() {
  return <Suspense><DemoCheckout /></Suspense>;
}
