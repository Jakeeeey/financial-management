import type { ReactNode } from "react";

interface HighlightedTextProps {
  value: string | null | undefined;
  query?: string;
  fallback?: string;
}

interface TextPart {
  value: string;
  highlighted: boolean;
}

function splitMatches(value: string, query: string): TextPart[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [{ value, highlighted: false }];

  const parts: TextPart[] = [];
  const normalizedValue = value.toLocaleLowerCase();
  let cursor = 0;

  while (cursor < value.length) {
    const matchStart = normalizedValue.indexOf(normalizedQuery, cursor);
    if (matchStart < 0) {
      parts.push({ value: value.slice(cursor), highlighted: false });
      break;
    }

    if (matchStart > cursor) {
      parts.push({ value: value.slice(cursor, matchStart), highlighted: false });
    }

    const matchEnd = matchStart + normalizedQuery.length;
    parts.push({ value: value.slice(matchStart, matchEnd), highlighted: true });
    cursor = matchEnd;
  }

  return parts;
}

export function HighlightedText({ value, query = "", fallback = "N/A" }: HighlightedTextProps): ReactNode {
  const text = value || fallback;
  if (!value || !query.trim()) return text;

  return splitMatches(value, query).map((part, index) => (
    part.highlighted ? (
      <mark
        key={`${part.value}-${index}`}
        className="rounded-sm bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/30"
      >
        {part.value}
      </mark>
    ) : (
      <span key={`${part.value}-${index}`}>{part.value}</span>
    )
  ));
}
