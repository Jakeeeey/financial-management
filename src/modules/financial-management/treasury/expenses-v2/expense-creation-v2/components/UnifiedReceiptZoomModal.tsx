"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { getAssetUrl } from "../../utils/assetUrl";

export interface UnifiedReceiptZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  docNo?: string;
  title?: string;
  subtitle?: string;
}

export const UnifiedReceiptZoomModal: React.FC<UnifiedReceiptZoomModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  docNo,
  title = "Receipt Attachment Preview",
  subtitle,
}) => {
  const [zoomScale, setZoomScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const rAFRef = useRef<number | null>(null);

  const updateDOMTransform = (scale: number, x: number, y: number) => {
    if (imgRef.current) {
      imgRef.current.style.transform = `translate3d(${x}px, ${y}px, 0px) scale(${scale})`;
    }
  };

  const resetPanZoom = useCallback(() => {
    setZoomScale(1);
    posRef.current = { x: 0, y: 0 };
    setIsDragging(false);
    updateDOMTransform(1, 0, 0);
  }, []);



  const handleZoomIn = () => {
    setZoomScale((prev) => {
      const next = Math.min(Number((prev + 0.25).toFixed(2)), 4);
      updateDOMTransform(next, posRef.current.x, posRef.current.y);
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => {
      const next = Math.max(Number((prev - 0.25).toFixed(2)), 0.5);
      if (next <= 1) {
        posRef.current = { x: 0, y: 0 };
      }
      updateDOMTransform(next, posRef.current.x, posRef.current.y);
      return next;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else if (e.deltaY > 0) {
      handleZoomOut();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    posRef.current = { x: newX, y: newY };

    if (rAFRef.current) {
      cancelAnimationFrame(rAFRef.current);
    }
    rAFRef.current = requestAnimationFrame(() => {
      updateDOMTransform(zoomScale, newX, newY);
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (rAFRef.current) {
      cancelAnimationFrame(rAFRef.current);
      rAFRef.current = null;
    }
  };

  const resolvedImageUrl = imageUrl ? getAssetUrl(imageUrl) : "";
  const isBlobUrl = imageUrl?.startsWith("blob:") || imageUrl?.startsWith("data:");

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          resetPanZoom();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-5xl md:max-w-6xl w-[94vw] max-h-[92vh] p-0 overflow-hidden bg-card border-border flex flex-col z-[150]">
        {/* Header with Pan & Zoom Controls */}
        <DialogHeader className="p-2.5 px-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <ImageIcon className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <DialogTitle className="text-xs font-bold text-foreground flex items-center gap-2 truncate">
                  <span>{title}</span>
                  {docNo && (
                    <Badge variant="outline" className="font-mono text-[10px] py-0 px-1.5 bg-background shrink-0">
                      {docNo}
                    </Badge>
                  )}
                </DialogTitle>
                {subtitle && (
                  <p className="text-[10px] text-muted-foreground font-mono truncate max-w-sm sm:max-w-md">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Interactive Zoom Toolbar */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 bg-background/90 dark:bg-zinc-900 border border-border p-0.5 rounded-lg shadow-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={zoomScale <= 0.5}
                  className="h-6 w-6 rounded-md"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>

                <span className="font-mono text-[11px] font-bold text-foreground px-1.5 min-w-[44px] text-center select-none">
                  {Math.round(zoomScale * 100)}%
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={zoomScale >= 4}
                  className="h-6 w-6 rounded-md"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetPanZoom}
                  className="h-6 text-[10px] font-semibold gap-1 px-2 text-muted-foreground hover:text-foreground border-l border-border/80 rounded-none rounded-r-md"
                  title="Reset Zoom & Drag Position"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </Button>
              </div>

              {resolvedImageUrl && !isBlobUrl && (
                <a
                  href={resolvedImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 mr-6"
                >
                  Open Original <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Draggable & Zoomable Viewport Container */}
        <div
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`p-3 bg-zinc-950/95 flex items-center justify-center flex-1 min-h-[480px] max-h-[82vh] overflow-hidden select-none relative ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {zoomScale > 1 && (
            <div className="absolute top-2 left-2 z-10 bg-black/60 text-zinc-300 text-[10px] font-mono px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1 pointer-events-none">
              <Move className="w-3 h-3 text-amber-400" /> Click & Drag to explore all corners
            </div>
          )}

          {imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              ref={imgRef}
              src={resolvedImageUrl}
              alt="Receipt Attachment"
              draggable={false}
              style={{
                willChange: "transform",
              }}
              className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl border border-zinc-800/80 pointer-events-auto origin-center transition-none"
            />
          ) : (
            <p className="text-xs text-zinc-400 italic">No receipt image URL found.</p>
          )}
        </div>

        {/* Compact Footer */}
        <DialogFooter className="p-2 px-4 border-t border-border bg-muted/30 shrink-0 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono">
            Use mouse wheel to zoom • Drag image to view all corners
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-7 text-xs font-semibold px-4"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
