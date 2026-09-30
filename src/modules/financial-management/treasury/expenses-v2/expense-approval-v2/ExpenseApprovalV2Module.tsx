"use client";

import React, { useState, useEffect, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import {
  ExpenseItem,
  SupplierOption,
  ChartOfAccountOption,
  DivisionInfo,
  DepartmentOption,
  EncoderGroupSummary,
  ExpenseApprover,
} from "./types";
import { EncoderCardsGrid } from "./components/EncoderCardsGrid";
import { ApprovalQueueTable } from "./components/ApprovalQueueTable";

export const ExpenseApprovalV2Module: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [coas, setCoas] = useState<ChartOfAccountOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionInfo[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [approvers, setApprovers] = useState<ExpenseApprover[]>([]);

  // Navigation state: null = Encoders List (Screen 1), number = Selected Encoder ID (Screen 2)
  const [selectedEncoderId, setSelectedEncoderId] = useState<number | null>(null);

  // Fetch initial dropdown and queue data
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch pending queue (scoped to logged in user's assigned divisions)
      const queueRes = await fetch("/api/fm/treasury/expenses-v2/expense-approval-v2/queue");
      const queueJson = await queueRes.json();
      setExpenses(queueJson.data || []);

      // Fetch suppliers
      const supRes = await fetch("/api/fm/treasury/expenses-v2/expense-creation-v2/suppliers");
      const supJson = await supRes.json();
      setSuppliers(supJson.data || []);

      // Fetch COA
      const coaRes = await fetch("/api/fm/treasury/expenses-v2/expense-creation-v2/chart_of_accounts");
      const coaJson = await coaRes.json();
      setCoas(coaJson.data || []);

      // Fetch Divisions
      const divRes = await fetch("/api/fm/treasury/expenses-v2/expense-creation-v2/division");
      const divJson = await divRes.json();
      setDivisions(divJson.data || []);

      // Fetch Departments
      const deptRes = await fetch("/api/fm/treasury/expenses-v2/expense-creation-v2/department");
      const deptJson = await deptRes.json();
      setDepartments(deptJson.data || []);

      // Fetch Approvers
      const appRes = await fetch("/api/fm/treasury/expenses-v2/expense-approval-v2/approvers");
      const appJson = await appRes.json();
      setApprovers(appJson.data || []);
    } catch (e) {
      console.error("Error fetching approval module data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Group pending expenses per Encoder / Submitter (created_by)
  const encoderGroups = useMemo<EncoderGroupSummary[]>(() => {
    const groupsMap: Record<number, EncoderGroupSummary> = {};

    expenses.forEach((item) => {
      if (item.status !== "Pending Approval") return;

      const userObj =
        typeof item.created_by === "object" && item.created_by !== null
          ? item.created_by
          : null;

      const userId = userObj ? userObj.user_id : (item.created_by as number) || 0;
      const fname = userObj ? userObj.user_fname : "Unknown";
      const lname = userObj ? userObj.user_lname : `Encoder #${userId}`;
      const email = userObj ? userObj.user_email : undefined;

      if (!groupsMap[userId]) {
        groupsMap[userId] = {
          user_id: userId,
          user_fname: fname,
          user_lname: lname,
          user_email: email,
          division_id: item.division_id,
          pending_count: 0,
          total_amount: 0,
          items: [],
        };
      }

      groupsMap[userId].items.push(item);
      groupsMap[userId].pending_count += 1;
      groupsMap[userId].total_amount += Number(item.amount || 0);
    });

    return Object.values(groupsMap);
  }, [expenses]);

  // Selected encoder details
  const selectedEncoderGroup = useMemo(() => {
    if (!selectedEncoderId) return null;
    return encoderGroups.find((g) => g.user_id === selectedEncoderId) || null;
  }, [selectedEncoderId, encoderGroups]);

  // Auto return to Encoders list if selected encoder has 0 pending items left
  useEffect(() => {
    if (selectedEncoderId && !selectedEncoderGroup) {
      setSelectedEncoderId(null);
    }
  }, [selectedEncoderId, selectedEncoderGroup]);

  // Action callback: Approve / Return with Concern / Reject
  const handleConfirmAction = async (payload: {
    expense_id?: number;
    expense_ids?: number[];
    action: "Approve" | "With Concern" | "Reject";
    remarks?: string;
    created_at: string;
  }) => {
    const res = await fetch("/api/fm/treasury/expenses-v2/expense-approval-v2/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json();
      throw new Error(errJson.error || "Failed to process approval action.");
    }

    // Refresh pending queue data
    fetchData();
  };

  return (
    <div className="space-y-6">
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Expense Approval V2
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and approve division expense receipts grouped by encoder profiles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg border border-border/60 bg-card/60 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* VIEW SWITCHING: SCREEN 1 (ENCODER CARDS GRID) vs SCREEN 2 (SINGLE ENCODER RECEIPTS TABLE) */}
      {!selectedEncoderId ? (
        <EncoderCardsGrid
          groups={encoderGroups}
          divisions={divisions}
          onSelectEncoder={(userId) => setSelectedEncoderId(userId)}
        />
      ) : (
        <ApprovalQueueTable
          expenses={selectedEncoderGroup ? selectedEncoderGroup.items : []}
          suppliers={suppliers}
          coas={coas}
          divisions={divisions}
          departments={departments}
          approvers={approvers}
          selectedEncoderName={
            selectedEncoderGroup
              ? `${selectedEncoderGroup.user_fname} ${selectedEncoderGroup.user_lname}`
              : undefined
          }
          onBackToEncoders={() => setSelectedEncoderId(null)}
          onConfirmAction={handleConfirmAction}
        />
      )}
    </div>
  );
};
