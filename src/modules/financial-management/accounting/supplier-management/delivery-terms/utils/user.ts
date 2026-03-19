/**
 * User utility - deprecated
 * Use fetchProvider.getCurrentUserId() instead
 */

export async function getCurrentUserId(): Promise<number | null> {
  // Kept for backward compatibility - delegates to fetchProvider
  const { getCurrentUserId: getFromFetch } = await import(
    "../providers/fetchProvider"
  );
  return getFromFetch();
}
