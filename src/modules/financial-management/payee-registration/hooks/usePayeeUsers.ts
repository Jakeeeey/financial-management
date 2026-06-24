import { useState, useEffect } from "react";
import { Payee } from "../types/payee.schema";

export interface PayeeUser {
  user_id?: number;
  userId?: number;
  id?: number;
  user_fname?: string;
  firstName?: string;
  user_lname?: string;
  lastName?: string;
  user_email?: string;
  email?: string;
  user_tin?: string;
  tinNumber?: string;
  user_contact?: string;
  contactNumber?: string;
  user_department?: number;
  department?: number | any;
  user_department_name?: string;
  department_name?: string;
}

export function usePayeeUsers() {
  const [users, setUsers] = useState<PayeeUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const [usersRes, payeesRes, deptsRes] = await Promise.all([
          fetch("/api/fm/treasury/users?sort=firstName"),
          fetch("/api/fm/payee-registration/payees"),
          fetch("/api/fm/treasury/expense-approval/user-expense-limit?action=departments")
        ]);

        const usersJson = await usersRes.json();
        const payeesJson = payeesRes.ok ? await payeesRes.json() : { data: [] };
        const deptsJson = deptsRes.ok ? await deptsRes.json() : [];

        if (!cancelled) {
          const rawUsers: PayeeUser[] = Array.isArray(usersJson) ? usersJson : (usersJson?.data ?? []);
          const payees: Payee[] = payeesJson?.data ?? [];
          const departments: any[] = Array.isArray(deptsJson) ? deptsJson : (deptsJson?.data ?? []);

          // Create department lookup map
          const deptMap = new Map<number, string>();
          departments.forEach(d => {
            if (d.department_id && d.department_name) {
              deptMap.set(Number(d.department_id), d.department_name);
            }
          });

          const existingNames = new Set(payees.map(p => (p.supplier_name || "").toLowerCase().trim()).filter(Boolean));
          const existingEmails = new Set(payees.map(p => (p.email_address || "").toLowerCase().trim()).filter(Boolean));
          const existingTins = new Set(payees.map(p => (p.tin_number || "").replace(/\D/g, "")).filter(Boolean));

          const filteredUsers = rawUsers.filter(u => {
            const name = `${u.firstName || u.user_fname || ""} ${u.lastName || u.user_lname || ""}`.trim().toLowerCase();
            const email = (u.email || u.user_email || "").toLowerCase().trim();
            const tin = (u.tinNumber || u.user_tin || "").replace(/\D/g, "");

            if (name && existingNames.has(name)) return false;
            if (email && email !== "n/a" && existingEmails.has(email)) return false;
            if (tin && existingTins.has(tin)) return false;

            // Map department name
            if (u.department && typeof u.department === "object" && u.department.department_name) {
               u.department_name = u.department.department_name;
            } else if (u.user_department_name) {
               u.department_name = u.user_department_name;
            } else {
               const deptId = u.user_department || u.department;
               if (deptId && !isNaN(Number(deptId))) {
                 u.department_name = deptMap.get(Number(deptId)) || "";
               }
            }

            return true;
          });

          setUsers(filteredUsers);
        }
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return { users, loading };
}
