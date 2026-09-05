import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Commergent — Agentic Commerce",
  description: "An explainable AI shopping agent powered by Razorpay MCP.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
