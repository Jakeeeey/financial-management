"use client";

import { useCallback, useEffect, useState } from "react";
import {
  decideSubmission,
  fetchApprovalQueue,
  fetchSubmissionReview,
  type ApprovalDecision,
  type ApprovalQueueItem,
  type SubmissionReview,
} from "../services/logisticsWerApprovalApi";

const PAGE_SIZE = 25;

export const APPROVAL_STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "returned", label: "Returned" },
  { value: "rejected", label: "Rejected" },
  { value: "converted", label: "Converted" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "all", label: "All statuses" },
];

export function useLogisticsWerApproval() {
  const [status, setStatus] = useState("submitted");
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [review, setReview] = useState<SubmissionReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApprovalQueue({ status, search, page, size: PAGE_SIZE });
      setItems(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
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
  }, [draftSearch]);

  const changeStatus = useCallback((nextStatus: string) => {
    setStatus(nextStatus);
    setPage(0);
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

  return {
    status,
    draftSearch,
    setDraftSearch,
    search,
    page,
    items,
    totalElements,
    totalPages,
    loading,
    error,
    reviewId,
    review,
    reviewLoading,
    reviewError,
    deciding,
    setPage,
    applySearch,
    changeStatus,
    openReview,
    closeReview,
    decide,
    retry: load,
  };
}
