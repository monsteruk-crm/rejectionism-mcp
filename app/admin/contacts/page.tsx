import { requireAdminPage } from "@/lib/auth/boundaries";
import Link from "next/link";
import { AdminServiceError } from "../_components/service-error";
import { listContacts } from "@/lib/campaign";
import { createContactAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ContactsListPage() {
  await requireAdminPage();
  const result = await listContacts({ limit: 100 });
  const contacts = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Collaborators & Alliances
          </p>
          <h1 className="font-heading text-4xl font-black uppercase tracking-tight">
            Contacts ({result.ok ? total : "Unavailable"})
          </h1>
        </div>
        <Link
          href="/admin"
          className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {!result.ok && <AdminServiceError error={result.error} />}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Contacts Table */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] lg:col-span-2">
          {!result.ok ? (
            <p className="text-xs font-bold text-rejection-red">Register unavailable.</p>
          ) : contacts.length === 0 ? (
            <p className="text-xs italic text-ink/70">
              No contacts registered. Note: Do not store sensitive or private contact details.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs">
                <thead className="border-b-2 border-ink font-heading uppercase text-ink">
                  <tr>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-2">Org / Role</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/15">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-cream">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/contacts/${contact.id}`}
                          className="font-heading text-sm font-bold text-ink hover:text-rejection-red"
                        >
                          {contact.name}
                        </Link>
                        {contact.email && (
                          <p className="font-mono text-[11px] text-ink/60">{contact.email}</p>
                        )}
                        {contact.notes && (
                          <p className="mt-0.5 text-[11px] text-ink/70">{contact.notes}</p>
                        )}
                      </td>
                      <td className="py-3 pr-2 font-mono text-xs text-ink/70 whitespace-nowrap">
                        {contact.organization || "—"}
                        {" // "}
                        {contact.role || "—"}
                      </td>
                      <td className="py-3 pr-2 whitespace-nowrap">
                        <span className="border border-ink/40 bg-paper px-2 py-0.5 font-heading text-[10px] uppercase text-ink">
                          {contact.status}
                        </span>
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/contacts/${contact.id}`}
                          className="border border-ink bg-cream px-2 py-1 font-heading text-[11px] font-bold uppercase hover:bg-ink hover:text-cream"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Contact Form */}
        <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
          <h2 className="border-b-2 border-ink pb-2 font-heading text-xl font-black uppercase">
            Add Contact
          </h2>

          <form action={createContactAction} className="mt-4 space-y-4 text-xs font-sans">
            <div>
              <label htmlFor="name" className="block font-heading font-bold uppercase text-ink">
                Full Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="e.g. Sandra from HR"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="organization"
                  className="block font-heading font-bold uppercase text-ink"
                >
                  Organization
                </label>
                <input
                  type="text"
                  id="organization"
                  name="organization"
                  maxLength={200}
                  className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                />
              </div>

              <div>
                <label htmlFor="role" className="block font-heading font-bold uppercase text-ink">
                  Role
                </label>
                <input
                  type="text"
                  id="role"
                  name="role"
                  maxLength={200}
                  className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block font-heading font-bold uppercase text-ink">
                Email (Optional)
              </label>
              <input
                type="email"
                id="email"
                name="email"
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="contact@example.com"
              />
            </div>

            <div>
              <label htmlFor="status" className="block font-heading font-bold uppercase text-ink">
                Status
              </label>
              <input
                type="text"
                id="status"
                name="status"
                defaultValue="PROSPECT"
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block font-heading font-bold uppercase text-ink">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={20000}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
                placeholder="Collaboration context or public notes"
              />
            </div>

            <button
              type="submit"
              className="w-full border-2 border-ink bg-ink py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red"
            >
              Save Contact
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
