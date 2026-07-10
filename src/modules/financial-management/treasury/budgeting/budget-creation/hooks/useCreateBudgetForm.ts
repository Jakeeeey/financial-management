// src/modules/financial-management/treasury/budgeting/budget-creation/hooks/useCreateBudgetForm.ts

"use client";

import { useState, useEffect } from "react";
import type { Budget, CreateBudgetPayload, Division, Department, COA, BudgetAttachment } from "../types";
import { budgetService } from "../services/budgetService";
import { toast } from "sonner";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

interface FormState {
  year:          string;
  month:         string;
  division_id:   string;
  department_id: string;
  coa_id:        string;
  gl_code:       string;
  amount:        string;
  remarks:       string;
  attachments:   File[];
}

export function useCreateBudgetForm(
  onSuccess: (payload: CreateBudgetPayload, names: { division_name?: string; department_name?: string; coa_name?: string }) => void | Promise<void>,
  initialData: Budget | null = null,
  supplementParent: Budget | null = null,
  checkDuplicate: (year: number, month: number, coaId: number, divisionId: number, departmentId: number) => Promise<boolean>
) {
  const [form, setForm] = useState<FormState>({
    year:          String(new Date().getFullYear()),
    month:         String(new Date().getMonth() + 1),
    division_id:   "",
    department_id: "",
    coa_id:        "",
    gl_code:       "",
    amount:        "",
    remarks:       "",
    attachments:   [],
  });

  const [existingAttachments, setExistingAttachments] = useState<BudgetAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Lookups
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [coas, setCoas] = useState<COA[]>([]);
  const [usedCoaIds, setUsedCoaIds] = useState<Set<number>>(new Set());
  const [fetchingLookups, setFetchingLookups] = useState(false);

  // Sync with initialData
  useEffect(() => {
    if (initialData) {
      const monthIdx = MONTH_NAMES.indexOf(initialData.month) + 1;
      setForm({
        year:          String(initialData.year || ""),
        month:         monthIdx > 0 ? String(monthIdx) : String(initialData.month || ""),
        division_id:   String(initialData.division_id || ""),
        department_id: String(initialData.department_id || ""),
        coa_id:        String(initialData.coa_id || ""),
        gl_code:       initialData.gl_code || "",
        amount:        String(initialData.amount || ""),
        remarks:       initialData.remarks || "",
        attachments:   [],
      });

      // Fetch existing attachments
      budgetService.getAttachments(initialData.id).then(setExistingAttachments).catch(console.error);

    } else if (supplementParent) {
      const monthIdx = MONTH_NAMES.indexOf(supplementParent.month) + 1;
      setForm(prev => ({
        ...prev,
        year:          String(supplementParent.year),
        month:         monthIdx > 0 ? String(monthIdx) : String(supplementParent.month),
        division_id:   String(supplementParent.division_id),
        department_id: String(supplementParent.department_id),
        coa_id:        String(supplementParent.coa_id),
        gl_code:       supplementParent.gl_code || "",
        amount:        "",
        remarks:       "",
        attachments:   [],
      }));
    }
  }, [initialData, supplementParent]);

  // Lookup Loading
  useEffect(() => {
    async function loadDivisions() {
      try {
        setFetchingLookups(true);
        const divList = await budgetService.getDivisions();
        setDivisions(divList);
      } finally {
        setFetchingLookups(false);
      }
    }
    loadDivisions();
  }, []);

  useEffect(() => {
    if (!form.division_id || isNaN(Number(form.division_id))) {
      setDepartments([]);
      return;
    }
    async function loadDepts() {
      try {
        setFetchingLookups(true);
        const divId = Number(form.division_id);
        const deptList = await budgetService.getDepartments(divId);
        setDepartments(deptList);
      } finally {
        setFetchingLookups(false);
      }
    }
    loadDepts();
  }, [form.division_id]);

  useEffect(() => {
    if (!form.department_id || isNaN(Number(form.department_id))) {
      setCoas([]);
      return;
    }
    async function loadCoas() {
      try {
        setFetchingLookups(true);
        // Find the dept_div_id from departments lookup
        const dept = departments.find(d => String(d.department_id) === form.department_id);
        const deptDivId = dept?.dept_div_id;
        
        if (deptDivId) {
            const coaList = await budgetService.getCOAs(deptDivId);
            setCoas(coaList);
        } else {
            setCoas([]);
        }
      } finally {
        setFetchingLookups(false);
      }
    }
    loadCoas();
  }, [form.department_id, departments]);

  // Auto-fill GL Code
  useEffect(() => {
    const coa = coas.find(c => String(c.coa_id) === form.coa_id);
    if (coa) {
      setForm(prev => ({ ...prev, gl_code: coa.gl_code || "" }));
    } else if (form.coa_id) {
      setForm(prev => ({ ...prev, gl_code: "" }));
    }
  }, [form.coa_id, coas]);

  // Fetch used COA IDs for the selected Year + Month + Division + Department
  useEffect(() => {
    if (!form.year || !form.month || !form.division_id || !form.department_id) {
      setUsedCoaIds(new Set());
      return;
    }
    async function loadUsedCoas() {
      const monthName = MONTH_NAMES[Number(form.month) - 1];
      if (!monthName) return;
      
      const excludeId = initialData ? String(initialData.id) : undefined;
      const ids = await budgetService.getUsedCoaIds(
        Number(form.year), 
        monthName,
        Number(form.division_id),
        Number(form.department_id),
        excludeId
      );
      setUsedCoaIds(new Set(ids));
    }
    loadUsedCoas();
  }, [form.year, form.month, form.division_id, form.department_id, initialData]);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };

      if (field === "division_id" && value !== prev.division_id) {
        next.department_id = "";
        next.coa_id = "";
        next.gl_code = "";
      }

      if (field === "department_id" && value !== prev.department_id) {
        next.coa_id = "";
        next.gl_code = "";
      }

      if (field === "coa_id" && !value) {
        next.gl_code = "";
      }

      return next;
    });
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    
    const MAX_SIZE_MB = 25;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
    const ALLOWED_EXTENSIONS = new Set([
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "xlsm",
      "csv",
      "png",
      "jpg",
      "jpeg",
      "gif",
      "webp",
      "bmp",
      "svg",
      "tif",
      "tiff",
      "heic",
      "heif",
    ]);
    const ALLOWED_MIME_TYPES = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel.sheet.macroenabled.12",
      "text/csv",
    ]);

    const isAllowedFile = (file: File) => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      return file.type.startsWith("image/") || ALLOWED_MIME_TYPES.has(file.type) || ALLOWED_EXTENSIONS.has(extension);
    };
    
    const allFiles = Array.from(files);
    const oversizedFiles = allFiles.filter(f => f.size > MAX_SIZE_BYTES);
    const unsupportedFiles = allFiles.filter(f => f.size <= MAX_SIZE_BYTES && !isAllowedFile(f));
    const validFiles = allFiles.filter(f => f.size <= MAX_SIZE_BYTES && isAllowedFile(f));

    if (oversizedFiles.length > 0) {
      toast.error(`Some files were rejected because they exceed the ${MAX_SIZE_MB}MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
    }

    if (unsupportedFiles.length > 0) {
      toast.error(`Only Excel, PDF, Word, and image files can be attached: ${unsupportedFiles.map(f => f.name).join(', ')}`);
    }

    if (validFiles.length > 0) {
      setForm(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...validFiles],
      }));
    }
  };

  const removeFile = (index: number) => {
    setForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const removeExistingAttachment = async (id: string | number) => {
    try {
      await budgetService.deleteAttachment(id);
      setExistingAttachments(prev => prev.filter(a => String(a.id) !== String(id)));
      toast.success("Attachment removed.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove attachment";
      toast.error(msg);
    }
  };

  const validate = async () => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.year) newErrors.year = "Year is required";
    if (!form.month) newErrors.month = "Month is required";
    if (!form.division_id) newErrors.division_id = "Division is required";
    if (!form.department_id) newErrors.department_id = "Department is required";
    if (!form.coa_id) newErrors.coa_id = "COA is required";
    if (!form.amount || Number(form.amount) <= 0) newErrors.amount = "Amount must be greater than 0";

    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return false;
    }

    // Only check duplicate for Original budgets
    if (!initialData && !supplementParent) {
        const isDup = await checkDuplicate(
            Number(form.year), 
            Number(form.month), 
            Number(form.coa_id),
            Number(form.division_id),
            Number(form.department_id)
        );
        if (isDup) {
            setErrors({ coa_id: "This account is already budgeted for this period and department." });
            return false;
        }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!(await validate())) return;

    setLoading(true);
    try {
        const payload: CreateBudgetPayload = {
            parent_budget_id: supplementParent?.id ? Number(supplementParent.id) : initialData?.parent_budget_id ? Number(initialData.parent_budget_id) : null,
            entry_type:       supplementParent ? 'supplemental' : (initialData?.entry_type || 'original'),
            year:             Number(form.year),
            month:            Number(form.month),
            division_id:      Number(form.division_id),
            department_id:    Number(form.department_id),
            coa_id:           Number(form.coa_id),
            amount:           Number(form.amount),
            remarks:          form.remarks,
            attachments:      form.attachments,
        };
        const divName = divisions.find(d => String(d.division_id) === form.division_id)?.division_name;
        const deptName = departments.find(d => String(d.department_id) === form.department_id)?.department_name;
        const coaName = coas.find(c => String(c.coa_id) === form.coa_id)?.account_title;

        await onSuccess(payload, {
            division_name: divName || undefined,
            department_name: deptName || undefined,
            coa_name: coaName || undefined,
        });
    } finally {
        setLoading(false);
    }
  };

  return {
    form, existingAttachments, errors, loading,
    divisions, departments, coas, usedCoaIds, fetchingLookups,
    setField, addFiles, removeFile, removeExistingAttachment, handleSubmit,
  };
}
