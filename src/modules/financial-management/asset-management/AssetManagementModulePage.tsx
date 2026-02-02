"use client";

import React, { useEffect, useState, useMemo } from "react";
import AddAssetModal from "./components/AddAssetModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { columns } from "./components/data-table/columns";
import { AssetTableData } from "./types";
import { AssetDataTable } from "./components/data-table";
import { formatPHP, getDepreciatedValue } from "./utils/lib";

export default function AssetManagementModulePage() {
  const [data, setData] = useState<AssetTableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectionDate, setProjectionDate] = useState<Date>(new Date());

  // Calculate aggregate total for the summary header (Always Current Value)
  const totalValue = useMemo(() => {
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
      const response = await fetch("/api/fm/asset-management");
      const result = await response.json();
      setData(result);
    } catch (error) {
      toast.error("Failed to load assets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Asset Management
          </h1>
          <div className="mt-4">
            <h2 className="text-2xl font-bold text-primary">
              {formatPHP(totalValue)}
            </h2>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Total Current Asset Value
            </p>
          </div>
        </div>

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

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Asset Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <AssetDataTable
              columns={columns}
              data={data}
              tableMeta={{
                projectionDate,
                setProjectionDate,
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
