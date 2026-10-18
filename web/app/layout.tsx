import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getConfiguredChain } from "@/lib/chains";
import { cookies } from "next/headers";
import { THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PICARD Role-Play",
  description: "Educational crypto-fraud role-play on a test network",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Throws (and refuses to render) if the configured chain is not local or Sepolia.
  const chain = getConfiguredChain();
  // Saved theme choice (set by ThemeToggle), applied on the server so the first paint is right.
  const theme = (await cookies()).get(THEME_COOKIE)?.value === "dark" ? "dark" : undefined;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-theme={theme}
      suppressHydrationWarning
    >
      <body className="paper-grain flex min-h-full flex-col text-ink">
        <div className="border-b border-line bg-saffron-tint px-4 py-1 text-center text-[11px] text-saffron-deep">
          Testnet demonstration on <strong className="font-semibold">{chain.name}</strong> (chain {chain.id}). Assets
          have no monetary value.
        </div>
        {children}
      </body>
    </html>
  );
}
