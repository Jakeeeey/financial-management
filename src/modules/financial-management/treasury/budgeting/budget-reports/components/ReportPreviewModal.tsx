import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, X } from "lucide-react";

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
      {/* Forced width using ! to override base component restrictions */}
      <DialogContent 
        showCloseButton={false}
        className="!max-w-6xl !sm:max-w-6xl w-full h-[96vh] overflow-hidden flex flex-col gap-0 space-y-0 rounded-md border-none shadow-2xl p-0 bg-slate-950"
      >
        {/* Accessibility Requirements (Hidden Visually) */}
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>PDF Preview of the selected budget report.</DialogDescription>
        </DialogHeader>
        
        {/* Slim Dedicated Control Bar */}
        <div className="h-12 bg-slate-950 flex items-center justify-between px-6 shrink-0 m-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-primary/20 rounded">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-white uppercase tracking-widest leading-none">{title}</span>
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-tighter mt-1">MEN2 MARKETING - PDF PREVIEW</span>
            </div>
          </div>
          
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={onClose} 
            className="h-9 px-6 rounded-md font-black text-[11px] uppercase tracking-widest gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            <X className="h-4 w-4" />
            Close Preview
          </Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden m-0 p-0">
          {loading ? (
            <div className="h-full w-full flex flex-col items-center justify-center gap-4 animate-pulse">
              <div className="h-20 w-20 bg-white/5 rounded-full" />
              <div className="h-4 w-64 bg-white/5 rounded-lg" />
            </div>
          ) : pdfUrl ? (
            <iframe 
              src={pdfUrl} 
              className="w-full h-full border-none bg-slate-950 block m-0 p-0"
              style={{ display: 'block' }}
              title="PDF Preview"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-white/20">
              <FileSpreadsheet className="h-12 w-12 opacity-20 mb-4" />
              <p className="text-sm font-bold">Failed to load preview.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
