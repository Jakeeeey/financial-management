import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Payee } from "../types/payee.schema";

export interface PayeeUser {
  user_id?: number;
  userId?: number;
  id?: number;
  user_fname?: string;
  firstName?: string;
  middleName?: string;
  user_mname?: string;
  user_lname?: string;
  lastName?: string;
  user_email?: string;
  email?: string;
  user_tin?: string;
  tinNumber?: string;
  user_contact?: string;
  contactNumber?: string;
  isDeleted?: boolean | number;
  existingPayee?: Payee;
}

interface UserLookupResponse {
  data?: PayeeUser[];
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
}

interface UsePayeeUsersOptions {
  currentPayeeId?: number;
}

const getUserId = (user: PayeeUser) => user.id ?? user.user_id ?? user.userId;

const getUserName = (user: PayeeUser) =>
  `${user.firstName || user.user_fname || ""} ${user.lastName || user.user_lname || ""}`
    .trim()
    .toLowerCase();

const getUserEmail = (user: PayeeUser) =>
  (user.email || user.user_email || "").trim().toLowerCase();

const getUserTin = (user: PayeeUser) =>
  (user.tinNumber || user.user_tin || "").replace(/\D/g, "");

const findExistingPayee = (
  user: PayeeUser,
  payees: Payee[],
  currentPayeeId?: number,
) => {
  const userName = getUserName(user);
  const userEmail = getUserEmail(user);
  const userTin = getUserTin(user);

  return payees.find((payee) => {
    if (currentPayeeId != null && payee.id === currentPayeeId) return false;

    const payeeName = (payee.supplier_name || "").trim().toLowerCase();
    const payeeEmail = (payee.email_address || "").trim().toLowerCase();
    const payeeTin = (payee.tin_number || "").replace(/\D/g, "");

    return (
      (userName && payeeName === userName) ||
      (userEmail && userEmail !== "n/a" && payeeEmail === userEmail) ||
      (userTin && payeeTin === userTin)
    );
  });
};

export function usePayeeUsers(options: UsePayeeUsersOptions = {}) {
  const { currentPayeeId } = options;
  const [rawUsers, setRawUsers] = useState<PayeeUser[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [payeesLoaded, setPayeesLoaded] = useState(false);
  const activeSearchRef = useRef("");
  const currentPageRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUsersPage = useCallback(async (search: string, page: number, append: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        search,
        page: String(page),
        size: "25",
      });
      const response = await fetch(`/api/fm/payee-registration/user-lookup?${params.toString()}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({})) as UserLookupResponse & { message?: string };

      if (!response.ok) {
        throw new Error(json.message || "Unable to load users");
      }

      if (controller.signal.aborted) return;

      const nextUsers = Array.isArray(json.data) ? json.data : [];
      setRawUsers((previous) => {
        if (!append) return nextUsers;

        const byId = new Map(previous.map((user) => [String(getUserId(user)), user]));
        nextUsers.forEach((user) => byId.set(String(getUserId(user)), user));
        return Array.from(byId.values());
      });
      activeSearchRef.current = search;
      currentPageRef.current = Number.isInteger(json.page) ? Number(json.page) : page;
      setHasMore(Boolean(json.hasMore));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      if (cause instanceof Error && cause.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setRawUsers((previous) => append ? previous : []);
        setHasMore(false);
        setError(cause instanceof Error ? cause.message : "Unable to load users");
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPayees = async () => {
      try {
        const response = await fetch("/api/fm/payee-registration/payees", { cache: "no-store" });
        if (!response.ok) return;
        const json = await response.json() as { data?: Payee[] };
        if (!cancelled) setPayees(Array.isArray(json.data) ? json.data : []);
      } catch {
        // The user lookup remains usable if the payee list is unavailable.
      } finally {
        if (!cancelled) setPayeesLoaded(true);
      }
    };

    void loadUsersPage("", 0, false);
    void loadPayees();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [loadUsersPage]);

  const searchUsers = useCallback((value: string) => {
    const search = value.trim();
    activeSearchRef.current = search;
    currentPageRef.current = 0;
    setError(null);
    setLoading(true);
    setHasMore(false);
    abortRef.current?.abort();

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = null;
      void loadUsersPage(search, 0, false);
    }, 250);
  }, [loadUsersPage]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    void loadUsersPage(activeSearchRef.current, currentPageRef.current + 1, true);
  }, [hasMore, loadUsersPage, loading]);

  const retry = useCallback(() => {
    void loadUsersPage(activeSearchRef.current, 0, false);
  }, [loadUsersPage]);

  const users = useMemo(
    () => rawUsers.map((user) => ({
      ...user,
      existingPayee: payeesLoaded
        ? findExistingPayee(user, payees, currentPayeeId)
        : undefined,
    })),
    [currentPayeeId, payees, payeesLoaded, rawUsers],
  );

  return {
    users,
    loading,
    error,
    hasMore,
    searchUsers,
    loadMore,
    retry,
  };
}
