"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, BarChart, Bar
} from "recharts";
import {
    BrainCircuit, ShieldAlert, Sparkles, TrendingUp, AlertTriangle, CheckCircle,
    SlidersHorizontal, X, Calendar, RefreshCw, BarChart3, HelpCircle,
    User, ArrowUpRight, DollarSign, Activity, FileWarning, Search, ChevronsUpDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { disbursementProvider } from "../providers/fetchProvider";
import { Disbursement, DashboardFilters, COADto, SupplierDto, DivisionDto, DepartmentDto } from "../types";
import { AiInsightsPanel } from "../components/AiInsightsPanel";

// Styling constants for charts
const THEME_COLORS = {
    actual: "hsl(var(--primary))",
    forecast: "hsl(262.1 83.3% 57.8%)", // purple
    amber: "hsl(47.9 95.8% 53.1%)",
    rose: "hsl(346.8 77.2% 49.8%)",
    emerald: "hsl(142.1 76.2% 36.3%)",
    indigo: "hsl(221.2 83.2% 53.3%)"
};

const PIE_COLORS = [
    THEME_COLORS.actual,
    THEME_COLORS.indigo,
    THEME_COLORS.forecast,
    THEME_COLORS.emerald,
    THEME_COLORS.rose,
    THEME_COLORS.amber,
    "hsl(173.4 80.4% 40%)", // teal
    "hsl(198.6 88.7% 48.4%)", // sky
    "hsl(25.2 95% 53.1%)"  // orange
];

interface AnomalyLog {
    id: string;
    level: "high" | "medium" | "low";
    title: string;
    description: string;
    docNo?: string;
    date?: string;
    category: "check" | "mismatch" | "shift" | "duplicate" | "compliance";
}

export default function AnalyticsSubmodule() {
    // Tab selector state
    const [activePanel, setActivePanel] = useState<"spend" | "anomalies" | "copilot">("spend");
    
    // Core data state
    const [vouchers, setVouchers] = useState<Disbursement[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filter states
    const [showFilters, setShowFilters] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [divisionFilter, setDivisionFilter] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("");
    const [coaFilter, setCoaFilter] = useState("All");
    const [typeFilter, setTypeFilter] = useState("All");

    // Lookups
    const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
    const [divisions, setDivisions] = useState<DivisionDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [coas, setCoas] = useState<COADto[]>([]);
    const [isSupplierComboOpen, setIsSupplierComboOpen] = useState(false);
    const [isCoaComboOpen, setIsCoaComboOpen] = useState(false);

    // Grouping for forecast charts
    const [forecastGroup, setForecastGroup] = useState<"division" | "department">("division");

    // Load filter lookups
    useEffect(() => {
        const loadLookups = async () => {
            try {
                const [trade, nonTrade, divs, depts, coaList] = await Promise.all([
                    disbursementProvider.getSuppliers("Trade").catch(() => []),
                    disbursementProvider.getSuppliers("Non-Trade").catch(() => []),
                    disbursementProvider.getDivisions().catch(() => []),
                    disbursementProvider.getDepartments().catch(() => []),
                    disbursementProvider.getCOAs().catch(() => [])
                ]);
                setSuppliers([...trade, ...nonTrade].sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)));
                setDivisions(divs);
                setDepartments(depts);
                setCoas(coaList);
            } catch (err) {
                console.error("Failed to load lookups", err);
            }
        };
        loadLookups();
        
        // Initialize default dates (last 90 days for better historical charts)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        setStartDate(ninetyDaysAgo.toISOString().split("T")[0]);
        setEndDate(new Date().toISOString().split("T")[0]);
    }, []);

    // Main fetch routine
    const fetchAnalyticsData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch first page of 100 to gather enough statistical data
            const res = await disbursementProvider.getDisbursements(
                0,
                100,
                typeFilter,
                supplierSearch,
                startDate,
                endDate,
                "All",
                divisionFilter,
                departmentFilter,
                ""
            );
            
            let filtered = res.content;
            
            // Client side filter matches
            if (coaFilter && coaFilter !== "All") {
                const coaId = Number(coaFilter);
                filtered = filtered.filter(item => 
                    item.payables.some(p => p.coaId === coaId) || 
                    item.payments.some(p => p.coaId === coaId)
                );
            }
            
            setVouchers(filtered);
        } catch (err) {
            console.error("Failed to load analytics data", err);
            toast.error("Failed to fetch analytics payload");
        } finally {
            setLoading(false);
        }
    }, [typeFilter, supplierSearch, startDate, endDate, divisionFilter, departmentFilter, coaFilter]);

    useEffect(() => {
        fetchAnalyticsData();
    }, [fetchAnalyticsData]);

    const handleApplyFilters = () => {
        fetchAnalyticsData();
    };

    const handleClearFilters = () => {
        setSupplierSearch("");
        setStartDate("");
        setEndDate("");
        setDivisionFilter("");
        setDepartmentFilter("");
        setCoaFilter("All");
        setTypeFilter("All");
        fetchAnalyticsData();
        toast.info("Filters reset");
    };

    // --- ANOMALY DETECTION ENGINE ---
    const anomalies = useMemo((): AnomalyLog[] => {
        const logs: AnomalyLog[] = [];
        if (vouchers.length === 0) return logs;

        // Group vouchers by payee to study historical division allocations
        const payeeDivisionsMap = new Map<string, Set<number>>();
        vouchers.forEach(v => {
            if (v.payeeName && v.divisionId) {
                if (!payeeDivisionsMap.has(v.payeeName)) {
                    payeeDivisionsMap.set(v.payeeName, new Set());
                }
                payeeDivisionsMap.get(v.payeeName)!.add(v.divisionId);
            }
        });

        // 1. Double Payments Check (Same Payee, Same Amount, within 5-day variance)
        const sortedByDate = [...vouchers].sort((a, b) => new Date(a.transactionDate || 0).getTime() - new Date(b.transactionDate || 0).getTime());
        for (let i = 0; i < sortedByDate.length; i++) {
            for (let j = i + 1; j < sortedByDate.length; j++) {
                const v1 = sortedByDate[i];
                const v2 = sortedByDate[j];

                if (v1.payeeName && v1.payeeName === v2.payeeName && Math.abs(v1.totalAmount - v2.totalAmount) < 0.01) {
                    const d1 = new Date(v1.transactionDate || 0).getTime();
                    const d2 = new Date(v2.transactionDate || 0).getTime();
                    const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);

                    if (diffDays <= 5) {
                        logs.push({
                            id: `dup-${v1.id}-${v2.id}`,
                            level: "high",
                            title: "Potential Double Payment Risk",
                            description: `Vouchers ${v1.docNo} and ${v2.docNo} both allocated ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v1.totalAmount)} to "${v1.payeeName}" within ${diffDays.toFixed(0)} days (V1: ${v1.transactionDate}, V2: ${v2.transactionDate}).`,
                            docNo: `${v1.docNo} / ${v2.docNo}`,
                            date: v2.transactionDate,
                            category: "duplicate"
                        });
                    }
                }
            }
        }

        // 2. Consecutive/Sequential Check Numbers Audit
        // Collect all checks, parse numeric part, match consecutive check sequence
        const checksList: Array<{ checkNo: number; raw: string; voucher: Disbursement; date: string }> = [];
        vouchers.forEach(v => {
            v.payments.forEach(p => {
                if (p.checkNo && p.checkNo.trim() !== "") {
                    const parsed = parseInt(p.checkNo.replace(/\D/g, ""), 10);
                    if (!isNaN(parsed)) {
                        checksList.push({
                            checkNo: parsed,
                            raw: p.checkNo,
                            voucher: v,
                            date: p.date || v.transactionDate || ""
                        });
                    }
                }
            });
        });

        // Sort checks by check number
        checksList.sort((a, b) => a.checkNo - b.checkNo);
        for (let i = 0; i < checksList.length - 1; i++) {
            const c1 = checksList[i];
            const c2 = checksList[i + 1];

            if (c2.checkNo - c1.checkNo === 1) {
                // If they are issued to different suppliers on the same date or division
                const isSamePayee = c1.voucher.payeeName === c2.voucher.payeeName;
                const isSameDay = c1.date === c2.date;
                
                if (isSamePayee && isSameDay) {
                    logs.push({
                        id: `seq-${c1.voucher.id}-${c2.voucher.id}`,
                        level: "medium",
                        title: "Consecutive Check Issuance Risk",
                        description: `Consecutive checks issued in close succession (Check ${c1.raw} and ${c2.raw}) to payee "${c1.voucher.payeeName}" on ${c1.date}. Verify if voucher splitting was used to circumvent approval limits.`,
                        docNo: `${c1.voucher.docNo} & ${c2.voucher.docNo}`,
                        date: c1.date,
                        category: "check"
                    });
                }
            }
        }

        // 3. Payment Mismatches Lacking Justification
        vouchers.forEach(v => {
            const hasMismatch = Math.abs(v.totalAmount - v.paidAmount) > 0.05 && v.paidAmount > 0;
            const remarksLength = (v.remarks || "").trim().length;
            if (hasMismatch && remarksLength < 8) {
                logs.push({
                    id: `mis-${v.id}`,
                    level: "medium",
                    title: "Unjustified Payment Mismatch",
                    description: `Voucher ${v.docNo} has a mismatch of ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Math.abs(v.totalAmount - v.paidAmount))} between Vouchered (${v.totalAmount}) and Released (${v.paidAmount}) amounts, but lacks descriptive remarks detailing why.`,
                    docNo: v.docNo,
                    date: v.transactionDate,
                    category: "mismatch"
                });
            }
        });

        // 4. Compliance Gaps (Released/Posted but no Check Number recorded)
        vouchers.forEach(v => {
            const requiresCheck = v.status === "Released" || v.status === "Posted";
            const hasCheckNo = v.payments.some(p => p.checkNo && p.checkNo.trim() !== "");
            if (requiresCheck && !hasCheckNo) {
                logs.push({
                    id: `comp-${v.id}`,
                    level: "high",
                    title: "Missing Payment Audit Trail",
                    description: `Voucher ${v.docNo} is finalized as status "${v.status}" but contains no registered Check Number lines in the payments database.`,
                    docNo: v.docNo,
                    date: v.transactionDate,
                    category: "compliance"
                });
            }
        });

        // 5. Prefix & Supplier Classification Mismatch
        vouchers.forEach(v => {
            if (v.docNo && v.payeeId) {
                const supplier = suppliers.find(s => s.id === v.payeeId);
                if (supplier) {
                    const isTradeSupplier = supplier.supplier_type === "TRADE";
                    const isTradeDoc = v.docNo.startsWith("TR-");
                    
                    if (isTradeSupplier && !isTradeDoc) {
                        logs.push({
                            id: `pref-${v.id}`,
                            level: "low",
                            title: "Supplier Classification Code Mismatch",
                            description: `Trade supplier "${v.payeeName}" is registered using document number "${v.docNo}". By guidelines, Trade payees must use "TR-" prefixes.`,
                            docNo: v.docNo,
                            date: v.transactionDate,
                            category: "shift"
                        });
                    } else if (!isTradeSupplier && isTradeDoc) {
                        logs.push({
                            id: `pref-${v.id}`,
                            level: "low",
                            title: "Supplier Classification Code Mismatch",
                            description: `Non-Trade supplier "${v.payeeName}" is registered using document number "${v.docNo}". By guidelines, Non-Trade payees must use "NT-" prefixes.`,
                            docNo: v.docNo,
                            date: v.transactionDate,
                            category: "shift"
                        });
                    }
                }
            }
        });

        // 6. Division Allocation Shift
        vouchers.forEach(v => {
            if (v.payeeName && v.divisionId) {
                const historicalDivisions = payeeDivisionsMap.get(v.payeeName);
                if (historicalDivisions && historicalDivisions.size > 1) {
                    // This supplier is booked across multiple divisions
                    // Let's see if this is an unusual booking (we look for rare divisions)
                    const countMap = new Map<number, number>();
                    vouchers.forEach(oth => {
                        if (oth.payeeName === v.payeeName && oth.divisionId) {
                            countMap.set(oth.divisionId, (countMap.get(oth.divisionId) || 0) + 1);
                        }
                    });

                    const currentCount = countMap.get(v.divisionId) || 0;
                    const totalCounts = Array.from(countMap.values()).reduce((sum, c) => sum + c, 0);

                    // If division booking represents less than 20% of supplier bookings, flag it
                    if (currentCount / totalCounts < 0.25 && totalCounts >= 4) {
                        logs.push({
                            id: `shift-${v.id}`,
                            level: "low",
                            title: "Cost Division Classification Shift",
                            description: `Payee "${v.payeeName}" is booked under division "${v.divisionName || v.divisionId}". Historically, this supplier is booked under other divisions ${Array.from(historicalDivisions).filter(id => id !== v.divisionId).map(id => divisions.find(d => d.divisionId === id)?.divisionName || id).join(", ")}.`,
                            docNo: v.docNo,
                            date: v.transactionDate,
                            category: "shift"
                        });
                    }
                }
            }
        });

        return logs.sort((a, b) => {
            const levelPriority = { high: 3, medium: 2, low: 1 };
            return levelPriority[b.level] - levelPriority[a.level];
        });
    }, [vouchers, suppliers, divisions]);

    // --- PREDICTIVE SPEND MODELING & FORECAST DATA GENERATOR ---
    const spendModelData = useMemo(() => {
        if (vouchers.length === 0) return [];

        // 1. Group actual payouts by week (using date_created or transactionDate)
        const weeklySpendMap = new Map<string, Record<string, number>>();
        
        vouchers.forEach(v => {
            const dateStr = v.transactionDate || v.dateCreated;
            if (!dateStr) return;

            const date = new Date(dateStr);
            // Get week representation (Year-W[No])
            const oneJan = new Date(date.getFullYear(), 0, 1);
            const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
            const weekNumber = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
            const weekKey = `${date.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;

            if (!weeklySpendMap.has(weekKey)) {
                weeklySpendMap.set(weekKey, {});
            }

            const groupKey = forecastGroup === "division" 
                ? (v.divisionName || "Unclassified Division") 
                : (v.departmentName || "Unclassified Department");
            
            const groupValue = weeklySpendMap.get(weekKey)!;
            groupValue[groupKey] = (groupValue[groupKey] || 0) + (v.paidAmount || v.totalAmount || 0);
            groupValue._total = (groupValue._total || 0) + (v.paidAmount || v.totalAmount || 0);
        });

        interface WeeklySpendRow {
            week: string;
            _total?: number;
            [key: string]: string | number | undefined;
        }

        // Convert map to sorted list of weeks
        const sortedWeeks = Array.from(weeklySpendMap.entries())
            .map(([week, spends]) => ({ week, ...spends } as WeeklySpendRow))
            .sort((a, b) => a.week.localeCompare(b.week));

        if (sortedWeeks.length === 0) return [];

        // 2. Perform simple linear regression to project next 4 weeks
        const n = sortedWeeks.length;
        const xValues = Array.from({ length: n }, (_, i) => i);
        const yValues = sortedWeeks.map(w => w._total || 0);

        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += xValues[i];
            sumY += yValues[i];
            sumXY += xValues[i] * yValues[i];
            sumXX += xValues[i] * xValues[i];
        }

        // Slope (m) and intercept (c) for line y = mx + c
        const denominator = (n * sumXX - sumX * sumX);
        const m = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
        const c = n > 0 ? (sumY - m * sumX) / n : 0;

        // Generate final chart rows: actual weekly spend
        const chartData = sortedWeeks.map((w, idx) => {
            const row: Record<string, unknown> = {
                name: `W${w.week.split("-W")[1]}`,
                totalSpend: w._total,
                type: "actual"
            };

            // Copy group spend properties
            Object.keys(w).forEach(k => {
                if (k !== "week" && k !== "_total") {
                    row[k] = w[k];
                }
            });

            return row;
        });

        // Add 4 forecast weeks
        const lastWeekNum = parseInt(sortedWeeks[n - 1].week.split("-W")[1], 10);
        const currentYear = new Date().getFullYear();

        // Calculate distribution percentages across categories to project division splits
        const groupTotals: Record<string, number> = {};
        let absoluteTotal = 0;
        vouchers.forEach(v => {
            const groupKey = forecastGroup === "division" 
                ? (v.divisionName || "Unclassified Division") 
                : (v.departmentName || "Unclassified Department");
            const amt = v.paidAmount || v.totalAmount || 0;
            groupTotals[groupKey] = (groupTotals[groupKey] || 0) + amt;
            absoluteTotal += amt;
        });

        const distributionPct: Record<string, number> = {};
        Object.keys(groupTotals).forEach(k => {
            distributionPct[k] = absoluteTotal > 0 ? groupTotals[k] / absoluteTotal : 0;
        });

        for (let i = 1; i <= 4; i++) {
            const forecastIndex = n - 1 + i;
            const forecastedSpend = Math.max(0, m * forecastIndex + c);
            const wNum = lastWeekNum + i;
            
            const forecastRow: Record<string, unknown> = {
                name: `W${String(wNum).padStart(2, "0")} (Forecast)`,
                forecastSpend: forecastedSpend,
                type: "forecast"
            };

            // Distribute forecasted spend proportionately
            Object.keys(distributionPct).forEach(groupKey => {
                forecastRow[groupKey] = forecastedSpend * distributionPct[groupKey];
            });

            chartData.push(forecastRow);
        }

        return chartData;
    }, [vouchers, forecastGroup]);

    // Pie chart distribution dataset
    const pieData = useMemo(() => {
        const map = new Map<string, number>();
        let total = 0;

        vouchers.forEach(v => {
            const key = forecastGroup === "division" 
                ? (v.divisionName || "Unclassified Division") 
                : (v.departmentName || "Unclassified Department");
            const amt = v.paidAmount || v.totalAmount || 0;
            map.set(key, (map.get(key) || 0) + amt);
            total += amt;
        });

        return Array.from(map.entries()).map(([name, value]) => ({
            name,
            value,
            percentage: total > 0 ? (value / total) * 100 : 0
        })).sort((a, b) => b.value - a.value);
    }, [vouchers, forecastGroup]);

    // Summary Card stats block
    const summaryAnalyticsStats = useMemo(() => {
        let totalOutflow = 0;
        vouchers.forEach(v => {
            totalOutflow += v.paidAmount || 0;
        });
        const anomalyCount = anomalies.length;
        const criticalAnomalies = anomalies.filter(a => a.level === "high").length;
        
        return {
            totalOutflow,
            anomalyCount,
            criticalAnomalies
        };
    }, [vouchers, anomalies]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP"
        }).format(val);
    };

    // AI dashboard payload helper for co-pilot panel
    const dashboardPayloadObject = useMemo(() => {
        if (vouchers.length === 0) return null;
        
        const totalDisbursed = vouchers.reduce((s, v) => s + v.totalAmount, 0);
        const totalPaid = vouchers.reduce((s, v) => s + v.paidAmount, 0);
        const totalUnpaid = Math.max(0, totalDisbursed - totalPaid);

        return {
            totalDisbursed,
            totalPaid,
            totalUnpaidPayables: totalUnpaid,
            divisionExpenses: divisions.map(div => {
                const totalExpense = vouchers
                    .filter(v => v.divisionId === div.divisionId)
                    .reduce((s, v) => s + v.paidAmount, 0);
                return {
                    divisionId: div.divisionId,
                    divisionName: div.divisionName,
                    totalExpense
                };
            }).filter(d => d.totalExpense > 0),
            paymentCoaExpenses: [],
            payableCoaExpenses: coas.map(coa => {
                const totalExpense = vouchers.reduce((sum, v) => {
                    const payableMatchSum = v.payables
                        .filter(p => p.coaId === coa.coaId)
                        .reduce((s, p) => s + p.amount, 0);
                    return sum + payableMatchSum;
                }, 0);
                return {
                    coaId: coa.coaId,
                    accountTitle: coa.accountTitle,
                    totalExpense
                };
            }).filter(c => c.totalExpense > 0),
            vouchers: vouchers.map(v => ({
                id: v.id,
                docNo: v.docNo,
                transactionDate: v.transactionDate || "",
                status: v.status,
                payeeName: v.payeeName || "N/A",
                totalAmount: v.totalAmount,
                paidAmount: v.paidAmount,
                checkNumbers: v.payments.map(p => p.checkNo).filter(Boolean).join(", "),
                bankNames: v.payments.map(p => p.accountTitle).filter(Boolean).join(", "),
                expenseAccountsHit: v.payables.map(p => p.accountTitle).filter(Boolean).join(", "),
                remarks: v.remarks
            }))
        };
    }, [vouchers, divisions, coas]);

    return (
        <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* 🌟 PAGE HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2 border-b border-border/50">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/10 flex items-center justify-center text-purple-500 shadow-[0_0_15px_-3px_rgba(168,85,247,0.2)] shrink-0">
                        <BrainCircuit className="h-6 w-6 animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                            AI Treasury & Analytics
                            <Sparkles className="w-4 h-4 text-purple-400" />
                        </h1>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Audit compliance controls, scan sequential checks, and map future cash funding needs</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchAnalyticsData}
                        disabled={loading}
                        className="h-9 px-3 text-xs font-bold uppercase tracking-wider bg-background/50 border-border/50 hover:bg-muted/50 transition-all"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5 mr-2", loading && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                            "h-9 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
                            showFilters ? "bg-muted text-foreground border-primary/25" : "border-border/50 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5 mr-2" />
                        Filters
                    </Button>
                </div>
            </div>

            {/* 🔍 COLLAPSIBLE FILTER MATRIX */}
            {showFilters && (
                <div className="bg-card rounded-xl border border-border shadow-sm p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 animate-in slide-in-from-top duration-300">
                    {/* Date limits */}
                    <div className="space-y-1.5 col-span-1 md:col-span-2">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Historical Analysis Window</Label>
                        <div className="flex items-center gap-2">
                            <Input type="date" className="h-9 text-xs font-bold uppercase bg-background border-border/50 rounded-lg px-2" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            <span className="text-[9px] font-black text-muted-foreground/50 uppercase">TO</span>
                            <Input type="date" className="h-9 text-xs font-bold uppercase bg-background border-border/50 rounded-lg px-2" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                    </div>

                    {/* Supplier search */}
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/85">Payee / Supplier</Label>
                        <Popover open={isSupplierComboOpen} onOpenChange={setIsSupplierComboOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" aria-expanded={isSupplierComboOpen} className="w-full h-9 text-xs font-bold justify-between bg-background px-3 rounded-lg border-border/50 shadow-sm">
                                    <span className="truncate uppercase text-foreground">{supplierSearch || "All Suppliers"}</span>
                                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0 shadow-xl border-border rounded-lg" align="start">
                                <Command>
                                    <CommandInput placeholder="Type supplier name..." className="h-9 text-xs font-medium" />
                                    <CommandList className="max-h-[220px]">
                                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No supplier found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem onSelect={() => { setSupplierSearch(""); setIsSupplierComboOpen(false); }} className="text-[10px] font-black uppercase text-muted-foreground cursor-pointer py-1.5">-- Clear Selection --</CommandItem>
                                            {suppliers.map((sup) => (
                                                <CommandItem key={sup.id} value={sup.supplier_name} onSelect={() => { setSupplierSearch(sup.supplier_name); setIsSupplierComboOpen(false); }} className="text-xs font-bold uppercase cursor-pointer py-1.5">
                                                    <Check className={cn("mr-2 h-3.5 w-3.5 text-primary", supplierSearch === sup.supplier_name ? "opacity-100" : "opacity-0")} />
                                                    {sup.supplier_name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* COA Filter */}
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/85">GL Account (COA)</Label>
                        <Popover open={isCoaComboOpen} onOpenChange={setIsCoaComboOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" aria-expanded={isCoaComboOpen} className="w-full h-9 text-xs font-bold justify-between bg-background px-3 rounded-lg border-border/50 shadow-sm">
                                    <span className="truncate uppercase text-foreground">
                                        {coaFilter === "All" ? "All Accounts" : coas.find(c => String(c.coaId) === coaFilter)?.accountTitle || coaFilter}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[320px] p-0 shadow-xl border-border rounded-lg" align="start">
                                <Command>
                                    <CommandInput placeholder="Search account..." className="h-9 text-xs font-medium" />
                                    <CommandList className="max-h-[220px]">
                                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No accounts found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem onSelect={() => { setCoaFilter("All"); setIsCoaComboOpen(false); }} className="text-[10px] font-black uppercase text-muted-foreground cursor-pointer py-1.5">-- Clear Selection --</CommandItem>
                                            {coas.map((c) => (
                                                <CommandItem key={c.coaId} value={`${c.glCode} ${c.accountTitle}`} onSelect={() => { setCoaFilter(String(c.coaId)); setIsCoaComboOpen(false); }} className="text-xs font-bold uppercase cursor-pointer py-1.5">
                                                    <Check className={cn("mr-2 h-3.5 w-3.5 text-primary", coaFilter === String(c.coaId) ? "opacity-100" : "opacity-0")} />
                                                    <span className="text-[10px] text-muted-foreground mr-1.5">{c.glCode}</span> {c.accountTitle}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Divisions/Departments */}
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Division / Cost Center</Label>
                        <select className="h-9 w-full rounded-lg border border-border/50 bg-background px-3 text-xs font-bold uppercase text-foreground shadow-sm focus:ring-1 focus:ring-primary/30 outline-none cursor-pointer" value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)}>
                            <option value="">All Divisions</option>
                            {divisions.map(d => (
                                <option key={d.divisionId} value={d.divisionId}>{d.divisionName}</option>
                            ))}
                        </select>
                    </div>

                    {/* Voucher Type */}
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Voucher Type</Label>
                        <select className="h-9 w-full rounded-lg border border-border/50 bg-background px-3 text-xs font-bold uppercase text-foreground shadow-sm focus:ring-1 focus:ring-primary/30 outline-none cursor-pointer" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                            <option value="All">All Types</option>
                            <option value="Trade">Trade</option>
                            <option value="Non-Trade">Non-Trade</option>
                        </select>
                    </div>

                    <div className="col-span-1 md:col-span-6 flex justify-end gap-2 pt-2 border-t border-border/20">
                        <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs font-bold uppercase text-rose-500 hover:bg-rose-500/10">Reset Filters</Button>
                        <Button size="sm" onClick={handleApplyFilters} className="text-xs font-black uppercase bg-foreground text-background hover:bg-foreground/90">Apply Search</Button>
                    </div>
                </div>
            )}

            {/* 📊 SUMMARY DECK */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 rounded-xl border border-border flex items-center justify-between bg-card">
                    <div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Active Outflow Sample</span>
                        <div className="text-2xl font-black text-foreground mt-1.5">{formatCurrency(summaryAnalyticsStats.totalOutflow)}</div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">Sum of release transactions</p>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
                        <DollarSign className="w-5 h-5 animate-pulse" />
                    </div>
                </Card>

                <Card className="p-4 rounded-xl border border-border flex items-center justify-between bg-card">
                    <div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Vouchers Scanned</span>
                        <div className="text-2xl font-black text-foreground mt-1.5">{vouchers.length}</div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">Data registry count</p>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500">
                        <Activity className="w-5 h-5" />
                    </div>
                </Card>

                <Card className={cn(
                    "p-4 rounded-xl border flex items-center justify-between transition-colors",
                    summaryAnalyticsStats.criticalAnomalies > 0 
                        ? "border-rose-500/30 bg-rose-500/[0.02]" 
                        : "border-border bg-card"
                )}>
                    <div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Anomaly Warnings</span>
                        <div className={cn(
                            "text-2xl font-black mt-1.5",
                            summaryAnalyticsStats.criticalAnomalies > 0 ? "text-rose-500" : "text-foreground"
                        )}>
                            {summaryAnalyticsStats.anomalyCount}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">High Severity:</span>
                            <Badge className={cn(
                                "px-1.5 py-0 h-4 text-[8px] font-black",
                                summaryAnalyticsStats.criticalAnomalies > 0 ? "bg-rose-500 text-white" : "bg-muted text-muted-foreground"
                            )}>
                                {summaryAnalyticsStats.criticalAnomalies} CRITICAL
                            </Badge>
                        </div>
                    </div>
                    <div className={cn(
                        "p-3 rounded-xl",
                        summaryAnalyticsStats.criticalAnomalies > 0 ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                    )}>
                        <FileWarning className="w-5 h-5" />
                    </div>
                </Card>
            </div>

            {/* 📊 TABS PANEL */}
            <div className="flex flex-col gap-4">
                <Tabs value={activePanel} onValueChange={(val) => setActivePanel(val as "spend" | "anomalies" | "copilot")} className="w-full">
                    <TabsList className="bg-muted/50 p-1 rounded-xl h-10 shadow-inner w-full max-w-[500px] grid grid-cols-3">
                        <TabsTrigger value="spend" className="rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" /> Spend Model
                        </TabsTrigger>
                        <TabsTrigger value="anomalies" className="rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" /> Anomalies ({anomalies.length})
                        </TabsTrigger>
                        <TabsTrigger value="copilot" className="rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                            <BrainCircuit className="w-3.5 h-3.5" /> Co-Pilot
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {loading ? (
                    <div className="bg-card border border-border shadow-sm rounded-xl min-h-[420px] flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                        <span className="text-xs font-bold uppercase text-muted-foreground tracking-widest animate-pulse">Running AI scans and projections...</span>
                    </div>
                ) : activePanel === "spend" ? (
                    /* PANEL 1: PREDICTIVE SPEND MODELING */
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Forecast Area Chart */}
                        <Card className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
                            <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest">Spend Trend & 4-Week Cash Forecast</CardTitle>
                                    <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Historical weekly payout compared against forecasted funding needs</CardDescription>
                                </div>
                                <Tabs value={forecastGroup} onValueChange={(val) => setForecastGroup(val as "division" | "department")} className="w-[200px]">
                                    <TabsList className="bg-muted p-0.5 h-8 w-full grid grid-cols-2 rounded-lg">
                                        <TabsTrigger value="division" className="rounded-md text-[9px] font-black uppercase py-1 h-7">Division</TabsTrigger>
                                        <TabsTrigger value="department" className="rounded-md text-[9px] font-black uppercase py-1 h-7">Dept</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </CardHeader>
                            <CardContent className="p-0 h-[320px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={spendModelData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={THEME_COLORS.actual} stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor={THEME_COLORS.actual} stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={THEME_COLORS.forecast} stopOpacity={0.25}/>
                                                <stop offset="95%" stopColor={THEME_COLORS.forecast} stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.4)" />
                                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} />
                                        <YAxis 
                                            stroke="hsl(var(--muted-foreground))" 
                                            fontSize={9} 
                                            tickLine={false} 
                                            axisLine={false} 
                                            tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`}
                                        />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "10px" }}
                                            formatter={(value: number) => [formatCurrency(value), "Funding Required"]}
                                        />
                                        {/* Dynamic Category Plots */}
                                        {pieData.map((d, index) => (
                                            <Area 
                                                key={d.name}
                                                type="monotone" 
                                                dataKey={d.name} 
                                                stackId="1"
                                                stroke={PIE_COLORS[index % PIE_COLORS.length]} 
                                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                                                fillOpacity={0.08}
                                                strokeWidth={1.5}
                                            />
                                        ))}
                                        {/* Total Summary Overlays */}
                                        <Area 
                                            type="monotone" 
                                            dataKey="totalSpend" 
                                            name="Historical Payouts"
                                            stroke={THEME_COLORS.actual} 
                                            fill="url(#colorSpend)" 
                                            strokeWidth={3} 
                                            activeDot={{ r: 6 }} 
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="forecastSpend" 
                                            name="Forecast Outflow"
                                            stroke={THEME_COLORS.forecast} 
                                            strokeDasharray="4 4"
                                            fill="url(#colorForecast)" 
                                            strokeWidth={3} 
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Pie Chart Cost Breakdown */}
                        <Card className="rounded-xl border border-border bg-card p-5">
                            <CardHeader className="p-0 pb-4">
                                <CardTitle className="text-sm font-black uppercase tracking-widest">Share Distribution</CardTitle>
                                <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Proportionate breakdown of expenses by category</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0 flex flex-col justify-between h-[320px]">
                                {pieData.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs font-bold py-12">
                                        No cost data for pie distribution
                                    </div>
                                ) : (
                                    <>
                                        <div className="h-[180px] w-full relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={45}
                                                        outerRadius={70}
                                                        paddingAngle={3}
                                                        dataKey="value"
                                                    >
                                                        {pieData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "10px" }}
                                                        formatter={(value: number) => formatCurrency(value)}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Largest Segment</span>
                                                <span className="text-xs font-black text-foreground truncate max-w-[110px] text-center mt-0.5">{pieData[0]?.name}</span>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto scrollbar-none pr-1 space-y-2 mt-4 max-h-[120px]">
                                            {pieData.map((d, index) => (
                                                <div key={d.name} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                                                        <span className="font-bold text-foreground truncate uppercase text-[10px]">{d.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 ml-2 shrink-0">
                                                        <span className="font-semibold text-muted-foreground text-[10px]">{d.percentage.toFixed(1)}%</span>
                                                        <span className="font-black text-foreground text-[10px]">{formatCurrency(d.value)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : activePanel === "anomalies" ? (
                    /* PANEL 2: AUDIT & ANOMALY LISTINGS */
                    <div className="grid grid-cols-1 gap-4">
                        <Card className="rounded-xl border border-border bg-card">
                            <CardHeader className="border-b border-border/50 py-4 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-1.5 text-foreground">
                                        Active Audit Findings
                                        <Badge className="bg-primary/10 hover:bg-primary/10 text-primary border-primary/25 px-2 font-black py-0 h-5 text-[9px]">
                                            {anomalies.length} ISSUES SCANNING
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Automated heuristics scans verifying check logs, classification shifts, and payment limits</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3 min-h-[300px]">
                                {anomalies.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
                                        <CheckCircle className="w-10 h-10 text-emerald-500/50" />
                                        <span className="text-xs font-black uppercase tracking-widest text-emerald-400">All checks cleared: No anomalies flagged</span>
                                    </div>
                                ) : (
                                    anomalies.map((a) => (
                                        <div 
                                            key={a.id} 
                                            className={cn(
                                                "p-4 rounded-xl border flex gap-4 items-start transition-all",
                                                a.level === "high" 
                                                    ? "bg-rose-500/[0.02] border-rose-500/20 hover:bg-rose-500/[0.04]" 
                                                    : a.level === "medium" 
                                                    ? "bg-amber-500/[0.02] border-amber-500/20 hover:bg-amber-500/[0.04]" 
                                                    : "bg-muted/10 border-border/50 hover:bg-muted/20"
                                            )}
                                        >
                                            <div className={cn(
                                                "p-2 rounded-lg shrink-0 mt-0.5",
                                                a.level === "high" 
                                                    ? "bg-rose-500/10 text-rose-500" 
                                                    : a.level === "medium" 
                                                    ? "bg-amber-500/10 text-amber-500" 
                                                    : "bg-blue-500/10 text-blue-500"
                                            )}>
                                                {a.level === "high" ? (
                                                    <ShieldAlert className="w-4 h-4" />
                                                ) : (
                                                    <AlertTriangle className="w-4 h-4" />
                                                )}
                                            </div>

                                            <div className="flex-1 space-y-1">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <h4 className="text-xs font-black uppercase text-foreground">{a.title}</h4>
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge className={cn(
                                                            "px-1.5 py-0 h-4 text-[7px] font-black uppercase tracking-wider",
                                                            a.level === "high" 
                                                                ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                                                                : a.level === "medium" 
                                                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                                                                : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                                        )}>
                                                            {a.level} severity
                                                        </Badge>
                                                        <Badge variant="outline" className="px-1.5 py-0 h-4 text-[7px] font-black uppercase tracking-wider">
                                                            {a.category}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground leading-relaxed font-medium">{a.description}</p>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-black text-muted-foreground/80 uppercase pt-1">
                                                    {a.docNo && (
                                                        <span>Voucher: <span className="text-foreground">{a.docNo}</span></span>
                                                    )}
                                                    {a.date && (
                                                        <span>Date: <span className="text-foreground">{new Date(a.date).toLocaleDateString()}</span></span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    /* PANEL 3: AI CO-PILOT CHAT SCREEN */
                    <AiInsightsPanel 
                        data={dashboardPayloadObject} 
                        isLoading={loading} 
                    />
                )}
            </div>
        </div>
    );
}
