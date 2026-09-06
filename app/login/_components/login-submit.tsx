"use client";

import { useFormStatus } from "react-dom";

export function LoginSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="w-full border-2 border-ink bg-ink px-4 py-3 font-heading text-sm font-bold uppercase tracking-widest text-cream transition-colors hover:bg-rejection-red disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Verifying..." : "Sign In"}
    </button>
  );
}
