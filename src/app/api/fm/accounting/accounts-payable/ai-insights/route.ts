import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

interface APInsightRecord {
  id?: number; refNo?: string; supplier?: string; invoiceNo?: string;
  division?: string; invoiceDate?: string; dueDate?: string;
  amountPayable?: number; amountPaid?: number; outstandingBalance?: number;
  aging?: number | null; status?: string;
  apCategory?: "Trade" | "Non-Trade";
  transactionTypeName?: string | null;
}

interface APInsightRequest {
  records: APInsightRecord[];
  filters?: {
    tab?: "all" | "Trade" | "Non-Trade";
    dateFrom?: string; dateTo?: string; supplier?: string; status?: string;
  };
}

interface APInsight {
  summary: string;
  healthStatus: "healthy" | "caution" | "critical";
  keyFindings: string[];
  risks: string[];
  recommendations: string[];
  focusAreas: {
    category: "Trade" | "Non-Trade";
    headline: string;
    observations: string[];
  }[];
  topSupplier: { name: string; outstanding: number } | null;
  aging: { bucket: string; outstanding: number; note: string; }[];
  generatedBy: "openai" | "anthropic" | "gemini" | "rules-engine";
  generatedAt: string;
}

const VALID_CATEGORIES = new Set<"Trade" | "Non-Trade">(["Trade", "Non-Trade"]);

function asNumber(v: unknown, fb = 0): number {
  if (v === null || v === undefined || v === "") return fb;
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(value);
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  let body: APInsightRequest;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 }); }
  if (!body || !Array.isArray(body.records)) {
    return NextResponse.json({ success: false, message: "Missing required field: records (array)" }, { status: 400 });
  }

  const aiProvider = process.env.AI_PROVIDER;
  if (aiProvider && process.env.AI_API_KEY) {
    try {
      const insight = await callExternalAI(body);
      return NextResponse.json({ success: true, data: insight });
    } catch (err) {
      console.error("[AP AI-Insights] External provider failed, falling back to rules engine:", err);
    }
  }

  return NextResponse.json({ success: true, data: generateRulesBasedInsights(body) });
}

async function callExternalAI(body: APInsightRequest): Promise<APInsight> {
  const apiKey = process.env.AI_API_KEY;
  const apiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content:
          "You are a senior AP / treasury analyst. Respond with ONLY valid JSON of this shape:\n" +
          '{"summary":"","healthStatus":"healthy|caution|critical","keyFindings":[""],"risks":[""],"recommendations":[""],' +
          '"focusAreas":[{"category":"Trade|Non-Trade","headline":"","observations":[""]}],' +
          '"topSupplier":{"name":"","outstanding":0}|null,' +
          '"aging":[{"bucket":"0-30|31-60|61-90|91+","outstanding":0,"note":""}]}'
        },
        { role: "user", content: buildAIPrompt(body) },
      ],
      temperature: 0.3, max_tokens: 2000,
    }),
  });
  if (!response.ok) throw new Error(`AI provider error (${response.status}): ${await response.text().catch(() => "Unknown error")}`);

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response content from AI provider");

  try { return JSON.parse(content) as APInsight; }
  catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) return JSON.parse(match[1]) as APInsight;
    throw new Error("Failed to parse AI response as JSON");
  }
}

function buildAIPrompt(body: APInsightRequest): string {
  const { records, filters } = body;
  const totalPayable = records.reduce((s, r) => s + asNumber(r.amountPayable), 0);
  const totalPaid    = records.reduce((s, r) => s + asNumber(r.amountPaid), 0);
  const totalOutstanding = records.reduce((s, r) => s + asNumber(r.outstandingBalance), 0);
  const overdue = records.filter(r => (r.aging ?? 0) >= 0 && asNumber(r.outstandingBalance) > 0).length;
  const byCat: Record<string, { count: number; outstanding: number; overdue: number }> = {
    Trade: { count: 0, outstanding: 0, overdue: 0 }, "Non-Trade": { count: 0, outstanding: 0, overdue: 0 },
  };
  for (const r of records) {
    const cat = VALID_CATEGORIES.has(r.apCategory as "Trade" | "Non-Trade") ? r.apCategory as "Trade" | "Non-Trade" : "Non-Trade";
    byCat[cat].count += 1;
    byCat[cat].outstanding += asNumber(r.outstandingBalance);
    if ((r.aging ?? 0) >= 0 && asNumber(r.outstandingBalance) > 0) byCat[cat].overdue += 1;
  }
  const aging = agingBreakdown(records);
  const top = topNBySupplier(records, 5);
  return [
    "Accounts Payable Analysis Request",
    filters ? `Active filters: ${JSON.stringify(filters)}` : "",
    "Headline metrics:",
    `- Records analyzed: ${records.length}`,
    `- Total payable: ${formatCurrency(totalPayable)}`,
    `- Total paid: ${formatCurrency(totalPaid)}`,
    `- Outstanding: ${formatCurrency(totalOutstanding)}`,
    `- Overdue invoices: ${overdue}`,
    "Trade vs Non-Trade:",
    `- Trade: ${byCat.Trade.count} records, ${formatCurrency(byCat.Trade.outstanding)} outstanding, ${byCat.Trade.overdue} overdue`,
    `- Non-Trade: ${byCat["Non-Trade"].count} records, ${formatCurrency(byCat["Non-Trade"].outstanding)} outstanding, ${byCat["Non-Trade"].overdue} overdue`,
    "Aging buckets (outstanding):",
    ...aging.map(b => `- ${b.bucket}: ${formatCurrency(b.outstanding)} (${b.note})`),
    "Top suppliers by outstanding:",
    ...top.map(s => `- ${s.name}: ${formatCurrency(s.outstanding)}`),
    "Provide detailed analysis.",
  ].join("\n");
}

