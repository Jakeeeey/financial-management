import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "vos_access_token";

interface CashFlowEntry {
  cashFlowActivity?: string | null;
  transactionDate?: string | null;
  transactionRef?: string | null;
  netCashFlow?: number | null;
}

interface AIAnalysisRequest {
  entries: CashFlowEntry[];
  summary: {
    operatingActivities: number;
    investingActivities: number;
    financingActivities: number;
    netIncreaseInCash: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

interface AIInsight {
  summary: string;
  healthStatus: "healthy" | "caution" | "critical";
  keyFindings: string[];
  risks: string[];
  recommendations: string[];
  trends: {
    operating: string;
    investing: string;
    financing: string;
  };
}

/**
 * POST /api/fm/financial-statements/statement-of-cash-flow/ai-insights
 *
 * Analyzes cash flow statement data using AI and returns structured insights.
 * Currently uses a rules-based analysis engine as a fallback.
 * Can be upgraded to use OpenAI, Anthropic, or any LLM provider.
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Missing token" },
        { status: 401 }
      );
    }

    let body: AIAnalysisRequest;
    try {
      const rawBody = await request.json();
      body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body || !body.summary || !body.period || !body.entries) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: summary, period, entries" },
        { status: 400 }
      );
    }

    // Attempt to use external AI if API key is configured
    const aiProvider = process.env.AI_PROVIDER; // "openai" | "anthropic" | "gemini" | undefined

    if (aiProvider && process.env.AI_API_KEY) {
      try {
        const aiInsights = await callExternalAI(body);
        return NextResponse.json({ success: true, data: aiInsights });
      } catch (aiError) {
        console.error("External AI analysis failed, falling back to rules engine:", aiError);
        // Fall through to rules-based engine
      }
    }

    // Rules-based analysis engine (works without any API key)
    const insights = generateRulesBasedInsights(body);

    return NextResponse.json({ success: true, data: insights });
  } catch (error) {
    console.error("AI Insights Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to analyze cash flow data",
      },
      { status: 500 }
    );
  }
}

/**
 * Rules-based analysis engine that evaluates cash flow health
 * without requiring any external AI API.
 */
function generateRulesBasedInsights(data: AIAnalysisRequest): AIInsight {
  const { summary, period } = data;
  const { operatingActivities, investingActivities, financingActivities, netIncreaseInCash } = summary;

  const keyFindings: string[] = [];
  const risks: string[] = [];
  const recommendations: string[] = [];

  // === Operating Activities Analysis ===
  const operatingTrend =
    operatingActivities > 0
      ? "Positive operating cash flow indicates core business operations are generating sufficient cash."
      : operatingActivities < 0
        ? "Negative operating cash flow suggests the core business is not generating enough cash from operations."
        : "Operating cash flow is neutral, with no significant net movement.";

  keyFindings.push(
    `Operating activities: ${formatCurrency(operatingActivities)} — ${
      operatingActivities >= 0 ? "Positive" : "Negative"
    } cash generation`
  );

  if (operatingActivities < 0) {
    risks.push(
      "Sustained negative operating cash flow may indicate fundamental business model issues or poor working capital management."
    );
  }

  // === Investing Activities Analysis ===
  const investingTrend =
    investingActivities < 0
      ? "Negative investing cash flow typically indicates the company is investing in long-term assets for future growth."
      : investingActivities > 0
        ? "Positive investing cash flow may indicate the company is selling off assets, which could be a liquidity strategy or a sign of divestment."
        : "No significant investing activity during the period.";

  keyFindings.push(
    `Investing activities: ${formatCurrency(investingActivities)} — ${
      investingActivities < 0 ? "Investing in assets" : "Asset monetization"
    }`
  );

  if (investingActivities > 0 && operatingActivities < 0) {
    risks.push(
      "Selling assets while core operations are cash-negative could be a red flag for liquidity problems."
    );
  }

  // === Financing Activities Analysis ===
  const financingTrend =
    financingActivities > 0
      ? "Positive financing cash flow suggests the company is raising capital through debt or equity."
      : financingActivities < 0
        ? "Negative financing cash flow indicates debt repayment, share buybacks, or dividend distributions."
        : "No significant financing activity during the period.";

  keyFindings.push(
    `Financing activities: ${formatCurrency(financingActivities)} — ${
      financingActivities >= 0 ? "Raising capital" : "Repaying/de-risking"
    }`
  );

  if (financingActivities > 0 && financingActivities > Math.abs(operatingActivities)) {
    risks.push(
      "The company is relying heavily on external financing rather than operations to fund its cash needs."
    );
  }

  // === Overall Health Assessment ===
  let healthStatus: "healthy" | "caution" | "critical";
  let summaryText: string;

  if (operatingActivities > 0 && netIncreaseInCash > 0) {
    healthStatus = "healthy";
    summaryText = `Your cash flow from ${period.startDate} to ${period.endDate} shows a healthy position. Operating activities generated ${formatCurrency(operatingActivities)} in cash, and overall cash increased by ${formatCurrency(netIncreaseInCash)}. The business is generating sufficient cash from its core operations.`;
  } else if (operatingActivities > 0 && netIncreaseInCash <= 0) {
    healthStatus = "caution";
    summaryText = `While core operations generated ${formatCurrency(operatingActivities)} in positive cash flow, overall cash decreased by ${formatCurrency(Math.abs(netIncreaseInCash))}. This suggests significant cash outflows from investing or financing activities are offsetting operational gains.`;
  } else if (operatingActivities <= 0 && netIncreaseInCash > 0) {
    healthStatus = "caution";
    summaryText = `Cash increased by ${formatCurrency(netIncreaseInCash)}, but operating activities consumed ${formatCurrency(Math.abs(operatingActivities))}. The company appears to be relying on external financing or asset sales to maintain liquidity.`;
  } else {
    healthStatus = "critical";
    summaryText = `Critical cash position: Operating activities consumed ${formatCurrency(Math.abs(operatingActivities))}, and total cash decreased by ${formatCurrency(Math.abs(netIncreaseInCash))}. Immediate attention is needed to improve operational cash generation and preserve liquidity.`;
  }

  // === Recommendations ===
  if (operatingActivities < 0) {
    recommendations.push(
      "Review accounts receivable collection processes and consider tightening payment terms to improve operating cash flow."
    );
    recommendations.push(
      "Analyze expense structure and identify non-essential costs that can be reduced or deferred."
    );
  }

  if (investingActivities > 0 && operatingActivities < 0) {
    recommendations.push(
      "Avoid selling productive assets to fund operations. Consider restructuring debt or seeking equity investment instead."
    );
  }

  if (financingActivities > 0 && operatingActivities < 0) {
    recommendations.push(
      "Develop a clear debt repayment plan once operations return to positive cash generation."
    );
  }

  if (operatingActivities > 0 && netIncreaseInCash > 0) {
    recommendations.push(
      "Consider allocating excess cash to high-yield investments, debt reduction, or shareholder returns."
    );
  }

  // Add a general recommendation always
  recommendations.push(
    "Perform regular cash flow forecasting to anticipate liquidity needs and identify potential shortfalls early."
  );

  return {
    summary: summaryText,
    healthStatus,
    keyFindings,
    risks: risks.length > 0 ? risks : ["No significant risks identified in this period."],
    recommendations,
    trends: {
      operating: operatingTrend,
      investing: investingTrend,
      financing: financingTrend,
    },
  };
}

/**
 * Calls an external AI provider for more sophisticated analysis.
 * Currently supports OpenAI-compatible APIs.
 */
async function callExternalAI(
  data: AIAnalysisRequest
): Promise<AIInsight> {
  const apiKey = process.env.AI_API_KEY;
  const apiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  const prompt = buildAIPrompt(data);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a financial analyst expert specializing in cash flow statement analysis. " +
            "Analyze the provided cash flow data and return a JSON object with the following structure:\n" +
            "{\n" +
            '  "summary": "A comprehensive 2-3 sentence summary of the cash flow health",\n' +
            '  "healthStatus": "healthy" | "caution" | "critical",\n' +
            '  "keyFindings": ["Finding 1", "Finding 2", ...],\n' +
            '  "risks": ["Risk 1", "Risk 2", ...],\n' +
            '  "recommendations": ["Recommendation 1", "Recommendation 2", ...],\n' +
            '  "trends": {\n' +
            '    "operating": "Trend description for operating activities",\n' +
            '    "investing": "Trend description for investing activities",\n' +
            '    "financing": "Trend description for financing activities"\n' +
            "  }\n" +
            "}\n" +
            "Respond ONLY with valid JSON, no other text.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`AI provider error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response content from AI provider");
  }

