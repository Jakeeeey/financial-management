export function getTrialBalanceReviewLabel(reviewFlag: string): string {
  if (reviewFlag.toLowerCase() === "critical") return "Needs review";
  if (reviewFlag.toLowerCase() === "normal") return "No flag";
  return "Review status unavailable";
}

export function getTrialBalanceReviewReason(reviewFlag: string, reason?: string | null): string | null {
  if (reviewFlag.toLowerCase() !== "critical") return null;
  return reason?.trim() || "Review reason unavailable.";
}
