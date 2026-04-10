import * as React from "react";
import { Search, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

/**
 * Filter item container to maintain consistent 4-per-row layout
 * while allowing items to grow and fill empty space.
 */
const FilterItem = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`space-y-2 flex-grow basis-[calc(25%-1rem)] min-w-[250px] ${className}`}>
    {children}
  </div>
);

export function TrialBalanceFilters() {
  const [periodType, setPeriodType] = React.useState("manual");

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Filters</h3>
        <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground">
          <RotateCcw className="h-4 w-4" />
          Reset Filters
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        {/* Search Bar */}
        <FilterItem>
          <Label htmlFor="search">Quick Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search account code or title..."
              className="pl-9 rounded-lg"
            />
          </div>
        </FilterItem>

        {/* Period Type */}
        <FilterItem>
          <Label>Period Type</Label>
          <Select value={periodType} onValueChange={setPeriodType}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annually">Annually</SelectItem>
            </SelectContent>
          </Select>
        </FilterItem>

        {/* Conditional Date Filters */}
        {periodType === "manual" && (
          <>
            <FilterItem>
              <Label>Date From</Label>
              <Input type="date" className="rounded-lg" defaultValue="2026-03-01" />
            </FilterItem>
            <FilterItem>
              <Label>Date To</Label>
              <Input type="date" className="rounded-lg" defaultValue="2026-03-31" />
            </FilterItem>
          </>
        )}

        {(periodType === "monthly" || periodType === "quarterly" || periodType === "annually") && (
          <FilterItem>
            <Label>Year</Label>
            <Select defaultValue="2026">
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
              </SelectContent>
            </Select>
          </FilterItem>
        )}

        {periodType === "monthly" && (
          <FilterItem>
            <Label>Month</Label>
            <Select defaultValue="03">
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, idx) => (
                  <SelectItem key={month} value={String(idx + 1).padStart(2, "0")}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterItem>
        )}

        {periodType === "quarterly" && (
          <FilterItem>
            <Label>Quarter</Label>
            <Select defaultValue="q1">
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Select Quarter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="q1">Q1 (Jan - Mar)</SelectItem>
                <SelectItem value="q2">Q2 (Apr - Jun)</SelectItem>
                <SelectItem value="q3">Q3 (Jul - Sep)</SelectItem>
                <SelectItem value="q4">Q4 (Oct - Dec)</SelectItem>
              </SelectContent>
            </Select>
          </FilterItem>
        )}

        {/* Standard Filters */}
        <FilterItem>
          <Label>Branch</Label>
          <Select defaultValue="all">
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              <SelectItem value="cebu">Cebu</SelectItem>
              <SelectItem value="manila">Manila</SelectItem>
              <SelectItem value="davao">Davao</SelectItem>
            </SelectContent>
          </Select>
        </FilterItem>

        <FilterItem>
          <Label>Account Type</Label>
          <Select defaultValue="all">
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="asset">Assets</SelectItem>
              <SelectItem value="liability">Liabilities</SelectItem>
              <SelectItem value="equity">Equity</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
            </SelectContent>
          </Select>
        </FilterItem>

        <FilterItem>
          <Label>Status</Label>
          <Select defaultValue="all">
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="unposted">Unposted</SelectItem>
            </SelectContent>
          </Select>
        </FilterItem>

        <FilterItem>
          <Label>Review Flag</Label>
          <Select defaultValue="all">
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="All Flags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Flags</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High Attention</SelectItem>
              <SelectItem value="critical">Critical Anomaly</SelectItem>
            </SelectContent>
          </Select>
        </FilterItem>
      </div>
    </div>
  );
}
