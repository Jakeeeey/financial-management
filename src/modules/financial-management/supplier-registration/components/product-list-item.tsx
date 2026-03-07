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

const handleRemove = async () => {
    await onRemove(product.id);
  };

  return (
    <div className="flex items-center gap-4 py-2 px-4 hover:bg-muted/40 transition-colors group border-b last:border-0">
      {/* Product Info - Flex Grow to push actions to the right */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-none truncate">
          {product.product_name}
        </p>
        {product.product_code && (
          <p className="text-[11px] text-muted-foreground mt-1 font-mono uppercase tracking-wider">
            {product.product_code}
          </p>
        )}
      </div>

      {/* Discount Selector - Fixed width for alignment */}
      <div className="flex items-center gap-2 w-[180px]">
        <Select
          value={product.discount_type?.toString() || "none"}
          onValueChange={async (v) => {
            setIsUpdating(true);
            await onDiscountChange(
              product.id,
              v === "none" ? null : parseInt(v),
            );
            setIsUpdating(false);
          }}
          disabled={isUpdating}
        >
          <SelectTrigger className="h-8 text-xs bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Default (No Discount)</SelectItem>
            {discountTypes.map((dt) => (
              <SelectItem key={dt.id} value={dt.id.toString()}>
                {dt.discount_type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-8 flex justify-end">
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
    </div>
  );
}
