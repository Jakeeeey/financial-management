"use client";


import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProducts } from "@/modules/financial-management/supplier-registration/hooks/useProducts";
import { Loader2, Package, Search } from "lucide-react";
import { useMemo, useState } from "react";

interface AddPayeeProductsModalProps {
  open: boolean;
  onClose: () => void;
  onAddProducts: (productIds: number[]) => Promise<void>;
  assignedProductIds: number[];
}

export function AddPayeeProductsModal({
  open,
  onClose,
  onAddProducts,
  assignedProductIds,
}: AddPayeeProductsModalProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { products, isLoading } = useProducts();

  const assignedSet = useMemo(
    () => new Set(assignedProductIds),
    [assignedProductIds],
  );

  const availableProducts = useMemo(() => {
    const uniqueProducts = new Map<number, (typeof products)[0]>();

    products.forEach((p) => {
      const productId = Number(
        p.product_id || (p as { id?: number; product_id?: number }).id,
      );
      if (!assignedSet.has(productId) && !uniqueProducts.has(productId)) {
        uniqueProducts.set(productId, p);
      }
    });

    const list = Array.from(uniqueProducts.values());

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase();
    return list.filter(
      (p) =>
        (p.product_name?.toLowerCase() ?? "").includes(query) ||
        (p.product_code?.toLowerCase() ?? "").includes(query),
    );
  }, [products, assignedSet, searchQuery]);

  const toggleProduct = (productId: number) => {
    setSelectedIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  };

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await onAddProducts(selectedIds);
      setSelectedIds([]);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] gap-0 p-0 flex flex-col h-[600px]">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Add Products</DialogTitle>
          <DialogDescription>
            Select products to assign to this payee.
          </DialogDescription>

          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or code..."
              className="pl-9 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-2">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Loading products...
                  </p>
                </div>
              ) : availableProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Package className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No products available
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All products are already assigned or match your search.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {availableProducts.map((product) => {
                    const productId = Number(
                      product.product_id || (product as { id?: number; product_id?: number }).id,
                    );
                    const isSelected = selectedIds.includes(productId);

                    return (
                      <div
                        key={productId}
                        className={`flex items-center gap-3 p-3 rounded-md transition-colors cursor-pointer border ${
                          isSelected
                            ? "bg-primary/5 border-primary/20"
                            : "hover:bg-muted/50 border-transparent"
                        }`}
                        onClick={() => toggleProduct(productId)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleProduct(productId)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {product.product_name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <code className="text-[10px] bg-muted px-1 rounded">
                              {product.product_code}
                            </code>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/10 shrink-0">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} product(s) selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={selectedIds.length === 0 || isSubmitting}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Selected
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
