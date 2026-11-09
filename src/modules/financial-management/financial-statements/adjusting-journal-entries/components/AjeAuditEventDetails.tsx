import type { AjeAuditEvent } from "../types";
import { money } from "./formatters";

function auditChangeValue(field: string, value: string | null | undefined) {
  if (!value) return "—";
  if (field !== "Journal lines") return value;
  return value.replace(/(\bDebit\s+)(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(,\s*Credit\s+)(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/g,
    (_match, debitLabel: string, debit: string, creditLabel: string, credit: string) => `${debitLabel}${money(Number(debit))}${creditLabel}${money(Number(credit))}`);
}

export function AjeAuditEventDetails({ event }: { event: AjeAuditEvent }) {
  const display = event.display;
  const posting = event.action === "SYSTEM_POSTED" && display;
  const unreadable = display && event.changes.some(change => change.field === "Raw audit details");

  return <>
    {posting ? <section aria-label="Posting details" className="space-y-3">
      <h3 className="whitespace-pre-wrap break-words text-sm font-semibold">{display.summary}</h3>
      {display.facts.length > 0 && <dl className="flex flex-wrap gap-x-8 gap-y-3 rounded-md bg-muted/30 px-3 py-2">
        {display.facts.map(fact => <div key={fact.label}>
          <dt className="text-xs text-muted-foreground">{fact.label}</dt>
          <dd className="break-words text-sm font-medium">{fact.value}</dd>
        </div>)}
      </dl>}
      {display.postingLines.length > 0 && <div className="max-w-full overflow-x-auto rounded-md border">
        <table className="w-full min-w-[26rem] text-sm" aria-label="Recorded journal lines">
          <caption className="sr-only">Journal lines recorded when this event occurred</caption>
          <thead className="bg-muted/40"><tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">Account</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Debit</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Credit</th>
          </tr></thead>
          <tbody className="divide-y">{display.postingLines.map((line, index) => <tr key={index}>
            <td className="break-words px-3 py-2">{line.accountLabel}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{line.debit}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{line.credit}</td>
          </tr>)}</tbody>
          {display.totals && <tfoot className="border-t bg-muted/20 font-semibold"><tr>
            <th scope="row" className="px-3 py-2 text-left">Total</th>
            <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{display.totals.debit}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">{display.totals.credit}</td>
          </tr></tfoot>}
        </table>
      </div>}
    </section> : <>
      {event.reason && <section aria-label="Event reason"><h3 className="text-xs font-semibold text-muted-foreground">Reason / detail</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm">{event.reason}</p></section>}
      {!unreadable && <section aria-label="Changes recorded at this event">
        <h3 className="text-xs font-semibold">Changes recorded at this event</h3>
        {event.changes.length ? <div className="mt-2 divide-y rounded-md border">
          <div className="hidden grid-cols-[minmax(8rem,0.7fr)_1fr_1fr] gap-3 bg-muted/40 px-3 py-2 text-xs font-medium sm:grid"><span>Field</span><span>Before</span><span>After</span></div>
          {event.changes.map((change, index) => <div key={`${change.field}-${index}`} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(8rem,0.7fr)_1fr_1fr] sm:gap-3">
            <p className="font-medium">{change.field}</p>
            <div><p className="text-xs text-muted-foreground sm:sr-only">Before</p><p className="whitespace-pre-wrap break-words text-sm">{auditChangeValue(change.field, change.before)}</p></div>
            <div><p className="text-xs text-muted-foreground sm:sr-only">After</p><p className="whitespace-pre-wrap break-words text-sm">{auditChangeValue(change.field, change.after)}</p></div>
          </div>)}
        </div> : <p className="mt-1 text-sm text-muted-foreground">No field changes recorded.</p>}
      </section>}
    </>}
    {display?.notice && <p role="status" className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{display.notice}</p>}
    {display && <details className="rounded-md border px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">View recorded data</summary>
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/30 p-3 text-xs">{JSON.stringify({ action:event.action, changes:event.changes }, null, 2)}</pre>
    </details>}
  </>;
}
