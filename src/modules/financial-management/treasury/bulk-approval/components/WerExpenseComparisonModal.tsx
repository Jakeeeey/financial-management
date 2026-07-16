"use client";

import * as React from "react";
import { FileText, Maximize2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import type { EvidenceViewerItem } from "../utils/evidenceViewer";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  werItems: EvidenceViewerItem[];
  expenseItem: EvidenceViewerItem | null;
  onPreviewUrl: (url: string) => void;
};

function EvidenceImage({ item, title, onPreviewUrl }: {
  item: EvidenceViewerItem;
  title: string;
  onPreviewUrl: (url: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div>
          <Badge className={item.category === "wer-summary" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"}>
            {title}
          </Badge>
          <p className="mt-2 max-w-[34vw] truncate text-xs font-bold text-slate-700 dark:text-slate-200">{item.label}</p>
        </div>
        <Button type="button" size="icon" variant="ghost" onClick={() => onPreviewUrl(`/api/fm/expense-assets?id=${item.url}`)} title="View full screen">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-950 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/fm/expense-assets?id=${item.url}`} alt={item.label} className="max-h-full max-w-full object-contain" />
      </div>
    </div>
  );
}

export default function WerExpenseComparisonModal({
  open,
  onOpenChange,
  werItems,
  expenseItem,
  onPreviewUrl,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex h-[90vh] w-[96vw] max-w-[96vw] flex-col overflow-hidden rounded-[2rem] border-slate-200 bg-slate-100 p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <DialogTitle className="sr-only">WER and expense attachment comparison</DialogTitle>
        <DialogDescription className="sr-only">Compare weekly expense report summaries with the selected expense attachment.</DialogDescription>

        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-7 py-5 dark:border-slate-800 dark:bg-slate-950">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">WER & Expense Verification</h2>
            <p className="text-xs font-medium text-slate-500">Compare the weekly summary against the selected expense line.</p>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-5 p-5">
          <div className="min-h-0">
            {werItems.length > 0 ? (
              <Carousel className="h-full w-full" opts={{ watchDrag: false }}>
                <CarouselContent className="h-full">
                  {werItems.map((item) => (
                    <CarouselItem key={item.url} className="h-full">
                      <EvidenceImage item={item} title="WER Summary Attachment" onPreviewUrl={onPreviewUrl} />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {werItems.length > 1 && (
                  <>
                    <CarouselPrevious className="left-4" />
                    <CarouselNext className="right-4" />
                  </>
                )}
              </Carousel>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-amber-300 bg-amber-50 text-center dark:border-amber-900 dark:bg-amber-950/20">
                <FileText className="mb-3 h-8 w-8 text-amber-500" />
                <p className="text-sm font-black text-amber-800 dark:text-amber-300">No WER Summary Attached</p>
                <p className="mt-1 text-xs text-amber-700/70 dark:text-amber-400/70">The selected header has no weekly summary file.</p>
              </div>
            )}
          </div>

          <div className="min-h-0">
            {expenseItem ? (
              <EvidenceImage item={expenseItem} title="Expense Attachment" onPreviewUrl={onPreviewUrl} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                No expense attachment available.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
