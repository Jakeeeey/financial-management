import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountManagementFormValues } from "../types";
import { sanitizeMobileNumber } from "./utils";

type TextFieldProps = {
  id: keyof AccountManagementFormValues;
  label: string;
  value: string;
  disabled?: boolean;
  required?: boolean;
  type?: string;
  error?: string;
  inputMode?: "numeric" | "text" | "email" | "decimal";
  maxLength?: number;
  pattern?: string;
  onChange: (id: keyof AccountManagementFormValues, value: string) => void;
};

export function RequiredMark() {
  return <span className="text-destructive">*</span>;
}

export function FieldError({ message }: { message?: string | null }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

export function TextField({
  id,
  label,
  value,
  disabled,
  required,
  type = "text",
  error,
  inputMode,
  maxLength,
  pattern,
  onChange,
}: TextFieldProps) {
  return (
    <div className="grid gap-1.5" data-invalid={Boolean(error) || undefined}>
      <Label htmlFor={id}>
        {label} {required ? <RequiredMark /> : null}
      </Label>
      <Input
        id={id}
        value={value}
        type={type}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        inputMode={inputMode}
        maxLength={maxLength}
        pattern={pattern}
        onBeforeInput={(event) => {
          if (id !== "mobileNo") return;

          const data = (event.nativeEvent as InputEvent).data;
          if (data && /\D/.test(data)) event.preventDefault();
        }}
        onPaste={(event) => {
          if (id !== "mobileNo") return;

          event.preventDefault();
          const target = event.currentTarget;
          const start = target.selectionStart ?? value.length;
          const end = target.selectionEnd ?? value.length;
          const pasted = event.clipboardData.getData("text");

          onChange(
            id,
            sanitizeMobileNumber(
              `${value.slice(0, start)}${pasted}${value.slice(end)}`,
            ),
          );
        }}
        onChange={(event) => onChange(id, event.target.value)}
      />
      <FieldError message={error} />
    </div>
  );
}
