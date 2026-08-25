import { statusLabel, statusColor } from "../utils/types";

export function POStatusBadge({ status }: { status?: number | string | null }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(status)}`}>
      {statusLabel(status)}
    </span>
  );
}
