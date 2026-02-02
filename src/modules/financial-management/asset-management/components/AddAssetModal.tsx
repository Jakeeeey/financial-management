"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import imageCompression from "browser-image-compression";

import {
  Package,
  Scan,
  Landmark,
  ClipboardList,
  Loader2,
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Plus,
  ImagePlus,
  X,
  UploadCloud,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  FormDescription,
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
import {
  assetFormSchema,
  AssetFormValues,
  Department,
  User,
  ItemType,
  ItemClassification,
} from "../types";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface AddAssetModalProps {
  onSuccess: () => void;
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
  const [typeSearch, setTypeSearch] = useState("");
  const [classificationSearch, setClassificationSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    },
  });

  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        try {
          const [depRes, userRes, typeRes, classRes] = await Promise.all([
            fetch("/api/fm/asset-management?type=departments"),
            fetch("/api/fm/asset-management?type=users"),
            fetch("/api/fm/asset-management?type=item_types"),
            fetch("/api/fm/asset-management?type=item_classifications"),
          ]);

          const depData = await depRes.json();
          const userData = await userRes.json();
          const typeData = await typeRes.json();
          const classData = await classRes.json();

          setDepartments(Array.isArray(depData) ? depData : []);
          setUsers(Array.isArray(userData) ? userData : []);
          setTypes(Array.isArray(typeData) ? typeData : []);
          setClassifications(Array.isArray(classData) ? classData : []);
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

      const res = await fetch("/api/fm/asset-image-upload", {
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

      // if (selectedFile) {
      //   finalImageValue = await uploadToDirectus(selectedFile);
      //   console.log("DEBUG: Image Value to be submitted:", finalImageValue);
      // } else {
      //   console.log("DEBUG: No file selected, skipping upload.");
      // }

      if (selectedFile) {
        finalImageValue = await uploadToDirectus(selectedFile);
        console.log("DEBUG: Image Value to be submitted:", finalImageValue);
      }

      console.log("DEBUG: Form values before submission:", values);
      console.log("DEBUG: date_acquired value:", values.date_acquired);
      console.log("DEBUG: date_acquired type:", typeof values.date_acquired);

      const submissionData = {
        ...values,
        date_acquired: values.date_acquired.toISOString().split("T")[0],
        cost_per_item: Number(values.cost_per_item),
        quantity: Number(values.quantity),
        life_span: Number(values.life_span),
        department: Number(values.department),
        employee: values.employee ? Number(values.employee) : null,
        item_type: values.item_type,
        item_classification: values.item_classification,
        barcode: values.barcode || "",
        rfid_code: values.rfid_code || "",
        encoder: 133,
        item_image: finalImageValue,
      };

      console.log(
        "DEBUG: Submission data:",
        JSON.stringify(submissionData, null, 2),
      );

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
    } catch (error: any) {
      console.error("Asset creation error:", error);
      toast.error(error.message || "Failed to save asset");
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
      date_acquired: new Date(), // ✅ Add this
      department: 0,
      employee: null,
    });
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Add New Asset</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Add New Asset
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="px-6 pb-8 space-y-6"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                <ImagePlus className="h-4 w-4" /> Asset Image
              </div>
              <Separator />

              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50",
                  previewUrl ? "border-primary/50" : "border-muted",
                )}
                onClick={() => document.getElementById("image-upload")?.click()}
              >
                {previewUrl ? (
                  <div className="relative w-full aspect-video max-h-48 overflow-hidden rounded-md">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-contain"
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
                    <div className="p-4 bg-primary/10 rounded-full text-primary">
                      <UploadCloud className="h-8 w-8" />
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
              <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                <ClipboardList className="h-4 w-4" /> General Details
              </div>
              <Separator />

              <FormField
                control={form.control}
                name="item_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Dell Latitude 5420"
                        {...field}
                        className="bg-muted/20 h-10"
                      />
                    </FormControl>
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
                      <Popover>
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
                                    }}
                                  >
                                    <Plus className="h-4 w-4" />
                                    <span>
                                      Add{" "}
                                      <span className="font-bold">
                                        "{typeSearch}"
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
                      <Popover>
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
                                    }}
                                  >
                                    <Plus className="h-4 w-4" />
                                    <span>
                                      Add{" "}
                                      <span className="font-bold">
                                        "{classificationSearch}"
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
              <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                <Scan className="h-4 w-4" /> Tracking & Assignment
              </div>
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
                        className="h-10"
                      />
                    </FormItem>
                  )}
                />
              </div>

              {/* FIX FOR IMAGE 2: Added items-end to ensure vertical alignment */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department *</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(Number(val))}
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
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <Select
                        onValueChange={(val) =>
                          field.onChange(val === "none" ? null : Number(val))
                        }
                        value={field.value?.toString() ?? "none"}
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
                    <FormItem className="flex flex-col">
                      <FormLabel className="mb-2.5">Date Acquired *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full h-10 pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date()}
                            initialFocus
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
              <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                <Landmark className="h-4 w-4" /> Financials & Status
              </div>
              <Separator />

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
                        className="h-10"
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
                      <FormLabel>Life Span (Years) *</FormLabel>
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
