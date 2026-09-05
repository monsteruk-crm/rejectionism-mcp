export function StatusBadge({ status }: { status: string }) {
  let colorClass = "bg-paper text-ink border-ink/40";

  switch (status) {
    case "DONE":
    case "APPROVED":
    case "LIVE":
    case "PUBLISHED":
      colorClass = "bg-ink text-cream border-ink";
      break;
    case "IN_PROGRESS":
    case "NEXT":
    case "SCHEDULED":
      colorClass = "bg-rejection-red text-cream border-blood-red";
      break;
    case "BLOCKED":
    case "MISSING":
    case "NEEDS_WORK":
      colorClass = "bg-blood-red text-cream border-ink";
      break;
    case "BACKLOG":
    case "DRAFT":
    case "PLANNED":
    case "RESERVED":
    case "REDIRECT":
    case "UNKNOWN":
    case "SUPERSEDED":
    default:
      colorClass = "bg-paper text-ink border-ink/30";
      break;
  }

  return (
    <span
      className={`inline-block border px-2 py-0.5 font-heading text-[11px] font-bold uppercase tracking-wider ${colorClass}`}
    >
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: number }) {
  let badgeColor = "bg-paper text-ink border-ink/30";
  if (priority >= 80) {
    badgeColor = "bg-rejection-red text-cream border-blood-red";
  } else if (priority >= 40) {
    badgeColor = "bg-ink text-cream border-ink";
  }

  return (
    <span
      className={`inline-block border px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-widest ${badgeColor}`}
    >
      P:{priority}
    </span>
  );
}
