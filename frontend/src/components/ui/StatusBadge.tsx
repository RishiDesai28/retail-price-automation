type StatusBadgeProps = {
  status: string;
};

const statusStyles: Record<string, string> = {
  updated: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  review_required: 'border-amber-200 bg-amber-100 text-amber-800',
  rejected: 'border-red-200 bg-red-100 text-red-800',
  no_change: 'border-slate-200 bg-slate-100 text-slate-700',
  failed: 'border-red-200 bg-red-100 text-red-800',
  unmatched: 'border-violet-200 bg-violet-100 text-violet-800',
  manually_updated: 'border-sky-200 bg-sky-100 text-sky-800',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalizedStatus = status === 'manually_updated' ? 'manual update' : status.replace(/_/g, ' ');
  const styles = statusStyles[status] ?? 'border-slate-200 bg-slate-100 text-slate-700';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${styles}`}>
      {normalizedStatus}
    </span>
  );
}
