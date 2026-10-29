export function retryAfterSeconds(value: string | null, now = Date.now()): number {
  if (!value) return 10;
  const seconds = /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : (Date.parse(value) - now) / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 10;
}
