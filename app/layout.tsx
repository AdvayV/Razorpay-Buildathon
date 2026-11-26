import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Commergent — Agentic Commerce",
  description: "A shopping agent demo with simulated price comparisons, stock reminders, and one-time Razorpay test checkout.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
