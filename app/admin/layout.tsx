import { ReactNode } from "react";
import { requireAdminPage } from "@/lib/auth/boundaries";
import { AdminNav } from "./_components/admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Layout-level protection supplements, but never replaces, per-page guards.
  await requireAdminPage();

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <AdminNav />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</div>

      <footer className="border-t-2 border-ink bg-paper px-4 py-4 text-center text-xs uppercase tracking-widest text-ink/60">
        Rejectionism CampaignOS // Ad Nihilum // Confidential Satirical Headquarters
      </footer>
    </div>
  );
}
