// useCommitmentActions.ts
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ARCollectionCommitment } from '../types';

interface LogSalesmanCommitmentParams {
  salesmanId: number;
  commitmentDate: string;
  noteText: string;
}

export function useCommitmentActions(onSuccess?: () => void) {
  const [submitting, setSubmitting] = useState(false);

  const logSalesmanCommitment = useCallback(async (params: LogSalesmanCommitmentParams) => {
    setSubmitting(true);
    const toastId = toast.loading('Logging commitment for salesman...');
    try {
      const res = await fetch('/api/fm/accounting/ar-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        throw new Error(`Failed to log commitment: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.count === 0) {
        toast.info(data.message || 'No outstanding invoices found to log commitments for.', { id: toastId });
      } else {
        toast.success(`Logged PTP for ${data.count} outstanding invoices!`, { id: toastId });
      }
      onSuccess?.();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error: ${msg}`, { id: toastId });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [onSuccess]);

  const updateStatus = useCallback(async (
    commitmentId: string,
    status: ARCollectionCommitment['status'],
    noteText?: string
  ) => {
    setSubmitting(true);
    const toastId = toast.loading(`Updating status to ${status}...`);
    try {
      const res = await fetch(`/api/fm/accounting/ar-collections`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitmentId, status, noteText }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update commitment: ${res.statusText}`);
      }

      toast.success(`Commitment marked as ${status}!`, { id: toastId });
      onSuccess?.();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error: ${msg}`, { id: toastId });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [onSuccess]);

  return {
    submitting,
    logSalesmanCommitment,
    updateStatus,
  };
}