function topNBySupplier(records: APInsightRecord[], n: number) {
  const map = new Map<string, number>();
  for (const r of records) {
    if (!r.supplier) continue;
    map.set(r.supplier, (map.get(r.supplier) || 0) + asNumber(r.outstandingBalance));
  }
  return Array.from(map.entries())
    .map(([name, outstanding]) => ({ name, outstanding }))
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, n);
}

function agingBreakdown(records: APInsightRecord[]) {
  const buckets = [
    { bucket: "0-30",  outstanding: 0, note: "Not yet due or due within 30 days" },
    { bucket: "31-60", outstanding: 0, note: "Mildly past due" },
    { bucket: "61-90", outstanding: 0, note: "Significantly past due" },
    { bucket: "91+",   outstanding: 0, note: "Critical — escalate collections" },
  ];
  for (const r of records) {
    const bal = asNumber(r.outstandingBalance);
    if (bal <= 0) continue;
    const aging = r.aging ?? -1;
    if (aging < 0)        buckets[0].outstanding += bal;
    else if (aging <= 30) buckets[0].outstanding += bal;
    else if (aging <= 60) buckets[1].outstanding += bal;
    else if (aging <= 90) buckets[2].outstanding += bal;
    else                  buckets[3].outstanding += bal;
  }
  return buckets;
}

function buildFocusArea(category: "Trade" | "Non-Trade", stats: { count: number; payable: number; paid: number; outstanding: number; overdue: number }): { category: "Trade" | "Non-Trade"; headline: string; observations: string[]; } {
  const observations: string[] = [];
  const settleRate = stats.payable > 0 ? (stats.paid / stats.payable) * 100 : 0;
  observations.push(`${stats.count} record${stats.count === 1 ? "" : "s"} totalling ${formatCurrency(stats.outstanding)} outstanding.`);
  observations.push(`Settlement rate: ${settleRate.toFixed(1)}% (${formatCurrency(stats.paid)} paid of ${formatCurrency(stats.payable)}).`);
  if (stats.overdue > 0) {
    observations.push(`${stats.overdue} invoice${stats.overdue === 1 ? "" : "s"} currently past due.`);
  } else if (stats.count > 0) {
    observations.push("No past-due invoices in this category.");
  }
  const headline = category === "Trade"
    ? "Trade payables — operational supplier exposure"
    : "Non-Trade payables — overhead, services & expenses";
  return { category, headline, observations };
}

