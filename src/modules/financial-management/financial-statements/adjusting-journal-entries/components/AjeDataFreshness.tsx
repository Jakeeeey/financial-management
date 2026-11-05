import { Button } from "@/components/ui/button";
import { formatDateTime } from "./formatters";

export function AjeDataFreshness({ label, updatedAt, loading, stale = false }: {
  label: string;
  updatedAt: number | null;
  loading: boolean;
  stale?: boolean;
}) {
  if (updatedAt === null && !loading) return null;
  const iso = updatedAt === null ? undefined : new Date(updatedAt).toISOString();
  return <p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-muted-foreground">
    {updatedAt === null ? `Loading ${label}…` : <>{label} · Last updated <time dateTime={iso}>{formatDateTime(iso)}</time></>}
    {loading && updatedAt !== null && " · Refreshing…"}
    {stale && " · Showing stale data"}
  </p>;
}

export function AjeRetryAlert({ message, onRetry, retrying, retryLabel = "Retry" }: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
  retryLabel?: string;
}) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
    <span>{message}</span>
    <Button type="button" variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
      {retrying ? "Retrying…" : retryLabel}
    </Button>
  </div>;
}
