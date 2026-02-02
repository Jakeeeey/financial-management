"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPHP, getDepreciatedValue } from "../utils/lib";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  User,
  Building,
  Barcode,
  CalendarDays,
  Tag,
  Cpu,
} from "lucide-react";

export default function ViewAssetModal({
  asset,
  isOpen,
  onOpenChange,
  projectionDate = new Date(),
}: any) {
  if (!asset) return null;

  const currentVal = getDepreciatedValue(
    Number(asset.cost_per_item),
    Number(asset.quantity),
    Number(asset.life_span),
    asset.date_acquired,
    projectionDate,
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-150 p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {asset.item_name}
              </DialogTitle>
              <div className="flex items-center gap-3 text-sm text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <Barcode size={14} /> {asset.barcode || "N/A"}
                </span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1">
                  <Cpu size={14} /> {asset.rfid_code || "No RFID"}
                </span>
              </div>
            </div>
            <Badge
              variant={asset.condition === "Bad" ? "destructive" : "secondary"}
            >
              {asset.condition}
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Side: Visual & Category (4 Columns) */}
          <div className="md:col-span-5 space-y-4">
            <div className="aspect-square rounded-xl border bg-secondary/20 flex items-center justify-center overflow-hidden ring-1 ring-border">
              {asset.item_image ? (
                <img
                  src={`/api/fm/asset-image-view?id=${asset.item_image}`}
                  className="object-cover h-full w-full"
                  alt={asset.item_name}
                />
              ) : (
                <Package className="h-16 w-16 text-muted-foreground/20" />
              )}
            </div>

            <div className="space-y-3 pt-2">
              <Detail
                label="Classification"
                value={asset.classification_name}
                icon={<Tag size={12} />}
              />
              <Detail
                label="Acquisition Date"
                value={new Date(asset.date_acquired).toLocaleDateString(
                  "en-US",
                  { month: "long", day: "numeric", year: "numeric" },
                )}
                icon={<CalendarDays size={12} />}
              />
            </div>
          </div>

          {/* Right Side: Deployment & Finance (7 Columns) */}
          <div className="md:col-span-7 space-y-6">
            <div className="grid grid-cols-1 gap-4 bg-muted/30 p-4 rounded-lg border border-border/50">
              <Detail
                label="Department"
                value={asset.department_name}
                icon={<Building size={14} />}
              />
              <Detail
                label="Assigned Personnel"
                value={asset.assigned_to_name}
                icon={<User size={14} />}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex justify-between items-end text-sm px-1">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-tight">
                    Quantity
                  </span>
                  <span className="font-medium text-base">
                    {asset.quantity} Units
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-tight">
                    Original Cost
                  </span>
                  <span className="font-mono text-base">
                    {formatPHP(asset.cost_per_item * asset.quantity)}
                  </span>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl border-2 border-primary/20 bg-primary/3 p-5">
                <div className="flex flex-col gap-1 relative z-10">
                  <span className="text-[10px] uppercase tracking-widest font-black text-primary/60">
                    Projected Value ({projectionDate.toLocaleDateString()})
                  </span>
                  <span className="text-3xl font-black tracking-tighter text-primary font-mono">
                    {formatPHP(currentVal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Detail = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80 flex items-center gap-1.5">
      <span className="text-primary">{icon}</span> {label}
    </span>
    <p className="font-semibold text-sm">{value || "—"}</p>
  </div>
);
