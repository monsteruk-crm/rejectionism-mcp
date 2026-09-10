import { listActivity } from "@/lib/campaign/activity";

interface ActivityRow {
  id: string;
  createdAt: string;
  action: string;
  summary: string;
}

const PAGE_SIZE = 20;

export async function MemoryActivitySection({ memoryId }: { memoryId: string }) {
  const result = await listActivity({
    entityType: "CAMPAIGN_MEMORY",
    entityId: memoryId,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const items: ActivityRow[] = result.ok
    ? (result.data.items as ActivityRow[])
    : [];
  return (
    <section className="mb-8 rounded-md border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Activity</h2>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">No activity recorded for this memory.</p>
      ) : (
        <ul className="space-y-1 text-xs text-slate-700">
          {items.map((entry) => (
            <li key={entry.id} className="flex items-baseline justify-between gap-2">
              <span>
                <code className="font-mono text-[10px] text-slate-500">{entry.createdAt}</code> · {entry.action}
              </span>
              <span className="text-slate-500">{entry.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
