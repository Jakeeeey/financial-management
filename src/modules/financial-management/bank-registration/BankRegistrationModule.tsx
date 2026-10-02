"use client";

import React, { useState, useEffect } from "react";
import { Bank } from "./types/bank.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Edit } from "lucide-react";

export function BankRegistrationModule() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentBank, setCurrentBank] = useState<Partial<Bank>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchBanks = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/fm/bank-registration");
      const data = await res.json();
      if (data.success) {
        setBanks(data.data);
      } else {
        toast.error(data.error || "Failed to fetch banks");
      }
    } catch {
      toast.error("An error occurred while fetching banks");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  const handleOpenDialog = (bank?: Bank) => {
    if (bank) {
      setCurrentBank(bank);
    } else {
      setCurrentBank({ bank_name: "" });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setCurrentBank({});
  };

  const handleSaveBank = async () => {
    if (!currentBank.bank_name?.trim()) {
      toast.error("Bank name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const isEditing = !!currentBank.id;
      const url = isEditing
        ? `/api/fm/bank-registration/${currentBank.id}`
        : "/api/fm/bank-registration";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank_name: currentBank.bank_name }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Bank saved successfully");
        fetchBanks();
        handleCloseDialog();
      } else {
        toast.error(data.error || "Failed to save bank");
      }
    } catch {
      toast.error("An error occurred while saving the bank");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBanks = banks.filter((bank) =>
    bank.bank_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Bank Registration</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" /> Add Bank
        </Button>
      </div>

      <div className="flex items-center w-full max-w-sm">
        <Input
          placeholder="Search banks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Bank Name</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredBanks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No banks found.
                </TableCell>
              </TableRow>
            ) : (
              filteredBanks.map((bank) => (
                <TableRow key={bank.id}>
                  <TableCell className="font-medium">{bank.id}</TableCell>
                  <TableCell>{bank.bank_name}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleOpenDialog(bank)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentBank.id ? "Edit Bank" : "Add New Bank"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="bank_name" className="text-sm font-medium">
                Bank Name
              </label>
              <Input
                id="bank_name"
                value={currentBank.bank_name || ""}
                onChange={(e) =>
                  setCurrentBank({ ...currentBank, bank_name: e.target.value })
                }
                placeholder="Enter bank name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveBank} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
