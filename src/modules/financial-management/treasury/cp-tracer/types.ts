export type CPTracerSearch = {
    cp: string;
    invoice: string;
    memo: string;
    sr: string;
};

export type CPTracerReference = {
    id: string;
    number: string;
};

export type CPTracerRow = {
    cpId: string;
    cpNumber: string;
    invoices: CPTracerReference[];
    memos: CPTracerReference[];
    salesReturns: CPTracerReference[];
};

export type CPTracerResponse = {
    content: CPTracerRow[];
    totalElements: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
};
