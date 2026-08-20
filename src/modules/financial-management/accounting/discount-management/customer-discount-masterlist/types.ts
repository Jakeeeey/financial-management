export type DiscountOption = {
  id: number;
  discountType: string;
  totalPercent: number;
};

export type MasterlistCustomerDiscount = {
  id: number;
  customerCode: string;
  customerName: string;
  categoryId: number | null;
  categoryName: string;
  discount: DiscountOption | null;
};
