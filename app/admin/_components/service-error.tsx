import type { ServiceError } from "@/lib/campaign";

export function AdminServiceError({ error }: { error: ServiceError }) {
  return (
    <div
      role="alert"
      className="border-2 border-rejection-red bg-paper p-5 shadow-[4px_4px_0px_0px_rgba(200,16,46,1)]"
    >
      <p className="font-heading text-xs font-bold uppercase tracking-wider text-rejection-red">
        Data unavailable // {error.code}
      </p>
      <p className="mt-2 text-sm text-ink">{error.message}</p>
      {error.fieldErrors && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-ink/80">
          {Object.entries(error.fieldErrors).flatMap(([field, messages]) =>
            messages.map((message) => (
              <li key={`${field}-${message}`}>
                <span className="font-bold">{field}:</span> {message}
              </li>
            )),
          )}
        </ul>
      )}
    </div>
  );
}
