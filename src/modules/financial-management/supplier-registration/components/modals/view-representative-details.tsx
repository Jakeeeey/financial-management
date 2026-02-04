"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Representative } from "@/modules/financial-management/supplier-registration/types/representative.schema";
import { Mail, Phone, Trash2 } from "lucide-react";
import { formatPhoneNumber } from "@/modules/financial-management/supplier-registration/utils/utils";

interface RepresentativeCardProps {
  representative: Representative;
  onRemove: (id: number) => Promise<boolean>;
}

export function RepresentativeCard({
  representative,
  onRemove,
}: RepresentativeCardProps) {
  const fullName = [
    representative.first_name,
    representative.middle_name,
    representative.last_name,
    representative.suffix,
  ]
    .filter(Boolean)
    .join(" ");

  const handleRemove = async () => {
    await onRemove(representative.id!);
  };

  return (
    <Card>
      <CardContent className="flex items-start justify-between p-4">
        <div className="space-y-2 flex-1">
          <h4 className="font-semibold text-base">{fullName}</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              <span>{representative.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5" />
              <span>{formatPhoneNumber(representative.contact_number)}</span>
            </div>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Representative?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <strong>{fullName}</strong>?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemove}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
