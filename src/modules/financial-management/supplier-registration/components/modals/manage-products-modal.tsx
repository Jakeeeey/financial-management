"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, PackageOpen } from "lucide-react";
import { useSupplierProducts } from "../../hooks/useSupplierProduct";
import { AddProductsModal } from "./add-products-modal";
import { useDiscountTypes } from "../../hooks/useDiscountTypes";
import { ProductListItem } from "../product-list-item";

interface ManageProductsModalProps {
  supplierId: number | null;
  supplierName: string;
  open: boolean;
  onClose: () => void;
}

export function ManageProductsModal({
  supplierId,
  supplierName,
  open,
  onClose,
}: ManageProductsModalProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const { products, isLoading, addProduct, updateDiscount, removeProduct } =
    useSupplierProducts(supplierId);
  const { discountTypes } = useDiscountTypes();

  const handleAddProduct = async (
    productId: number,
    discountTypeId: number | null,
  ) => {
    const success = await addProduct(productId, discountTypeId);
    if (success) {
      setAddModalOpen(false);
    }
    return success;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden flex flex-col h-[70vh]">
          {/* Header Section */}
          <div className="p-6 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Manage Products
                </DialogTitle>
                <DialogDescription className="text-xs uppercase font-medium text-muted-foreground/80">
                  {supplierName}
                </DialogDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setAddModalOpen(true)}
                className="h-8 px-3"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Product
              </Button>
            </div>
          </div>

          {/* List Header - Labels for the "columns" */}
          <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span className="flex-1">Product Details</span>
            <span className="w-[180px]">Applied Discount</span>
            <span className="w-8"></span>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground animate-pulse">
                Fetching product catalog...
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <PackageOpen className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No products assigned yet.
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {products.map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    discountTypes={discountTypes}
                    onDiscountChange={updateDiscount}
                    onRemove={removeProduct}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AddProductsModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAddProduct={addProduct}
      />
    </>
  );
}
