"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ArrowLeft } from "lucide-react";
import { usePRDetail } from "../hooks/usePRDetail";
import { PRPrintContent } from "./PRPrintContent";

type ProcurementRequestPrintPageProps = {
  id: number;
};

export default function ProcurementRequestPrintPage({ id }: ProcurementRequestPrintPageProps) {
  const router = useRouter();
  const { master, details, loading, error } = usePRDetail(id);
  const printRef = React.useRef<HTMLDivElement>(null);

  function handlePrint() {
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc || !printRef.current) return;

    const clone = printRef.current.cloneNode(true) as HTMLElement;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print - ${master?.procurement_no ?? "PR"}</title>
          <style>
            body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>${clone.outerHTML}</body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  }

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (error || !master) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm text-destructive">Failed to load procurement request</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/fm/procurement/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" /> Print
        </Button>
      </div>

      <div className="border rounded-md bg-white p-8">
        <PRPrintContent ref={printRef} master={master} details={details} />
      </div>
    </div>
  );
}
