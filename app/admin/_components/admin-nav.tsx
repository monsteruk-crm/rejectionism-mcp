import Link from "next/link";
import { logoutAction } from "../../login/actions";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Search", href: "/admin/search" },
  { label: "Work Items", href: "/admin/work-items" },
  { label: "Canon", href: "/admin/canon" },
  { label: "Decisions", href: "/admin/decisions" },
  { label: "Assets", href: "/admin/assets" },
  { label: "Upload Links", href: "/admin/upload-links" },
  { label: "Websites", href: "/admin/websites" },
  { label: "Content", href: "/admin/content" },
  { label: "Contacts", href: "/admin/contacts" },
];

export function AdminNav() {
  return (
    <nav className="border-b-2 border-ink bg-paper px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="font-heading text-xl font-black uppercase tracking-wider text-ink hover:text-rejection-red"
          >
            CampaignOS // HQ
          </Link>
          <span className="bg-ink px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-widest text-cream">
            Satirical Art Ops
          </span>
        </div>

        <ul className="flex flex-wrap items-center gap-1 sm:gap-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block border border-transparent px-3 py-1 font-heading text-xs font-bold uppercase tracking-wider text-ink/80 transition-colors hover:border-ink hover:bg-cream hover:text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <form action={logoutAction}>
              <button
                type="submit"
                className="block border border-ink bg-ink px-3 py-1 font-heading text-xs font-bold uppercase tracking-wider text-cream transition-colors hover:bg-rejection-red"
              >
                Log Out
              </button>
            </form>
          </li>
        </ul>
      </div>
    </nav>
  );
}