  // Parse the JSON response
  try {
    // Try direct parse
    return JSON.parse(content) as AIInsight;
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as AIInsight;
    }
    throw new Error("Failed to parse AI response as JSON");
  }
}

function buildAIPrompt(data: AIAnalysisRequest): string {
  const { summary, period, entries } = data;

  // Create a summarized view of the entries
  const entriesByActivity = summarizeEntries(entries);

  return `
Cash Flow Statement Analysis Request

Period: ${period.startDate} to ${period.endDate}

Summary:
- Operating Activities: ${summary.operatingActivities}
- Investing Activities: ${summary.investingActivities}
- Financing Activities: ${summary.financingActivities}
- Net Increase in Cash: ${summary.netIncreaseInCash}

Transaction Breakdown:
${entriesByActivity}

Please provide detailed analysis of this cash flow statement.`;
}

function summarizeEntries(entries: CashFlowEntry[]): string {
  const grouped: Record<string, { count: number; total: number }> = {};

  entries.forEach((entry) => {
    const activity = entry.cashFlowActivity || "Uncategorized";
    if (!grouped[activity]) {
      grouped[activity] = { count: 0, total: 0 };
    }
    grouped[activity].count++;
    grouped[activity].total += entry.netCashFlow || 0;
  });

  return Object.entries(grouped)
    .map(
      ([activity, data]) =>
        `  ${activity}: ${data.count} transactions, net ${data.total}`
    )
    .join("\n");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);
}