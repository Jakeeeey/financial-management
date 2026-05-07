// src/modules/financial-management/treasury/budgeting/create-budget/hooks/useCreateBudgetForm.ts

"use client";

import { useState, useEffect } from "react";
import type { CreateBudgetPayload, Division, Department, COA } from "../types";
import { budgetService } from "../services/budgetService";
import { toast } from "sonner";

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

interface FormErrors {
  year?:          string;
  month?:         string;
  division_id?:   string;
  department_id?: string;
  coa_id?:        string;
  gl_code?:       string;
  amount?:        string;
}

const now = new Date();

const DEFAULT_STATE: FormState = {
  year:          String(now.getFullYear()),
  month:         String(now.getMonth() + 1),
  division_id:   "",
  department_id: "",
  coa_id:        "",
  gl_code:       "",
  amount:        "",
  remarks:       "",
  attachments:   [],
};

export function useCreateBudgetForm(
    onSuccess: (payload: CreateBudgetPayload) => void,
    initialData: Budget | null = null,
    supplementParent: Budget | null = null,
    checkDuplicate?: (year: number, month: number, coaId: number) => boolean
) {
  const [form,    setForm]    = useState<FormState>(DEFAULT_STATE);
  const [errors,  setErrors]  = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  // Sync with initialData for editing or supplementParent for supplementing
  useEffect(() => {
    if (initialData) {
        setForm({
            year:          String(initialData.year),
            month:         String(initialData.month),
            division_id:   String(initialData.division_id || ""),
            department_id: String(initialData.department_id || ""), 
            coa_id:        String(initialData.coa_id),
            gl_code:       initialData.gl_code,
            amount:        String(initialData.amount),
            remarks:       initialData.remarks,
            attachments:   [], // Don't try to sync File objects from URLs
        });
    } else if (supplementParent) {
        setForm({
            year:          String(supplementParent.year),
            month:         String(supplementParent.month),
            division_id:   String(supplementParent.division_id || ""),
            department_id: String(supplementParent.department_id || ""), 
            coa_id:        String(supplementParent.coa_id),
            gl_code:       supplementParent.gl_code,
            amount:        "", // Supplemental amount starts blank
            remarks:       "",
            attachments:   [],
        });
    } else {
        setForm(DEFAULT_STATE);
    }
    setErrors({});
  }, [initialData, supplementParent]);

  // Lookups
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [coas, setCoas] = useState<COA[]>([]);
  const [fetchingLookups, setFetchingLookups] = useState(false);

  // Load initial divisions
  useEffect(() => {
    async function loadInitial() {
      try {
        setFetchingLookups(true);
        const divList = await budgetService.getDivisions();
        setDivisions(divList);
      } catch (e) {
        toast.error("Failed to load divisions");
      } finally {
        setFetchingLookups(false);
      }
    }
    loadInitial();
  }, []);

  // Load departments when division changes
  useEffect(() => {
    if (!form.division_id) {
      setDepartments([]);
      return;
    }
    async function loadDepts() {
      try {
        setFetchingLookups(true);
        const deptList = await budgetService.getDepartments(Number(form.division_id));
        setDepartments(deptList);
      } catch (e) {
        toast.error("Failed to load departments");
      } finally {
        setFetchingLookups(false);
      }
    }
    loadDepts();
  }, [form.division_id]);

  // Load COAs when department changes
  useEffect(() => {
    if (!form.department_id) {
      setCoas([]);
      return;
    }
    async function loadCoas() {
      try {
        setFetchingLookups(true);
        // We'd ideally need the dept_div_id here based on the DDL logic.
        // For now, we'll assume the service handles fetching COAs for the selected department.
        const coaList = await budgetService.getCOAs(Number(form.department_id));
        setCoas(coaList);
      } catch (e) {
        toast.error("Failed to load Chart of Accounts");
      } finally {
        setFetchingLookups(false);
      }
    }
    loadCoas();
  }, [form.department_id]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));

    // Cascading resets
    if (key === "division_id") {
      setForm(f => ({ ...f, division_id: value as string, department_id: "", coa_id: "", gl_code: "" }));
    } else if (key === "department_id") {
      setForm(f => ({ ...f, department_id: value as string, coa_id: "", gl_code: "" }));
    } else if (key === "coa_id") {
        // Auto-fill GL Code if found
        const selectedCOA = coas.find(c => String((c as any).dept_div_coa_id || c.coa_id || (c as any).id) === value);
        if (selectedCOA) {
            setForm(f => ({ ...f, coa_id: value as string, gl_code: selectedCOA.coa_code || (selectedCOA as any).code || (selectedCOA as any).coaCode || "" }));
        }
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    setForm(f => ({ ...f, attachments: [...f.attachments, ...arr] }));
  };

  const removeFile = (index: number) => {
    setForm(f => ({ ...f, attachments: f.attachments.filter((_, i) => i !== index) }));
  };

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!form.year)          errs.year          = "Year is required.";
    if (!form.month)         errs.month         = "Month is required.";
    if (!form.division_id)   errs.division_id   = "Division is required.";
    if (!form.department_id) errs.department_id = "Department is required.";
    if (!form.coa_id)        errs.coa_id        = "COA is required.";
    if (!form.gl_code.trim()) errs.gl_code      = "GL Code is required.";
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
        errs.amount = "A valid positive amount is required.";
    }

    if (!errs.coa_id && checkDuplicate?.(Number(form.year), Number(form.month), Number(form.coa_id))) {
        errs.coa_id = "A budget for this Year, Month, and Account already exists.";
        toast.warning("Duplicate entry detected.");
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
        const payload: CreateBudgetPayload = {
            parent_budget_id: supplementParent ? supplementParent.id : initialData?.parent_budget_id,
            entry_type:    supplementParent ? 'supplemental' : (initialData?.entry_type || 'original'),
            year:          Number(form.year),
            month:         Number(form.month),
            division_id:   Number(form.division_id),
            department_id: Number(form.department_id),
            dept_div_coa_id: Number(form.coa_id), 
            gl_code:       form.gl_code,
            amount:        Number(form.amount),
            remarks:       form.remarks,
            attachments:   form.attachments,
        };
        // await budgetService.createBudget(payload); // Real API call
        onSuccess(payload);
        reset();
    } catch (e: any) {
        toast.error(e.message || "Failed to create budget");
    } finally {
        setLoading(false);
    }
  };

  const reset = () => {
    setForm(DEFAULT_STATE);
    setErrors({});
  };

  return {
    form, errors, loading,
    divisions, departments, coas, fetchingLookups,
    setField, addFiles, removeFile,
    handleSubmit, reset,
  };
}
