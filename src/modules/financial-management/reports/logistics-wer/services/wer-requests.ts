import { retryAfterSeconds } from "../utils/retry-after";

let scope = "session";
let deadline = 0;
const listeners = new Set<() => void>();
const pendingReads = new Map<string, Promise<Response>>();
const key = () => `wer-cooldown:${scope}`;
const emit = () => listeners.forEach(listener => listener());
export const cooldownSnapshot = () => deadline;
export function subscribeCooldown(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function setWerScope(next: string) {
  if (typeof window === "undefined") return;
  const previous = scope === next ? deadline : 0;
  scope = next;
  try { deadline = Math.max(previous, Number(localStorage.getItem(key())) || 0); } catch { deadline = previous; }
  emit();
}
if (typeof window !== "undefined") window.addEventListener("storage", event => {
  if (event.key === key()) { deadline = Math.max(deadline, Number(event.newValue) || 0); emit(); }
});
export class WerRateLimitError extends Error {
  readonly outcome = "not_applied";
  constructor() { super("Too many requests. Please wait before trying again. Your entries have been kept."); }
}
function startCooldown(seconds: number, requestScope: string) {
  if (requestScope !== scope) return;
  deadline = Math.max(deadline, Date.now() + seconds * 1000);
  try { localStorage.setItem(key(), String(deadline)); } catch { /* In-tab protection remains available. */ }
  emit();
}
export async function werFetch(input: string, init?: RequestInit): Promise<Response> {
  if (Date.now() < deadline) throw new WerRateLimitError();
  const read = !init?.method || init.method.toUpperCase() === "GET";
  const requestScope = scope;
  const requestKey = `${requestScope}:${input}`;
  if (read && pendingReads.has(requestKey)) return (await pendingReads.get(requestKey)!).clone();
  const request = fetch(input, init).then(async response => {
    const payload = response.status === 429 || response.headers.has("Retry-After") ? await response.clone().json().catch(() => null) : null;
    if (response.status === 429 || payload?.code === "WER_RATE_LIMITED") {
      startCooldown(retryAfterSeconds(response.headers.get("Retry-After") ?? (payload?.retryAfterSeconds ? String(payload.retryAfterSeconds) : null)), requestScope);
    }
    return response;
  }).finally(() => { if (read) pendingReads.delete(requestKey); });
  if (read) pendingReads.set(requestKey, request);
  return (await request).clone();
}
