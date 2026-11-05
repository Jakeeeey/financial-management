import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, X } from "lucide-react";

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  pdfUrl: string | null;
  loading: boolean;
}

export function ReportPreviewModal({ isOpen, onClose, title, pdfUrl, loading }: ReportPreviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        showCloseButton={false}
        className="!max-w-6xl !sm:max-w-6xl w-full h-[95vh] overflow-hidden flex flex-col gap-0 space-y-0 rounded-xl border border-slate-200/80 shadow-2xl p-0 bg-slate-100"
      >
        {/* Accessibility Header */}
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>PDF Preview of the selected budget report.</DialogDescription>
        </DialogHeader>
        
        {/* Modern Clean Header Bar */}
        <div className="h-14 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 shrink-0 m-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-600 shadow-xs">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider leading-none">{title}</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight mt-1">MEN2 MARKETING & DISTRIBUTION — PDF PREVIEW</span>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose} 
            className="h-8 px-4 rounded-lg font-bold text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all gap-1.5"
          >
            <X className="h-4 w-4" />
            Close Preview
          </Button>
        </div>

        {/* Floating PDF Canvas Area */}
        <div className="flex-1 bg-slate-200/70 p-4 flex flex-col relative overflow-hidden m-0">
          {loading ? (
            <div className="h-full w-full bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center gap-4 animate-pulse shadow-sm">
              <div className="h-16 w-16 bg-slate-100 rounded-full" />
              <div className="h-4 w-56 bg-slate-100 rounded-md" />
            </div>
          ) : pdfUrl ? (
            <div className="w-full h-full rounded-lg overflow-hidden border border-slate-300/80 shadow-md bg-white">
              <iframe 
                src={`${pdfUrl}#toolbar=0&navpanes=0`} 
                className="w-full h-full border-none block m-0 p-0"
                style={{ display: 'block' }}
                title="PDF Preview"
              />
            </div>
          ) : (
            <div className="h-full w-full bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center text-slate-400">
              <FileText className="h-12 w-12 opacity-30 mb-3" />
              <p className="text-xs font-semibold">Failed to load preview.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

