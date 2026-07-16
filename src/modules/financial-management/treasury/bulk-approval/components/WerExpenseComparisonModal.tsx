"use client";

import * as React from "react";
import { FileText, Maximize2, Move, RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import { clampEvidenceZoom, rotateEvidenceClockwise, type EvidenceViewerItem } from "../utils/evidenceViewer";

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
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [viewerEl, setViewerEl] = React.useState<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [item.url]);

  React.useEffect(() => {
    if (!viewerEl) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((current) => clampEvidenceZoom(current + (event.deltaY < 0 ? 0.15 : -0.15)));
    };
    viewerEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewerEl.removeEventListener("wheel", handleWheel);
  }, [viewerEl]);

  const resetView = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <div className="flex h-[68vh] min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex h-[5.25rem] shrink-0 items-center justify-between border-b border-border px-5 py-3">
        <div>
          <Badge className={item.category === "wer-summary" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"}>
            {title}
          </Badge>
          <p className="mt-2 max-w-[34vw] truncate text-xs font-bold text-foreground">{item.label}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" onClick={() => setZoom((current) => clampEvidenceZoom(current - 0.25))} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-10 text-center text-[10px] font-black text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button type="button" size="icon" variant="ghost" onClick={() => setZoom((current) => clampEvidenceZoom(current + 0.25))} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => setRotation((current) => rotateEvidenceClockwise(current))} title="Rotate clockwise">
            <RotateCw className="h-4 w-4" />
          </Button>
          {(zoom !== 1 || rotation !== 0) && (
            <Button type="button" size="icon" variant="ghost" onClick={resetView} title="Reset view">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button type="button" size="icon" variant="ghost" onClick={() => onPreviewUrl(`/api/fm/expense-assets?id=${item.url}`)} title="View full screen">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={setViewerEl} className="group relative flex h-[calc(68vh-5.25rem)] min-h-0 shrink-0 items-center justify-center overflow-hidden bg-slate-950 p-4">
        <motion.div
          drag={zoom > 1}
          dragMomentum={false}
          className={zoom > 1 ? "flex h-full w-full cursor-grab items-center justify-center active:cursor-grabbing" : "flex h-full w-full items-center justify-center"}
          style={{ scale: zoom, rotate: rotation }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/fm/expense-assets?id=${item.url}`} alt={item.label} className="max-h-full max-w-full select-none object-contain pointer-events-none" draggable={false} />
        </motion.div>
        <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-white/60 opacity-0 backdrop-blur group-hover:opacity-100">
          <Move className="h-3 w-3" /> Scroll to zoom {zoom > 1 ? "• Drag to pan" : ""}
        </div>
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
  const [werCarouselApi, setWerCarouselApi] = React.useState<CarouselApi>();
  const [currentWerSlide, setCurrentWerSlide] = React.useState(0);

  React.useEffect(() => {
    if (!werCarouselApi) return;
    const updateSlide = () => setCurrentWerSlide(werCarouselApi.selectedScrollSnap());
    updateSlide();
    werCarouselApi.on("select", updateSlide);
    return () => {
      werCarouselApi.off("select", updateSlide);
    };
  }, [werCarouselApi]);

  React.useEffect(() => {
    if (!open) return;
    setCurrentWerSlide(0);
    werCarouselApi?.scrollTo(0);
  }, [open, werCarouselApi]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex h-[86vh] w-[96vw] max-w-[96vw] sm:!w-[90vw] sm:!max-w-[90vw] flex-col overflow-hidden rounded-[2rem] border-border bg-muted/40 p-0 text-foreground shadow-2xl">
        <DialogTitle className="sr-only">WER and expense attachment comparison</DialogTitle>
        <DialogDescription className="sr-only">Compare weekly expense report summaries with the selected expense attachment.</DialogDescription>

        <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-7 py-5">
          <div>
            <h2 className="text-xl font-black text-foreground">WER & Expense Verification</h2>
            <p className="text-xs font-medium text-muted-foreground">Compare the weekly summary against the selected expense line.</p>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-5 overflow-auto p-5 md:grid-cols-2 md:overflow-hidden">
          <div className="h-[68vh] min-h-0">
            {werItems.length > 0 ? (
              <Carousel setApi={setWerCarouselApi} className="h-full w-full" opts={{ watchDrag: false }}>
                <CarouselContent className="h-full">
                  {werItems.map((item, index) => (
                    <CarouselItem key={item.url} className="h-full">
                      <div className="relative h-full">
                        <EvidenceImage item={item} title={`WER Summary Attachment ${index + 1}`} onPreviewUrl={onPreviewUrl} />
                        {werItems.length > 1 && (
                          <Badge className="absolute right-5 top-20 z-20 border-white/10 bg-slate-950/80 text-white shadow-lg backdrop-blur">
                            WER {currentWerSlide + 1} of {werItems.length}
                          </Badge>
                        )}
                      </div>
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

          <div className="h-[68vh] min-h-0">
            {expenseItem ? (
              <EvidenceImage item={expenseItem} title="Expense Attachment" onPreviewUrl={onPreviewUrl} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-border bg-card text-sm font-bold text-muted-foreground">
                No expense attachment available.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
