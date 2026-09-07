import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rejectionism CampaignOS",
  description: "Operational headquarters for REJECTIONISM CampaignOS.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream text-ink antialiased">{children}</body>
    </html>
  );
}
