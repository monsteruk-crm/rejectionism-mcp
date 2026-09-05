import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <p className="font-heading text-sm font-bold uppercase tracking-[0.3em] text-rejection-red">
        AD NIHILUM
      </p>
      <h1 className="font-heading text-5xl font-bold uppercase leading-none text-ink sm:text-7xl">
        Rejectionism CampaignOS
      </h1>
      <p className="max-w-xl text-lg text-ink/80">
        The operational headquarters for the art movement nobody applied for.
      </p>
      <Link
        href="/admin"
        className="border-2 border-ink bg-ink px-8 py-4 font-heading text-sm font-bold uppercase tracking-widest text-cream hover:border-rejection-red hover:bg-rejection-red"
      >
        Enter the HQ
      </Link>
      <p className="max-w-md text-xs uppercase tracking-wider text-ink/60">
        Unauthenticated test system — do not store private or sensitive data.
      </p>
    </main>
  );
}
