"use client";

import { useState } from "react";
import { useSuppliers } from "@/modules/financial-management/supplier-registration/hooks/useSuppliers";
import { DataTable } from "./components/data-table";
import { createColumns } from "./components/data-table/columns";
import { SupplierDetailsModal } from "@/modules/financial-management/supplier-registration/components/modals/SupplierDetailsModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Supplier } from "@/modules/financial-management/supplier-registration/types/supplier.schema";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EditSupplierModal } from "./components/modals/edit-supplier-modal";

export default function SupplierRepresentativeModulePage() {
  const { suppliers, isLoading, error, refresh, setSearchQuery } =
    useSuppliers();
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Handle view supplier
  const handleView = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setViewModalOpen(true);
  };

  // Handle edit supplier
  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setEditModalOpen(true);
  };

  // Handle edit success
  const handleEditSuccess = () => {
    refresh();
    toast.success("Supplier updated successfully");
  };

  // Create columns with handlers
  const columns = createColumns({
    onView: handleView,
    onEdit: handleEdit,
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Supplier Registration
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage suppliers and their representatives
          </p>
        </div>
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
          <Button onClick={() => toast.info("Add supplier form coming soon!")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Suppliers List</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-12">
              <p className="text-destructive font-medium">
                Error loading suppliers
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {error.message}
              </p>
              <Button onClick={refresh} variant="outline" className="mt-4">
                Try Again
              </Button>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={suppliers}
              searchPlaceholder="Search by name, TIN, or contact person..."
              onSearchChange={setSearchQuery}
            />
          )}
        </CardContent>
      </Card>

      {/* Supplier Details Modal */}
      <SupplierDetailsModal
        supplier={selectedSupplier}
        open={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedSupplier(null);
        }}
      />

      {/* Edit Supplier Modal */}
      <EditSupplierModal
        supplier={selectedSupplier}
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedSupplier(null);
        }}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
