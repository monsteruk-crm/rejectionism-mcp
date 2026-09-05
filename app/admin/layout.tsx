import { ReactNode } from "react";
import { isTestModeEnabled } from "@/lib/campaign/test-mode";
import { TestModeBanner } from "./_components/test-mode-banner";
import { AdminNav } from "./_components/admin-nav";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const testModeEnabled = isTestModeEnabled();

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <TestModeBanner enabled={testModeEnabled} />
      <AdminNav />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {!testModeEnabled ? (
          <div className="border-4 border-ink bg-paper p-8 text-center shadow-[6px_6px_0px_0px_rgba(13,13,13,1)]">
            <h2 className="font-heading text-3xl font-black uppercase tracking-wider text-rejection-red">
              Test Mode Disabled
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-ink/80">
              Rejectionism CampaignOS is running with test mode disabled. In accordance with
              security guidelines, all campaign records and mutation capabilities are locked.
            </p>
            <div className="mx-auto mt-6 max-w-md border-2 border-ink bg-cream p-4 text-left">
              <p className="font-heading text-xs font-bold uppercase tracking-wider text-ink">
                Required Configuration
              </p>
              <p className="mt-1 font-mono text-xs text-ink/90">UNAUTHENTICATED_TEST_MODE=true</p>
            </div>
          </div>
        ) : (
          children
        )}
      </div>

      <footer className="border-t-2 border-ink bg-paper px-4 py-4 text-center text-xs uppercase tracking-widest text-ink/60">
        Rejectionism CampaignOS // Ad Nihilum // Confidential Satirical Headquarters
      </footer>
    </div>
  );
}
