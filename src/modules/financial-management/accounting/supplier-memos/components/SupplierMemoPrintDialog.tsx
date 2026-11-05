"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PdfTemplate } from "@/components/pdf-layout-design/services/pdf-template";
import type { SupplierMemo } from "../types";

export function SupplierMemoPrintDialog({ memo, api, onClose }: {
  memo: SupplierMemo; api: string; onClose: () => void;
}) {
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [selected, setSelected] = useState("none");
  const [loading, setLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [revision, setRevision] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setOptionsError("");
    void fetch(api + "?action=print-options", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Unable to load print templates.");
        if (!controller.signal.aborted) setTemplates(payload.templates);
      })
      .catch(error => { if (!controller.signal.aborted) setOptionsError(error instanceof Error ? error.message : "Unable to load print templates."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, revision]);
  useEffect(() => () => generation.current?.abort(), []);

  async function generate() {
    if (generation.current) return;
    const controller = new AbortController();
    generation.current = controller;
    setGenerating(true); setError("");
    try {
      const query = selected === "none" ? "" : "?" + new URLSearchParams({ templateId: selected });
      const response = await fetch(api + "/" + memo.id + "/print" + query, { cache: "no-store", signal: controller.signal });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "The memo PDF could not be generated.");
      }
      if (!response.headers.get("content-type")?.includes("application/pdf")) throw new Error("The print service did not return a PDF. Please try again.");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = memo.memo_number.replace(/[^a-zA-Z0-9._-]/g, "_") + ".pdf";
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      onClose();
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "The memo PDF could not be generated.");
    } finally {
      generation.current = null;
      if (!controller.signal.aborted) setGenerating(false);
    }
  }

  const config = templates.find(template => String(template.id) === selected)?.config;
  const thermal = config?.paperSize === "Custom" && Math.min(config.customSize.width, config.customSize.height) < 100;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-[425px] max-h-[90dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Printer className="size-5" /> Print Settings</DialogTitle>
        <DialogDescription>{memo.memo_number} · Generate an individual supplier memo PDF.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2"><Label htmlFor="supplier-memo-print-template">Header Template</Label>
          <Select value={selected} onValueChange={setSelected} disabled={loading || generating}>
            <SelectTrigger id="supplier-memo-print-template"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">Standard Header</SelectItem>
              {templates.map(template => <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {loading && <p role="status" className="text-sm text-muted-foreground">Loading templates…</p>}
        {optionsError && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{optionsError} Standard Header is still available.</p>
          <Button type="button" variant="outline" size="sm" disabled={generating} onClick={() => setRevision(value => value + 1)}>Retry templates</Button></div>}
        {!loading && !optionsError && !templates.length && <p className="text-sm text-muted-foreground">No saved templates are available. Use Standard Header.</p>}
        <dl className="rounded-md border p-3 text-sm space-y-2">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Paper size</dt><dd>{config?.paperSize === "Custom" ? `${config.customSize.width} × ${config.customSize.height} mm` : config?.paperSize || "A4"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Orientation</dt><dd className="capitalize">{config?.orientation || "portrait"}</dd></div>
        </dl>
        <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">{thermal ? "Thermal printing uses a stacked layout sized to the selected paper." : "The document will be downloaded as a PDF with memo details, linked disbursements, and signature lines."}</p>
        {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" disabled={loading || generating} onClick={() => void generate()}>{generating && <Loader2 className="size-4 animate-spin" />}{generating ? "Generating…" : "Generate PDF"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
