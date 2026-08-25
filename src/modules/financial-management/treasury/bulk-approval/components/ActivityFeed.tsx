"use client";

import * as React from "react";
import {
  History,
  Search,
  FileText,
  Loader2,
  Receipt,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  PartyPopper,
  AlertCircle,
  ClipboardList,
  PencilLine,
} from "lucide-react";
import { format } from "date-fns";
import type {
  ActivityLogDetail,
  DraftRevisionLog,
  ExpenseRevisionLog,
  LogDraft,
  LogRound,
} from "../type";
import * as api from "../providers/fetchProvider";
import { formatCurrency } from "../utils/format";

interface Props {
  logs: LogDraft[];
  loading: boolean;
}

function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";

  try {
    return format(new Date(d), "MMM d, h:mm a");
  } catch {
    return d;
  }
}

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/_/g, " ")
    .toLowerCase();
}

function getOutcomeMeta(outcome: string) {
  switch (outcome) {
    case "FINAL_APPROVED":
      return {
        label: "Fully Approved",
        bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50",
        pill: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800",
        icon: <PartyPopper className="h-3.5 w-3.5" />,
      };
    case "REJECTED":
      return {
        label: "Rejected",
        bg: "bg-red-50/60 border-red-200 dark:bg-red-950/20 dark:border-red-900/50",
        pill: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800",
        icon: <XCircle className="h-3.5 w-3.5" />,
      };
    case "WITH_CONCERN":
      return {
        label: "With Concern",
        bg: "bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50",
        pill: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800",
        icon: <AlertCircle className="h-3.5 w-3.5" />,
      };
    case "SUPERSEDED":
      return {
        label: "Superseded",
        bg: "bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800",
        pill: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
        icon: <RotateCcw className="h-3.5 w-3.5" />,
      };
    default:
      return {
        label: "In Progress",
        bg: "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50",
        pill: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800",
        icon: <Clock className="h-3.5 w-3.5" />,
      };
  }
}

function getDraftStatusMeta(status: string) {
  const s = normalizeStatus(status);

  if (s === "approved") {
    return {
      label: "Fully Approved",
      cls: "text-emerald-700 bg-emerald-100/80 dark:bg-emerald-900/40 dark:text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
    };
  }

  if (s === "rejected") {
    return {
      label: "Rejected",
      cls: "text-red-700 bg-red-100/80 dark:bg-red-900/40 dark:text-red-400",
      icon: <XCircle className="h-3 w-3" />,
    };
  }

  if (s === "with concern") {
    return {
      label: "With Concern",
      cls: "text-amber-700 bg-amber-100/80 dark:bg-amber-900/40 dark:text-amber-400",
      icon: <AlertCircle className="h-3 w-3" />,
    };
  }

  if (s === "submitted") {
    return {
      label: "Awaiting L1",
      cls: "text-blue-700 bg-blue-100/80 dark:bg-blue-900/40 dark:text-blue-400",
      icon: <Clock className="h-3 w-3" />,
    };
  }

  const m = s.match(/pending l(\d+)/);

  if (m) {
    return {
      label: `Awaiting L${m[1]}`,
      cls: "text-amber-700 bg-amber-100/80 dark:bg-amber-900/40 dark:text-amber-400",
      icon: <Clock className="h-3 w-3" />,
    };
  }

  return {
    label: status || "Unknown",
    cls: "text-muted-foreground bg-muted dark:bg-muted/20",
    icon: <AlertCircle className="h-3 w-3" />,
  };
}

