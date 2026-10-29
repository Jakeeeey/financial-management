export interface CoaAmount {
  coaId: number | null;
  amount: number;
  classified?: boolean;
}

export interface CoaBudgetBalance {
  coaId: number;
  allocatedAmount: number;
  reservedAmount: number;
  remainingAmount: number;
  overBudgetAmount: number;
}

export interface BudgetBalances {
  allocatedBudget: number;
  reservedAmount: number;
  remainingAmount: number;
  unclassifiedBudgetAmount: number;
  unclassifiedReservedAmount: number;
  overBudgetAmount: number;
  byCoa: CoaBudgetBalance[];
}

export interface BudgetRequestOverage {
  coaId: number;
  requestedAmount: number;
  remainingAmount: number;
  overAmount: number;
}

export interface BudgetAllocationOverage {
  coaId: number;
  allocatedAmount: number;
  reservedAmount: number;
  shortfall: number;
}

export interface ReservationSubmission {
  id: number;
  status: string | null;
  disbursementId: number | null;
}

export function splitReservationSources<T extends ReservationSubmission>(submissions: T[]): {
  draftReservations: T[];
  approvedDisbursementIds: number[];
} {
  const draftReservations = submissions.filter((submission) => {
    const status = (submission.status || "").toLowerCase();
    return status === "submitted" || (status === "approved" && !submission.disbursementId);
  });
  const approvedDisbursementIds = Array.from(new Set(
    submissions
      .filter((submission) => (submission.status || "").toLowerCase() === "approved" && submission.disbursementId)
      .map((submission) => submission.disbursementId as number),
  ));
  return { draftReservations, approvedDisbursementIds };
}

function cents(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Budget amounts must be finite, nonnegative numbers.");
  }
  return Math.round((value + Number.EPSILON) * 100);
}

function dollars(value: number): number {
  return value / 100;
}

export function calculateBudgetBalances(
  budgetLines: CoaAmount[],
  reservationLines: CoaAmount[],
): BudgetBalances {
  const allocatedByCoa = new Map<number, number>();
  const reservedByCoa = new Map<number, number>();
  let allocatedCents = 0;
  let reservedCents = 0;
  let unclassifiedBudgetCents = 0;
  let unclassifiedReservedCents = 0;

  for (const line of budgetLines) {
    const amount = cents(line.amount);
    allocatedCents += amount;
    if (line.coaId === null || !Number.isInteger(line.coaId) || line.coaId <= 0 || line.classified === false) {
      unclassifiedBudgetCents += amount;
    } else {
      allocatedByCoa.set(line.coaId, (allocatedByCoa.get(line.coaId) ?? 0) + amount);
    }
  }

  for (const line of reservationLines) {
    const amount = cents(line.amount);
    reservedCents += amount;
    if (line.coaId === null || !Number.isInteger(line.coaId) || line.coaId <= 0) {
      unclassifiedReservedCents += amount;
    } else {
      reservedByCoa.set(line.coaId, (reservedByCoa.get(line.coaId) ?? 0) + amount);
    }
  }

  let remainingCents = 0;
  let overBudgetCents = 0;
  const allCoaIds = new Set([...allocatedByCoa.keys(), ...reservedByCoa.keys()]);
  const byCoa = Array.from(allCoaIds)
    .sort((left, right) => left - right)
    .map((coaId) => {
      const allocated = allocatedByCoa.get(coaId) ?? 0;
      const reserved = reservedByCoa.get(coaId) ?? 0;
      const difference = allocated - reserved;
      const remaining = Math.max(0, difference);
      const overBudget = Math.max(0, -difference);
      remainingCents += remaining;
      overBudgetCents += overBudget;
      return {
        coaId,
        allocatedAmount: dollars(allocated),
        reservedAmount: dollars(reserved),
        remainingAmount: dollars(remaining),
        overBudgetAmount: dollars(overBudget),
      };
    });

  return {
    allocatedBudget: dollars(allocatedCents),
    reservedAmount: dollars(reservedCents),
    remainingAmount: dollars(remainingCents),
    unclassifiedBudgetAmount: dollars(unclassifiedBudgetCents),
    unclassifiedReservedAmount: dollars(unclassifiedReservedCents),
    overBudgetAmount: dollars(overBudgetCents),
    byCoa,
  };
}

