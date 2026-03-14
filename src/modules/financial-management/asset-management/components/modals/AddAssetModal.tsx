"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import imageCompression from "browser-image-compression";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";
import { cn } from "../../utils/lib";

import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assetService } from "@/modules/financial-management/asset-management/services/assetService";
import {
  assetFormSchema,
  AssetFormValues,
  Department,
  ItemClassification,
  ItemType,
  User,
} from "@/modules/financial-management/asset-management/types";

interface AddAssetModalProps {
  onSuccess: () => void;
}

interface AssetItem {
  id: number;
  item_name: string;
  item_type?: { type_name?: string };
  item_classification?: { classification_name?: string };
}

export default function AddAssetModal({ onSuccess }: AddAssetModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [classifications, setClassifications] = useState<ItemClassification[]>(
    [],
  );
  const [items, setItems] = useState<AssetItem[]>([]);
  const [itemNameSearch, setItemNameSearch] = useState("");
  const [typeSearch, setTypeSearch] = useState("");
  const [classificationSearch, setClassificationSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Popover states to auto-close upon selection
  const [nameOpen, setNameOpen] = useState(false);
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
      life_span: 5,
      date_acquired: new Date(),
      department: 0,
      employee: null,
      serial: "",
      is_active_warning: 0,
    },
  });

  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        try {
          const [depData, userData, typeData, classData, itemData] =
            await Promise.all([
              assetService.getDepartments(),
              assetService.getUsers(),
              assetService.getItemTypes(),
              assetService.getItemClassifications(),
              assetService.getItems(),
            ]);

          setDepartments(Array.isArray(depData) ? depData : []);
          setUsers(Array.isArray(userData) ? userData : []);
          setTypes(Array.isArray(typeData) ? typeData : []);
          setClassifications(Array.isArray(classData) ? classData : []);
          setItems(Array.isArray(itemData) ? itemData : []);
        } catch (error) {
          console.error("Failed to load dropdown data", error);
          toast.error("Failed to load form options");
        }
      };
      fetchData();
    }
  }, [open]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      const now = new Date();
      form.reset({
        item_name: "",
        item_type: "",
        item_classification: "",
        barcode: "",
        rfid_code: "",
        condition: "Good",
        quantity: 1,
        cost_per_item: 0,
        life_span: 5,
        date_acquired: now,
        department: 0,
        employee: null,
        serial: "",
        is_active_warning: 0,
      });
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadToDirectus = async (file: File) => {
    try {
      // 1. Compress the image before uploading to save time/bandwidth
      const options = {
        maxSizeMB: 1, // Max size 1MB
        maxWidthOrHeight: 1024, // Max resolution 1024px
        useWebWorker: true,
      };

      console.log("DEBUG: Compressing file...");
      const compressedFile = await imageCompression(file, options);

      const formData = new FormData();
      formData.append("file", compressedFile);

      const res = await fetch("/api/fm/asset-management/asset-image-upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const result = await res.json();
      return result?.data?.id; // Returning the UUID string
    } catch (error) {
      console.error("Upload Error:", error);
      throw error;
    }
  };

  const onSubmit = async (values: AssetFormValues) => {
    setLoading(true);
    try {
      let finalImageValue = null;

      if (selectedFile) {
        finalImageValue = await uploadToDirectus(selectedFile);
      }

      const submissionData = {
        ...values,
        date_acquired: format(values.date_acquired, "yyyy-MM-dd"),
        cost_per_item: Number(values.cost_per_item),
        quantity: Number(values.quantity),
        life_span: Number(values.life_span),
        department: Number(values.department),
        employee: values.employee ? Number(values.employee) : null,
        item_type: values.item_type,
        item_classification: values.item_classification,
        barcode: values.barcode || "",
        rfid_code: values.rfid_code || "",
        serial: values.serial || "",
        is_active_warning: values.is_active_warning,
        encoder: 133,
        item_image: finalImageValue,
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
      resetForm();
      onSuccess();
    } catch (error: unknown) {
      console.error("Asset creation error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save asset",
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    form.reset({
      item_name: "",
      item_type: "",
      item_classification: "",
      barcode: "",
      rfid_code: "",
      condition: "Good",
      quantity: 1,
      cost_per_item: 0,
      life_span: 5,
      date_acquired: new Date(),
      department: 0,
      employee: null,
      serial: "",
      is_active_warning: 0,
    });
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add New Asset
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto p-0 rounded-2xl">
        <DialogHeader className="p-6 pb-0 gap-0">
          <DialogTitle className="text-lg font-semibold flex items-center">
            Create New Asset
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Fill in the details below to add a new asset to the inventory.
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
                onClick={() => document.getElementById("image-upload")?.click()}
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
                  id="image-upload"
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
                  <FormItem className="flex flex-col">
                    <FormLabel>Item Name *</FormLabel>
                    <Popover open={nameOpen} onOpenChange={setNameOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between h-10 font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            {field.value || "Search or type asset name..."}
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
                              value.toLowerCase().includes(search.toLowerCase())
                            )
                              return 1;
                            return 0;
                          }}
                        >
                          <CommandInput
                            placeholder="Type asset name..."
                            value={itemNameSearch}
                            onValueChange={(val) => {
                              setItemNameSearch(val);
                              field.onChange(val); // Continously update form value as user types
                            }}
                          />
                          <CommandList>
                            <CommandEmpty className="p-2 text-sm text-muted-foreground">
                              New item will be created.
                            </CommandEmpty>
                            <CommandGroup heading="Existing Assets">
                              {Array.from(
                                new Map(
                                  items
                                    .filter((item) =>
                                      item.item_name
                                        .toLowerCase()
                                        .includes(itemNameSearch.toLowerCase()),
                                    )
                                    .map((item) => [
                                      item.item_name.toLowerCase(),
                                      item,
                                    ]),
                                ).values(),
                              )
                                .slice(0, 10) // Limit suggestions
                                .map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    value={item.item_name}
                                    onSelect={(val) => {
                                      form.setValue("item_name", val);
                                      // Autofill Type and Classification
                                      if (item.item_type?.type_name) {
                                        form.setValue(
                                          "item_type",
                                          item.item_type.type_name,
                                        );
                                      }
                                      if (
                                        item.item_classification
                                          ?.classification_name
                                      ) {
                                        form.setValue(
                                          "item_classification",
                                          item.item_classification
                                            .classification_name,
                                        );
                                      }
                                      setItemNameSearch("");
                                      setNameOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        item.item_name === field.value
                                          ? "opacity-100"
                                          : "opacity-0",
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span>{item.item_name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {item.item_type?.type_name} •{" "}
                                        {
                                          item.item_classification
                                            ?.classification_name
                                        }
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* ITEM TYPE FIELD */}
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
                            <CommandList>
                              {/* Custom "Add New" Logic */}
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

                {/* CLASSIFICATION FIELD */}
                <FormField
                  control={form.control}
                  name="item_classification"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Classification *</FormLabel>
                      <Popover
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
                            <CommandList>
                              {/* Custom "Add New" Logic */}
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
                        onValueChange={(val: any) =>
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
                        onValueChange={(val: any) =>
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
                        onValueChange={(val: any) =>
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
                              {/* <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /> */}
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
                      {/* LABEL UPDATED TO YEARS */}
                      <FormLabel>Life Span</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          placeholder="e.g. 5"
                          className="h-10"
                          onChange={(e) =>
                            // Ensure we save as an integer for the annual formula
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
              <Button
                variant="outline"
                type="button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="min-w-30" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Asset
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
