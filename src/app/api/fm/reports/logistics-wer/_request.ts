import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const context = new AsyncLocalStorage<{ requestId: string; directusRequests: number }>();
export function countDirectusRequest(): string | undefined {
  const current = context.getStore();
  if (current) current.directusRequests++;
  return current?.requestId;
}
export async function observeWerOperation<T>(operation: string, task: () => Promise<T>): Promise<T> {
  if (context.getStore()) return task();
  const current = { requestId: randomUUID(), directusRequests: 0 };
  const start = Date.now();
  return context.run(current, async () => {
    try { return await task(); }
    finally { console.info("[WER operation]", { operation, ...current, durationMs: Date.now() - start }); }
  });
}
