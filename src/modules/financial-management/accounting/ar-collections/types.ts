// types.ts
// All TypeScript interfaces and types for the AR Collections module.

import { Invoice } from '../accounts-receivable/types';

export interface ARCollectionCommitment {
  id: string;
  invoiceNo: string;
  invoiceId: number;
  customerName: string;
  customerCode: string;
  salesmanName: string;
  salesmanCode: string;
  outstandingAmount: number;
  committedAmount: number;
  commitmentDate: string; // ISO date string (YYYY-MM-DD)
  commitmentType: 'full' | 'partial' | 'no_response' | 'disputed';
  status: 'pending' | 'kept' | 'broken' | 'rescheduled' | 'waived';
  followUpBy: string | null; // ISO date string (YYYY-MM-DD)
  assignedTo: string | null;
  salesmanId?: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  daysOverdueAtAssignment: number;
}

export interface ARCollectionNote {
  id: string;
  commitmentId: string;
  invoiceNo: string;
  noteType: 'call_log' | 'promise' | 'escalation' | 'resolution' | 'remark';
  noteText: string;
  createdBy: string;
  createdAt: string;
}

export interface CollectionFilterOptions {
  status?: string;
  salesman?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CalendarDayData {
  date: Date;
  formattedDate: string; // YYYY-MM-DD
  totalExpected: number;
  commitments: ARCollectionCommitment[];
  statusDots: {
    status: ARCollectionCommitment['status'];
    count: number;
  }[];
  intensity: number; // 0 to 1 scale for heat map background
}

export interface SalesmanPerformance {
  name: string;
  code: string;
  totalOutstanding: number;
  ptpCount: number;
  ptpKeptCount: number;
  ptpBrokenCount: number;
  fulfillmentRate: number; // Percentage (0-100)
  performanceRating: 'high' | 'medium' | 'low';
}

export interface CollectionsMergedRow {
  invoice: Invoice;
  commitment: ARCollectionCommitment | null;
  notesCount: number;
}
