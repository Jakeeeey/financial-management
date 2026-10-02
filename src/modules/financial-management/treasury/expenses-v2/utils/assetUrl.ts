/**
 * Helper to resolve Directus asset URLs.
 * Handles both new File IDs (UUIDs) and legacy full URLs seamlessly.
 */
export function getAssetUrl(fileIdOrUrl: string | null | undefined): string {
  if (!fileIdOrUrl) return "";
  const trimmed = fileIdOrUrl.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  return `${apiBase}/assets/${trimmed}`;
}
