"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Download, X } from "lucide-react";
import { toast } from "sonner";
import { pdfTemplateService, type PdfTemplate } from "@/components/pdf-layout-design/services/pdf-template";
import type { CompanyData } from "@/components/pdf-layout-design/types";
import { generatePurchaseOrderPdf } from "../utils/generatePurchaseOrderPdf";
import type { PurchaseOrder, PurchaseOrderItem } from "../utils/types";

type PrintProcurementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PurchaseOrder;
  items: PurchaseOrderItem[];
  supplierName: string;
  supplier?: {
    address?: string | null;
    email_address?: string | null;
    phone_number?: string | null;
    tin_number?: string | null;
    payment_terms?: string | null;
  } | null;
};

export default function PrintProcurementDialog({
  open, onOpenChange,
  po, items, supplierName, supplier,
}: PrintProcurementDialogProps) {
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const init = async () => {
      try {
        const cached = localStorage.getItem("pdf_company_data");
        if (cached) setCompanyData(JSON.parse(cached));

        const [compRes, tpls] = await Promise.all([
          fetch("/api/pdf/company"),
          pdfTemplateService.fetchTemplates(),
        ]);

        if (compRes.ok) {
          const result = await compRes.json();
          const company = result.data?.[0] || (Array.isArray(result.data) ? null : result.data);
          setCompanyData(company);
          if (company) localStorage.setItem("pdf_company_data", JSON.stringify(company));
        }

        setTemplates(tpls);
        if (tpls.length > 0 && !selectedTemplateName) {
          setSelectedTemplateName(tpls[0].name);
        }
      } catch (error) {
        console.error("Error fetching print data:", error);
      }
    };
    init();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    if (!companyData) {
      toast.warning("Company data not loaded yet. Please wait.");
      return;
    }
    setIsGenerating(true);
    try {
      const { url } = await generatePurchaseOrderPdf(
        po, items, companyData,
        { supplierName, supplier, selectedTemplate: selectedTemplateName }
      );
      setPdfUrl(url);
      setIsPreviewOpen(true);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadFromPreview = async () => {
    if (!pdfUrl) return;
    const resp = await fetch(pdfUrl);
    const blob = await resp.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `PO_${po.purchase_order_no}_${Date.now()}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Print Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Layout Template</label>
              <Select value={selectedTemplateName} onValueChange={setSelectedTemplateName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent className="!max-h-[200px] overflow-y-auto">
                  <SelectItem value="__none__">Standard Header</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleGenerate} disabled={isGenerating || !companyData}>
              {isGenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
              Generate PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isPreviewOpen && pdfUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-6xl h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold">Print Preview</h3>
                <p className="text-xs text-muted-foreground">{po.purchase_order_no}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadFromPreview}>
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setIsPreviewOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 p-4 flex items-center justify-center">
              <iframe src={pdfUrl} className="w-full h-full rounded-lg border shadow-sm bg-white" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
