import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export type CreateOptionMatch = {
  value: string;
  kind: "duplicate" | "similar";
};

type CreateOptionDialogProps = {
  open: boolean;
  value: string | null;
  matches: CreateOptionMatch[];
  saving: boolean;
  noun: string;
  pluralNoun: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function CreateOptionDialog({
  open,
  value,
  matches,
  saving,
  noun,
  pluralNoun,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: CreateOptionDialogProps) {
  const hasDuplicate = matches.some((match) => match.kind === "duplicate");
  const hasSimilar = matches.some((match) => match.kind === "similar");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {hasDuplicate
              ? `${titleCase(noun)} already exists`
              : hasSimilar
                ? `Similar ${pluralNoun} found`
                : `Add ${noun}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasDuplicate || hasSimilar
              ? `Review the existing ${pluralNoun} before adding "${value}".`
              : `Are you sure you want to add "${value}" to the ${pluralNoun} list?`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {matches.length > 0 ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="mb-2 font-medium">Existing matches</p>
            <ul className="grid gap-1">
              {matches.map((match) => (
                <li key={`${match.kind}-${match.value}`} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{match.value}</span>
                  <Badge variant={match.kind === "duplicate" ? "destructive" : "secondary"}>
                    {match.kind === "duplicate" ? "Duplicate" : "Similar"}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={saving}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
