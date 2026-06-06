export interface CustomerSearchResult {
  id: number;
  customer_code: string;
  customer_name: string;
  payment_term_name: string;
  payment_days: number;
  discount_config_count: number;
  store_type?: number | null;
  classification?: number | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DiscountType {
  id: number;
  discount_type: string;
  total_percent: number | string;
}

export interface PaymentTerm {
  id: number;
  payment_name: string;
  payment_days?: number | null;
  payment_description?: string | null;
}

export interface Customer {
  id: number;
  customer_code: string;
  customer_name: string;
  type: "Regular" | "Employee";
  store_name: string;
  store_signage: string;
  brgy?: string;
  city?: string;
  province?: string;
  contact_number: string;
  customer_email?: string;
  tel_number?: string;
  customer_tin?: string;
  payment_term?: number;
  payment_term_detail?: PaymentTerm | null;
  credit_type?: number;
  company_code?: number;
  isActive: number;
  isVAT: number;
  isEWT: number;
  discount_type?: DiscountType;
  latitude?: string | number;
  longitude?: string | number;
  classification?: number;
}

export interface BankAccount {
  id: number;
  customer_id: number;
  bank_name: string | number;
  account_name: string;
  account_number: string;
  account_type: "Savings" | "Checking" | "Other";
  branch_of_account?: string;
  is_primary: number;
  notes?: string;
}

export interface Salesman {
  id: number;
  salesman_code: string;
  salesman_name: string;
}

export interface SalesmanRelation {
  id: number;
  customer_id: number;
  salesman_id: Salesman;
}

export interface SupplierCategoryDiscount {
  id: number;
  customer_code: string;
  discount_type: DiscountType;
  supplier_id: {
    id: number;
    supplier_name: string;
    supplier_shortcut?: string;
  };
  category_id?: {
    category_id: number;
    category_name: string;
  } | null;
}

export interface ProductDiscount {
  id: number;
  customer_code: string;
  product_id: {
    product_id: number;
    product_name: string;
    sku_code?: string;
  };
  discount_type: DiscountType;
  unit_price?: number;
}

export interface Transaction {
  invoiceId?: number;
  invoiceNo?: string;
  orderId?: string;
  customerName?: string;
  customerCode?: string;
  invoiceDate?: string;
  calculatedDueDate?: string;
  netReceivable?: number;
  totalPaid?: number;
  outstandingBalance?: number;
  daysOverdue?: number;
  branch?: string;
  salesman?: string;
  division?: string;
  isPosted?: number;
}

export interface SalesInvoice {
  invoice_id: number;
  invoice_no: string;
  invoice_date?: string | null;
  due_date?: string | null;
  gross_amount?: number | null;
  discount_amount?: number | null;
  net_amount?: number | null;
  total_amount?: number | null;
  transaction_status?: string | null;
  remarks?: string | null;
  salesman_id?: {
    salesman_name?: string;
  } | null;
}

export interface SalesReturn {
  id: number;
  return_no: string;
  return_date?: string | null;
  invoice_no?: string | null;
  amount?: number | null;
  remarks?: string | null;
  salesman_id?: {
    salesman_name?: string;
  } | null;
}

export interface CustomerMemo {
  id: number;
  memo_number: string;
  amount: number;
  applied_amount?: number;
  reason?: string;
  status?: string;
  created_at?: string;
  type?: number;
  supplier_id?: {
    supplier_name: string;
  } | null;
  chart_of_account?: {
    account_title: string;
  } | null;
}

export interface UnfulfilledSalesTransaction {
  id: number;
  sales_invoice_id: {
    invoice_id: number;
    invoice_no: string;
    invoice_date?: string | null;
    net_amount?: number | null;
    total_amount?: number | null;
    salesman_id?: {
      salesman_name?: string;
    } | null;
  };
  nte: string;
  isCleared: number;
  checked_by?: number | null;
  date_acknowledged?: string | null;
  date_created?: string | null;
  variance_amount: number;
}

export interface SalesInvoicePayment {
  id: number;
  invoice_id: {
    invoice_id: number;
    invoice_no: string;
  };
  collection_id?: {
    id: number;
    collection_receipt_no?: string | null;
    collection_date?: string | null;
  } | null;
  reference_no?: string | null;
  paid_amount: number;
  date_paid: string;
}

export interface StoreType {
  id: number;
  store_type: string;
}

export interface CustomerClassification {
  id: number;
  classification_name: string;
}
