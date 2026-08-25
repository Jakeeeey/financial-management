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
}

export function usePayeeUsers() {
  const [users, setUsers] = useState<PayeeUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const [usersRes, payeesRes] = await Promise.all([
          fetch("/api/fm/treasury/users?sort=firstName"),
          fetch("/api/fm/payee-registration/payees")
        ]);

        const usersJson = await usersRes.json();
        const payeesJson = payeesRes.ok ? await payeesRes.json() : { data: [] };

        if (!cancelled) {
          const rawUsers: PayeeUser[] = Array.isArray(usersJson) ? usersJson : (usersJson?.data ?? []);
          const payees: Payee[] = payeesJson?.data ?? [];

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
