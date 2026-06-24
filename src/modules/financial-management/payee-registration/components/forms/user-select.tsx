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
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PayeeUser } from "../../hooks/usePayeeUsers";

interface UserSelectProps {
  users: PayeeUser[];
  loading: boolean;
  onSelect: (user: PayeeUser) => void;
}

export function UserSelect({ users, loading, onSelect }: UserSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedValue, setSelectedValue] = useState("");

  const selectedUser = users.find((u) => String(u.id || u.user_id || u.userId) === selectedValue);
  const selectedName = selectedUser 
    ? `${selectedUser.firstName || selectedUser.user_fname || ""} ${selectedUser.lastName || selectedUser.user_lname || ""}`.trim()
    : "";

  const visibleUsers = users.filter((u) => {
    const name = `${u.firstName || u.user_fname || ""} ${u.lastName || u.user_lname || ""}`.trim().toLowerCase();
    const dept = (u.department_name || "").toLowerCase();
    const term = query.toLowerCase();
    return name.includes(term) || dept.includes(term);
  });

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setQuery("");
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
            onValueChange={setQuery}
            placeholder="Search users..."
          />
          <CommandList 
            className="max-h-64 overflow-y-auto"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <CommandEmpty>{loading ? "Loading..." : "No users found."}</CommandEmpty>
            <CommandGroup>
              {visibleUsers.map((u) => {
                const id = String(u.id || u.user_id || u.userId);
                const name = `${u.firstName || u.user_fname || ""} ${u.lastName || u.user_lname || ""}`.trim();
                return (
                  <CommandItem
                    key={id}
                    value={name}
                    onSelect={() => {
                      onSelect(u);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 flex-shrink-0",
                        "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{name}</span>
                      {u.department_name && (
                        <span className="text-xs text-muted-foreground">
                          {u.department_name}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
