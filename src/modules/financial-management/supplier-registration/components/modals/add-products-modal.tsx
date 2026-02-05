"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Loader2 } from "lucide-react";
import { useProducts } from "@/modules/financial-management/supplier-registration/hooks/useProducts";
import { Product } from "../../types/product.schema";
import { useDiscountTypes } from "../../hooks/useDiscountTypes";

interface AddProductsModalProps {
  open: boolean;
  onClose: () => void;
  onAddProduct: (
    productId: number,
    discountTypeId: number | null,
  ) => Promise<boolean>;
}

export function AddProductsModal({
  open,
  onClose,
  onAddProduct,
}: AddProductsModalProps) {
  const {
    products,
    isLoading: productsLoading,
    setSearchQuery,
  } = useProducts();
  const { discountTypes, isLoading: discountTypesLoading } = useDiscountTypes();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<string>("none");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!selectedProduct) return;

    setIsSubmitting(true);
    const discountId =
      selectedDiscount === "none" ? null : parseInt(selectedDiscount);
    const success = await onAddProduct(selectedProduct.product_id, discountId);

    if (success) {
      setSelectedProduct(null);
      setSelectedDiscount("none");
      onClose();
    }
    setIsSubmitting(false);
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Products to Supplier</DialogTitle>
          <DialogDescription>
            Search and select a product, then choose an optional discount type.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products by name or code..."
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              autoComplete="off"
            />
          </div>

          {/* Products List */}
          <ScrollArea className="h-[300px] border rounded-md">
            {productsLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : products.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No products found
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {products.map((product) => (
                  <button
                    key={product.product_id}
                    onClick={() => handleProductSelect(product)}
                    className={`w-full text-left p-3 rounded-md transition-colors ${
                      selectedProduct?.product_id === product.product_id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <p className="font-medium text-sm">
                      {product.product_name}
                    </p>
                    {product.product_code && (
                      <p className="text-xs opacity-80 mt-0.5">
                        Code: {product.product_code}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected Product & Discount */}
          {selectedProduct && (
            <div className="border rounded-md p-4 space-y-3 bg-muted/50">
              <div>
                <p className="text-sm font-medium">Selected Product:</p>
                <p className="text-sm text-muted-foreground">
                  {selectedProduct.product_name}
                  {selectedProduct.product_code &&
                    ` (${selectedProduct.product_code})`}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Discount Type (Optional)
                </label>
                <Select
                  value={selectedDiscount}
                  onValueChange={setSelectedDiscount}
                  disabled={discountTypesLoading}
                >
                  <SelectTrigger>
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
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!selectedProduct || isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
