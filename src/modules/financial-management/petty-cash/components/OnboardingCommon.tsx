import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OnboardingError } from "../providers/onboarding.api";
import { onboardingErrorTitle, onboardingFieldErrors, type FeedbackField } from "../utils/onboardingFeedback";
import type { Readiness } from "../onboarding-types";

export function Field({ label, id, value, onChange, type = "text", disabled, required, maxLength, list, placeholder, error }: { label: string; id: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean; required?: boolean; maxLength?: number; list?: string; placeholder?: string; error?: string }) {
    const errorId = error ? `${id}-error` : undefined;
    return <div className="min-w-0 space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label><Input id={id} type={type} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} required={required} maxLength={maxLength} step={type === "number" ? "any" : undefined} list={list} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={errorId} />{error && <p id={errorId} className="text-xs font-medium text-destructive">{error}</p>}</div>;
}

export function NativeSelect({ label, id, value, onChange, children, disabled, error }: { label: string; id: string; value: string; onChange: (value: string) => void; children: ReactNode; disabled?: boolean; error?: string }) {
    const errorId = error ? `${id}-error` : undefined;
    return <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label><select id={id} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={errorId} className="h-9 w-full rounded-md border bg-background px-3 text-sm">{children}</select>{error && <p id={errorId} className="text-xs font-medium text-destructive">{error}</p>}</div>;
}

export type FeedbackTone = "success" | "error" | "warning" | "info";

export function OnboardingFeedback({ tone, title, children, fields, requestId, action }: {
    tone: FeedbackTone;
    title: string;
    children?: ReactNode;
    fields?: FeedbackField[];
    requestId?: string;
    action?: { label: string; onClick: () => void };
}) {
    const styles: Record<FeedbackTone, { box: string; icon: string; title: string }> = {
        success: { box: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100", icon: "text-emerald-600 dark:text-emerald-400", title: "text-emerald-900 dark:text-emerald-100" },
        error: { box: "border-destructive/40 bg-destructive/5 text-foreground", icon: "text-destructive", title: "text-foreground" },
        warning: { box: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100", icon: "text-amber-600 dark:text-amber-400", title: "text-amber-900 dark:text-amber-100" },
        info: { box: "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100", icon: "text-blue-600 dark:text-blue-400", title: "text-blue-900 dark:text-blue-100" },
    };
    const palette = styles[tone];
    const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? AlertTriangle : tone === "error" ? XCircle : Info;
    return <div role={tone === "error" ? "alert" : "status"} className={`space-y-2 rounded-lg border p-3 text-sm ${palette.box}`}>
        <div className="flex items-start gap-2.5"><Icon className={`mt-0.5 size-4 shrink-0 ${palette.icon}`} /><div className="min-w-0 flex-1 space-y-1"><p className={`font-semibold ${palette.title}`}>{title}</p>{children && <div className="leading-relaxed">{children}</div>}</div></div>
        {!!fields?.length && <ul className="list-inside list-disc space-y-1 pl-6">{fields.map(item => <li key={`${item.field}:${item.message}`}><span className="font-medium">{item.label}:</span> {item.message}</li>)}</ul>}
        {action && <Button type="button" size="sm" variant="outline" className="ml-6" onClick={action.onClick}>{action.label}</Button>}
        {requestId && <details className="ml-6 text-xs opacity-75"><summary className="cursor-pointer">Technical details</summary><p className="mt-1 break-all font-mono">Reference: {requestId}</p></details>}
    </div>;
}

export function ErrorBox({ error, retry, title, showFields = true, action }: { error: Error | null; retry?: () => void; title?: string; showFields?: boolean; action?: { label: string; onClick: () => void } }) {
    if (!error) return null;
    const requestId = error instanceof OnboardingError ? error.requestId : undefined;
    const fields = showFields ? onboardingFieldErrors(error) : [];
    return <OnboardingFeedback tone="error" title={title || onboardingErrorTitle(error)} requestId={requestId} fields={fields} action={action ?? (retry ? { label: "Retry", onClick: retry } : undefined)}><p>{error.message}</p></OnboardingFeedback>;
}

export function ReadinessList({ checks }: { checks: Record<string, Readiness> }) {
    return <div className="space-y-3"><h3 className="font-medium">Configuration readiness</h3><p className="text-xs text-muted-foreground">These checks explain setup requirements. Financial actions are delivered in later increments.</p>
        {Object.entries(checks).map(([name, check]) => <div key={name} className="rounded-lg border p-3 text-sm"><span className="font-medium">{name.replaceAll("_", " ")}: {check.ready ? "Configured" : "Needs setup"}</span>
            {check.blockers.length > 0 && <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{check.blockers.map((blocker, index) => <li key={`${blocker.code}-${index}`}>{blocker.message}</li>)}</ul>}
        </div>)}
    </div>;
}

export function Paging({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (page: number) => void }) {
    return <div className="flex items-center justify-end gap-3 text-sm"><span>{total} record(s) · Page {page}</span><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous page</Button><Button variant="outline" size="sm" disabled={page * pageSize >= total} onClick={() => onChange(page + 1)}>Next page</Button></div>;
}
