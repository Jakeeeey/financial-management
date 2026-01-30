"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assetFormSchema, AssetFormValues, Department, User } from "../types";

interface AddAssetModalProps {
  onSuccess: () => void;
}

export default function AddAssetModal({ onSuccess }: AddAssetModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      item_name: "",
      item_type: "2",
      item_classification: "1",
      barcode: "",
      rfid_code: "",
      condition: "Good",
      quantity: 1,
      cost_per_item: 0,
      life_span: 12,
      date_acquired: new Date(),
      department: undefined,
      employee: null,
    },
  });

  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        try {
          const [depRes, userRes] = await Promise.all([
            fetch("/api/fm/asset-management?type=departments"),
            fetch("/api/fm/asset-management?type=users"),
          ]);
          const depData = await depRes.json();
          const userData = await userRes.json();
          setDepartments(Array.isArray(depData) ? depData : []);
          setUsers(Array.isArray(userData) ? userData : []);
        } catch (error) {
          console.error("Failed to load dropdown data", error);
          toast.error("Failed to load form options");
        }
      };
      fetchData();
    }
  }, [open]);

  const onSubmit = async (values: AssetFormValues) => {
    setLoading(true);
    try {
      const submissionData = {
        ...values,
        // Convert date to ISO string
        date_acquired: values.date_acquired.toISOString(),
        // Ensure proper number types
        cost_per_item: Number(values.cost_per_item),
        quantity: Number(values.quantity),
        life_span: Number(values.life_span),
        department: Number(values.department),
        employee: values.employee ? Number(values.employee) : null,
        // Ensure these are strings for Directus
        item_type: values.item_type,
        item_classification: values.item_classification,
        barcode: values.barcode || "",
        rfid_code: values.rfid_code || "",
      };

      const res = await fetch("/api/fm/asset-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionData),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to save asset");
      }

      toast.success("Asset saved successfully!");
      setOpen(false);
      form.reset();
      onSuccess();
    } catch (error: any) {
      console.error("Asset creation error:", error);
      toast.error(error.message || "Failed to save asset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add New Asset</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Asset</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="item_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Dell Latitude 5420" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rfid_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RFID Code</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department *</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem
                            key={d.department_id}
                            value={d.department_id.toString()}
                          >
                            {d.department_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned To</FormLabel>
                    <Select
                      onValueChange={(val) =>
                        field.onChange(val === "none" ? null : Number(val))
                      }
                      value={field.value?.toString() ?? "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {users.map((u) => (
                          <SelectItem
                            key={u.user_id}
                            value={u.user_id.toString()}
                          >
                            {u.user_fname} {u.user_lname}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="cost_per_item"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost per Item *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="life_span"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Life Span (Months) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 12)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condition *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Bad">Bad</SelectItem>
                      <SelectItem value="Under Maintenance">
                        Under Maintenance
                      </SelectItem>
                      <SelectItem value="Discontinued">Discontinued</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Asset
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
