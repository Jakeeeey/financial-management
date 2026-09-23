"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  decideSubmission,
  decideSubmissionsBulk,
  fetchApprovalQueue,
  fetchSubmissionReview,
  type ApprovalDecision,
  type ApprovalQueueItem,
  type BulkDecisionResult,
  type SubmissionReview,
} from "../services/logisticsWerApprovalApi";

const PAGE_SIZE = 25;

export const APPROVAL_STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "returned", label: "Returned" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "all", label: "All statuses" },
];

export function useLogisticsWerApproval() {
  const searchParams = useSearchParams();
  const initialSearch = (searchParams.get("search") || "").trim();
  const [status, setStatus] = useState("all");
  const [draftSearch, setDraftSearch] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [review, setReview] = useState<SubmissionReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeciding, setBulkDeciding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApprovalQueue({ status, search, page, size: PAGE_SIZE });
      setItems(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      setStatusCounts(result.statusCounts ?? {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the approval queue.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const applySearch = useCallback(() => {
    setSearch(draftSearch.trim());
    setPage(0);
    setSelectedIds([]);
  }, [draftSearch]);

  const changeStatus = useCallback((nextStatus: string) => {
    setStatus(nextStatus);
    setPage(0);
    setSelectedIds([]);
  }, []);

  const openReview = useCallback(async (submissionId: number) => {
    setReviewId(submissionId);
    setReview(null);
    setReviewError(null);
    setReviewLoading(true);
    try {
      setReview(await fetchSubmissionReview(submissionId));
    } catch (reviewLoadError) {
      setReviewError(reviewLoadError instanceof Error ? reviewLoadError.message : "Unable to load the submission.");
    } finally {
      setReviewLoading(false);
    }
  }, []);

  const closeReview = useCallback(() => {
    setReviewId(null);
    setReview(null);
    setReviewError(null);
  }, []);

  const decide = useCallback(async (decision: ApprovalDecision, remarks?: string) => {
    if (reviewId === null) return null;
    setDeciding(true);
    try {
      const result = await decideSubmission(reviewId, decision, remarks);
      setReview((current) => (current ? { ...current, submission: result.submission } : current));
      await load();
      return result;
    } finally {
      setDeciding(false);
    }
  }, [load, reviewId]);

  const toggleSelected = useCallback((submissionId: number) => {
    setSelectedIds((current) => current.includes(submissionId)
      ? current.filter((id) => id !== submissionId)
      : [...current, submissionId]);
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const decideBulk = useCallback(async (
    decision: ApprovalDecision,
    remarks?: string,
  ): Promise<BulkDecisionResult | null> => {
    if (selectedIds.length === 0) return null;
    setBulkDeciding(true);
    try {
      const result = await decideSubmissionsBulk(selectedIds, decision, remarks);
      setSelectedIds([]);
      await load();
      return result;
    } finally {
      setBulkDeciding(false);
    }
  }, [load, selectedIds]);

  return {
    status,
    draftSearch,
    setDraftSearch,
    search,
    page,
    items,
    totalElements,
    totalPages,
    statusCounts,
    loading,
    error,
    reviewId,
    review,
    reviewLoading,
    reviewError,
    deciding,
    selectedIds,
    bulkDeciding,
    toggleSelected,
    clearSelection,
    decideBulk,
    setPage,
    applySearch,
    changeStatus,
    openReview,
    closeReview,
    decide,
    retry: load,
  };
}
