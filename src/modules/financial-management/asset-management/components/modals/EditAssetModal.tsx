"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import imageCompression from "browser-image-compression";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  assetFormSchema,
  AssetFormValues,
  AssetTableData,
  Department,
  ItemClassification,
  ItemType,
  User,
} from "@/modules/financial-management/asset-management/types";
import { format } from "date-fns";
import { Check, ChevronsUpDown, Loader2, UploadCloud, X } from "lucide-react";
import { assetService } from "../../services/assetService";
import { cn } from "../../utils/lib";

interface EditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetTableData | null;
  onSuccess: () => void;
}

export default function EditAssetModal({
  asset,
  isOpen,
  onClose,
  onSuccess,
}: EditAssetModalProps) {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [classifications, setClassifications] = useState<ItemClassification[]>(
    [],
  );

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Popover states to auto-close upon selection
  const [typeOpen, setTypeOpen] = useState(false);
  const [classificationOpen, setClassificationOpen] = useState(false);
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      item_name: "",
      item_type: "",
      item_classification: "",
      barcode: "",
      rfid_code: "",
      condition: "Good",
      quantity: 1,
      cost_per_item: 0,
      life_span: 1,
      date_acquired: new Date(),
      department: 0,
      employee: null,
      item_image: null,
      serial: "",
      is_active_warning: 0,
    },
  });

  // Sync Form with Asset Data
  useEffect(() => {
    if (asset && isOpen) {
      form.reset({
        item_name: asset.item_name,
        item_type: asset.item_type_name || "",
        item_classification: asset.classification_name || "",
        barcode: asset.barcode || "",
        rfid_code: asset.rfid_code || "",
        condition: asset.condition,
        quantity: 1, // Fixed to 1
        cost_per_item: asset.cost_per_item,
        life_span: asset.life_span,
        date_acquired: new Date(asset.date_acquired),
        department: asset.department || 0,
        employee: asset.employee,
        item_image: asset.item_image,
        serial: asset.serial || "",
        is_active_warning: asset.is_active_warning || 0,
      });

      setPreviewUrl(
        asset.item_image
          ? `/api/fm/asset-management/asset-image-view?id=${asset.item_image}`
          : null,
      );
    }
  }, [asset, isOpen, form]);

  // Fetch Options
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const [depData, userData, typeData, classData] = await Promise.all([
            assetService.getDepartments(),
            assetService.getUsers(),
            assetService.getItemTypes(),
            assetService.getItemClassifications(),
          ]);

          setDepartments(depData);
          setUsers(userData);
          setTypes(typeData);
          setClassifications(classData);
        } catch {
          toast.error("Failed to load options");
        }
      };
      fetchData();
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadToDirectus = async (file: File) => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
    };
    const compressedFile = await imageCompression(file, options);
    const formData = new FormData();
    formData.append("file", compressedFile);

    const res = await fetch("/api/fm/asset-management/asset-image-upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    const result = await res.json();
    return result?.data?.id;
  };

  const onSubmit = async (values: AssetFormValues) => {
    if (!asset) return;
    setLoading(true);
    try {
      let finalImageValue = asset.item_image;

      if (selectedFile) {
        finalImageValue = await uploadToDirectus(selectedFile);
      } else if (previewUrl === null) {
        finalImageValue = null;
      }

      await assetService.updateAsset(
        asset.id,
        asset.item_id,
        values,
        finalImageValue,
      );

      toast.success("Asset updated successfully!");
      onClose();
      onSuccess();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update asset");
    } finally {
      setLoading(false);
    }
  };

  if (!asset) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto p-0 rounded-2xl">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Edit Asset: {asset.item_name}</DialogTitle>
          <DialogDescription>
            Modify asset identifiers and assignments. Values are handled in PHP.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="px-6 pb-8 space-y-6"
          >
            {/* IMAGE SECTION */}
            <div className="space-y-4">
              <Separator />
              <div
                className={cn(
                  "border border-dashed rounded-lg p-4 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/50",
                  previewUrl ? "border-primary/50" : "border-muted",
                )}
                onClick={() =>
                  document.getElementById("edit-image-upload")?.click()
                }
              >
                {previewUrl ? (
                  <div className="relative w-full aspect-video max-h-48 overflow-hidden rounded-md">
                    <Image
                      src={previewUrl}
                      alt="Preview"
                      width={400}
                      height={200}
                      className="object-contain"
                      unoptimized
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewUrl(null);
                        setSelectedFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <UploadCloud className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="text-sm font-medium">Click to update image</p>
                  </div>
                )}
                <input
                  id="edit-image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {/* IDENTIFIERS SECTION */}
            <div className="space-y-4">
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="item_name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Item Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Scan or enter barcode"
                        />
                      </FormControl>
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
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Enter RFID"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Enter Serial"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_active_warning"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Security Tag</FormLabel>
                      <Select
                        onValueChange={(val: any) => field.onChange(Number(val))}
                        value={field.value?.toString() ?? "0"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Activated</SelectItem>
                          <SelectItem value="0">Deactivated</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* CATEGORIZATION SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Item Type */}
              <FormField
                control={form.control}
                name="item_type"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Item Type *</FormLabel>
                    <Popover open={typeOpen} onOpenChange={setTypeOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-between"
                          >
                            {field.value || "Select type..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Search type..." />
                          <CommandList>
                            <CommandEmpty>No type found.</CommandEmpty>
                            <CommandGroup>
                              {types.map((t) => (
                                <CommandItem
                                  key={t.id}
                                  value={t.type_name}
                                  onSelect={(val) => {
                                    form.setValue("item_type", val);
                                    setTypeOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      t.type_name === field.value
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {t.type_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />

              {/* Classification */}
              <FormField
                control={form.control}
                name="item_classification"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Classification *</FormLabel>
                    <Popover open={classificationOpen} onOpenChange={setClassificationOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-between"
                          >
                            {field.value || "Select classification..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Search classification..." />
                          <CommandList>
                            <CommandEmpty>
                              No classification found.
                            </CommandEmpty>
                            <CommandGroup>
                              {classifications.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={c.classification_name}
                                  onSelect={(val) => {
                                    form.setValue("item_classification", val);
                                    setClassificationOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      c.classification_name === field.value
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {c.classification_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />
            </div>

            {/* ASSIGNMENT SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Department */}
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Department</FormLabel>
                    <Popover open={departmentOpen} onOpenChange={setDepartmentOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-between"
                          >
                            {departments.find(
                              (d) => d.department_id === field.value,
                            )?.department_name || "Select department..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Search department..." />
                          <CommandList>
                            <CommandGroup>
                              {departments.map((d) => (
                                <CommandItem
                                  key={d.department_id}
                                  value={d.department_name}
                                  onSelect={() => {
                                    form.setValue("department", d.department_id);
                                    setDepartmentOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      d.department_id === field.value
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {d.department_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />

              {/* Employee */}
              <FormField
                control={form.control}
                name="employee"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Assigned To</FormLabel>
                    <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-between"
                          >
                            {users.find((u) => u.user_id === field.value)
                              ? `${users.find((u) => u.user_id === field.value)?.user_fname} ${users.find((u) => u.user_id === field.value)?.user_lname}`
                              : "Select employee..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Search employee..." />
                          <CommandList>
                            <CommandGroup>
                              {users.map((u) => (
                                <CommandItem
                                  key={u.user_id}
                                  value={`${u.user_fname} ${u.user_lname}`}
                                  onSelect={() => {
                                    form.setValue("employee", u.user_id);
                                    setEmployeeOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      u.user_id === field.value
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {u.user_fname} {u.user_lname}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />

              {/* Date Acquired */}
              <FormField
                control={form.control}
                name="date_acquired"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date Acquired</FormLabel>
                    <Popover open={dateOpen} onOpenChange={setDateOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-between h-10 font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick date</span>
                            )}
                            {/* <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" /> */}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            if (date) {
                              field.onChange(date);
                              setDateOpen(false);
                            }
                          }}
                          disabled={(date) => date > new Date()}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* FINANCIALS & CONDITION */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Condition</FormLabel>
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
                          Maintenance
                        </SelectItem>
                        <SelectItem value="Discontinued">
                          Discontinued
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cost_per_item"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost (PHP)</FormLabel>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qty</FormLabel>
                    <Input
                      type="number"
                      {...field}
                      disabled
                      className="bg-muted"
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 1)
                      }
                    />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="life_span"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Life (Yrs)</FormLabel>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                    />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Asset
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
