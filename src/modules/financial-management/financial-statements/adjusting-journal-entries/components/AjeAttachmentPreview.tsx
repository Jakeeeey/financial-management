"use client";

import * as React from "react";
import { Download, Image as ImageIcon, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PREVIEWABLE_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"]);
const PREVIEWABLE_IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|bmp)$/i;

export function isPreviewableAjeImage(mimeType: string, filename: string, allowExtensionFallback = false) {
  const normalizedMimeType = mimeType.trim().toLowerCase().split(";")[0];
  return PREVIEWABLE_IMAGE_MIMES.has(normalizedMimeType)
    || (allowExtensionFallback && !normalizedMimeType && PREVIEWABLE_IMAGE_EXTENSIONS.test(filename));
}

type Props = {
  fileName: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  downloadUrl?: string;
  openDownloadInNewTab?: boolean;
  metadata?: string;
  statusText?: string;
  onRemove?: () => void;
  removeDisabled?: boolean;
};

function AttachmentImageViewer({ fileName, previewUrl, downloadUrl }: { fileName: string; previewUrl: string; downloadUrl?: string }) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = React.useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = React.useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);

  React.useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewport({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const sideways = rotation % 180 !== 0;
  const rotatedWidth = imageSize ? sideways ? imageSize.height : imageSize.width : 0;
  const rotatedHeight = imageSize ? sideways ? imageSize.width : imageSize.height : 0;
  const fit = imageSize ? Math.max(0, Math.min((viewport.width - 16) / rotatedWidth, (viewport.height - 16) / rotatedHeight, 1)) : 0;
  const ready = Boolean(imageSize && fit > 0 && !failed);
  const resetView = () => {
    setZoom(1);
    setRotation(0);
    viewportRef.current?.scrollTo({ left: 0, top: 0 });
  };

  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <div role="group" aria-label="Image viewing controls" className="flex shrink-0 flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="icon" aria-label="Zoom out" title="Zoom out" disabled={!ready || zoom <= 0.25} onClick={() => setZoom(value => Math.max(0.25, value - 0.25))}><ZoomOut aria-hidden="true" className="size-4" /></Button>
      <span className="min-w-12 text-center text-sm tabular-nums" aria-live="polite" aria-atomic="true"><span className="sr-only">Zoom </span>{Math.round(zoom * 100)}%</span>
      <Button type="button" variant="outline" size="icon" aria-label="Zoom in" title="Zoom in" disabled={!ready || zoom >= 4} onClick={() => setZoom(value => Math.min(4, value + 0.25))}><ZoomIn aria-hidden="true" className="size-4" /></Button>
      <Button type="button" variant="outline" size="icon" aria-label="Rotate clockwise" title="Rotate clockwise" disabled={!ready} onClick={() => setRotation(value => (value + 90) % 360)}><RotateCw aria-hidden="true" className="size-4" /></Button>
      <Button type="button" variant="outline" disabled={!ready} onClick={resetView}><RotateCcw aria-hidden="true" className="size-4" />Reset view</Button>
      {downloadUrl && <Button type="button" variant="outline" asChild><a href={downloadUrl} download={fileName}><Download aria-hidden="true" className="size-4" />Download original</a></Button>}
      <p className="basis-full text-xs text-muted-foreground">100% fits the image within the viewer. Scroll to inspect enlarged images.</p>
      <span className="sr-only" role="status">Rotation {rotation} degrees clockwise.</span>
    </div>
    <div ref={viewportRef} role="region" aria-label={`Image viewport for ${fileName}`} tabIndex={0} className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {failed ? <p role="status" className="p-4 text-sm text-muted-foreground">{downloadUrl ? "Preview unavailable. Download the original file to view it." : "Preview unavailable."}</p> : <>
        {!imageSize && <p role="status" className="p-4 text-sm text-muted-foreground">Loading image preview…</p>}
        <div className="relative overflow-hidden" style={{ width: Math.max(viewport.width, rotatedWidth * fit * zoom + 16), height: Math.max(viewport.height, rotatedHeight * fit * zoom + 16) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={fileName} decoding="async" draggable={false} className="absolute block max-w-none" style={{ left: "50%", top: "50%", width: imageSize ? imageSize.width * fit * zoom : 1, height: imageSize ? imageSize.height * fit * zoom : 1, opacity: ready ? 1 : 0, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }} onLoad={event => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setFailed(true)} />
        </div>
      </>}
    </div>
  </div>;
}

export function AjeAttachmentPreview({ fileName, thumbnailUrl, previewUrl, downloadUrl, openDownloadInNewTab = false, metadata, statusText, onRemove, removeDisabled = false }: Props) {
  const [open, setOpen] = React.useState(false);
  const previewTriggerRef = React.useRef<HTMLButtonElement>(null);
  const [failedThumbnailUrl, setFailedThumbnailUrl] = React.useState<string | null>(null);
  const thumbnailSource = thumbnailUrl || previewUrl;
  const thumbnailUnavailable = !thumbnailSource || failedThumbnailUrl === thumbnailSource;

  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-2 text-sm">
    <div className="flex min-w-0 items-center gap-3">
      {previewUrl && <Button ref={previewTriggerRef} type="button" variant="outline" className="h-14 w-14 shrink-0 overflow-hidden p-1" style={{ height: 56, width: 56, minHeight: 56, minWidth: 56 }} aria-label={`Preview ${fileName}`} onClick={() => setOpen(true)}>
        {thumbnailUnavailable ? <ImageIcon aria-hidden="true" className="size-6 text-muted-foreground" /> : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailSource} alt={`Preview of ${fileName}`} loading="lazy" decoding="async" className="block rounded-sm" style={{ width: 48, height: 48, maxWidth: "100%", maxHeight: "100%", objectFit: "cover" }} onError={() => setFailedThumbnailUrl(thumbnailSource)} />
        )}
      </Button>}
      <div className="min-w-0">
        {downloadUrl ? <a className="break-all text-primary underline" href={downloadUrl} target={openDownloadInNewTab ? "_blank" : undefined} rel={openDownloadInNewTab ? "noreferrer" : undefined}>{fileName}</a> : <span className="break-all">{fileName}</span>}
        {statusText && <p className="text-xs text-muted-foreground">{statusText}</p>}
        {metadata && <p className="text-xs text-muted-foreground">{metadata}</p>}
      </div>
    </div>
    {onRemove && <Button type="button" variant="ghost" size="sm" disabled={removeDisabled} onClick={onRemove}>Remove</Button>}

    {previewUrl && <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[90dvh] max-h-[900px] flex-col gap-3 overflow-hidden" style={{ width: "min(90vw, 900px)", maxWidth: "90vw" }} onCloseAutoFocus={event => { event.preventDefault(); previewTriggerRef.current?.focus({ preventScroll: true }); }}>
        <DialogHeader className="max-h-[20dvh] shrink-0 overflow-y-auto">
          <DialogTitle className="break-all pr-6">{fileName}</DialogTitle>
          <DialogDescription>Image preview</DialogDescription>
        </DialogHeader>
        {open && <AttachmentImageViewer key={previewUrl} fileName={fileName} previewUrl={previewUrl} downloadUrl={downloadUrl} />}
      </DialogContent>
    </Dialog>}
  </div>;
}
