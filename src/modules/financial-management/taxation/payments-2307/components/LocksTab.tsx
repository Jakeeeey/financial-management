"use client";

import { useMemo, useState } from "react";
import { Lock, LockOpen, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERIOD_KEYS, PERIOD_LABELS } from "../constants";
import type { PeriodKey, PeriodLockRow } from "../types";
import { UnlockDialog } from "./UnlockDialog";

const COLUMN_COUNT = 6;

interface LocksTabProps {
  locks: PeriodLockRow[];
  isLoading: boolean;
  isSaving: boolean;
  onLock: (periodKey: PeriodKey) => Promise<void>;
  onUnlock: (periodKey: PeriodKey, reason: string) => Promise<void>;
}

export function LocksTab({ locks, isLoading, isSaving, onLock, onUnlock }: LocksTabProps) {
  const [alert, setAlert] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<PeriodKey | null>(null);

  const latestByPeriod = useMemo(() => {
    const map = new Map<PeriodKey, PeriodLockRow>();
    for (const lock of locks) {
      const current = map.get(lock.periodKey);
      if (!current || lock.lockedAt > current.lockedAt) map.set(lock.periodKey, lock);
    }
    return map;
  }, [locks]);

  const lockedCount = useMemo(
    () =>
      PERIOD_KEYS.filter((periodKey) => {
        const lock = latestByPeriod.get(periodKey);
        return lock !== undefined && lock.unlockedAt === null;
      }).length,
    [latestByPeriod],
  );

  async function lockPeriod(periodKey: PeriodKey) {
    setAlert(null);
    try {
      await onLock(periodKey);
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "The period was not locked.");
    }
  }

  return (
    <section
      aria-label="Period locks"
      className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <h2 className="text-sm font-semibold">Period locks</h2>
        <Badge variant="outline" className="tabular-nums text-[11px]">
          {lockedCount} of {PERIOD_KEYS.length} locked
        </Badge>
      </header>


      {alert ? (
        <div className="px-4 pb-3">
          <Alert variant="destructive">
            <AlertDescription>{alert}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <Table aria-label="Period locks">
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Locked by</TableHead>
              <TableHead>Locked at</TableHead>
              <TableHead className="min-w-[200px]">Last unlock</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell colSpan={COLUMN_COUNT}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              PERIOD_KEYS.map((periodKey) => {
                const lock = latestByPeriod.get(periodKey) ?? null;
                const isLocked = lock !== null && lock.unlockedAt === null;

                return (
                  <TableRow key={periodKey}>
                    <TableCell className="font-medium">{PERIOD_LABELS[periodKey]}</TableCell>
                    <TableCell>
                      {lock === null ? (
                        <Badge variant="outline" className="text-[11px] font-semibold">
                          Never locked
                        </Badge>
                      ) : isLocked ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          Locked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] font-semibold">
                          Open
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {lock ? (lock.lockedByName ?? (lock.lockedBy ? `#${lock.lockedBy}` : "—")) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{lock ? lock.lockedAt.replace("T", " ") : "—"}</TableCell>
                    <TableCell>
                      {lock?.unlockedAt ? (
                        <div className="max-w-[260px]">
                          <div className="tabular-nums text-xs">{lock.unlockedAt.replace("T", " ")}</div>
                          <div className="truncate text-xs text-muted-foreground" title={lock.unlockReason ?? ""}>
                            {lock.unlockReason ?? "No reason recorded"}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isLocked ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setUnlocking(periodKey)}
                          disabled={isSaving}
                          className="min-h-11 md:min-h-0"
                        >
                          <LockOpen className="mr-2 size-4" />
                          Unlock
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void lockPeriod(periodKey)}
                          disabled={isSaving}
                          className="min-h-11 md:min-h-0"
                        >
                          {isSaving ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          ) : (
                            <Lock className="mr-2 size-4" />
                          )}
                          Lock
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <UnlockDialog
        periodKey={unlocking}
        isSaving={isSaving}
        onClose={() => setUnlocking(null)}
        onSubmit={async (reason) => {
          if (unlocking === null) return;
          await onUnlock(unlocking, reason);
        }}
      />
    </section>
  );
}
