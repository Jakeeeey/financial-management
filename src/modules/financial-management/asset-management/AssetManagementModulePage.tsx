"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { columns } from "./components/data-table/columns";
import { AssetTableData } from "./types";
import { AssetDataTable } from "./components/data-table";
import { formatPHP, getDepreciatedValue } from "./utils/lib";
import { ColumnFiltersState } from "@tanstack/react-table";
import { AssetTableSkeleton } from "./components/data-table/skeleton-loader";
import { ErrorPage } from "@/app/(financial-management)/fm/_components/ErrorPage";
import AddAssetModal from "./components/modals/AddAssetModal";

export default function AssetManagementModulePage() {
  const [data, setData] = useState<AssetTableData[]>([]);
  const [errorState, setErrorState] = useState<{
    hasError: boolean;
    message?: string;
  }>({
    hasError: false,
  });
  const [loading, setLoading] = useState(true);
  const [projectionDate, setProjectionDate] = useState<Date>(new Date());
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const totalValue = useMemo(() => {
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

  const fetchAssets = async () => {
    try {
      setLoading(true);
      setErrorState({ hasError: false });

      const response = await fetch("/api/fm/asset-management");

      if (!response.ok) throw new Error("Failed to fetch data from server");

      const result = await response.json();

      // If result is not what we expect, throw error
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
  };

  useEffect(() => {
    fetchAssets();
  }, []);

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchAssets}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <AddAssetModal onSuccess={fetchAssets} />
        </div>
      </div>

      <AssetDataTable
        columns={columns}
        data={data}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        tableMeta={{
          projectionDate,
          setProjectionDate,
        }}
      />
    </div>
  );
}
