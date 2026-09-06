import { redirect } from "next/navigation";
import { hasAdminSession } from "@/lib/auth/boundaries";
import { loginAction } from "./actions";
import { LoginSubmit } from "./_components/login-submit";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await props.searchParams;

  // Valid sessions go straight to the dashboard.
  if (await hasAdminSession()) {
    redirect("/admin");
  }

  const showInvalidFeedback = searchParams.error === "invalid";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="border-4 border-ink bg-paper p-8 shadow-[6px_6px_0px_0px_rgba(13,13,13,1)]">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.3em] text-rejection-red">
          Ad Nihilum
        </p>
        <h1 className="mt-2 font-heading text-3xl font-black uppercase tracking-tight text-ink">
          CampaignOS Login
        </h1>
        <p className="mt-2 text-xs uppercase tracking-wider text-ink/60">
          Operational headquarters access
        </p>

        {showInvalidFeedback && (
          <div
            role="alert"
            className="mt-4 border-2 border-rejection-red bg-cream p-3 text-center font-heading text-xs font-bold uppercase tracking-wider text-rejection-red"
          >
            Invalid password. Check the credential and try again.
          </div>
        )}

        <form action={loginAction} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block font-heading text-xs font-bold uppercase tracking-wider text-ink"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              maxLength={256}
              autoComplete="current-password"
              className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <LoginSubmit />
        </form>
      </div>
    </main>
  );
}
