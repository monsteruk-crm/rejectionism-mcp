import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Submit Campaign Artwork | Rejectionism CampaignOS",
  description: "Secure, direct submission portal for Rejectionism campaign deliverables.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function UploadLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col justify-between p-4 sm:p-8">
      <header className="max-w-3xl mx-auto w-full mb-6 pb-4 border-b border-ink/10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="inline-block w-3 h-3 bg-rejection-red" />
          <span className="font-mono font-bold tracking-wider uppercase text-sm">
            REJECTIONISM // SUBMISSION PORTAL
          </span>
        </div>
        <span className="text-xs font-mono text-ink/50 uppercase">CAPABILITY AUTHENTICATED</span>
      </header>

      <main className="max-w-3xl mx-auto w-full flex-1">{children}</main>

      <footer className="max-w-3xl mx-auto w-full mt-12 pt-4 border-t border-ink/10 text-xs font-mono text-ink/50 text-center">
        REJECTIONISM CAMPAIGN OS &bull; AUTHORIZED SUBMISSIONS ONLY &bull; ZERO TRACKING &bull; PRIVATE STORAGE
      </footer>
    </div>
  );
}
