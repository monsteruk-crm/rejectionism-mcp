import { TEST_MODE_WARNING } from "@/lib/campaign/test-mode";

export function TestModeBanner({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return (
      <div className="border-b-4 border-rejection-red bg-ink px-4 py-3 text-center text-cream">
        <p className="font-heading text-sm font-bold uppercase tracking-wider text-rejection-red">
          SYSTEM NOTICE: UNAUTHENTICATED TEST MODE IS DISABLED
        </p>
        <p className="mt-1 text-xs text-cream/80">
          All campaign mutations and operational views are blocked. Set{" "}
          <code className="bg-black/50 px-1 py-0.5 font-mono text-cream">
            UNAUTHENTICATED_TEST_MODE=true
          </code>{" "}
          in your environment to enable test access.
        </p>
      </div>
    );
  }

  return (
    <div className="border-b-2 border-ink bg-rejection-red px-4 py-2 text-center text-cream">
      <p className="font-heading text-xs font-bold uppercase tracking-widest sm:text-sm">
        {TEST_MODE_WARNING}
      </p>
    </div>
  );
}
