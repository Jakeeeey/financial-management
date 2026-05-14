// src/modules/financial-management/asset-management/components/modals/EditAssetModal.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import imageCompression from "browser-image-compression";
import { format } from "date-fns";
import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";
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
import { assetService } from "../../services/assetService";
import { cn } from "../../utils/lib";

interface EditAssetModalProps {
  /** Controls whether the edit modal is visible. */
  isOpen: boolean;
  /** Closes the modal; parent owns the open state. */
  onClose: () => void;
  /** Selected asset row to hydrate into the edit form. */
  asset: AssetTableData | null;
  /** Optional full-refresh callback kept for legacy parent flows. */
  onSuccess?: () => void;
  /** Patches the edited asset row in the parent table without forcing a full refetch. */
  onLocalUpdate: (updated: Partial<AssetTableData> & { id: number }) => void;
}

/**
 * Modal form for editing an existing asset using the same layout as AddAssetModal.
 *
 * The form hydrates from the selected asset, supports optional image replacement
 * or removal, and patches the parent table through `onLocalUpdate` after the
 * update request succeeds.
 */
export default function EditAssetModal({
  asset,
  isOpen,
  onClose,
  onLocalUpdate,
}: EditAssetModalProps) {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [classifications, setClassifications] = useState<ItemClassification[]>(
    [],
  );
  const [typeSearch, setTypeSearch] = useState("");
  const [classificationSearch, setClassificationSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Popover states to auto-close upon selection.
  const [typeOpen, setTypeOpen] = useState(false);
  const [classificationOpen, setClassificationOpen] = useState(false);
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

  // Sync form with the selected asset whenever the edit modal opens.
  /** Hydrates the form and preview image from the selected asset when the modal opens. */
  useEffect(() => {
    if (!asset || !isOpen) return;

    form.reset({
      item_name: asset.item_name,
      item_type: asset.item_type_name || "",
      item_classification: asset.classification_name || "",
      barcode: asset.barcode || "",
      rfid_code: asset.rfid_code || "",
      condition: asset.condition,
      quantity: 1, // Fixed to 1.
      cost_per_item: asset.cost_per_item,
      life_span: asset.life_span,
      date_acquired: new Date(asset.date_acquired),
      department: asset.department || 0,
      employee: asset.employee,
      item_image: asset.item_image,
      serial: asset.serial || "",
      is_active_warning: asset.is_active_warning || 0,
    });

    setSelectedFile(null);
    setTypeSearch("");
    setClassificationSearch("");
    setPreviewUrl(
      asset.item_image
        ? `/api/fm/asset-management/asset-image-view?id=${asset.item_image}`
        : null,
    );
  }, [asset, isOpen, form]);

  // Fetch dropdown options when the edit modal is opened.
  /** Loads select/combobox options required by the edit form. */
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      try {
        const [depData, userData, typeData, classData] = await Promise.all([
          assetService.getDepartments(),
          assetService.getUsers(),
          assetService.getItemTypes(),
          assetService.getItemClassifications(),
        ]);

        setDepartments(Array.isArray(depData) ? depData : []);
        setUsers(Array.isArray(userData) ? userData : []);
        setTypes(Array.isArray(typeData) ? typeData : []);
        setClassifications(Array.isArray(classData) ? classData : []);
      } catch {
        toast.error("Failed to load form options");
      }
    };

    fetchData();
  }, [isOpen]);

  /** Stores a selected replacement image and creates a preview URL for the upload area. */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  /** Compresses and uploads a replacement asset image, returning the Directus file UUID. */
  const uploadToDirectus = async (file: File) => {
    const compressedFile = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
    });
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

  /** Keeps mouse wheel scrolling inside open combobox lists instead of the parent dialog. */
  const stopWheelPropagation = (event: React.WheelEvent) => {
    event.stopPropagation();
  };

  /** Updates the asset, resolves display labels, and patches the parent row locally. */
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

      const selectedDepartment = departments.find(
        (d) => d.department_id === values.department,
      );
      const selectedEmployee = users.find((u) => u.user_id === values.employee);
      const d = values.date_acquired;
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      // Build the locally patched version of the row from form values.
      // This mirrors what fetchAssets returns for this row without a full refetch.
      const updatedFields: Partial<AssetTableData> & { id: number } = {
        id: asset.id,
        item_name: values.item_name,
        item_type_name: values.item_type,
        classification_name: values.item_classification,
        condition: values.condition,
        cost_per_item: values.cost_per_item,
        quantity: values.quantity,
        life_span: values.life_span,
        date_acquired: localDateStr,
        department: values.department,
        department_name:
          selectedDepartment?.department_name ?? asset.department_name,
        employee: values.employee,
        assigned_to_name: selectedEmployee
          ? `${selectedEmployee.user_fname} ${selectedEmployee.user_lname}`.trim()
          : "Unassigned",
        item_image: finalImageValue,
        barcode: values.barcode ?? null,
        rfid_code: values.rfid_code ?? null,
        serial: values.serial ?? null,
        is_active_warning: values.is_active_warning,
      };

      onLocalUpdate(updatedFields); // Patch just this row, no refetch.
      toast.success("Asset updated successfully!");
      onClose();

      // NOTE: onSuccess (full refetch) is intentionally not called here.
      // It is kept in the props as a fallback if a full refresh is needed later.
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update asset");
    } finally {
      setLoading(false);
    }
  };

  if (!asset) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto p-0 rounded-2xl">
        <DialogHeader className="p-6 pb-0 gap-0">
          <DialogTitle className="text-lg font-semibold flex items-center">
            Edit Asset
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Update the asset details below.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="px-6 pb-8 space-y-6"
          >
            {/* SECTION 0: IMAGE */}
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
                  <>
                    <div className="p-4">
                      <UploadCloud className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG or WebP (max. 2MB)
                      </p>
                    </div>
                  </>
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

            {/* SECTION 1: GENERAL INFO */}
            <div className="space-y-4">
              <Separator />
              <FormField
                control={form.control}
                name="item_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Asset name"
                        {...field}
                        className="h-10"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="item_type"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Item Type *</FormLabel>
                      <Popover modal open={typeOpen} onOpenChange={setTypeOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between h-10",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value || "Select type..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-(--radix-popover-trigger-width) p-0"
                          align="start"
                        >
                          <Command
                            filter={(value, search) => {
                              if (
                                value
                                  .toLowerCase()
                                  .includes(search.toLowerCase())
                              )
                                return 1;
                              return 0;
                            }}
                          >
                            <CommandInput
                              placeholder="Search or type new..."
                              value={typeSearch}
                              onValueChange={setTypeSearch}
                            />
                            <CommandList
                              className="overscroll-contain"
                              onWheel={stopWheelPropagation}
                            >
                              {typeSearch &&
                                !types.some(
                                  (t) =>
                                    t.type_name.toLowerCase() ===
                                    typeSearch.toLowerCase(),
                                ) && (
                                  <div
                                    className="p-2 border-b cursor-pointer hover:bg-accent flex items-center gap-2 text-sm text-primary font-medium"
                                    onClick={() => {
                                      form.setValue("item_type", typeSearch);
                                      setTypeSearch("");
                                      setTypeOpen(false);
                                    }}
                                  >
                                    <Plus className="h-4 w-4" />
                                    <span>
                                      Add{" "}
                                      <span className="font-bold">
                                        &quot;{typeSearch}&quot;
                                      </span>{" "}
                                      as new type
                                    </span>
                                  </div>
                                )}
                              <CommandGroup heading="Existing Types">
                                {types
                                  .filter((t) =>
                                    t.type_name
                                      .toLowerCase()
                                      .includes(typeSearch.toLowerCase()),
                                  )
                                  .map((t) => (
                                    <CommandItem
                                      key={t.id}
                                      value={t.type_name}
                                      onSelect={(val) => {
                                        form.setValue("item_type", val);
                                        setTypeSearch("");
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
                              <CommandEmpty>No results found.</CommandEmpty>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="item_classification"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Classification *</FormLabel>
                      <Popover
                        modal
                        open={classificationOpen}
                        onOpenChange={setClassificationOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between h-10",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value || "Select classification..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-(--radix-popover-trigger-width) p-0"
                          align="start"
                        >
                          <Command
                            filter={(value, search) => {
                              if (
                                value
                                  .toLowerCase()
                                  .includes(search.toLowerCase())
                              )
                                return 1;
                              return 0;
                            }}
                          >
                            <CommandInput
                              placeholder="Search or type new..."
                              value={classificationSearch}
                              onValueChange={setClassificationSearch}
                            />
                            <CommandList
                              className="overscroll-contain"
                              onWheel={stopWheelPropagation}
                            >
                              {classificationSearch &&
                                !classifications.some(
                                  (c) =>
                                    c.classification_name.toLowerCase() ===
                                    classificationSearch.toLowerCase(),
                                ) && (
                                  <div
                                    className="p-2 border-b cursor-pointer hover:bg-accent flex items-center gap-2 text-sm text-primary font-medium"
                                    onClick={() => {
                                      form.setValue(
                                        "item_classification",
                                        classificationSearch,
                                      );
                                      setClassificationSearch("");
                                      setClassificationOpen(false);
                                    }}
                                  >
                                    <Plus className="h-4 w-4" />
                                    <span>
                                      Add{" "}
                                      <span className="font-bold">
                                        &quot;{classificationSearch}&quot;
                                      </span>{" "}
                                      as new
                                    </span>
                                  </div>
                                )}
                              <CommandGroup heading="Existing Classifications">
                                {classifications
                                  .filter((c) =>
                                    c.classification_name
                                      .toLowerCase()
                                      .includes(
                                        classificationSearch.toLowerCase(),
                                      ),
                                  )
                                  .map((c) => (
                                    <CommandItem
                                      key={c.id}
                                      value={c.classification_name}
                                      onSelect={(val) => {
                                        form.setValue(
                                          "item_classification",
                                          val,
                                        );
                                        setClassificationSearch("");
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
                              <CommandEmpty>No results found.</CommandEmpty>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* SECTION 2: TRACKING & ASSIGNMENT */}
            <div className="space-y-4">
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <Input
                        placeholder="Optional"
                        {...field}
                        value={field.value ?? ""}
                        className="h-10"
                      />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rfid_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RFID Code</FormLabel>
                      <Input
                        placeholder="Optional"
                        {...field}
                        value={field.value ?? ""}
                        className="h-10"
                      />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="serial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <Input
                        placeholder="Optional"
                        {...field}
                        value={field.value ?? ""}
                        className="h-10"
                      />
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
                        onValueChange={(val: string) =>
                          field.onChange(Number(val))
                        }
                        value={field.value?.toString() ?? "0"}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10">
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem className="flex flex-col flex-1">
                      <FormLabel>Department *</FormLabel>
                      <Select
                        onValueChange={(val: string) =>
                          field.onChange(Number(val))
                        }
                        value={field.value > 0 ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Unassigned" />
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
                    <FormItem className="flex flex-col flex-1">
                      <FormLabel>Assigned To</FormLabel>
                      <Select
                        onValueChange={(val: string) =>
                          field.onChange(val === "none" ? null : Number(val))
                        }
                        value={field.value ? field.value.toString() : "none"}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Unassigned" />
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
                <FormField
                  control={form.control}
                  name="date_acquired"
                  render={({ field }) => (
                    <FormItem className="flex flex-col flex-1">
                      <FormLabel>Date Acquired</FormLabel>
                      <Popover open={dateOpen} onOpenChange={setDateOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full h-9 pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick date</span>
                              )}
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
                            captionLayout="dropdown"
                            fromYear={1900}
                            toYear={new Date().getFullYear()}
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* SECTION 3: FINANCIALS & CONDITION */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                <FormField
                  control={form.control}
                  name="cost_per_item"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost</FormLabel>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        className="h-10"
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
                      <FormLabel>Quantity</FormLabel>
                      <Input
                        type="number"
                        {...field}
                        disabled
                        className="h-10 bg-muted"
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
                      <FormLabel>Life Span</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          placeholder="e.g. 5"
                          className="h-10"
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10">
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
              </div>

              <Separator />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="min-w-30" disabled={loading}>
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
