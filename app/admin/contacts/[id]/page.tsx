import Link from "next/link";
import { AdminServiceError } from "../../_components/service-error";
import { notFound } from "next/navigation";
import { getContactById } from "@/lib/campaign";
import { updateContactAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditContactPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await getContactById(params.id);

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") {
      notFound();
    }

    return <AdminServiceError error={result.error} />;
  }

  const contact = result.data;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
            Edit Contact // ID: {contact.id}
          </p>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
            {contact.name}
          </h1>
        </div>
        <Link
          href="/admin/contacts"
          className="text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-ink"
        >
          &larr; All Contacts
        </Link>
      </div>

      <div className="border-2 border-ink bg-paper p-6 shadow-[4px_4px_0px_0px_rgba(13,13,13,1)]">
        <div className="mb-6 flex items-center justify-between border-b border-ink/20 pb-3">
          <span className="border border-ink/40 bg-paper px-2 py-0.5 font-heading text-xs uppercase text-ink">
            Status: {contact.status}
          </span>
          <span className="font-mono text-xs text-ink/70">Version {contact.version}</span>
        </div>

        <form action={updateContactAction} className="space-y-4 text-xs font-sans">
          <input type="hidden" name="id" value={contact.id} />
          <input type="hidden" name="expectedVersion" value={contact.version} />

          <div>
            <label htmlFor="name" className="block font-heading font-bold uppercase text-ink">
              Full Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={contact.name}
              required
              maxLength={200}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                defaultValue={contact.organization || ""}
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
                defaultValue={contact.role || ""}
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className="block font-heading font-bold uppercase text-ink">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                defaultValue={contact.email || ""}
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
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
                defaultValue={contact.status}
                maxLength={200}
                className="mt-1 w-full border-2 border-ink bg-cream p-2 font-heading uppercase text-xs text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block font-heading font-bold uppercase text-ink">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={contact.notes || ""}
              rows={4}
              maxLength={20000}
              className="mt-1 w-full border-2 border-ink bg-cream p-2 text-ink focus:outline-none focus:ring-2 focus:ring-rejection-red"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Link
              href="/admin/contacts"
              className="border border-ink bg-cream px-4 py-2 font-heading text-xs font-bold uppercase hover:bg-paper"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="border-2 border-ink bg-ink px-6 py-2 font-heading text-xs font-bold uppercase tracking-widest text-cream hover:bg-rejection-red"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
