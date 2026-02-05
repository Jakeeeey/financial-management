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
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl font-bold">
                  Manage Products
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {supplierName}
                </DialogDescription>
              </div>
              <Button size="sm" onClick={() => setAddModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Product
              </Button>
            </div>
          </DialogHeader>

          <div className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Loading products...
                  </p>
                ) : products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <PackageOpen className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      No products assigned to this supplier
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click "Add Product" to get started
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
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
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Products Modal */}
      <AddProductsModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAddProduct={handleAddProduct}
      />
    </>
  );
}
