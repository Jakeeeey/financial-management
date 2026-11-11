import { Button } from "@/components/ui/button";

export function CopyReportButton({ name, busy, disabled, onClick }: { name: string; busy: boolean; disabled: boolean; onClick: () => void }) {
  return <Button type="button" variant="outline" disabled={disabled} aria-label={`Copy ${name}`} onClick={onClick}>{busy ? "Preparing text…" : "Copy"}</Button>;
}
