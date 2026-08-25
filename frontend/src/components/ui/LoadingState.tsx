export function LoadingState({ message = 'Loading data…' }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 text-slate-600">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        <span>{message}</span>
      </div>
    </div>
  );
}
