"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { X } from "lucide-react";
import { ProductPerSupplierWithDetails } from "../types/product-per-suppplier.schema";
import { DiscountType } from "../types/discount-type.schema";

interface ProductListItemProps {
  product: ProductPerSupplierWithDetails;
  discountTypes: DiscountType[];
  onDiscountChange: (
    productPerSupplierId: number,
    discountTypeId: number | null,
  ) => Promise<boolean>;
  onRemove: (productPerSupplierId: number) => Promise<boolean>;
}

export function ProductListItem({
  product,
  discountTypes,
  onDiscountChange,
  onRemove,
}: ProductListItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleDiscountChange = async (value: string) => {
    setIsUpdating(true);
    const discountId = value === "none" ? null : parseInt(value);
    await onDiscountChange(product.id, discountId);
    setIsUpdating(false);
  };

  const handleRemove = async () => {
    await onRemove(product.id);
  };

  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 rounded-md group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">•</span>
          <div>
            <p className="text-sm font-medium text-foreground truncate">
              {product.product_name}
              {product.product_code && (
                <span className="text-muted-foreground ml-1">
                  ({product.product_code})
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">Discount:</span>
              <Select
                value={product.discount_type?.toString() || "none"}
                onValueChange={handleDiscountChange}
                disabled={isUpdating}
              >
                <SelectTrigger className="h-7 w-30 text-xs">
                  <SelectValue placeholder="No discount" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No discount</SelectItem>
                  {discountTypes.map((dt) => (
                    <SelectItem key={dt.id} value={dt.id.toString()}>
                      {dt.discount_type}
                      {dt.total_percent &&
                        dt.total_percent !==
                          "0.000000000000000000000000000000" &&
                        ` (${parseFloat(dt.total_percent).toFixed(1)}%)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong>{product.product_name}</strong> from this supplier? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
