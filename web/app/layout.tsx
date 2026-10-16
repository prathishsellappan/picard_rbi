import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getConfiguredChain } from "@/lib/chains";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Picard Role-Play",
  description: "Educational crypto-fraud role-play on a test network",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Throws (and refuses to render) if the configured chain is not local or Sepolia.
  const chain = getConfiguredChain();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
          Testnet demonstration on <strong>{chain.name}</strong> (chain {chain.id}). Assets have no monetary value.
        </div>
        {children}
      </body>
    </html>
  );
}
