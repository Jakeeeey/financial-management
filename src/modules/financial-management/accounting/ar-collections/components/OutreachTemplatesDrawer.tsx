// OutreachTemplatesDrawer.tsx
import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { MessageSquare, Mail, AlertTriangle, Sparkles, Copy, MessageCircle } from 'lucide-react';
import { Invoice } from '../../accounts-receivable/types';
import { ARCollectionCommitment } from '../types';
import { formatPeso } from '../../accounts-receivable/utils';

interface OutreachTemplatesDrawerProps {
  invoice: Invoice | null;
  commitment: ARCollectionCommitment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OutreachTemplatesDrawer({
  invoice,
  commitment,
  open,
  onOpenChange,
}: OutreachTemplatesDrawerProps) {
  const [friendly, setFriendly] = useState('');
  const [formal, setFormal] = useState('');
  const [urgent, setUrgent] = useState('');
  const [aiCustom, setAiCustom] = useState('');
  const [activeTab, setActiveTab] = useState('friendly');
  const [prevInvoiceNo, setPrevInvoiceNo] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(false);
  const [prevCommitment, setPrevCommitment] = useState<ARCollectionCommitment | null>(null);

  if (invoice && (invoice.invoiceNo !== prevInvoiceNo || open !== prevOpen || commitment !== prevCommitment)) {
    setPrevInvoiceNo(invoice.invoiceNo);
    setPrevOpen(open);
    setPrevCommitment(commitment);
    if (open) {
      const amt = formatPeso(invoice.outstanding);
      const cust = invoice.customer;
      const sales = invoice.salesman;
      const invNo = invoice.invoiceNo;
      const days = invoice.overdue || 0;

      // 1. Friendly template
      setFriendly(
        `Hi ${cust},\n\nHope you're doing well! This is a gentle reminder regarding Invoice #${invNo} for ${amt} which is currently due. Please coordinate with our salesman ${sales} for check pickup. Thank you so much!`
      );

      // 2. Formal email template
      setFormal(
        `Dear Accounts Payable Team,\n\nWe would like to request an update regarding outstanding Invoice #${invNo} (issued to ${cust}) amounting to ${amt}.\n\nPlease find attached copy of the billing invoice. Kindly reply with the payment confirmation or scheduled release date. You may also align with our sales representative, ${sales}.\n\nThank you for your prompt attention to this matter.\n\nBest regards,\nCollections & Credit Department`
      );

      // 3. Urgent / Demand warning
      setUrgent(
        `IMPORTANT NOTICE: Accounts Payable department of ${cust}.\n\nYour account has an overdue balance of ${amt} for Invoice #${invNo} which is now ${days} days past due.\n\nTo prevent credit suspension, please arrange check placement or bank transfer details today. Direct inquiries to ${sales}.\n\nCredit Operations`
      );

      // 4. AI-Enhanced personalized draft (custom generated based on urgency score)
      let tone = "polite but firm";
      if (days > 60) tone = "strict and urgent";
      else if (days < 15) tone = "warm and helpful";

      setAiCustom(
        `[AI DRAFTED - Tone: ${tone}]\n\nHello ${cust},\n\nOur system flagged Invoice #${invNo} (${amt}) as ${days} days overdue. We notice ${
          commitment 
            ? `a promise was logged on ${commitment.commitmentDate} but is currently marked as ${commitment.status}`
            : 'no payment arrangement has been logged for this invoice'
        }.\n\nWe value our relationship and want to help resolve this quickly. Please let us know if there are dispute details, or click to copy billing copies. Sales representative ${sales} is available to retrieve check drafts immediately today.\n\nThank you!`
      );
    }
  }

  if (!invoice) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Outreach template copied successfully!');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[460px] flex flex-col h-full p-6">
        <SheetHeader className="border-b pb-4 shrink-0">
          <SheetTitle className="text-sm font-bold flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-purple-600" />
            Outreach Message Templates
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Customer: {invoice.customer} · Overdue: {invoice.overdue ?? 0} days
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 mt-4">
          <TabsList className="grid w-full grid-cols-4 h-8 p-1 shrink-0">
            <TabsTrigger value="friendly" className="text-[9px] gap-0.5 px-0 h-6">
              <MessageSquare className="h-2.5 w-2.5" />
              Friendly
            </TabsTrigger>
            <TabsTrigger value="formal" className="text-[9px] gap-0.5 px-0 h-6">
              <Mail className="h-2.5 w-2.5" />
              Formal
            </TabsTrigger>
            <TabsTrigger value="urgent" className="text-[9px] gap-0.5 px-0 h-6">
              <AlertTriangle className="h-2.5 w-2.5" />
              Urgent
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-[9px] gap-0.5 px-0 h-6 bg-purple-500/5 text-purple-600">
              <Sparkles className="h-2.5 w-2.5" />
              AI Draft
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 py-4 flex flex-col justify-between">
            {/* Friendly Tab */}
            <TabsContent value="friendly" className="flex-1 flex flex-col focus-visible:outline-none">
              <div className="space-y-1.5 flex-1 flex flex-col">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">WhatsApp / Viber Friendly Reminder</Label>
                <Textarea
                  value={friendly}
                  onChange={(e) => setFriendly(e.target.value)}
                  className="flex-1 min-h-[200px] text-xs font-mono p-3 leading-relaxed"
                />
              </div>
              <Button
                onClick={() => handleCopy(friendly)}
                className="mt-3 w-full bg-purple-600 hover:bg-purple-700 text-white gap-2 text-xs"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Template
              </Button>
            </TabsContent>

            {/* Formal Tab */}
            <TabsContent value="formal" className="flex-1 flex flex-col focus-visible:outline-none">
              <div className="space-y-1.5 flex-1 flex flex-col">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Accounts Payable Email Update</Label>
                <Textarea
                  value={formal}
                  onChange={(e) => setFormal(e.target.value)}
                  className="flex-1 min-h-[200px] text-xs font-mono p-3 leading-relaxed"
                />
              </div>
              <Button
                onClick={() => handleCopy(formal)}
                className="mt-3 w-full bg-purple-600 hover:bg-purple-700 text-white gap-2 text-xs"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Template
              </Button>
            </TabsContent>

            {/* Urgent Tab */}
            <TabsContent value="urgent" className="flex-1 flex flex-col focus-visible:outline-none">
              <div className="space-y-1.5 flex-1 flex flex-col">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Overdue Demand Notice (SMS / Email)</Label>
                <Textarea
                  value={urgent}
                  onChange={(e) => setUrgent(e.target.value)}
                  className="flex-1 min-h-[200px] text-xs font-mono p-3 leading-relaxed text-rose-700 dark:text-rose-400 border-rose-500/20"
                />
              </div>
              <Button
                onClick={() => handleCopy(urgent)}
                className="mt-3 w-full bg-rose-600 hover:bg-rose-700 text-white gap-2 text-xs"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Template
              </Button>
            </TabsContent>

            {/* AI Custom Tab */}
            <TabsContent value="ai" className="flex-1 flex flex-col focus-visible:outline-none">
              <div className="space-y-1.5 flex-1 flex flex-col">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">AI Personalized Collector Assistant Draft</Label>
                <Textarea
                  value={aiCustom}
                  onChange={(e) => setAiCustom(e.target.value)}
                  className="flex-1 min-h-[200px] text-xs font-mono p-3 leading-relaxed border-purple-500/30"
                />
              </div>
              <Button
                onClick={() => handleCopy(aiCustom)}
                className="mt-3 w-full bg-purple-600 hover:bg-purple-700 text-white gap-2 text-xs"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Draft
              </Button>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
