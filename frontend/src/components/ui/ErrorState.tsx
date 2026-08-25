type ErrorStateProps = {
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({ message, retryLabel = 'Retry', onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-2 text-sm text-red-700">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
