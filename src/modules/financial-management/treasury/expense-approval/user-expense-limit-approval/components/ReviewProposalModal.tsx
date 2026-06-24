// src/modules/financial-management/treasury/expense-approval/user-expense-limit-approval/components/ReviewProposalModal.tsx

"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { X, Check, Ban, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProcessLimitProposal } from "../hooks/useUserExpenseLimitApproval";
import { useCoas } from "../../user-expense-limit/hooks/useUserExpenseLimit";
import type { PendingLimitApproval, Coa } from "../../user-expense-limit/types";
import { formatPeso, BUDGET_COAS } from "../../user-expense-limit/utils";
import { getCoaConfig } from "../../user-expense-limit/components/LimitTable";

interface ReviewProposalModalProps {
  proposal:  PendingLimitApproval;
  onClose:   () => void;
  onSuccess: (message: string) => void;
}

export function ReviewProposalModal({ proposal, onClose, onSuccess }: ReviewProposalModalProps) {
  const { processProposal, loading } = useProcessLimitProposal();
  const { coas } = useCoas();

  const defaultCoaIds = useMemo(() => new Set(BUDGET_COAS.map(c => c.id)), []);

  const [formLimits, setFormLimits] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    
    // Set default COAs
    BUDGET_COAS.forEach(coa => {
      init[coa.id] = proposal.limits[coa.id] || "";
    });

    // Set custom COAs
    Object.entries(proposal.limits).forEach(([coaIdStr, val]) => {
      const id = Number(coaIdStr);
      if (!defaultCoaIds.has(id)) {
        init[id] = val;
      }
    });

    return init;
  });

  // Resolve custom COA objects from loaded list
  const customCoasInProposal = useMemo(() => {
    const list: Coa[] = [];
    Object.keys(proposal.limits).forEach(coaIdStr => {
      const id = Number(coaIdStr);
      if (!defaultCoaIds.has(id)) {
        const detail = coas.find(c => c.coa_id === id);
        list.push({
          coa_id: id,
          account_title: detail?.account_title ?? `Account #${id}`,
          gl_code: detail?.gl_code ?? "—"
        });
      }
    });
    return list;
  }, [proposal.limits, coas, defaultCoaIds]);

  const handleLimitChange = (coaId: number, val: string) => {
    setFormLimits(prev => ({
      ...prev,
      [coaId]: val
    }));
  };

  const handleAction = async (action: "approve" | "reject") => {
    const finalizedLimits: Record<number, number> = {};
    
    // Default limits
    BUDGET_COAS.forEach(coa => {
      finalizedLimits[coa.id] = parseFloat(formLimits[coa.id]) || 0;
    });

    // Custom limits
    customCoasInProposal.forEach(coa => {
      finalizedLimits[coa.coa_id] = parseFloat(formLimits[coa.coa_id]) || 0;
    });

    const payload = {
      user_id: proposal.user_id,
      action,
      limits: action === "approve" ? finalizedLimits : undefined,
    };

    const result = await processProposal(payload);
    if (result.success) {
      onSuccess(result.message || "Request processed successfully.");
      onClose();
    }
  };

  const totalProposed = Object.keys(formLimits).reduce(
    (sum, coaIdStr) => sum + (parseFloat(formLimits[Number(coaIdStr)]) || 0),
    0
  );

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none select-none">
        <div className="pointer-events-auto w-full max-w-lg bg-background rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0 bg-muted/20">
            <div>
              <h2 className="text-base font-black tracking-tight text-foreground/90">Review Limit Proposal</h2>
              <p className="text-xs text-muted-foreground/80 mt-1 font-semibold">
                Review, modify, or reject proposed limits for <span className="font-extrabold text-foreground">{proposal.user_name ?? `User #${proposal.user_id}`}</span>
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 bg-background/50">
            
            {/* Submitter Details */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-muted/10 border border-border/60 rounded-xl p-4 select-text">
              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground/90 block">Department</span>
                <span className="text-xs font-bold text-foreground mt-0.5 block">{proposal.user_department ?? "—"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground/90 block">Proposed By</span>
                <span className="text-xs font-bold text-foreground mt-0.5 block">{proposal.created_by_name ?? "—"}</span>
              </div>
              <div className="col-span-2 border-t border-border/40 pt-3 mt-1">
                <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground/90 block">Reason / Remarks from Submitter</span>
                <span className="text-xs font-medium text-foreground italic block mt-1 bg-muted/20 p-2.5 rounded-lg border border-border/30">
                  {proposal.remarks ? `"${proposal.remarks}"` : "No remarks provided."}
                </span>
              </div>
            </div>

            {/* Editable COA limits */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">Proposed Ceilings (Modify amounts below if needed)</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Default limits */}
                {BUDGET_COAS.map(coa => {
                  const config = getCoaConfig(coa.id, coa.name, coa.glCode);
                  return (
                    <div key={coa.id} className="relative p-4 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-border-hover hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 overflow-hidden">
                      <div className="absolute top-0 right-0 w-10 h-10 bg-gradient-to-br opacity-5 rounded-bl-full pointer-events-none" />
                      
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg border shrink-0 ${config.colorClass}`}>
                          <config.icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-foreground/95 block">{config.name}</span>
                          <span className="text-[9px] text-muted-foreground font-bold font-mono bg-muted/80 px-1 py-0.5 rounded leading-none">GL: {config.glCode}</span>
                        </div>
                      </div>
                      
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₱</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={formLimits[coa.id] ?? ""}
                          onChange={e => handleLimitChange(coa.id, e.target.value)}
                          className="h-9 text-xs pl-7 text-foreground font-black bg-background border-border/80 focus-visible:ring-primary rounded-lg shadow-inner"
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Custom limits */}
                {customCoasInProposal.map(coa => {
                  const config = getCoaConfig(coa.coa_id, coa.account_title, coa.gl_code);
                  return (
                    <div key={coa.coa_id} className="relative p-4 rounded-xl border border-dashed border-violet-500/35 bg-violet-500/[0.01] shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:border-violet-500/60 hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 overflow-hidden">
                      <div className="flex items-center gap-2.5 pr-6">
                        <div className={`p-2 rounded-lg border shrink-0 ${config.colorClass}`}>
                          <config.icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-foreground/95 block truncate max-w-[120px]">{config.name}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[9px] text-muted-foreground font-bold font-mono bg-muted/80 px-1 py-0.5 rounded leading-none">GL: {config.glCode}</span>
                            <Badge variant="outline" className="text-[8px] bg-purple-500/10 text-purple-600 border-none font-bold py-0 px-1 rounded leading-none h-3.5">Custom</Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₱</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={formLimits[coa.coa_id] ?? ""}
                          onChange={e => handleLimitChange(coa.coa_id, e.target.value)}
                          className="h-9 text-xs pl-7 text-foreground font-black bg-background border-border/80 focus-visible:ring-primary rounded-lg shadow-inner"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Proposed Total */}
              <div className="flex items-center justify-between border-t border-border/80 pt-4 text-xs font-bold bg-muted/5 p-3 rounded-xl border select-text">
                <span className="text-muted-foreground font-black uppercase tracking-wider text-[10px]">Proposed Total Limit:</span>
                <span className="text-primary font-black text-base">{formatPeso(totalProposed)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-muted/20 flex justify-between gap-2 shrink-0">
            {/* Reject Action */}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={loading}
              onClick={() => handleAction("reject")}
              className="h-9 px-4 text-xs font-bold rounded-xl gap-1.5 shadow-sm"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
              Reject Request
            </Button>

            {/* Edit / Save / Approve Actions */}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-9 px-4 text-xs font-semibold rounded-xl">
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={loading}
                onClick={() => handleAction("approve")}
                className="h-9 px-4 text-xs font-bold rounded-xl gap-1.5 shadow-sm"
              >
                {loading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</>
                ) : (
                  <><Check className="h-3.5 w-3.5" /> Approve & Update</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
