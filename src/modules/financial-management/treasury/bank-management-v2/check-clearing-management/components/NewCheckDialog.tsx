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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { phtDate } from "../pht";
import { DateField } from "./DateField";
import { OptionCombobox } from "./OptionCombobox";
import type { IssueCheckPayload, ReceiveCheckPayload } from "../providers/checksApi";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: { bankId: number; label: string }[];
  isSaving: boolean;
  onIssue: (payload: IssueCheckPayload) => Promise<unknown>;
  onReceive: (payload: ReceiveCheckPayload) => Promise<unknown>;
};

const emptyIssue = { bankAccountId: "", checkDate: phtDate(), amount: "", payee: "", remarks: "" };
const emptyReceive = { bankAccountId: "", checkNo: "", checkDate: phtDate(), amount: "", draweeBank: "", payor: "", remarks: "" };

/** FSD 1.4 — issue a check from the active checkbook, or record one received. */
export function NewCheckDialog({ open, onOpenChange, accounts, isSaving, onIssue, onReceive }: Props) {
  const [tab, setTab] = useState("issue");
  const [issue, setIssue] = useState(emptyIssue);
  const [receive, setReceive] = useState(emptyReceive);
  const [touched, setTouched] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setIssue(emptyIssue);
      setReceive(emptyReceive);
      setTouched(false);
    }
    onOpenChange(next);
  }

  const today = phtDate();
  const issueErrors = {
    bankAccountId: issue.bankAccountId ? "" : "Choose the account the check is drawn on.",
    checkDate: issue.checkDate ? "" : "Pick the check date.",
    amount: Number(issue.amount) > 0 ? "" : "Enter an amount greater than zero.",
    payee: issue.payee.trim() ? "" : "Enter the payee.",
  };
  const receiveErrors = {
    bankAccountId: receive.bankAccountId ? "" : "Choose the deposit account.",
    checkNo: receive.checkNo.trim() ? "" : "Enter the check number.",
    checkDate: receive.checkDate ? "" : "Pick the check date.",
    amount: Number(receive.amount) > 0 ? "" : "Enter an amount greater than zero.",
    draweeBank: receive.draweeBank.trim() ? "" : "Enter the drawee bank.",
  };

  const issueBlocked = Object.values(issueErrors).some(Boolean);
  const receiveBlocked = Object.values(receiveErrors).some(Boolean);

  async function submitIssue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (Object.values(issueErrors).some(Boolean)) return;
    const saved = await onIssue({
      bankAccountId: Number(issue.bankAccountId),
      checkDate: issue.checkDate,
      amount: Number(issue.amount),
      payee: issue.payee.trim(),
      remarks: issue.remarks.trim() || null,
    });
    if (saved) onOpenChange(false);
  }

  async function submitReceive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (Object.values(receiveErrors).some(Boolean)) return;
    const saved = await onReceive({
      bankAccountId: Number(receive.bankAccountId),
      checkNo: receive.checkNo.trim(),
      checkDate: receive.checkDate,
      amount: Number(receive.amount),
      draweeBank: receive.draweeBank.trim() || null,
      payor: receive.payor.trim() || null,
      remarks: receive.remarks.trim() || null,
    });
    if (saved) onOpenChange(false);
  }

  const accountOptions = accounts.map((account) => ({ value: String(account.bankId), label: account.label }));

  const accountSelect = (
    value: string,
    onChange: (next: string) => void,
    id: string,
    label: string,
    error?: string,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} <span className="text-destructive">*</span>
      </Label>
      <OptionCombobox
        id={id}
        options={accountOptions}
        value={value}
        onChange={onChange}
        placeholder="Select account"
        searchPlaceholder="Search accounts"
        emptyLabel="No account matches that search."
      />
      {touched && error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] sm:max-w-[600px] p-0 rounded-2xl">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Add a check</DialogTitle>
            <DialogDescription className="line-clamp-2 max-w-md">
              Issue a check from the active checkbook series, or record a customer check received.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 overflow-hidden">
            <div className="px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="issue" className="min-h-11 md:min-h-0">Issue a check</TabsTrigger>
                <TabsTrigger value="receive" className="min-h-11 md:min-h-0">Record received</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="issue" className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <form id="issue-check-form" onSubmit={submitIssue} className="space-y-4">
                {accountSelect(issue.bankAccountId, (next) => setIssue({ ...issue, bankAccountId: next }), "issue-account", "Account drawn on", issueErrors.bankAccountId)}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="issue-date">
                      Check date <span className="text-destructive">*</span>
                    </Label>
                    <DateField
                      id="issue-date"
                      inDialog
                      value={issue.checkDate}
                      onChange={(value) => setIssue({ ...issue, checkDate: value })}
                    />
                    {touched && issueErrors.checkDate && (
                      <p className="text-xs text-destructive">{issueErrors.checkDate}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issue-amount">
                      Amount <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="issue-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={issue.amount}
                      onChange={(event) => setIssue({ ...issue, amount: event.target.value })}
                    />
                    {touched && issueErrors.amount && <p className="text-xs text-destructive">{issueErrors.amount}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issue-payee">
                    Payee <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="issue-payee"
                    value={issue.payee}
                    maxLength={120}
                    onChange={(event) => setIssue({ ...issue, payee: event.target.value })}
                  />
                  {touched && issueErrors.payee && <p className="text-xs text-destructive">{issueErrors.payee}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issue-remarks">Remarks</Label>
                  <Textarea
                    id="issue-remarks"
                    rows={3}
                    maxLength={500}
                    className="min-h-[100px] resize-none"
                    value={issue.remarks}
                    onChange={(event) => setIssue({ ...issue, remarks: event.target.value })}
                  />
                </div>
              </form>
            </TabsContent>

            <TabsContent value="receive" className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <form id="receive-check-form" onSubmit={submitReceive} className="space-y-4">
                {accountSelect(receive.bankAccountId, (next) => setReceive({ ...receive, bankAccountId: next }), "receive-account", "Deposit account", receiveErrors.bankAccountId)}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="receive-no">
                      Check number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="receive-no"
                      value={receive.checkNo}
                      maxLength={40}
                      onChange={(event) => setReceive({ ...receive, checkNo: event.target.value })}
                    />
                    {touched && receiveErrors.checkNo && (
                      <p className="text-xs text-destructive">{receiveErrors.checkNo}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receive-bank">
                      Drawee bank <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="receive-bank"
                      value={receive.draweeBank}
                      maxLength={120}
                      onChange={(event) => setReceive({ ...receive, draweeBank: event.target.value })}
                    />
                    {touched && receiveErrors.draweeBank && (
                      <p className="text-xs text-destructive">{receiveErrors.draweeBank}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receive-date">
                      Check date <span className="text-destructive">*</span>
                    </Label>
                    {receive.checkDate > today && (
                      <p className="text-xs text-muted-foreground">Future-dated — stored as a PDC.</p>
                    )}
                    <DateField
                      id="receive-date"
                      inDialog
                      value={receive.checkDate}
                      onChange={(value) => setReceive({ ...receive, checkDate: value })}
                    />
                    {touched && receiveErrors.checkDate && (
                      <p className="text-xs text-destructive">{receiveErrors.checkDate}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receive-amount">
                      Amount <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="receive-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={receive.amount}
                      onChange={(event) => setReceive({ ...receive, amount: event.target.value })}
                    />
                    {touched && receiveErrors.amount && (
                      <p className="text-xs text-destructive">{receiveErrors.amount}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receive-payor">Payor</Label>
                  <Input
                    id="receive-payor"
                    value={receive.payor}
                    maxLength={120}
                    onChange={(event) => setReceive({ ...receive, payor: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receive-remarks">Remarks</Label>
                  <Textarea
                    id="receive-remarks"
                    rows={3}
                    maxLength={500}
                    className="min-h-[100px] resize-none"
                    value={receive.remarks}
                    onChange={(event) => setReceive({ ...receive, remarks: event.target.value })}
                  />
                </div>
              </form>
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form={tab === "issue" ? "issue-check-form" : "receive-check-form"} disabled={isSaving || accounts.length === 0 || (tab === "issue" ? issueBlocked : receiveBlocked)}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tab === "issue" ? "Issue check" : "Record check"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
