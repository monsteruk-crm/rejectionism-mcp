"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "../../login/actions";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Search", href: "/admin/search" },
  { label: "Upload Assets", href: "/admin/assets/upload", highlight: true },
  { label: "Work Items", href: "/admin/work-items" },
  { label: "Canon", href: "/admin/canon" },
  { label: "Decisions", href: "/admin/decisions" },
  { label: "Assets", href: "/admin/assets" },
  { label: "Contributor Links", href: "/admin/upload-links" },
  { label: "Websites", href: "/admin/websites" },
  { label: "Content", href: "/admin/content" },
  { label: "Contacts", href: "/admin/contacts" },
];

export function AdminNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  // Close mobile menu on route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="border-b-2 border-ink bg-paper px-4 py-3" aria-label="Admin Navigation">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex min-h-[44px] items-center font-heading text-xl font-black uppercase tracking-wider text-ink hover:text-rejection-red focus:outline-none focus:ring-2 focus:ring-rejection-red"
          >
            CampaignOS // HQ
          </Link>
          <span className="hidden bg-ink px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-widest text-cream sm:inline-block">
            Satirical Art Ops
          </span>
        </div>

        {/* Mobile menu toggle */}
        <div className="lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-menu"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center border-2 border-ink bg-cream px-3 py-2 font-heading text-xs font-bold uppercase tracking-wider text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
          >
            {mobileOpen ? "✕ Close" : "☰ Menu"}
          </button>
        </div>

        {/* Desktop nav */}
        <ul className="hidden flex-wrap items-center gap-1 lg:flex xl:gap-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex min-h-[44px] items-center border px-3 py-1 font-heading text-xs font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-rejection-red ${
                    active
                      ? "border-ink bg-ink text-cream"
                      : item.highlight
                        ? "border-rejection-red bg-rejection-red/10 text-rejection-red hover:bg-rejection-red hover:text-cream"
                        : "border-transparent text-ink/80 hover:border-ink hover:bg-cream hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex min-h-[44px] items-center border border-ink bg-ink px-3 py-1 font-heading text-xs font-bold uppercase tracking-wider text-cream transition-colors hover:bg-rejection-red focus:outline-none focus:ring-2 focus:ring-rejection-red"
              >
                Log Out
              </button>
            </form>
          </li>
        </ul>
      </div>

      {/* Mobile nav disclosure */}
      {mobileOpen && (
        <div id="mobile-nav-menu" className="mt-3 border-t-2 border-ink pt-3 lg:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex min-h-[44px] items-center border px-4 py-2 font-heading text-sm font-bold uppercase tracking-wider ${
                      active
                        ? "border-ink bg-ink text-cream"
                        : item.highlight
                          ? "border-rejection-red bg-rejection-red/10 text-rejection-red"
                          : "border-transparent text-ink hover:bg-cream"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="pt-2">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex min-h-[44px] w-full items-center justify-center border border-ink bg-ink px-4 py-2 font-heading text-sm font-bold uppercase tracking-wider text-cream hover:bg-rejection-red"
                >
                  Log Out
                </button>
              </form>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
