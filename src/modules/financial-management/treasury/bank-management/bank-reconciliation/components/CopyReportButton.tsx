import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

export function CopyReportButton({ id, name, busy, disabled, feedback, onClick, onRetry, onRefresh }: {
  id: string; name: string; busy: boolean; disabled: boolean;
  feedback?: { error: string; message: string; recovery: "retry" | "refresh" | "" };
  onClick: () => void; onRetry: () => void; onRefresh: () => void;
}) {
  const feedbackId = useId(), message = busy ? "Preparing report text…" : feedback?.error || feedback?.message;
  const button = useRef<HTMLButtonElement | null>(null), restoreFocus = useRef(false);
  useEffect(() => {
    if (!busy && !disabled && restoreFocus.current) {
      restoreFocus.current = false;
      if (document.activeElement === document.body) button.current?.focus({ preventScroll: true });
    }
  }, [busy, disabled]);
  const start = (element: HTMLButtonElement, action: () => void) => { restoreFocus.current = document.activeElement === element; action(); };
  return <div role="group" aria-label={`Copy ${name} controls`} className="min-h-16 min-w-0 max-w-sm space-y-2 text-sm">
    <Button ref={button} id={id} type="button" variant="outline" disabled={disabled} aria-label={`Copy ${name}`} aria-describedby={message ? feedbackId : undefined} onClick={event => start(event.currentTarget, onClick)}>{busy ? "Preparing text…" : "Copy"}</Button>
    {message && <p id={feedbackId} role={feedback?.error && !busy ? "alert" : "status"} className={`break-words text-xs ${feedback?.error && !busy ? "text-destructive" : "text-muted-foreground"}`}>{message}</p>}
    {!busy && feedback?.error && feedback.recovery && <Button type="button" size="sm" variant="outline" disabled={disabled} aria-label={`${feedback.recovery === "refresh" ? "Refresh reports for" : "Retry copy"} ${name}`} onClick={event => feedback.recovery === "refresh" ? onRefresh() : start(event.currentTarget, onRetry)}>{feedback.recovery === "refresh" ? "Refresh reports" : "Retry copy"}</Button>}
  </div>;
}
