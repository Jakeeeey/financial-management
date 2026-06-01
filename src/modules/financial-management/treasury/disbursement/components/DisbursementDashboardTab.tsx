"use client";

import React, { useState, useMemo } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
    Search, Loader2, TrendingDown, CreditCard, AlertCircle, FileText,
    Building2, Wallet, CalendarDays, PieChart
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDisbursementDashboard } from "../hooks/useDisbursementDashboard";
import { VoucherSummary } from "../types";

export function DisbursementDashboardTab() {
    const { data, filters, setFilters, isLoading, handleApplyFilters } = useDisbursementDashboard();
    const [selectedVoucher, setSelectedVoucher] = useState<VoucherSummary | null>(null);

    const formatMoney = (amount: number) => `₱${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // 🚀 FIX: Prevent chart overlap by only taking the Top 10 highest expenses
    const topCoaExpenses = useMemo(() => {
        return (data?.coaExpenses || []).slice(0, 10);
    }, [data?.coaExpenses]);

    const topDivisionExpenses = useMemo(() => {
        return (data?.divisionExpenses || []).slice(0, 10);
    }, [data?.divisionExpenses]);

    // 🚀 FIX: Smart text truncator for the Y-Axis
    const truncateText = (text: string, maxLength: number = 22) => {
        if (!text) return "";
        return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
    };

    const handleQuickRange = (range: string) => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (range) {
            case "today":
                break;
            case "this_week":
                start.setDate(today.getDate() - today.getDay());
                break;
            case "this_month":
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case "this_year":
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today.getFullYear(), 11, 31);
                break;
            case "all_time":
                start = new Date(2020, 0, 1);
                end = new Date(today.getFullYear() + 1, 11, 31);
                break;
            default: return;
        }

        setFilters({
            ...filters,
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0]
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 1. PREMIUM FILTER BAR */}
            <Card className="shadow-sm border-border/50 bg-card rounded-2xl overflow-hidden">
                <CardContent className="p-5 flex flex-wrap gap-5 items-end bg-muted/10">

                    <div className="space-y-1.5 flex-1 min-w-[140px]">
                        <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-primary"/> Quick Range
                        </label>
                        <Select onValueChange={handleQuickRange}>
                            <SelectTrigger className="h-10 text-xs font-bold uppercase bg-background shadow-sm border-border/50"><SelectValue placeholder="Custom" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="today" className="text-xs font-bold uppercase">Today</SelectItem>
                                <SelectItem value="this_week" className="text-xs font-bold uppercase">This Week</SelectItem>
                                <SelectItem value="this_month" className="text-xs font-bold uppercase">This Month</SelectItem>
                                <SelectItem value="this_year" className="text-xs font-bold uppercase">This Year</SelectItem>
                                <SelectItem value="all_time" className="text-xs font-bold uppercase">All Time</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-[140px]">
                        <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Start Date</label>
                        <Input type="date" className="h-10 text-xs font-bold uppercase bg-background shadow-sm border-border/50" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-[140px]">
                        <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">End Date</label>
                        <Input type="date" className="h-10 text-xs font-bold uppercase bg-background shadow-sm border-border/50" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-[140px]">
                        <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Trans Type</label>
                        <Select value={filters.transactionType?.toString() || "ALL"} onValueChange={(val) => setFilters({ ...filters, transactionType: val === "ALL" ? "" : Number(val) })}>
                            <SelectTrigger className="h-10 text-xs font-bold uppercase bg-background shadow-sm border-border/50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL" className="text-xs font-bold uppercase">All Types</SelectItem>
                                <SelectItem value="1" className="text-xs font-bold uppercase text-blue-600">Trade</SelectItem>
                                <SelectItem value="2" className="text-xs font-bold uppercase text-purple-600">Non-Trade</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-[160px]">
                        <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Status</label>
                        <Select value={filters.status} onValueChange={(val) => setFilters({ ...filters, status: val })}>
                            <SelectTrigger className="h-10 text-xs font-bold uppercase bg-background shadow-sm border-border/50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL" className="text-xs font-bold uppercase text-primary">Valid Outflows</SelectItem>
                                <SelectItem value="Released" className="text-xs font-bold uppercase">Released Only</SelectItem>
                                <SelectItem value="Posted" className="text-xs font-bold uppercase">Posted Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button onClick={handleApplyFilters} disabled={isLoading} className="h-10 px-8 text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md hover:shadow-lg rounded-xl">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                        Generate
                    </Button>
                </CardContent>
            </Card>

            {/* 2. KPI METRIC CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-sm border-none bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-blue-700/70 dark:text-blue-400/70 flex items-center justify-between">
                            Total Disbursed <TrendingDown className="w-4 h-4 text-blue-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-blue-700 dark:text-blue-400">{formatMoney(data?.totalDisbursed || 0)}</div>
                        <p className="text-[10px] uppercase font-bold text-blue-700/50 dark:text-blue-400/50 mt-1 tracking-widest">Total Voucher Amount</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-none bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-emerald-700/70 dark:text-emerald-400/70 flex items-center justify-between">
                            Total Paid <CreditCard className="w-4 h-4 text-emerald-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{formatMoney(data?.totalPaid || 0)}</div>
                        <p className="text-[10px] uppercase font-bold text-emerald-700/50 dark:text-emerald-400/50 mt-1 tracking-widest">Actual Cash Outflow</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-none bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-orange-700/70 dark:text-orange-400/70 flex items-center justify-between">
                            Unpaid Payables <AlertCircle className="w-4 h-4 text-orange-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-orange-700 dark:text-orange-400">{formatMoney(data?.totalUnpaidPayables || 0)}</div>
                        <p className="text-[10px] uppercase font-bold text-orange-700/50 dark:text-orange-400/50 mt-1 tracking-widest">Pending Settlement</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* 3. 🚀 DYNAMIC CHART: EXPENSE DISTRIBUTION (Tabs for COA vs Division) */}
                <Card className="xl:col-span-1 shadow-sm flex flex-col rounded-2xl border-border/50">
                    <CardHeader className="border-b bg-muted/10 pb-4">
                        <CardTitle className="text-sm font-black uppercase text-foreground flex items-center gap-2">
                            <PieChart className="w-4 h-4 text-primary" /> Expense Analysis
                        </CardTitle>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Top 10 Breakdown of recorded payables</p>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 min-h-[420px] flex flex-col">
                        <Tabs defaultValue="account" className="w-full h-full flex flex-col">
                            <TabsList className="w-full rounded-none border-b bg-transparent h-12">
                                <TabsTrigger value="account" className="flex-1 data-[state=active]:border-b-2 border-primary rounded-none h-full font-bold uppercase text-[10px] tracking-widest">
                                    By GL Account
                                </TabsTrigger>
                                <TabsTrigger value="division" className="flex-1 data-[state=active]:border-b-2 border-primary rounded-none h-full font-bold uppercase text-[10px] tracking-widest">
                                    By Division
                                </TabsTrigger>
                            </TabsList>

                            {/* CHART A: BY COA */}
                            <TabsContent value="account" className="flex-1 p-4 m-0">
                                {topCoaExpenses.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={topCoaExpenses} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--muted))" />
                                            <XAxis type="number" tickFormatter={(val) => `₱${val/1000}k`} className="text-[9px] font-bold" />
                                            {/* 🚀 FIX: Increased width to 140 and added tick formatter */}
                                            <YAxis dataKey="accountTitle" type="category" className="text-[9px] font-bold uppercase" width={140} tickFormatter={(val) => truncateText(val, 20)} tick={{fill: 'hsl(var(--foreground))'}} />
                                            <Tooltip
                                                formatter={(value: number) => [formatMoney(value), "Expense"]}
                                                labelFormatter={(label) => <span className="font-black uppercase text-xs">{label}</span>}
                                                cursor={{fill: 'hsl(var(--muted))'}}
                                                contentStyle={{ borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}
                                            />
                                            <Bar dataKey="totalExpense" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No GL Data Available</div>
                                )}
                            </TabsContent>

                            {/* CHART B: BY DIVISION */}
                            <TabsContent value="division" className="flex-1 p-4 m-0">
                                {topDivisionExpenses.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={topDivisionExpenses} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--muted))" />
                                            <XAxis type="number" tickFormatter={(val) => `₱${val/1000}k`} className="text-[9px] font-bold" />
                                            {/* 🚀 FIX: Increased width to 140 and added tick formatter */}
                                            <YAxis dataKey="divisionName" type="category" className="text-[9px] font-bold uppercase" width={140} tickFormatter={(val) => truncateText(val, 20)} tick={{fill: 'hsl(var(--foreground))'}} />
                                            <Tooltip
                                                formatter={(value: number) => [formatMoney(value), "Expense"]}
                                                labelFormatter={(label) => <span className="font-black uppercase text-xs">{label}</span>}
                                                cursor={{fill: 'hsl(var(--muted))'}}
                                                contentStyle={{ borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}
                                            />
                                            <Bar dataKey="totalExpense" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No Division Data Available</div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* 4. MASTER TABLE */}
                <Card className="xl:col-span-2 shadow-sm flex flex-col rounded-2xl border-border/50">
                    <CardHeader className="border-b bg-muted/10 flex flex-row items-center justify-between py-4">
                        <CardTitle className="text-sm font-black uppercase text-foreground">Outflow Register</CardTitle>
                        <Badge variant="outline" className="font-mono bg-background shadow-sm">{data?.vouchers?.length || 0} Records</Badge>
                    </CardHeader>
                    <CardContent className="p-0 overflow-auto max-h-[500px] custom-scrollbar">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm backdrop-blur-md">
                                <TableRow>
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground pl-6">Doc No</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Payee & Date</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right">Total Amt</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right pr-6">Paid Amt</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-48 text-center"><Loader2 className="animate-spin mx-auto text-primary/50" /></TableCell></TableRow>
                                ) : data?.vouchers?.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">No matching records found.</TableCell></TableRow>
                                ) : data?.vouchers?.map((v) => (
                                    <TableRow
                                        key={v.id}
                                        onClick={() => setSelectedVoucher(v)}
                                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                                    >
                                        <TableCell className="font-black text-xs text-primary pl-6 py-4">{v.docNo}</TableCell>
                                        <TableCell className="py-4">
                                            <div className="font-black text-xs uppercase text-foreground">{v.payeeName}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-mono text-muted-foreground">{v.transactionDate}</span>
                                                <Badge variant="secondary" className="text-[8px] uppercase tracking-wider px-1.5 py-0 bg-muted/50">{v.status}</Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-black text-xs py-4">
                                            {formatMoney(v.totalAmount)}
                                        </TableCell>
                                        <TableCell className="text-right font-black text-xs text-emerald-600 dark:text-emerald-500 pr-6 py-4">
                                            {formatMoney(v.paidAmount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* 5. DRILL-DOWN SLIDE-OVER (SHEET) */}
            <Sheet open={!!selectedVoucher} onOpenChange={(open) => !open && setSelectedVoucher(null)}>
                <SheetContent className="sm:max-w-md w-full border-l shadow-2xl flex flex-col p-0 bg-background/95 backdrop-blur-xl">
                    <div className="bg-primary/5 p-6 border-b border-primary/10">
                        <SheetHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <SheetTitle className="text-2xl font-black text-primary uppercase tracking-tight">{selectedVoucher?.docNo}</SheetTitle>
                                    <SheetDescription className="text-xs font-bold uppercase tracking-widest mt-1">
                                        Disbursement Drill-down
                                    </SheetDescription>
                                </div>
                                <Badge className="uppercase text-[10px] font-black tracking-widest shadow-sm">{selectedVoucher?.status}</Badge>
                            </div>
                        </SheetHeader>
                    </div>

                    <div className="p-6 space-y-8 flex-1 overflow-auto custom-scrollbar">
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Building2 size={14} className="text-primary/70"/> Payee Info</h4>
                            <p className="text-sm font-black uppercase text-foreground">{selectedVoucher?.payeeName}</p>
                            <p className="text-xs font-bold text-muted-foreground">Trans Date: <span className="font-mono text-foreground">{selectedVoucher?.transactionDate}</span></p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 p-5 bg-card rounded-2xl border shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                            <div>
                                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Total Amount</p>
                                <p className="text-xl font-black text-foreground mt-1">{formatMoney(selectedVoucher?.totalAmount || 0)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Amount Paid</p>
                                <p className="text-xl font-black text-emerald-600 dark:text-emerald-500 mt-1">{formatMoney(selectedVoucher?.paidAmount || 0)}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Wallet size={14} className="text-emerald-500"/> Payment Details (Credits)</h4>
                            <div className="text-xs font-medium space-y-3">
                                <div className="p-4 border rounded-xl shadow-sm bg-card">
                                    <span className="font-bold uppercase block mb-1.5 text-[10px] text-muted-foreground tracking-widest">Source Banks</span>
                                    <span className="font-black uppercase">{selectedVoucher?.bankNames || 'No banks attached'}</span>
                                </div>
                                <div className="p-4 border rounded-xl shadow-sm bg-card">
                                    <span className="font-bold uppercase block mb-1.5 text-[10px] text-muted-foreground tracking-widest">Check Numbers</span>
                                    <span className="font-mono text-primary font-bold">{selectedVoucher?.checkNumbers || 'No checks issued'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><FileText size={14} className="text-orange-500"/> Expense Allocation (Debits)</h4>
                            <div className="p-4 border rounded-xl shadow-sm bg-muted/30">
                                <span className="font-bold uppercase block mb-3 text-[10px] text-muted-foreground tracking-widest">Chart of Accounts Hit</span>
                                <div className="flex flex-wrap gap-2">
                                    {selectedVoucher?.expenseAccountsHit?.split(',').map((acc, i) => (
                                        <Badge key={i} variant="outline" className="text-[10px] uppercase border-border bg-background shadow-sm py-1 px-3">{acc.trim()}</Badge>
                                    )) || <span className="text-xs text-muted-foreground italic font-medium">No expenses allocated</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}