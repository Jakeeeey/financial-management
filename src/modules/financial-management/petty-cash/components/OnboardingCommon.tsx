import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OnboardingError } from "../providers/onboarding.api";
import type { Readiness } from "../onboarding-types";

export function Field({ label, id, value, onChange, type = "text", disabled, required, maxLength }: { label: string; id: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean; required?: boolean; maxLength?: number }) {
  return <div className="min-w-0 space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label><Input id={id} type={type} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} required={required} maxLength={maxLength} step={type === "number" ? "any" : undefined} /></div>;
}
export function NativeSelect({ label, id, value, onChange, children, disabled }: { label: string; id: string; value: string; onChange: (value: string) => void; children: ReactNode; disabled?: boolean }) {
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label><select id={id} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} className="h-9 w-full rounded-md border bg-background px-3 text-sm">{children}</select></div>;
}
export function ErrorBox({ error, retry }: { error: Error | null; retry?: () => void }) {
  if (!error) return null;
  return <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"><p>{error.message}</p>
    {error instanceof OnboardingError && <>{Object.entries(error.fields).map(([field, message]) => <p key={field} className="mt-1">{field}: {message}</p>)}{error.requestId && <p className="mt-2 text-xs">Reference: {error.requestId}</p>}</>}
    {retry && <Button className="mt-3" size="sm" variant="outline" onClick={retry}>Retry</Button>}</div>;
}
export function ReadinessList({ checks }: { checks: Record<string, Readiness> }) {
  return <div className="space-y-3"><h3 className="font-medium">Configuration readiness</h3><p className="text-xs text-muted-foreground">These checks explain setup requirements. Financial actions are delivered in later increments.</p>
    {Object.entries(checks).map(([name, check]) => <div key={name} className="rounded-lg border p-3 text-sm"><span className="font-medium">{name.replaceAll("_", " ")}: {check.ready ? "Configured" : "Needs setup"}</span>
      {check.blockers.length > 0 && <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{check.blockers.map((blocker, index) => <li key={`${blocker.code}-${index}`}>{blocker.message}</li>)}</ul>}</div>)}
  </div>;
}
export function Paging({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (page: number) => void }) {
  return <div className="flex items-center justify-end gap-3 text-sm"><span>{total} record(s) · Page {page}</span><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous page</Button><Button variant="outline" size="sm" disabled={page * pageSize >= total} onClick={() => onChange(page + 1)}>Next page</Button></div>;
}
