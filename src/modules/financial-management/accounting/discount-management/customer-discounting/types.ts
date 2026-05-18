export type DiscountOption = {
  id: number;
  discountType: string;
  totalPercent: number;
};

export type CustomerDiscountingCustomer = {
  id: number;
  customerCode: string;
  customerName: string;
  storeName: string;
  globalDiscount: DiscountOption | null;
};

export type CustomerDiscountingSupplier = {
  id: number;
  supplierName: string;
  supplierShortcut: string;
};

export type CustomerDiscountingCategory = {
  categoryId: number;
  categoryName: string;
};

export type CustomerDiscountingProduct = {
  productId: number;
  productCode: string;
  barcode: string;
  productName: string;
  categoryId: number | null;
  categoryName: string;
  pricePerUnit: number | null;
  priceA: number | null;
  priceB: number | null;
  priceC: number | null;
  priceD: number | null;
  priceE: number | null;
};

export type SupplierCategoryRule = {
  id: number;
  customerCode: string;
  supplierId: number | null;
  supplierName: string;
  categoryId: number | null;
  categoryName: string;
  discount: DiscountOption | null;
};

export type ProductRule = {
  id: number;
  customerCode: string;
  productId: number | null;
  productName: string;
  productCode: string;
  barcode: string;
  discount: DiscountOption | null;
  unitPrice: number | null;
};

export type CustomerDiscountingModuleData = {
  customers: CustomerDiscountingCustomer[];
  discountTypes: DiscountOption[];
  suppliers: CustomerDiscountingSupplier[];
  categories: CustomerDiscountingCategory[];
};

export type CustomerDiscountingRules = {
  supplierCategoryRules: SupplierCategoryRule[];
  productRules: ProductRule[];
};

export type CustomerDiscountPricingResult = {
  customer: {
    id: number;
    customerCode: string;
    customerName: string;
    globalDiscount: DiscountOption | null;
  };
  product: {
    productId: number;
    productCode: string;
    barcode: string;
    productName: string;
    categoryId: number | null;
    categoryName: string;
  };
  supplierId: number | null;
  priceTier: "manual" | "price_per_unit" | "priceA" | "priceB" | "priceC" | "priceD" | "priceE";
  basePrice: number | null;
  appliedTier: "product" | "supplier_category" | "global" | "base";
  ruleId: number | null;
  discount: DiscountOption | null;
  unitPrice: number | null;
  finalPrice: number | null;
};
