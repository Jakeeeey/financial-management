"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Supplier } from "@/modules/financial-management/supplier-registration/types/supplier.schema";
import { useRepresentatives } from "@/modules/financial-management/supplier-registration/hooks/useRepresentatives";
import { RepresentativeCard } from "./view-representative-details";
import { AddRepresentativeForm } from "../forms/add-representative-form";
import { useState } from "react";
import {
  MapPin,
  Building2,
  FileText,
  CreditCard,
  Users,
  Plus,
} from "lucide-react";

interface SupplierDetailsModalProps {
  supplier: Supplier | null;
  open: boolean;
  onClose: () => void;
}

export function SupplierDetailsModal({
  supplier,
  open,
  onClose,
}: SupplierDetailsModalProps) {
  const [showAddRepForm, setShowAddRepForm] = useState(false);
  const { representatives, isLoading, removeRepresentative, refresh } =
    useRepresentatives(supplier?.id || null);

  if (!supplier) return null;

  const handleAddRepSuccess = () => {
    setShowAddRepForm(false);
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">
                {supplier.supplier_name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {supplier.supplier_shortcut} • {supplier.supplier_type}
              </p>
            </div>
            <Badge variant={supplier.isActive === 1 ? "default" : "secondary"}>
              {supplier.isActive === 1 ? "Active" : "Inactive"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Contact Person
                </p>
                <p className="text-base">{supplier.contact_person}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Email Address
                </p>
                <p className="text-base">{supplier.email_address || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Phone Number
                </p>
                <p className="text-base">{supplier.phone_number || "N/A"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Address
                </p>
                <p className="text-base">{supplier.address}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Barangay
                  </p>
                  <p className="text-base">{supplier.brgy}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    City
                  </p>
                  <p className="text-base">{supplier.city}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Province
                  </p>
                  <p className="text-base">{supplier.state_province}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Postal Code
                  </p>
                  <p className="text-base">{supplier.postal_code}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Country
                </p>
                <p className="text-base">{supplier.country}</p>
              </div>
            </CardContent>
          </Card>

          {/* Business Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5" />
                Business Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  TIN Number
                </p>
                <p className="text-base font-mono">{supplier.tin_number}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Date Added
                </p>
                <p className="text-base">
                  {new Date(supplier.date_added || "").toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                <Badge
                  variant={supplier.isActive === 1 ? "default" : "secondary"}
                >
                  {supplier.isActive === 1 ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Terms & Conditions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Terms & Conditions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Payment Terms
                </p>
                <p className="text-base">{supplier.payment_terms}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Delivery Terms
                </p>
                <Badge variant="outline">{supplier.delivery_terms}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Representatives */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Representatives ({representatives.length})
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => setShowAddRepForm(!showAddRepForm)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Rep
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showAddRepForm && (
                <div className="mb-4">
                  <AddRepresentativeForm
                    supplierId={supplier.id!}
                    onSuccess={handleAddRepSuccess}
                    onCancel={() => setShowAddRepForm(false)}
                  />
                  <Separator className="mt-4" />
                </div>
              )}

              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Loading representatives...
                </p>
              ) : representatives.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No representatives found. Click "Add Rep" to add one.
                </p>
              ) : (
                <div className="space-y-3">
                  {representatives.map((rep) => (
                    <RepresentativeCard
                      key={rep.id}
                      representative={rep}
                      onRemove={removeRepresentative}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
