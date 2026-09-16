import { useState } from "react";
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
import { Check, ChevronsUpDown, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PayeeUser } from "../../hooks/usePayeeUsers";

interface UserSelectProps {
  users: PayeeUser[];
  loading: boolean;
  error?: string | null;
  hasMore?: boolean;
  onSearch?: (query: string) => void;
  onLoadMore?: () => void;
  onRetry?: () => void;
  onSelect: (user: PayeeUser) => void;
}

export function UserSelect({
  users,
  loading,
  error,
  hasMore = false,
  onSearch,
  onLoadMore,
  onRetry,
  onSelect,
}: UserSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedValue, setSelectedValue] = useState("");
  const [selectedUser, setSelectedUser] = useState<PayeeUser | null>(null);

  const selectedName = selectedUser
    ? `${selectedUser.firstName || selectedUser.user_fname || ""} ${selectedUser.lastName || selectedUser.user_lname || ""}`.trim()
    : "";

  const visibleUsers = users;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setQuery("");
          onSearch?.("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={loading}
          className={cn("w-full justify-between font-normal", !selectedValue && "text-muted-foreground")}
        >
          {selectedName || (loading ? "Loading users..." : "Select a user...")}
          {loading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-70" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={(value) => {
              setQuery(value);
              onSearch?.(value);
            }}
            placeholder="Search users..."
          />
          <CommandList 
            className="max-h-64 overflow-y-auto"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            {error ? (
              <div className="flex flex-col items-center gap-2 px-4 py-5 text-center text-xs text-muted-foreground">
                <p>{error}</p>
                {onRetry && (
                  <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Retry
                  </Button>
                )}
              </div>
            ) : (
              <CommandEmpty>{loading ? "Loading..." : "No eligible users found."}</CommandEmpty>
            )}
            <CommandGroup>
              {visibleUsers.map((u) => {
                const id = String(u.id ?? u.user_id ?? u.userId);
                const name = `${u.firstName || u.user_fname || ""} ${u.lastName || u.user_lname || ""}`.trim();
                const email = u.email || u.user_email || "";
                const isAlreadyRegistered = Boolean(u.existingPayee);
                return (
                  <CommandItem
                    key={id}
                    value={id}
                    disabled={isAlreadyRegistered}
                    onSelect={() => {
                      if (isAlreadyRegistered) return;
                      setSelectedValue(id);
                      setSelectedUser(u);
                      setOpen(false);
                      onSelect(u);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", selectedValue === id ? "opacity-100" : "opacity-0")}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{name || email || `User #${id}`}</p>
                      {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
                    </div>
                    {isAlreadyRegistered && (
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                        Already registered
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {hasMore && onLoadMore && (
              <div className="border-t p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={loading}
                  onClick={onLoadMore}
                >
                  {loading ? "Loading..." : "Load more users"}
                </Button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
