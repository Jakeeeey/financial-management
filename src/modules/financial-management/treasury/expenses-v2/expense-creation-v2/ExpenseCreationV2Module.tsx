"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ExpenseSummaryCards } from "./components/ExpenseSummaryCards";
import { ExpenseTable } from "./components/ExpenseTable";
import { SingleExpenseModal } from "./components/SingleExpenseModal";
import { BulkExpenseModal } from "./components/BulkExpenseModal";
import { RevisionDrawer } from "./components/RevisionDrawer";
import { HistoryLogModal } from "./components/HistoryLogModal";
import {
  ExpenseItem,
  ExpenseFormValues,
  SupplierOption,
  ChartOfAccountOption,
  DivisionOption,
  DepartmentOption,
  ExpenseApproverOption,
  UserDefaultsOption,
} from "./types";
import {
  fetchExpenses,
  createSingleExpense,
  createBulkExpenses,
  resubmitExpense,
  submitDraftExpense,
  deleteExpense,
} from "./services/expenseService";
import {
  fetchDivisions,
  fetchDepartments,
  fetchChartOfAccounts,
  fetchSuppliers,
  fetchExpenseApprovers,
  fetchUserDefaults,
} from "./services/referenceService";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Table as TableIcon, RefreshCw, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

export const ExpenseCreationV2Module: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [coas, setCoas] = useState<ChartOfAccountOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [approvers, setApprovers] = useState<ExpenseApproverOption[]>([]);
  const [userDefaults, setUserDefaults] = useState<UserDefaultsOption | null>(null);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Modals & Drawers state
  const [singleModalOpen, setSingleModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [revisionDrawerOpen, setRevisionDrawerOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const [selectedItemForRevision, setSelectedItemForRevision] = useState<ExpenseItem | null>(null);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<ExpenseItem | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [expenseData, divData, deptData, coaData, suppData, approverData, defaultsData] = await Promise.all([
        fetchExpenses(),
        fetchDivisions(),
        fetchDepartments(),
        fetchChartOfAccounts(),
        fetchSuppliers(),
        fetchExpenseApprovers(),
        fetchUserDefaults(),
      ]);

      setExpenses(expenseData);
      setDivisions(divData);
      setDepartments(deptData);
      setCoas(coaData);
      setSuppliers(suppData);
      setApprovers(approverData);
      setUserDefaults(defaultsData);
    } catch (err) {
      toast.error("Failed to load module data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleCreateSingle = async (values: ExpenseFormValues, asSubmit: boolean) => {
    await createSingleExpense(values, asSubmit);
    toast.success(asSubmit ? "Expense created & submitted for approval!" : "Expense saved as draft!");
    loadData();
  };

  const handleCreateBulk = async (items: ExpenseFormValues[], asSubmit: boolean) => {
    await createBulkExpenses(items, asSubmit);
    toast.success(
      asSubmit
        ? `${items.length} expenses created & submitted for approval!`
        : `${items.length} expenses saved as drafts!`
    );
    loadData();
  };

  const handleResubmitRevision = async (
    id: number,
    values: ExpenseFormValues,
    notes: string
  ) => {
    await resubmitExpense(id, values, notes);
    toast.success("Expense receipt resubmitted for approval!");
    loadData();
  };

  const handleSubmitDraft = async (id: number) => {
    try {
      await submitDraftExpense(id);
      toast.success("Draft expense submitted for approval!");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    }
  };

  const handleDeleteExpense = async (id: number) => {
    try {
      await deleteExpense(id);
      toast.success("Expense receipt deleted!");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deletion failed");
    }
  };

  const handleOpenHistory = (item: ExpenseItem) => {
    setSelectedItemForHistory(item);
    setHistoryModalOpen(true);
  };

  const handleOpenRevision = (item: ExpenseItem) => {
    setSelectedItemForRevision(item);
    setRevisionDrawerOpen(true);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Receipt className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Expense Creation V2</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Encode and manage expense receipts for pre-disbursement approval pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button variant="secondary" size="sm" onClick={() => setBulkModalOpen(true)}>
            <TableIcon className="w-4 h-4 mr-2" />
            Bulk Entry
          </Button>

          <Button size="sm" onClick={() => setSingleModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Single Expense
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <ExpenseSummaryCards
        expenses={expenses}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Status Filter Tabs & Main Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-muted/50 p-1 border border-border/60">
              <TabsTrigger value="all" className="text-xs">
                All Receipts ({expenses.length})
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-xs">
                Drafts ({expenses.filter((e) => e.status === "Draft").length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs text-blue-600 dark:text-blue-400 font-bold data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-600">
                Pending ({expenses.filter((e) => e.status === "Pending Approval").length})
              </TabsTrigger>
              <TabsTrigger value="concern" className="text-xs text-orange-500 font-bold">
                Needs Revision ({expenses.filter((e) => e.status === "With Concern").length})
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-xs text-emerald-500">
                Approved ({expenses.filter((e) => e.status === "Submitted To Disbursement").length})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-xs text-rose-500">
                Rejected ({expenses.filter((e) => e.status === "Rejected").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center border border-border/60 rounded-xl bg-card/20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <ExpenseTable
            expenses={expenses}
            suppliers={suppliers}
            coas={coas}
            divisions={divisions}
            departments={departments}
            approvers={approvers}
            onOpenHistory={handleOpenHistory}
            onOpenRevision={handleOpenRevision}
            onSubmitDraft={handleSubmitDraft}
            onDeleteExpense={handleDeleteExpense}
            activeTab={activeTab}
          />
        )}
      </div>

      {/* Single Expense Modal */}
      <SingleExpenseModal
        open={singleModalOpen}
        onOpenChange={setSingleModalOpen}
        suppliers={suppliers}
        coas={coas}
        divisions={divisions}
        departments={departments}
        userDefaults={userDefaults}
        onSubmit={handleCreateSingle}
      />

      {/* Bulk Expense Modal */}
      <BulkExpenseModal
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
        suppliers={suppliers}
        coas={coas}
        divisions={divisions}
        departments={departments}
        userDefaults={userDefaults}
        onSubmitBulk={handleCreateBulk}
      />

      {/* Revision Resubmission Drawer */}
      <RevisionDrawer
        open={revisionDrawerOpen}
        onOpenChange={setRevisionDrawerOpen}
        item={selectedItemForRevision}
        suppliers={suppliers}
        coas={coas}
        divisions={divisions}
        departments={departments}
        userDefaults={userDefaults}
        onResubmit={handleResubmitRevision}
      />

      {/* History Log Audit Modal */}
      <HistoryLogModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        item={selectedItemForHistory}
      />
    </div>
  );
};
