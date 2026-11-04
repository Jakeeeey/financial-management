export interface StockPositionSummary {
  postedBaseQuantity: number | string;
  postedCost: number | string;
  pendingBaseQuantity: number | string;
  pendingCost: number | string;
  projectedExposure: number | string;
  agreementCount: number;
  productCount: number;
  agreementsAboveNinety: number;
  agreementsOverLimit: number;
  asOf: string;
}

export interface StockPositionRow {
  agreementId: number;
  agreementReference: string;
  consigneeId: number;
  consigneeName: string;
  productId: number;
  productCode: string | null;
  productName: string | null;
  uomId: number | null;
  uomName: string | null;
  uomMultiplier: number | string | null;
  postedQuantity: number | string;
  postedBaseQuantity: number | string;
  unitCost: number | string | null;
  postedCost: number | string;
  pendingQuantity: number | string;
  pendingBaseQuantity: number | string;
  pendingCost: number | string;
  exposureLimit: number | string | null;
  projectedExposure: number | string | null;
  utilization: number | string | null;
}

export interface PendingCommitment {
  documentId: number;
  documentNumber: string;
  agreementId: number;
  agreementReference: string;
  consigneeName: string;
  documentDate: string;
  deliveryReference: string | null;
  lineId: number;
  lineNumber: number;
  productId: number;
  productCode: string | null;
  productName: string | null;
  uomId: number | null;
  uomName: string | null;
  uomMultiplier: number | string | null;
  quantity: number | string;
  baseQuantity: number | string;
  unitCost: number | string | null;
  lineAmount: number | string | null;
  submittedAt: string | null;
}

export interface StockMovement {
  movementId: number;
  documentId: number;
  documentNumber: string;
  agreementReference: string;
  consigneeName: string;
  inventoryClass: "WAREHOUSE" | "CONSIGNMENT";
  direction: "IN" | "OUT";
  productId: number;
  productCode: string | null;
  productName: string | null;
  uomId: number | null;
  uomName: string | null;
  uomMultiplier: number | string | null;
  quantity: number | string;
  baseQuantity: number | string;
  unitCost: number | string;
  totalCost: number | string;
  journalEntryId: number | null;
  postedAt: string;
  postedBy: string | null;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface StockPositionResponse {
  summary: StockPositionSummary;
  positions: PageResult<StockPositionRow>;
  pending: PendingCommitment[];
}

export interface StockPositionChoice {
  id: number;
  code: string | null;
  name: string | null;
}

export interface StockPositionChoices {
  items: StockPositionChoice[];
  page: number;
  pageSize: number;
  total: number;
}
