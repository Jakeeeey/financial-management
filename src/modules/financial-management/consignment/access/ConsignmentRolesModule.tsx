"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Pencil, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ConsignmentAccess, ConsignmentPage, ConsignmentRole, ConsignmentRoleAssignment, ConsignmentUserOption } from "./types";
import { formatConsignmentTimestamp } from "./format-consignment-timestamp";

const ROLE_OPTIONS: ConsignmentRole[] = ["CREATOR", "APPROVER", "CONTROLLER"];
const PAGE_SIZE = 50;

export default function ConsignmentRolesModule() {
  const [access, setAccess] = useState<ConsignmentAccess | null>(null);
  const [assignments, setAssignments] = useState<ConsignmentRoleAssignment[]>([]);
  const [assignmentPage, setAssignmentPage] = useState(0);
  const [assignmentHasNext, setAssignmentHasNext] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [users, setUsers] = useState<ConsignmentUserOption[]>([]);
  const [userPage, setUserPage] = useState(0);
  const [userHasNext, setUserHasNext] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ConsignmentUserOption | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [userOptionsLoading, setUserOptionsLoading] = useState(false);
  const [userOptionsLoadingMore, setUserOptionsLoadingMore] = useState(false);
  const [userOptionsError, setUserOptionsError] = useState("");
  const userSearchControllerRef = useRef<AbortController | null>(null);
  const userSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [role, setRole] = useState<ConsignmentRole>("CREATOR");
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState<ConsignmentRole>("CREATOR");
  const [pendingDelete, setPendingDelete] = useState<ConsignmentRoleAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const loadAssignments = useCallback(async (page = 0) => {
    setAssignmentsLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
      const response = await fetch("/api/fm/consignment/access/roles?" + query.toString(), { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load consignment role assignments.");
      const result: ConsignmentPage<ConsignmentRoleAssignment> = await response.json();
      setAssignments(result.items);
      setAssignmentPage(result.page);
      setAssignmentHasNext(result.hasNext);
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/fm/consignment/access/me", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not verify consignment access.");
        const currentAccess: ConsignmentAccess = await response.json();
        if (!active) return;
        setAccess(currentAccess);
        if (currentAccess.canManageRoles) await loadAssignments();
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load consignment access.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadAssignments]);

  useEffect(() => {
    userSearchControllerRef.current?.abort();
    userSearchControllerRef.current = null;
    if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current);
    setUserOptionsError("");
    setUserOptionsLoadingMore(false);

    if (!access?.canManageRoles || !userPickerOpen) {
      setUserOptionsLoading(false);
      return;
    }

    setUsers([]);
    setUserPage(0);
    setUserHasNext(false);
    setUserOptionsLoading(true);
    const controller = new AbortController();
    userSearchControllerRef.current = controller;
    userSearchTimeoutRef.current = setTimeout(() => {
      const query = new URLSearchParams({
        search: userSearch.trim(),
        page: "0",
        size: String(PAGE_SIZE),
      });
      void fetch("/api/fm/consignment/access/users?" + query.toString(), {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const result = await response.json().catch(() => null) as { message?: string } | null;
            throw new Error(result?.message ?? "Could not search active users.");
          }
          return response.json() as Promise<ConsignmentPage<ConsignmentUserOption>>;
        })
        .then((result) => {
          if (controller.signal.aborted) return;
          setUsers(result.items);
          setUserPage(result.page);
          setUserHasNext(result.hasNext);
        })
        .catch((searchError: unknown) => {
          if (controller.signal.aborted) return;
          setUsers([]);
          setUserOptionsError(searchError instanceof Error ? searchError.message : "Could not search active users.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setUserOptionsLoading(false);
        });
    }, 250);

    return () => {
      if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current);
      userSearchControllerRef.current?.abort();
      userSearchControllerRef.current = null;
    };
  }, [access?.canManageRoles, userPickerOpen, userSearch]);

  async function loadMoreUsers() {
    if (!userHasNext || userOptionsLoadingMore || userOptionsLoading) return;

    userSearchControllerRef.current?.abort();
    const controller = new AbortController();
    userSearchControllerRef.current = controller;
    setUserOptionsLoadingMore(true);
    setUserOptionsError("");
    try {
      const query = new URLSearchParams({
        search: userSearch.trim(),
        page: String(userPage + 1),
        size: String(PAGE_SIZE),
      });
      const response = await fetch("/api/fm/consignment/access/users?" + query.toString(), {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(result?.message ?? "Could not search active users.");
      }
      const result: ConsignmentPage<ConsignmentUserOption> = await response.json();
      if (controller.signal.aborted) return;
      setUsers((current) => {
        const existingIds = new Set(current.map((user) => user.userId));
        return [...current, ...result.items.filter((user) => !existingIds.has(user.userId))];
      });
      setUserPage(result.page);
      setUserHasNext(result.hasNext);
    } catch (searchError) {
      if (!controller.signal.aborted) {
        setUserOptionsError(searchError instanceof Error ? searchError.message : "Could not search active users.");
      }
    } finally {
      if (!controller.signal.aborted) setUserOptionsLoadingMore(false);
    }
  }

  async function changeAssignmentPage(page: number) {
    if (page < 0 || assignmentsLoading) return;
    setError("");
    try {
      await loadAssignments(page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load consignment role assignments.");
    }
  }

  async function refreshOwnAccess() {
    const response = await fetch("/api/fm/consignment/access/me", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not refresh consignment access.");
    const currentAccess: ConsignmentAccess = await response.json();
    setAccess(currentAccess);
    if (currentAccess.canManageRoles) {
      await loadAssignments(0);
    } else {
      setAssignments([]);
      setAssignmentPage(0);
      setAssignmentHasNext(false);
    }
  }

  async function saveRoleAssignment(targetUserId: number, targetRole: ConsignmentRole) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/fm/consignment/access/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId, role: targetRole }),
      });
      const result = await response.json().catch(() => null) as (ConsignmentRoleAssignment & { message?: string }) | null;
      if (!response.ok) throw new Error(result?.message ?? "Could not save the role assignment.");
      if (!result) throw new Error("The role assignment was saved, but its updated details could not be read.");
      if (targetUserId === access?.userId) {
        await refreshOwnAccess();
      } else {
        await loadAssignments(0);
      }
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the role assignment.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function assignRole() {
    if (!selectedUser) return;
    const saved = await saveRoleAssignment(selectedUser.userId, role);
    if (saved) {
      setSelectedUser(null);
      setUserSearch("");
      setRole("CREATOR");
    }
  }

  async function saveEditedRole() {
    if (editingUserId == null) return;
    const saved = await saveRoleAssignment(editingUserId, editRole);
    if (saved) setEditingUserId(null);
  }

  async function deleteAssignment() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/fm/consignment/access/roles/" + pendingDelete.userId, {
        method: "DELETE",
      });
      const result = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Could not delete the role assignment.");

      const deletedUserId = pendingDelete.userId;
      const targetPage = assignments.length === 1 && assignmentPage > 0 ? assignmentPage - 1 : assignmentPage;
      setPendingDelete(null);
      if (editingUserId === deletedUserId) setEditingUserId(null);
      if (deletedUserId === access?.userId) {
        await refreshOwnAccess();
      } else {
        await loadAssignments(targetPage);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete the role assignment.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading consignment access…</div>;
  if (error && !access) return <div className="p-6 text-sm text-destructive">{error}</div>;
  if (!access?.canManageRoles) {
    return <div className="rounded-lg border p-6 text-sm text-muted-foreground">Consignment Controller or Financial Management admin access is required to manage consignment roles.</div>;
  }

  const normalizedUserSearch = userSearch.trim();

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Consignment Roles</h1>
        <p className="mt-1 text-sm text-muted-foreground">Assign one explicit consignment role to an active ERP user. Financial Management administrators can manage this page.</p>
      </div>

      <section className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="min-w-64 flex-1 space-y-1 text-sm">
          <span id="consignment-user-label" className="block">User</span>
          <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={userPickerOpen}
                aria-labelledby="consignment-user-label"
                className="w-full justify-between font-normal"
                disabled={saving || deleting}
              >
                <span className="truncate">
                  {selectedUser
                    ? selectedUser.displayName + " · " + (selectedUser.email ?? ("#" + selectedUser.userId))
                    : "Select a user"}
                </span>
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search users by name or email…"
                  value={userSearch}
                  onValueChange={setUserSearch}
                />
                <CommandList>
                  {userOptionsLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">Searching users…</div>
                  ) : userOptionsError ? (
                    <CommandEmpty>{userOptionsError}</CommandEmpty>
                  ) : users.length === 0 ? (
                    <CommandEmpty>
                      {normalizedUserSearch
                        ? "No active users match this search."
                        : "No unassigned active users found."}
                    </CommandEmpty>
                  ) : (
                    <CommandGroup>
                      {users.map((user) => (
                        <CommandItem
                          key={user.userId}
                          value={user.displayName + " " + (user.email ?? "")}
                          onSelect={() => {
                            setSelectedUser(user);
                            setUserPickerOpen(false);
                            setUserSearch("");
                          }}
                        >
                          <Check className="mr-2 size-4 opacity-0" />
                          <span className="min-w-0 truncate">
                            {user.displayName} · {user.email ?? ("#" + user.userId)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
                {userHasNext && !userOptionsLoading && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full rounded-none border-t"
                    onClick={() => void loadMoreUsers()}
                    disabled={userOptionsLoadingMore}
                  >
                    {userOptionsLoadingMore ? "Loading more users…" : "Load more users"}
                  </Button>
                )}
              </Command>
            </PopoverContent>
          </Popover>
          {userOptionsError && users.length > 0 && (
            <span role="alert" className="block text-xs text-destructive">{userOptionsError}</span>
          )}
        </div>
        <label className="w-48 space-y-1 text-sm">
          <span>Role</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={role}
            onChange={(event) => setRole(event.target.value as ConsignmentRole)}
            disabled={saving || deleting}
          >
            {ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <Button onClick={assignRole} disabled={!selectedUser || saving || deleting}>
          {saving ? "Saving…" : "Save assignment"}
        </Button>
      </section>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <section className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-medium">Active assignments</span>
          <span className="text-sm text-muted-foreground">Page {assignmentPage + 1}</span>
        </div>
        {assignments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {assignmentsLoading ? "Loading assignments…" : "No consignment roles have been assigned."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => {
                  const isEditing = editingUserId === assignment.userId;
                  return (
                    <tr key={assignment.userId} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium">{assignment.displayName}</div>
                        <div className="text-xs text-muted-foreground">{assignment.email ?? ("User #" + assignment.userId)}</div>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            className="h-9 min-w-36 rounded-md border bg-background px-2"
                            value={editRole}
                            onChange={(event) => setEditRole(event.target.value as ConsignmentRole)}
                            disabled={saving || deleting}
                            aria-label={"Role for " + assignment.displayName}
                          >
                            {ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        ) : assignment.role}
                      </td>
                      <td className="px-4 py-3">{formatConsignmentTimestamp(assignment.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void saveEditedRole()}
                                disabled={saving || deleting || editRole === assignment.role}
                              >
                                <Check className="mr-1 size-4" />
                                {saving ? "Saving…" : "Save"}
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                aria-label={"Cancel editing " + assignment.displayName}
                                onClick={() => setEditingUserId(null)}
                                disabled={saving || deleting}
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              aria-label={"Edit role for " + assignment.displayName}
                              title="Edit role"
                              onClick={() => {
                                setEditingUserId(assignment.userId);
                                setEditRole(assignment.role);
                              }}
                              disabled={saving || deleting}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            aria-label={"Delete assignment for " + assignment.displayName}
                            title="Delete assignment"
                            onClick={() => setPendingDelete(assignment)}
                            disabled={saving || deleting}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {(assignmentPage > 0 || assignmentHasNext) && (
          <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void changeAssignmentPage(assignmentPage - 1)}
              disabled={assignmentsLoading || assignmentPage === 0}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void changeAssignmentPage(assignmentPage + 1)}
              disabled={assignmentsLoading || !assignmentHasNext}
            >
              Next
            </Button>
          </div>
        )}
      </section>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {pendingDelete?.role} access for {pendingDelete?.displayName}? This role assignment will be removed, and the change will remain in the audit history.
              {pendingDelete?.role === "CONTROLLER" && (
                <span className="mt-2 block">
                  If this is the last Controller assignment, only Financial Management administrators will be able to manage Consignment roles after removal.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => void deleteAssignment()} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete assignment"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
