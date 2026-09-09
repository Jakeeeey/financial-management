"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  returnAssetFormSchema,
  ReturnAssetFormValues,
  AssetTableData,
  AssetAssignment,
} from "../../types";
import { assetService } from "../../services/assetService";
import { cn } from "../../utils/lib";

interface ReturnAssetModalProps {
  asset: AssetTableData | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReturnAssetModal({
  asset,
  isOpen,
  onClose,
  onSuccess,
}: ReturnAssetModalProps) {
  const [loading, setLoading] = useState(false);
  const [assignment, setAssignment] = useState<AssetAssignment | null>(null);
  const [fetching, setFetching] = useState(false);

  const form = useForm<ReturnAssetFormValues>({
    resolver: zodResolver(returnAssetFormSchema),
    defaultValues: {
      actual_return_date: new Date(),
      condition_on_return: "Good",
      assignment_status: "Returned",
      notes: "",
    },
  });

  useEffect(() => {
    if (isOpen && asset) {
      setFetching(true);
      assetService.getAssetAssignments(asset.id).then((history) => {
        const active = history.find((a: AssetAssignment) => a.assignment_status === "Assigned" && a.user_id === asset.employee);
        setAssignment(active || null);
        form.reset({
          actual_return_date: new Date(),
          condition_on_return: asset?.condition || "Good",
          assignment_status: "Returned",
          notes: "",
        });
      }).catch((err) => {
        toast.error("Failed to load active assignment");
        console.error(err);
      }).finally(() => {
        setFetching(false);
      });
    } else {
      setAssignment(null);
    }
  }, [isOpen, asset, form]);

  const onSubmit = async (values: ReturnAssetFormValues) => {
    if (!asset || !assignment) return;
    setLoading(true);
    try {
      await assetService.returnAsset(assignment.assignment_id, {
        actual_return_date: format(values.actual_return_date, "yyyy-MM-dd"),
        condition_on_return: values.condition_on_return,
        assignment_status: values.assignment_status,
        notes: values.notes || null,
      });
      toast.success("Asset returned successfully");
      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to return asset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Return Asset</DialogTitle>
          <DialogDescription>
            Process the return of <strong>{asset?.item_name}</strong>
            {assignment?.user_name ? ` from ${assignment.user_name}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !assignment ? (
          <div className="text-center p-8 text-muted-foreground">
            No active assignment found for this asset.
            <div className="mt-4">
              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="actual_return_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Return Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="condition_on_return"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condition on Return *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Bad">Bad</SelectItem>
                      <SelectItem value="Under Maintenance">Maintenance</SelectItem>
                      <SelectItem value="Discontinued">Discontinued</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignment_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Return Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Returned">Returned Successfully</SelectItem>
                      <SelectItem value="Damaged">Returned Damaged</SelectItem>
                      <SelectItem value="Lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional notes regarding the return..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Return Asset
              </Button>
            </div>
          </form>
        </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
