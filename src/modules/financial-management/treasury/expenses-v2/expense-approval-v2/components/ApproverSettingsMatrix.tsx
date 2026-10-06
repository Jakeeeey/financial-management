"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpenseApprover, DivisionInfo, UserInfo } from "../types";
import { Plus, Trash2, Building2, Layers, ShieldCheck } from "lucide-react";
import { AddApproverModal } from "./AddApproverModal";

interface ApproverSettingsMatrixProps {
  approvers: ExpenseApprover[];
  divisions: DivisionInfo[];
  users: UserInfo[];
  onAddApprover: (data: {
    approver_id: number;
    division_id: number;
    approver_hierarchy: number;
    created_at: string;
  }) => Promise<void>;
  onDeleteApprover: (id: number, deleted_at: string) => Promise<void>;
}

export const ApproverSettingsMatrix: React.FC<ApproverSettingsMatrixProps> = ({
  approvers,
  divisions,
  users,
  onAddApprover,
  onDeleteApprover,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetDivisionId, setTargetDivisionId] = useState<number | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleOpenAddForDivision = (divId?: number) => {
    setTargetDivisionId(divId);
    setIsAddModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this approver from the division?")) return;
    
    // Direct literal PH timestamp format: YYYY-MM-DDTHH:mm:ss.sssZ (without +8h shift)
    const now = new Date();
    const literalPhTimestamp = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000
    )
      .toISOString()
      .replace("Z", "+08:00");

    try {
      setDeletingId(id);
      await onDeleteApprover(id, literalPhTimestamp);
      setDeletingId(null);
    } catch {
      setDeletingId(null);
      alert("Failed to delete approver.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/60 p-4 rounded-xl border border-border/60">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Division Approval Hierarchy Settings
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure multi-level sequential expense approvers per Division.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => handleOpenAddForDivision()}
          className="gap-1.5 text-xs bg-primary text-primary-foreground font-semibold"
        >
          <Plus className="w-3.5 h-3.5" /> Add Approver
        </Button>
      </div>

      {/* Division Cards Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {divisions.map((div) => {
          // Filter approvers for this division sorted by hierarchy
          const divApprovers = approvers
            .filter((a) => {
              const divId =
                typeof a.division_id === "object"
                  ? a.division_id.division_id
                  : a.division_id;
              return divId === div.division_id && !a.is_deleted;
            })
            .sort((a, b) => a.approver_hierarchy - b.approver_hierarchy);

          return (
            <div
              key={div.division_id}
              className="bg-card/70 border border-border/60 hover:border-primary/40 rounded-xl p-4 space-y-3 shadow-xs flex flex-col justify-between transition-all"
            >
              <div>
                {/* Division Header */}
                <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{div.division_name}</h4>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {div.division_code || `DIV-${div.division_id}`}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {divApprovers.length} {divApprovers.length === 1 ? "Level" : "Levels"}
                  </Badge>
                </div>

                {/* Assigned Approvers List */}
                <div className="space-y-2 pt-3">
                  {divApprovers.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground italic border border-dashed border-border/50 rounded-lg">
                      No assigned approvers yet.
                    </div>
                  ) : (
                    divApprovers.map((app) => {
                      const userObj =
                        typeof app.approver_id === "object"
                          ? app.approver_id
                          : users.find((u) => u.user_id === app.approver_id);

                      const userName = userObj
                        ? `${userObj.user_fname} ${userObj.user_lname}`
                        : `User #${app.approver_id}`;

                      return (
                        <div
                          key={app.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs hover:bg-muted/70 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] bg-primary/10 text-primary border-primary/30 shrink-0"
                            >
                              <Layers className="w-3 h-3 mr-1" /> Level {app.approver_hierarchy}
                            </Badge>
                            <div className="truncate">
                              <span className="font-medium text-foreground block truncate" title={userName}>
                                {userName}
                              </span>
                              {userObj?.user_position ? (
                                <span className="text-[10px] text-muted-foreground block truncate">
                                  {userObj.user_position}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={deletingId === app.id}
                            onClick={() => handleDelete(app.id)}
                            className="h-7 w-7 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
                            title="Remove Approver"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Add Approver Button for Division */}
              <div className="pt-3 border-t border-border/40">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenAddForDivision(div.division_id)}
                  className="w-full text-xs gap-1.5 bg-background/60 border-border/60 hover:bg-muted"
                >
                  <Plus className="w-3.5 h-3.5 text-primary" /> Assign Approver to {div.division_name}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Approver Modal */}
      <AddApproverModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        users={users}
        divisions={divisions}
        existingApprovers={approvers}
        defaultDivisionId={targetDivisionId}
        onSave={onAddApprover}
      />
    </div>
  );
};