function generateRulesBasedInsights(body: APInsightRequest): APInsight {
  const { records } = body;
  const generatedBy: APInsight["generatedBy"] =
    process.env.AI_PROVIDER ? (process.env.AI_PROVIDER as APInsight["generatedBy"]) : "rules-engine";

  const totalPayable = records.reduce((s, r) => s + asNumber(r.amountPayable), 0);
  const totalPaid    = records.reduce((s, r) => s + asNumber(r.amountPaid), 0);
  const totalOutstanding = Math.max(0, totalPayable - totalPaid);
  const overdueRecords = records.filter(r => (r.aging ?? 0) >= 0 && asNumber(r.outstandingBalance) > 0.01);
  const totalOverdue = overdueRecords.reduce((s, r) => s + asNumber(r.outstandingBalance), 0);
  const settlementRate = totalPayable > 0 ? (totalPaid / totalPayable) * 100 : 0;

  const sumFor = (subset: APInsightRecord[]) => ({
    count: subset.length,
    payable: subset.reduce((s, r) => s + asNumber(r.amountPayable), 0),
    paid: subset.reduce((s, r) => s + asNumber(r.amountPaid), 0),
    outstanding: subset.reduce((s, r) => s + asNumber(r.outstandingBalance), 0),
    overdue: subset.filter(r => (r.aging ?? 0) >= 0 && asNumber(r.outstandingBalance) > 0.01).length,
  });
  const trade    = sumFor(records.filter(r => r.apCategory === "Trade"));
  const nonTrade = sumFor(records.filter(r => r.apCategory === "Non-Trade"));

  const agingBuckets = agingBreakdown(records);
  const supplierList = topNBySupplier(records, 5);
  const topSupplier = supplierList.length > 0 ? supplierList[0] : null;

  const overdueRatio = totalPayable > 0 ? totalOverdue / totalPayable : 0;
  let healthStatus: APInsight["healthStatus"] = "healthy";
  if (overdueRatio > 0.5 || overdueRecords.length >= Math.max(5, records.length * 0.4)) {
    healthStatus = "critical";
  } else if (overdueRatio > 0.2 || overdueRecords.length > 0) {
    healthStatus = "caution";
  }

  const summary = [
    `Across ${records.length} AP records (${formatCurrency(totalPayable)} total payable, ${formatCurrency(totalPaid)} paid,`,
    `${formatCurrency(totalOutstanding)} outstanding), settlement is at ${settlementRate.toFixed(1)}% with`,
    `${overdueRecords.length} invoice${overdueRecords.length === 1 ? "" : "s"} past due totalling ${formatCurrency(totalOverdue)}.`,
    healthStatus === "healthy"
      ? "Cash position is healthy — keep current payment cadence."
      : healthStatus === "caution"
        ? "Watch the overdue queue: prioritize the largest exposures first to avoid late-payment penalties."
        : "Liquidity risk: a large share of payables are past due — escalate collections and renegotiate terms with the largest creditors.",
  ].join(" ");

  const keyFindings: string[] = [
    `Total payable: ${formatCurrency(totalPayable)} — settlement rate ${settlementRate.toFixed(1)}%.`,
    `Outstanding: ${formatCurrency(totalOutstanding)} across ${records.length} record${records.length === 1 ? "" : "s"}.`,
    `Past-due: ${overdueRecords.length} invoice${overdueRecords.length === 1 ? "" : "s"} (${formatCurrency(totalOverdue)}).`,
    `Trade share: ${trade.outstanding > 0 || nonTrade.outstanding > 0 ? ((trade.outstanding / (trade.outstanding + nonTrade.outstanding || 1)) * 100).toFixed(1) : "0.0"}% of outstanding exposure.`,
  ];
  if (topSupplier) keyFindings.push(`Largest exposure: ${topSupplier.name} at ${formatCurrency(topSupplier.outstanding)}.`);

  const risks: string[] = [];
  if (overdueRecords.length > 0) {
    risks.push(`${overdueRecords.length} invoice${overdueRecords.length === 1 ? " is" : "s are"} past due, totalling ${formatCurrency(totalOverdue)} — late-payment penalties and supplier relationship strain are likely.`);
  }
  const critBucket = agingBuckets.find(b => b.bucket === "91+");
  if (critBucket && critBucket.outstanding > 0) {
    risks.push(`${formatCurrency(critBucket.outstanding)} sits in the 91+ day bucket — escalate collections and consider credit-memo or return settlements.`);
  }
  if (topSupplier && totalOutstanding > 0 && topSupplier.outstanding / totalOutstanding > 0.4) {
    risks.push(`Supplier concentration risk: ${topSupplier.name} accounts for ${((topSupplier.outstanding / totalOutstanding) * 100).toFixed(1)}% of outstanding exposure.`);
  }
  if (risks.length === 0) risks.push("No significant risks identified in the current snapshot.");

  const recommendations: string[] = [
    "Run an aging report weekly to catch newly-overdue invoices early.",
    "Concentrate payment runs on the largest creditors with the longest overdue balances first.",
  ];
  if (critBucket && critBucket.outstanding > 0) {
    recommendations.unshift(`Open a collection task for the ${formatCurrency(critBucket.outstanding)} in 91+ day invoices and consider issuing credit memos for disputed items.`);
  }
  if (topSupplier && totalOutstanding > 0 && topSupplier.outstanding / totalOutstanding > 0.4) {
    recommendations.unshift(`Negotiate extended payment terms with ${topSupplier.name} — they represent a large share of exposure.`);
  }
  if (settlementRate < 60) {
    recommendations.push("Settlement rate is below 60% — review collection discipline and tighten payment follow-ups.");
  }
  recommendations.push("Schedule a monthly review of supplier terms to align payment cycles with cash-flow forecast.");

  const focusAreas: APInsight["focusAreas"] = [];
  if (trade.count > 0)        focusAreas.push(buildFocusArea("Trade", trade));
  if (nonTrade.count > 0)     focusAreas.push(buildFocusArea("Non-Trade", nonTrade));

  return {
    summary, healthStatus, keyFindings, risks, recommendations,
    focusAreas,
    topSupplier,
    aging: agingBuckets,
    generatedBy,
    generatedAt: new Date().toISOString(),
  };
}
