type MetricCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
};

export function MetricCard({ title, value, subtitle }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
