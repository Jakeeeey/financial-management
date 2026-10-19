"use client";

import * as React from "react";
import { Image as ImageIcon } from "lucide-react";
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
  previewUrl?: string;
  downloadUrl?: string;
  openDownloadInNewTab?: boolean;
  metadata?: string;
  statusText?: string;
  onRemove?: () => void;
  removeDisabled?: boolean;
};

export function AjeAttachmentPreview({ fileName, previewUrl, downloadUrl, openDownloadInNewTab = false, metadata, statusText, onRemove, removeDisabled = false }: Props) {
  const [open, setOpen] = React.useState(false);
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const imageUnavailable = !previewUrl || failedUrl === previewUrl;

  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-2 text-sm">
    <div className="flex min-w-0 items-center gap-3">
      {previewUrl && <Button type="button" variant="outline" className="h-14 w-14 shrink-0 overflow-hidden p-1" style={{ height: 56, width: 56, minHeight: 56, minWidth: 56 }} aria-label={`Preview ${fileName}`} onClick={() => setOpen(true)}>
        {imageUnavailable ? <ImageIcon aria-hidden="true" className="size-6 text-muted-foreground" /> : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={`Preview of ${fileName}`} className="block rounded-sm" style={{ width: 48, height: 48, maxWidth: "100%", maxHeight: "100%", objectFit: "cover" }} onError={() => setFailedUrl(previewUrl)} />
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
      <DialogContent className="gap-3 overflow-y-auto" style={{ maxHeight: "90vh", width: "min(90vw, 900px)", maxWidth: "90vw" }}>
        <DialogHeader>
          <DialogTitle className="break-all pr-6">{fileName}</DialogTitle>
          <DialogDescription>Image preview</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-md bg-muted/40 p-2" style={{ maxHeight: "72vh" }}>
          {imageUnavailable ? <p role="status" className="text-sm text-muted-foreground">Preview unavailable. Download the file to view it.</p> : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={fileName} className="block object-contain" style={{ maxHeight: "68vh", maxWidth: "100%", width: "auto", height: "auto" }} onError={() => setFailedUrl(previewUrl)} />
          )}
        </div>
      </DialogContent>
    </Dialog>}
  </div>;
}
