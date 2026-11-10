"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { OptionCombobox } from "./components/OptionCombobox";
import { RateConfigPanel } from "./components/RateConfigPanel";
import { useRateConfig } from "./hooks/useRateConfig";
import { ratesInForce, withLiveRates } from "./liveRates";
import { REFERENCE_GROUPS, type ReferenceEntry } from "./reference.data";

function matches(entry: ReferenceEntry, needle: string, groupTitle: string): boolean {
  if (!needle) return true;
  const haystack = [groupTitle, entry.key, entry.label, entry.value, entry.note ?? ""].join(" ").toLowerCase();
  return haystack.includes(needle);
}

function count(n: number): string {
  return `${n} ${n === 1 ? "entry" : "entries"}`;
}

export function RatesReferencesModule() {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const rates = useRateConfig(null);

  const companies = rates.config?.companies ?? [];
  const companyOptions = companies.map((company) => ({
    value: String(company.companyId),
    label: `${company.code} · ${company.name}`,
    searchText: `${company.code} ${company.name}`,
  }));

  // The desk anchors every calculation on 1 January of the year on screen; the reference page
  // states the same rows, so it states the same anchor.
  const year = new Date().getFullYear();
  const live = useMemo(() => ratesInForce(rates.config, year), [rates.config, year]);

  const groups = useMemo(() => {
    const resolved = withLiveRates(REFERENCE_GROUPS, live);
    return resolved.map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => matches(entry, needle, group.title)),
    }));
  }, [live, needle]);

  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
  const firstWithEntries = groups.find((group) => group.entries.length > 0)?.key ?? REFERENCE_GROUPS[0].key;
  const [picked, setPicked] = useState<string | null>(null);
  // Derived, not stored: a tab whose results the search emptied can never stay selected.
  const active =
    picked === "configuration"
      ? "configuration"
      : groups.find((group) => group.key === picked && group.entries.length > 0)
        ? picked
        : firstWithEntries;

  const scope = live?.row
    ? `Rates for ${live.companyCode}, in force from ${live.row.effectiveFrom}.`
    : rates.isLoading
      ? "Reading the rate tables."
      : `No rate version is in force for ${year}, so this page shows the statutory defaults.`;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">Rates &amp; References</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{scope}</p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <OptionCombobox
            options={companyOptions}
            value={rates.companyId == null ? "" : String(rates.companyId)}
            onChange={(value) => rates.setCompanyId(Number(value))}
            placeholder="Pick a company"
            searchPlaceholder="Search a company"
            emptyLabel="No company matches."
            className="w-full justify-between sm:w-64"
            aria-label="Company"
          />
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a rate, form or rule"
              className="pl-9"
              aria-label="Search rates and references"
            />
          </div>
        </div>
      </div>

      <Tabs value={active ?? firstWithEntries} onValueChange={setPicked} className="space-y-4">
        <TabsList className="h-auto w-full flex-nowrap justify-start overflow-x-auto">
          <TabsTrigger value="configuration" className="min-h-11 shrink-0 md:min-h-0">
            Configuration
          </TabsTrigger>
          {groups.map((group) => (
            <TabsTrigger key={group.key} value={group.key} className="min-h-11 shrink-0 md:min-h-0">
              {group.title}
              <span className="ml-1.5 tabular-nums text-[11px] text-muted-foreground">({group.entries.length})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="configuration" className="space-y-4">
          <RateConfigPanel controller={rates} />
        </TabsContent>

        {total === 0 && (
          <p className="rounded-2xl border border-border/50 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Nothing matches &ldquo;{query}&rdquo;.
          </p>
        )}

        {groups.map((group) => (
          <TabsContent key={group.key} value={group.key} className="space-y-4">
            <section
              aria-label={group.title}
              className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-indigo-500/70 bg-card shadow-sm"
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
                <span className="tabular-nums text-[11px] text-muted-foreground">{count(group.entries.length)}</span>
              </header>
              {group.entries.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nothing in {group.title} matches &ldquo;{query}&rdquo;.
                </p>
              ) : (
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
                        {entry.note && <span className="mt-0.5 block text-xs text-muted-foreground">{entry.note}</span>}
                      </dt>
                      <dd className="text-sm tabular-nums sm:text-right">{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