function VoteRow({ vote }: { vote: LogRound["votes"][number] }) {
  const status = normalizeStatus(vote.status);
  const approved = status === "approved";
  const rejected = status === "rejected";
  const withConcern = status === "with concern";
  const initial = vote.name?.trim()?.charAt(0) || "?";

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/20 transition-colors group">
      <span className="shrink-0 mt-0.5 h-5 w-5 rounded-md bg-muted/60 border text-[9px] font-black flex items-center justify-center text-muted-foreground">
        L{vote.level}
      </span>

      <div
        className={`shrink-0 h-7 w-7 rounded-full border font-black text-[11px] flex items-center justify-center shadow-sm transition-colors ${
          approved
            ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800"
            : rejected
              ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800"
              : withConcern
                ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800"
                : "bg-muted text-muted-foreground border-muted-foreground/20 dark:bg-slate-800 dark:border-slate-700 text-muted-foreground/80"
        }`}
      >
        {initial}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-foreground/90 leading-tight">
          {vote.name || "Unknown"}
        </p>

        {vote.remarks && (
          <p className="text-[11px] text-muted-foreground italic mt-0.5 leading-snug line-clamp-2">
            &ldquo;{vote.remarks}&rdquo;
          </p>
        )}

        <p className="text-[10px] text-muted-foreground/60 font-medium mt-0.5">
          {formatDateTime(vote.created_at)}
        </p>
      </div>

      <div
        className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-wider shadow-sm ${
          approved
            ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-400"
            : rejected
              ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-400"
              : withConcern
                ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-400"
                : "bg-muted border-muted-foreground/10 text-muted-foreground dark:bg-slate-900/50 dark:border-slate-800"
        }`}
      >
        {approved ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : rejected ? (
          <XCircle className="h-3 w-3" />
        ) : withConcern ? (
          <AlertCircle className="h-3 w-3" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
        {vote.status}
      </div>
    </div>
  );
}

function RoundSection({
  round,
  defaultOpen,
}: {
  round: LogRound;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen ?? round.is_current);
  const meta = getOutcomeMeta(round.outcome);

  return (
    <div
      className={`rounded-xl border dark:border-slate-800 overflow-hidden transition-all dark:shadow-[0_0_20px_-12px_rgba(0,0,0,0.5)] ${meta.bg}`}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen((v: boolean) => !v)}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${meta.pill}`}
          >
            {meta.icon}
            Round {round.version}
          </span>

          <span className="text-[11px] font-bold text-muted-foreground/70">
            {meta.label}
          </span>

          {round.is_current && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </div>

        <div className="flex items-center gap-2 text-muted-foreground/60">
          <span className="text-[10px] font-semibold">
            {round.votes.length} vote{round.votes.length !== 1 ? "s" : ""}
          </span>

          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {round.votes.length === 0 ? (
            <p className="text-xs text-center italic text-muted-foreground py-3">
              No votes recorded.
            </p>
          ) : (
            round.votes.map((v: LogRound["votes"][number], i: number) => (
              <VoteRow key={`${v.approver_id}-${round.version}-${i}`} vote={v} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DraftRevisionList({ logs }: { logs: DraftRevisionLog[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-xs italic text-center text-muted-foreground py-3">
        No payable adjustment logs.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((revision) => {
        const hasBeforeAfter =
          revision.original_amount !== null && revision.new_amount !== null;
        const diff = hasBeforeAfter
          ? Number(revision.new_amount) - Number(revision.original_amount)
          : 0;

        return (
          <div
            key={revision.id}
            className="rounded-xl border dark:border-slate-800 bg-background/70 dark:bg-slate-900/70 p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-black text-foreground truncate">
                  {revision.coa_name || `Payable #${revision.payable_draft_id}`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {revision.editor_name} • {formatDateTime(revision.created_at)} • Version {revision.version}
                </p>
              </div>

              <div className="text-right shrink-0">
                {hasBeforeAfter ? (
                  <>
                    <p className="text-[11px] font-black tabular-nums text-primary">
                      {formatCurrency(Number(revision.original_amount))} → {formatCurrency(Number(revision.new_amount))}
                    </p>
                    <p
                      className={`text-[9px] font-bold uppercase ${
                        diff > 0
                          ? "text-emerald-600"
                          : diff < 0
                            ? "text-red-600"
                            : "text-muted-foreground"
                      }`}
                    >
                      {diff > 0 ? "+" : ""}{formatCurrency(diff)} change
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] font-black tabular-nums text-primary">
                    {formatCurrency(revision.amount)}
                  </p>
                )}
              </div>
            </div>

            {revision.remarks && (
              <p className="mt-2 text-[11px] text-muted-foreground leading-snug italic">
                &ldquo;{revision.remarks}&rdquo;
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExpenseRevisionList({ logs }: { logs: ExpenseRevisionLog[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-xs italic text-center text-muted-foreground py-3">
        No itemized expense revision logs.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((revision) => {
        const status = normalizeStatus(revision.status || revision.action);
        const isRejected = status === "rejected";
        const isConcern = status === "with concern";
        const isApproved = status === "approved";

        return (
          <div
            key={`${revision.log_id}-${revision.expense_id}`}
            className="rounded-xl border dark:border-slate-800 bg-background/70 dark:bg-slate-900/70 p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-black text-foreground truncate">
                  {revision.particulars || `Expense #${revision.expense_id}`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {revision.editor_name} • {formatDateTime(revision.changed_at)} • V{revision.version}
                </p>
              </div>

              <div className="text-right shrink-0 space-y-1">
                <p className="text-[11px] font-black tabular-nums text-foreground">
                  {formatCurrency(revision.amount)}
                </p>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${
                    isApproved
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : isRejected
                        ? "bg-red-50 border-red-200 text-red-700"
                        : isConcern
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {isApproved ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : isRejected ? (
                    <XCircle className="h-3 w-3" />
                  ) : isConcern ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  {revision.status || revision.action}
                </span>
              </div>
            </div>

            {revision.remarks && (
              <p className="mt-2 text-[11px] text-muted-foreground leading-snug italic">
                &ldquo;{revision.remarks}&rdquo;
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ActivityFeed({ logs, loading }: Props) {
  const [q, setQ] = React.useState("");
  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(new Set());
  const [details, setDetails] = React.useState<Record<number, ActivityLogDetail[]>>({});
  const [loadingDetails, setLoadingDetails] = React.useState<Record<number, boolean>>({});

  const filtered = React.useMemo(() => {
    const query = q.toLowerCase().trim();

    if (!query) return logs;

    return logs.filter(
      (l) =>
        l.doc_no.toLowerCase().includes(query) ||
        l.encoder_name.toLowerCase().includes(query) ||
        l.payee_name.toLowerCase().includes(query) ||
        (l.remarks ?? "").toLowerCase().includes(query)
    );
  }, [logs, q]);

  async function toggleExpand(draftId: number) {
    const next = new Set(expandedIds);

    if (next.has(draftId)) {
      next.delete(draftId);
    } else {
      next.add(draftId);

      if (!details[draftId]) {
        try {
          setLoadingDetails((prev) => ({ ...prev, [draftId]: true }));
          const data = await api.getActivityLogDetail(draftId);
          setDetails((prev) => ({ ...prev, [draftId]: data }));
        } catch (e) {
          console.error("Failed to load payables", e);
        } finally {
          setLoadingDetails((prev) => ({ ...prev, [draftId]: false }));
        }
      }
    }

    setExpandedIds(next);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0 mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-inner">
            <History size={16} className="stroke-[2.5]" />
          </div>

          <div>
            <h3 className="text-sm font-black tracking-tight text-foreground leading-none">
              Approval History
            </h3>
            <p className="text-[10px] font-medium text-muted-foreground mt-0.5 leading-none">
              Full draft history — approvals, revisions, and payables
            </p>
          </div>
        </div>

        <div className="relative w-full md:w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />

          <input
            type="text"
            placeholder="Search docs..."
            className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-muted/30 dark:bg-slate-800/50 border-transparent focus:border-primary focus:bg-background dark:focus:bg-slate-900 rounded-lg outline-none transition-all font-medium"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setExpandedIds(new Set());
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto pr-1 pb-4 space-y-3 rounded-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            <p className="text-sm font-medium">Loading history…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3 border-2 border-dashed rounded-2xl bg-muted/5">
            <Receipt size={40} className="opacity-20" />
            <p className="font-bold text-sm">No voting activity yet.</p>
          </div>
        ) : (
          filtered.map((draft) => {
            const isExpanded = expandedIds.has(draft.id);
            const isLoading = loadingDetails[draft.id];
            const itemDetails = details[draft.id] || [];
            const draftStatus = getDraftStatusMeta(draft.status ?? "");
            const latestRound = [...draft.rounds].sort(
              (a, b) => b.version - a.version
            )[0];
            const hasHistory = draft.rounds.length > 1;
            const latestMeta = getOutcomeMeta(latestRound?.outcome ?? "IN_PROGRESS");
            const latestVote = draft.rounds
              .flatMap((r: LogRound) => r.votes)
              .sort(
                (a: LogRound["votes"][number], b: LogRound["votes"][number]) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              )[0];

            return (
              <div
                key={draft.id}
                className="rounded-xl border dark:border-slate-800 bg-card dark:bg-slate-900 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full flex items-start justify-between gap-3 p-3 text-left hover:bg-muted/20 transition-colors group"
                  onClick={() => toggleExpand(draft.id)}
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div
                      className={`shrink-0 h-8 w-8 rounded-full border-2 font-black text-xs flex items-center justify-center shadow-sm ${latestMeta.pill}`}
                    >
                      {draft.encoder_name?.charAt(0) || "?"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-black text-[12px] text-foreground truncate leading-tight">
                        {draft.encoder_name || "Unknown Encoder"}
                      </p>

                      <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-none">
                        Payee: {draft.payee_name || "—"}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-muted-foreground font-mono">
                        <span className="flex items-center gap-1">
                          <FileText size={9} className="opacity-60" />
                          <span className="font-bold text-primary/80">
                            {draft.doc_no}
                          </span>
                        </span>

                        {hasHistory && (
                          <span className="flex items-center gap-0.5 text-amber-600 font-bold text-[10px]">
                            <RotateCcw size={9} />
                            {draft.rounds.length} rounds
                          </span>
                        )}

                        {latestVote && (
                          <span className="text-[10px] text-muted-foreground/60">
                            Last: {formatDateTime(latestVote.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[13px] font-black tabular-nums leading-none">
                      {formatCurrency(Number(draft.total_amount))}
                    </span>

                    <span
                      className={`flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${draftStatus.cls}`}
                    >
                      {draftStatus.icon}
                      {draftStatus.label}
                    </span>

                    <span className="text-[9px] text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 leading-none">
                      {isExpanded ? "Hide" : "View"}
                      {isExpanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t dark:border-slate-800 bg-muted/[0.03] dark:bg-slate-950/50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
                        <Clock size={11} />
                        Approval Rounds
                      </p>

                      {draft.rounds.length === 0 ? (
                        <p className="text-xs italic text-muted-foreground text-center py-4">
                          No rounds recorded yet.
                        </p>
                      ) : (
                        [...draft.rounds]
                          .sort((a, b) => b.version - a.version)
                          .map((round) => (
                            <RoundSection
                              key={round.version}
                              round={round}
                              defaultOpen={round.is_current || draft.rounds.length === 1}
                            />
                          ))
                      )}
                    </div>

                    <div className="border-t dark:border-slate-800 p-4 space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
                        <PencilLine size={11} />
                        Payable Amount Revision Logs
                      </p>
                      <DraftRevisionList logs={draft.logs ?? []} />
                    </div>

                    <div className="border-t dark:border-slate-800 p-4 space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
                        <ClipboardList size={11} />
                        Itemized Expense Revisions
                      </p>
                      <ExpenseRevisionList logs={draft.expense_logs ?? []} />
                    </div>

                    <div className="border-t dark:border-slate-800 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2 mb-3">
                        <Info size={11} />
                        Payables Breakdown
                      </p>

                      {isLoading ? (
                        <div className="flex items-center justify-center py-5 gap-2 text-muted-foreground text-xs font-medium">
                          <Loader2 size={14} className="animate-spin text-primary" />
                          Loading line items…
                        </div>
                      ) : itemDetails.length === 0 ? (
                        <p className="text-xs italic text-center text-muted-foreground py-3">
                          No line items found.
                        </p>
                      ) : (
                        <div className="rounded-xl border overflow-hidden bg-background/60 dark:bg-slate-900/60 dark:border-slate-800 shadow-inner">
                          {itemDetails.map((item, idx) => (
                            <div
                              key={item.id}
                              className={`flex justify-between items-center p-3 px-4 hover:bg-muted/30 dark:hover:bg-white/[0.03] transition-colors ${
                                idx !== 0
                                  ? "border-t border-border/50 dark:border-white/5"
                                  : ""
                              }`}
                            >
                              <div className="flex flex-col min-w-0 pr-4">
                                <span className="text-[11px] font-bold text-foreground/80 truncate">
                                  {item.coa_name}
                                </span>

                                <span className="text-[10px] text-muted-foreground italic truncate">
                                  {item.remarks || "—"}
                                </span>
                              </div>

                              <span className="text-[11px] font-black text-foreground tabular-nums shrink-0">
                                {formatCurrency(Number(item.amount))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
