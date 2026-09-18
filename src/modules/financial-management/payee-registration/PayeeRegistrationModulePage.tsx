"use client";

import { useState, useMemo, useCallback } from "react";
import { usePayees } from "./hooks/usePayees";
import { PayeesTable } from "./components/data-table";
import { createColumns } from "./components/data-table/columns";
import {
  PayeeFilters,
  PayeeFilterState,
} from "./components/payee-filters";
import { PayeeDetailsModal } from "./components/modals/payee-details-modal";
import { Button } from "@/components/ui/button";
import { Payee } from "./types/payee.schema";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EditPayeeModal } from "./components/modals/edit-payee-modal";
import { DataTableSkeleton } from "@/app/(financial-management)/fm/_components/DataTableSkeleton";
import { AddPayeeModal } from "./components/modals/add-payee-modal";
import { ErrorPage } from "@/app/(financial-management)/fm/_components/ErrorPage";

export default function PayeeRegistrationModulePage() {
  const { payees, isLoading, error, refresh } =
    usePayees();
  const [filters, setFilters] = useState<PayeeFilterState>({
    search: "",
    payeeId: "",
    status: "ALL",
  });
  const [selectedPayee, setSelectedPayee] = useState<Payee | null>(
    null,
  );
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Handle view payee
  const handleView = useCallback((payee: Payee) => {
    setSelectedPayee(payee);
    setViewModalOpen(true);
  }, []);

  // Handle edit payee
  const handleEdit = useCallback((payee: Payee) => {
    setSelectedPayee(payee);
    setEditModalOpen(true);
  }, []);

  // Handle edit success
  const handleEditSuccess = () => {
    refresh();
    toast.success("Payee updated successfully");
  };

  // Handle add payee success
  const handleAddSuccess = () => {
    refresh();
    toast.success("Payee created successfully");
  };

  const filteredPayees = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const searchDigits = search.replace(/\D/g, "");

    return (payees || []).filter((payee) => {
      const searchableText = [
        payee.contact_person,
        payee.email_address,
        payee.phone_number,
        payee.bank_details,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const tin = String(payee.tin_number || "");
      const phone = String(payee.phone_number || "");
      const matchesSearch =
        !search ||
        searchableText.includes(search) ||
        (searchDigits.length > 0 &&
          (tin.replace(/\D/g, "").includes(searchDigits) ||
            phone.replace(/\D/g, "").includes(searchDigits)));
      const matchesPayeeName =
        !filters.payeeId || String(payee.id) === filters.payeeId;
      const isActive = Number(payee.isActive) === 1;
      const matchesStatus =
        filters.status === "ALL" ||
        (filters.status === "ACTIVE" && isActive) ||
        (filters.status === "INACTIVE" && !isActive);

      return matchesSearch && matchesPayeeName && matchesStatus;
    });
  }, [filters, payees]);

  // Create columns with handlers
  const columns = useMemo(
    () =>
      createColumns({
        onView: handleView,
        onEdit: handleEdit,
      }),
    [handleView, handleEdit],
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <DataTableSkeleton />
      </div>
    );
  }

  if (error.hasError) {
    return (
      <div>
        <ErrorPage
          title="Data Connection Error"
          message={error.message}
          onRefresh={refresh}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
          <Button onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Payee
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <PayeeFilters
        filters={filters}
        payees={payees || []}
        onFiltersChange={setFilters}
        onReset={() =>
          setFilters({ search: "", payeeId: "", status: "ALL" })
        }
      />
      <PayeesTable
        columns={columns}
        data={filteredPayees}
        isLoading={isLoading}
        paginationResetKey={JSON.stringify(filters)}
      />

      {/* Payee Details Modal */}
      <PayeeDetailsModal
        payee={selectedPayee}
        open={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedPayee(null);
        }}
      />

      {/* Edit Payee Modal */}
      <EditPayeeModal
        payee={selectedPayee}
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedPayee(null);
        }}
        onSuccess={handleEditSuccess}
      />

      {/* Add Payee Modal */}
      <AddPayeeModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
}
