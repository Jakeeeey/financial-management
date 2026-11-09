"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { REFERENCE_GROUPS, type ReferenceEntry } from "./reference.data";

function matches(entry: ReferenceEntry, needle: string): boolean {
  if (!needle) return true;
  const haystack = [entry.key, entry.label, entry.value, entry.note ?? ""].join(" ").toLowerCase();
  return haystack.includes(needle);
}

export function RatesReferencesModule() {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const groups = useMemo(
    () =>
      REFERENCE_GROUPS.map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => matches(entry, needle)),
      })),
    [needle],
  );

  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
  const firstWithEntries = groups.find((group) => group.entries.length > 0)?.key ?? REFERENCE_GROUPS[0].key;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-2 sm:p-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold sm:text-2xl">Rates &amp; References</h1>
        <p className="mt-1 text-sm text-muted-foreground">Estimates for review; filing stays with the CPA.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a rate, form or rule"
          className="pl-9"
          aria-label="Search rates and references"
        />
      </div>

      {total === 0 ? (
        <p className="rounded-2xl border border-border/50 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Nothing matches &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <Tabs key={firstWithEntries} defaultValue={firstWithEntries} className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start">
            {groups.map((group) => (
              <TabsTrigger
                key={group.key}
                value={group.key}
                disabled={group.entries.length === 0}
                className="min-h-11 md:min-h-0"
              >
                {group.title}
                <span className="ml-1.5 tabular-nums text-[11px] text-muted-foreground">
                  ({group.entries.length})
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {groups.map((group) => (
            <TabsContent key={group.key} value={group.key} className="space-y-4">
              <section
                aria-label={group.title}
                className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-indigo-500/70 bg-card shadow-sm"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
                  <h2 className="text-sm font-semibold">{group.title}</h2>
                  <span className="tabular-nums text-[11px] text-muted-foreground">
                    {group.entries.length} entries
                  </span>
                </header>
                <dl className="divide-y divide-border/50">
                  {group.entries.map((entry) => (
                    <div
                      key={entry.key}
                      className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
                    >
                      <dt className="min-w-0">
                        <span className="block truncate text-sm font-medium" title={entry.label}>
                          {entry.label}
                        </span>
                        {entry.note && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">{entry.note}</span>
                        )}
                      </dt>
                      <dd className="text-sm tabular-nums sm:text-right">{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
