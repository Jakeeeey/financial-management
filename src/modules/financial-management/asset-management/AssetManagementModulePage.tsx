"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ColumnFiltersState } from "@tanstack/react-table";

// Components
import { columns } from "./components/data-table/columns";
import { AssetTableData } from "./types";
import { AssetDataTable } from "./components/data-table";
import { formatPHP, getDepreciatedValue } from "./utils/lib";
import { AssetTableSkeleton } from "./components/data-table/skeleton-loader";
import { ErrorPage } from "@/app/(financial-management)/fm/_components/ErrorPage";

// Modals
import AddAssetModal from "./components/modals/AddAssetModal";
import AssetViewModal from "./components/modals/AssetViewModal";
import AssetEditModal from "./components/modals/EditAssetModal";

export default function AssetManagementModulePage() {
  // --- State Management ---
  const [data, setData] = useState<AssetTableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    hasError: boolean;
    message?: string;
  }>({
    hasError: false,
  });

  // Table & Filter State
  const [projectionDate, setProjectionDate] = useState<Date>(new Date());
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Modal State
  const [selectedAsset, setSelectedAsset] = useState<AssetTableData | null>(
    null,
  );
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // --- Data Fetching ---
  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      setErrorState({ hasError: false });

      const response = await fetch("/api/fm/asset-management");
      if (!response.ok) throw new Error("Failed to fetch data from server");

      const result = await response.json();

      // [Guard Clause] Avoiding the .reduce crash if result is not an array
      if (!Array.isArray(result))
        throw new Error("Invalid data format received");

      setData(result);
    } catch (err: any) {
      console.error(err);
      setErrorState({
        hasError: true,
        message: err.message || "Could not load asset records.",
      });
      toast.error("Failed to load assets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // --- Memoized Calculations ---
  const totalValue = useMemo(() => {
    // [Guard Clause] Ensuring reduce doesn't run on non-arrays
    if (!Array.isArray(data)) return 0;

    return data.reduce((acc, asset) => {
      return (
        acc +
        getDepreciatedValue(
          Number(asset.cost_per_item),
          Number(asset.quantity),
          Number(asset.life_span),
          asset.date_acquired,
          projectionDate,
        )
      );
    }, 0);
  }, [data, projectionDate]);

  // --- Handlers for Table Actions (Meta Contract) ---
  const handleView = (asset: AssetTableData) => {
    setSelectedAsset(asset);
    setIsViewOpen(true);
  };

  const handleEdit = (asset: AssetTableData) => {
    setSelectedAsset(asset);
    setIsEditOpen(true);
  };

  // --- Render Logic ---
  if (loading) {
    return (
      <div className="p-6">
        <AssetTableSkeleton />
      </div>
    );
  }

  if (errorState.hasError) {
    return (
      <div className="p-6">
        <ErrorPage
          title="Data Connection Error"
          message={errorState.message}
          onRefresh={fetchAssets}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchAssets}
            disabled={loading}
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <AddAssetModal onSuccess={fetchAssets} />
        </div>

        {/* Optional: Display Total Inventory Value */}
        {/* <div className="text-right">
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
            Total Projected Inventory Value
          </p>
          <p className="text-2xl font-bold text-primary">
            {formatPHP(totalValue)}
          </p>
        </div> */}
      </div>

      {/* Main Data Table */}
      <AssetDataTable
        columns={columns}
        data={data}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        tableMeta={{
          projectionDate,
          setProjectionDate,
          onView: handleView, // Fulfilling meta contract for View
          onEdit: handleEdit, // Fulfilling meta contract for Edit
        }}
      />

      {/* Modals */}
      <AssetViewModal
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        asset={selectedAsset}
      />

      <AssetEditModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedAsset(null);
        }}
        onSuccess={fetchAssets}
        asset={selectedAsset}
      />
    </div>
  );
}
