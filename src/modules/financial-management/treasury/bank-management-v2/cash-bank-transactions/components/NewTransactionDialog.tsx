"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { EVENT_LABELS, TRANSACTION_KIND_LABELS } from "../constants";
import type { MemoBody, TransferBody } from "../schemas";
import type { AccountOption, ExpenseAccountOption } from "../types";
import { CreditMemoForm } from "./forms/CreditMemoForm";
import { DebitMemoForm } from "./forms/DebitMemoForm";
import { InterestForm } from "./forms/InterestForm";
import { TransferForm } from "./forms/TransferForm";

type DialogKind = "CREDIT" | "DEBIT" | "INTEREST" | "TRANSFER";

interface NewTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountOption[];
  expenseAccounts: ExpenseAccountOption[];
  isSaving: boolean;
  onCreateMemo: (body: MemoBody) => Promise<unknown>;
  onCreateTransfer: (body: TransferBody) => Promise<unknown>;
  onPosted: () => void;
}

const TABS: { value: DialogKind; label: string; event: string }[] = [
  { value: "CREDIT", label: "Credit memo", event: "E02" },
  { value: "DEBIT", label: "Debit memo", event: "E03" },
  { value: "INTEREST", label: "Interest", event: "E04" },
  { value: "TRANSFER", label: "Transfer", event: "E05" },
];

const FORM_IDS: Record<DialogKind, string> = {
  CREDIT: "new-credit-memo-form",
  DEBIT: "new-debit-memo-form",
  INTEREST: "new-interest-form",
  TRANSFER: "new-transfer-form",
};

const SUBMIT_LABELS: Record<DialogKind, string> = {
  CREDIT: "Post credit memo",
  DEBIT: "Post debit memo",
  INTEREST: "Post interest",
  TRANSFER: "Post transfer",
};

/** One dialog, four posting types; the footer submits whichever tab's form is open. */
export function NewTransactionDialog({
  open,
  onOpenChange,
  accounts,
  expenseAccounts,
  isSaving,
  onCreateMemo,
  onCreateTransfer,
  onPosted,
}: NewTransactionDialogProps) {
  const [kind, setKind] = useState<DialogKind>("CREDIT");
  const formId = FORM_IDS[kind];

  const handleOpenChange = (next: boolean) => {
    if (!next && isSaving) return;
    onOpenChange(next);
    if (next) setKind("CREDIT");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[600px]">
        <DialogHeader className="border-b border-border/50 px-6 py-4">
          <DialogTitle>New transaction</DialogTitle>
          <DialogDescription>
            Every type posts a journal entry through the bank mapping, so a missing mapping blocks the post.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={kind} onValueChange={(value) => setKind(value as DialogKind)} className="flex min-h-0 flex-1 flex-col">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-4">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  disabled={isSaving}
                  className="min-h-11 md:min-h-0"
                  title={EVENT_LABELS[tab.event] ?? TRANSACTION_KIND_LABELS[tab.value]}
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="CREDIT" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <CreditMemoForm
              formId={formId}
              accounts={accounts}
              isSaving={isSaving}
              onSubmit={onCreateMemo}
              onPosted={onPosted}
            />
          </TabsContent>
          <TabsContent value="DEBIT" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <DebitMemoForm
              formId={formId}
              accounts={accounts}
              expenseAccounts={expenseAccounts}
              isSaving={isSaving}
              onSubmit={onCreateMemo}
              onPosted={onPosted}
            />
          </TabsContent>
          <TabsContent value="INTEREST" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <InterestForm
              formId={formId}
              accounts={accounts}
              isSaving={isSaving}
              onSubmit={onCreateMemo}
              onPosted={onPosted}
            />
          </TabsContent>
          <TabsContent value="TRANSFER" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <TransferForm
              formId={formId}
              accounts={accounts}
              isSaving={isSaving}
              onSubmit={onCreateTransfer}
              onPosted={onPosted}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t border-border/50 bg-muted/20 px-6 py-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} disabled={isSaving} className="min-h-11 md:min-h-0">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Posting
              </>
            ) : (
              SUBMIT_LABELS[kind]
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
