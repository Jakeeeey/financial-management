import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { statusLabel, statusTone, toneClass } from "../constants";

/**
 * The single status chip for Bank Management V2.
 *
 * DESIGN.md routes every status through one semantic helper, so lanes pass a stored
 * status value and never a colour.
 */
export function StatusBadge({ status, label, className }: {
  status: string;
  label?: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("max-w-full truncate text-[11px] font-semibold", toneClass(statusTone(status)), className)}
    >
      {label ?? statusLabel(status)}
    </Badge>
  );
}
