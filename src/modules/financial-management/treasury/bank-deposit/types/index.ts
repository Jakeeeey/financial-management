export interface PaginatedResponse<T> {
    content: T[];
    totalPages: number;
    totalElements: number;
    size: number;
    number: number;
    bankOptions?: string[];
}

export type VaultAssetFilterType = "ALL" | "CASH" | "CHECK";

export interface VaultAssetFilters {
    type: VaultAssetFilterType;
    documentNumber: string;
    dateFrom: string;
    dateTo: string;
    bankName: string;
}

export interface VaultAsset {
    detailId: number;
    documentNumber: string;
    collectionReference: string;
    sourcePouchNo: string;
    assetType: "CASH" | "CHECK";
    bankName: string;
    bankReferenceValid: boolean;
    checkNo: string;
    amount: number;
    collectionDate: string | null;
    chequeDate: string | null;
}

export interface ActiveBankAccount {
    bankId: number;
    bankName: string;
    accountNumber: string;
    branch: string;
    contactPerson: string;
    isActive: boolean;
    displayName: string;
}

export interface DepositAsset {
    detailId: number;
    documentNumber?: string | null;
    assetType: "CASH" | "CHECK";
    bankName: string;
    checkNo: string;
    chequeDate: string | null;
    amount: number;
    status: "IN_TRANSIT" | "CLEARED" | "BOUNCED";
}

export interface CheckBreakdown {
    bankName: string;
    checkCount: number;
    totalAmount: number;
}

export interface DepositSlip {
    id: number;
    depositNo: string;
    depositDate: string;
    targetBankAccount?: string | null;
    depositReference?: string | null;
    validationDocumentFileId?: string | null;
    status: "PREPARED" | "CLEARED" | "CANCELLED";
    preparedBy: string;
    datePrepared: string;
    clearedAt?: string | null;
    totalCash: number;
    totalChecks: number;
    grandTotal: number;
    checkBreakdown?: CheckBreakdown[];
    depositedAssets: DepositAsset[];
}

export interface PrepareDepositPayload {
    assetIds: number[];
    targetBankId: number;
    remarks: string;
}

export interface ClearDepositPayload {
    depositReference: string;
    validationDocument: File | null;
}

export interface ClearDepositResponse {
    message: string;
    clearedAt?: string | null;
    depositReference?: string | null;
    validationDocumentFileId?: string | null;
}