export function findBudgetRequestOverages(
  requestLines: CoaAmount[],
  balances: CoaBudgetBalance[],
): BudgetRequestOverage[] {
  const requestedByCoa = new Map<number, number>();
  for (const line of requestLines) {
    if (line.coaId === null || !Number.isInteger(line.coaId) || line.coaId <= 0) continue;
    const amount = cents(line.amount);
    requestedByCoa.set(line.coaId, (requestedByCoa.get(line.coaId) ?? 0) + amount);
  }

  const remainingByCoa = new Map(balances.map((balance) => [balance.coaId, cents(balance.remainingAmount)]));
  return Array.from(requestedByCoa.entries())
    .flatMap(([coaId, requested]) => {
      const remaining = remainingByCoa.get(coaId) ?? 0;
      return requested > remaining
        ? [{
            coaId,
            requestedAmount: dollars(requested),
            remainingAmount: dollars(remaining),
            overAmount: dollars(requested - remaining),
          }]
        : [];
    })
    .sort((left, right) => left.coaId - right.coaId);
}

export function findBudgetAllocationOverages(
  allocations: CoaAmount[],
  balances: CoaBudgetBalance[],
): BudgetAllocationOverage[] {
  const allocatedByCoa = new Map<number, number>();
  for (const allocation of allocations) {
    if (allocation.coaId === null || !Number.isInteger(allocation.coaId) || allocation.coaId <= 0) continue;
    const amount = cents(allocation.amount);
    allocatedByCoa.set(allocation.coaId, (allocatedByCoa.get(allocation.coaId) ?? 0) + amount);
  }

  return balances.flatMap((balance) => {
    const allocated = allocatedByCoa.get(balance.coaId) ?? 0;
    const reserved = cents(balance.reservedAmount);
    return allocated < reserved
      ? [{
          coaId: balance.coaId,
          allocatedAmount: dollars(allocated),
          reservedAmount: dollars(reserved),
          shortfall: dollars(reserved - allocated),
        }]
      : [];
  });
}


export interface ExpenseVariance {
  allocatedAmount: number;
  actualAmount: number;
  otherCommittedAmount: number;
  projectedActualAmount: number;
  netVariance: number;
  requiresAcknowledgment: boolean;
  byCoa: Array<{ coaId: number; allocatedAmount: number; otherCommittedAmount: number; requestedAmount: number; projectedAmount: number; overAmount: number; unbudgeted: boolean }>;
}

/** Exclude an already-reserved proposal before adding its current lines. */
export function calculateExpenseVariance(
  lines: CoaAmount[],
  balances: CoaBudgetBalance[],
  allocatedAmount: number,
  reservedAmount: number,
  reservedProposal: CoaAmount[] = [],
): ExpenseVariance {
  const sumByCoa = (items: CoaAmount[]) => {
    const result = new Map<number, number>();
    for (const line of items) {
      if (line.coaId !== null) result.set(line.coaId, (result.get(line.coaId) ?? 0) + cents(line.amount));
    }
    return result;
  };
  const requested = sumByCoa(lines);
  const previous = sumByCoa(reservedProposal);
  const actual = lines.reduce((sum, line) => sum + cents(line.amount), 0);
  const other = Math.max(0, cents(reservedAmount) - reservedProposal.reduce((sum, line) => sum + cents(line.amount), 0));
  const byCoa = Array.from(requested, ([coaId, amount]) => {
    const balance = balances.find((row) => row.coaId === coaId);
    const allocated = cents(balance?.allocatedAmount ?? 0);
    const committed = Math.max(0, cents(balance?.reservedAmount ?? 0) - (previous.get(coaId) ?? 0));
    return { coaId, allocatedAmount: dollars(allocated), otherCommittedAmount: dollars(committed), requestedAmount: dollars(amount), projectedAmount: dollars(committed + amount), overAmount: dollars(Math.max(0, committed + amount - allocated)), unbudgeted: allocated === 0 };
  });
  const net = other + actual - cents(allocatedAmount);
  return { allocatedAmount, actualAmount: dollars(actual), otherCommittedAmount: dollars(other), projectedActualAmount: dollars(other + actual), netVariance: dollars(net), requiresAcknowledgment: net > 0 || byCoa.some((row) => row.overAmount > 0), byCoa };
}
