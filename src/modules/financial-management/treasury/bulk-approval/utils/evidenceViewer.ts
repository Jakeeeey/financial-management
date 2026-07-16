export type EvidenceCategory = "wer-summary" | "expense";

export type EvidenceHeader = { headerId: number; label: string };

export type WerSummaryAttachment = { headerId: number; url: string; label: string };

export type ExpenseEvidenceAttachment = {
  expenseId: number;
  headerId: number;
  url: string;
  label: string;
};

export type EvidenceViewerItem = {
  category: EvidenceCategory;
  headerId: number;
  expenseId?: number;
  url: string;
  label: string;
};

export function buildWerExpenseComparison(input: {
  items: EvidenceViewerItem[];
  expenseId: number;
}): {
  werItems: EvidenceViewerItem[];
  expenseItem: EvidenceViewerItem | null;
} {
  return {
    werItems: input.items.filter((item) => item.category === "wer-summary"),
    expenseItem: input.items.find(
      (item) => item.category === "expense" && item.expenseId === input.expenseId
    ) ?? null,
  };
}

export function buildEvidenceViewerState(input: {
  headers: EvidenceHeader[];
  werAttachments: WerSummaryAttachment[];
  expenseAttachments: ExpenseEvidenceAttachment[];
}): {
  allItems: EvidenceViewerItem[];
  lineItemsByExpenseId: Map<number, EvidenceViewerItem[]>;
  missingHeaders: EvidenceHeader[];
} {
  const seenUrls = new Set<string>();
  const werItems: EvidenceViewerItem[] = [];
  const expenseItems: EvidenceViewerItem[] = [];

  for (const attachment of input.werAttachments) {
    if (!attachment.url || seenUrls.has(attachment.url)) continue;

    seenUrls.add(attachment.url);
    werItems.push({ category: "wer-summary", ...attachment });
  }

  for (const attachment of input.expenseAttachments) {
    if (!attachment.url || seenUrls.has(attachment.url)) continue;

    seenUrls.add(attachment.url);
    expenseItems.push({ category: "expense", ...attachment });
  }

  const lineItemsByExpenseId = new Map<number, EvidenceViewerItem[]>();
  for (const item of expenseItems) {
    const lineItems = lineItemsByExpenseId.get(item.expenseId!) ?? [...werItems];
    lineItems.push(item);
    lineItemsByExpenseId.set(item.expenseId!, lineItems);
  }

  const coveredHeaderIds = new Set(werItems.map(({ headerId }) => headerId));

  return {
    allItems: [...werItems, ...expenseItems],
    lineItemsByExpenseId,
    missingHeaders: input.headers.filter(({ headerId }) => !coveredHeaderIds.has(headerId)),
  };
}
