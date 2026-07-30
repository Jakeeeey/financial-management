// riskPriority.ts
import { CollectionsMergedRow } from '../types';
import { getInvoiceRiskScore } from '../../accounts-receivable/utils';

/**
 * Computes a Collection Urgency Score (0 to 100) based on multiple parameters.
 * Highly urgent rows bubble to the top of the collection queue.
 */
export function getCollectionUrgencyScore(row: CollectionsMergedRow): number {
  const { invoice, commitment } = row;
  
  // Base risk score derived from aging & outstanding amount
  let score = getInvoiceRiskScore(invoice).score;

  // If no commitment is logged yet, add urgency
  if (!commitment) {
    score += 15;
  } else {
    // If commitment exists and is broken, boost urgency significantly
    if (commitment.status === 'broken') {
      score += 35;
    }
    // If pending but overdue, add urgency
    if (commitment.status === 'pending' && new Date(commitment.commitmentDate) < new Date()) {
      score += 20;
    }
  }

  // Cap the score at 100
  return Math.min(Math.max(score, 0), 100);
}

/**
 * Sorts collection rows by urgency score (descending).
 */
export function sortCollectionsByUrgency(rows: CollectionsMergedRow[]): CollectionsMergedRow[] {
  return [...rows].sort((a, b) => {
    const scoreA = getCollectionUrgencyScore(a);
    const scoreB = getCollectionUrgencyScore(b);
    return scoreB - scoreA;
  });
}
