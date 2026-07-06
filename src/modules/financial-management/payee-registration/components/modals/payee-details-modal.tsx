"use client";

import {
  Dialog,
  DialogContent,

  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Payee } from "../../types/payee.schema";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Calendar,
  CreditCard,
  MapPin,
  User,
  Info,
} from "lucide-react";
import Image from "next/image";
import { formatDate } from "@/modules/financial-management/supplier-registration/utils/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

interface PayeeDetailsModalProps {
  payee: Payee | null;
  open: boolean;
  onClose: () => void;
}

export function PayeeDetailsModal({
  payee,
  open,
  onClose,
}: PayeeDetailsModalProps) {

  if (!payee) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            {payee.supplier_image ? (
              <Image
                src={`${API_BASE_URL}/assets/${payee.supplier_image}`}
                alt={payee.supplier_name}
                width={64}
                height={64}
                className="h-16 w-16 rounded-lg object-cover border aspect-square"
                unoptimized
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center border">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <DialogTitle className="text-xl font-bold">
                {payee.supplier_name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{payee.supplier_type}</Badge>
                <Badge variant={payee.isActive === 1 ? "default" : "secondary"}>
                  {payee.isActive === 1 ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Contact Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contact Person:</span>
                <span className="font-medium">{payee.contact_person}</span>
              </div>
            </div>
          </div>

          {/* Business Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Business Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">TIN:</span>
                <span className="font-medium font-mono">{payee.tin_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Terms:</span>
                <span className="font-medium">{payee.payment_terms}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Terms:</span>
                <span className="font-medium">{payee.delivery_terms}</span>
              </div>
            </div>
          </div>

          <Separator className="col-span-full" />

          {/* Location Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </h3>
            <div className="text-sm space-y-1">
              <p className="font-medium">{payee.address}</p>
              <p className="text-muted-foreground">
                {payee.brgy}, {payee.city}
              </p>
              <p className="text-muted-foreground">
                {payee.state_province}, {payee.postal_code}
              </p>
              <p className="text-muted-foreground">{payee.country}</p>
            </div>
          </div>

          {/* Extra Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4" />
              Additional Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Date Added:
                </span>
                <span className="font-medium">
                  {payee.date_added ? formatDate(payee.date_added.toString()) : "N/A"}
                </span>
              </div>
              {payee.bank_details && (
                <div className="space-y-1 mt-2">
                   <p className="text-muted-foreground">Bank Details:</p>
                   <p className="font-medium bg-muted p-2 rounded text-xs">{payee.bank_details}</p>
                </div>
              )}
            </div>
          </div>

          <Separator className="col-span-full" />
        </div>

        {payee.notes_or_comments && (
          <div className="mt-2 space-y-2">
            <Separator />
            <h3 className="font-semibold text-sm text-muted-foreground">Notes / Comments</h3>
            <p className="text-sm text-muted-foreground italic bg-muted/30 p-3 rounded-md">
              &ldquo;{payee.notes_or_comments}&rdquo;
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
