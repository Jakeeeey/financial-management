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

interface AIInsightContent {
  summary: string;
  healthStatus: "healthy" | "caution" | "critical";
  healthRationale: string;
  keyFindings: string[];
  risks: string[];
  recommendations: string[];
  periodObservations: {
    operating: string;
    investing: string;
    financing: string;
  };
}

interface AIInsight extends AIInsightContent {
  analysisSource: "ai" | "rules-based";
  analyzedPeriod: AIAnalysisRequest["period"];
  generatedAt: string;
}

/**
 * POST /api/fm/financial-statements/statement-of-cash-flow/ai-insights
 *
 * Analyzes cash flow statement data using AI and returns structured insights.
 * Uses a rules-based analysis engine when AI is not configured or fails.
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
        return NextResponse.json({
          success: true,
          data: withAnalysisContext(aiInsights, body.period, "ai"),
        });
      } catch (aiError) {
        console.error("External AI analysis failed, falling back to rules engine:", aiError);
        // Fall through to rules-based engine
      }
    }

    // Rules-based analysis engine (works without any API key)
    const insights = generateRulesBasedInsights(body);

    return NextResponse.json({
      success: true,
      data: withAnalysisContext(insights, body.period, "rules-based"),
    });
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
function generateRulesBasedInsights(data: AIAnalysisRequest): AIInsightContent {
  const { summary, period } = data;
  const { operatingActivities, investingActivities, financingActivities, netIncreaseInCash } = summary;

  const keyFindings: string[] = [];
  const risks: string[] = [];
  const recommendations: string[] = [];

  // === Operating Activities Analysis ===
  const operatingObservation =
    operatingActivities > 0
      ? "Operating activities generated a net cash inflow during this period."
      : operatingActivities < 0
        ? "Operating activities used net cash during this period."
        : "Operating activities had no net cash movement during this period.";

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
  const investingObservation =
    investingActivities < 0
      ? "Investing activities used net cash during this period; this may include purchases of long-term assets."
      : investingActivities > 0
        ? "Investing activities generated a net cash inflow during this period."
        : "Investing activities had no net cash movement during this period.";

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
  const financingObservation =
    financingActivities > 0
      ? "Financing activities generated a net cash inflow during this period."
      : financingActivities < 0
        ? "Financing activities used net cash during this period."
        : "Financing activities had no net cash movement during this period.";

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
  let healthRationale: string;

  if (operatingActivities > 0 && netIncreaseInCash > 0) {
    healthStatus = "healthy";
    healthRationale = `Operating cash flow of ${formatCurrency(operatingActivities)} and net cash movement of ${formatCurrency(netIncreaseInCash)} are both positive for this period.`;
    summaryText = `For ${period.startDate} to ${period.endDate}, operating activities generated ${formatCurrency(operatingActivities)} and net cash increased by ${formatCurrency(netIncreaseInCash)}. Both cash-flow measures were positive in this report period.`;
  } else if (operatingActivities > 0 && netIncreaseInCash <= 0) {
    healthStatus = "caution";
    healthRationale = `Operating cash flow is positive at ${formatCurrency(operatingActivities)}, but net cash movement is ${formatCurrency(netIncreaseInCash)} for this period.`;
    summaryText = `Operating activities generated ${formatCurrency(operatingActivities)}, while net cash movement was ${formatCurrency(netIncreaseInCash)}. Investing, financing, or other cash movements offset the operating inflow.`;
  } else if (operatingActivities <= 0 && netIncreaseInCash > 0) {
    healthStatus = "caution";
    healthRationale = `Net cash movement is positive at ${formatCurrency(netIncreaseInCash)}, but operating cash flow is ${formatCurrency(operatingActivities)} for this period.`;
    summaryText = `Net cash increased by ${formatCurrency(netIncreaseInCash)}, while operating cash flow was ${formatCurrency(operatingActivities)}. Non-operating movements contributed to the increase.`;
  } else {
    healthStatus = "critical";
    healthRationale = `Operating cash flow of ${formatCurrency(operatingActivities)} and net cash movement of ${formatCurrency(netIncreaseInCash)} are both zero or negative for this period.`;
    summaryText = `For ${period.startDate} to ${period.endDate}, operating cash flow was ${formatCurrency(operatingActivities)} and net cash movement was ${formatCurrency(netIncreaseInCash)}. Both cash-flow measures were non-positive in this report period.`;
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
    healthRationale,
    keyFindings,
    risks: risks.length > 0 ? risks : ["No significant risks identified in this period."],
    recommendations,
    periodObservations: {
      operating: operatingObservation,
      investing: investingObservation,
      financing: financingObservation,
    },
  };
}

function withAnalysisContext(
  insight: AIInsightContent,
  period: AIAnalysisRequest["period"],
  analysisSource: AIInsight["analysisSource"]
): AIInsight {
  return {
    ...insight,
    analysisSource,
    analyzedPeriod: period,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Calls an external AI provider for more sophisticated analysis.
 * Currently supports OpenAI-compatible APIs.
 */
async function callExternalAI(
  data: AIAnalysisRequest
): Promise<AIInsightContent> {
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
            '  "healthRationale": "A concise explanation of the period values that support the selected health status",\n' +
            '  "keyFindings": ["Finding 1", "Finding 2", ...],\n' +
            '  "risks": ["Risk 1", "Risk 2", ...],\n' +
            '  "recommendations": ["Recommendation 1", "Recommendation 2", ...],\n' +
            '  "periodObservations": {\n' +
            '    "operating": "Observation about operating activity in this period",\n' +
            '    "investing": "Observation about investing activity in this period",\n' +
            '    "financing": "Observation about financing activity in this period"\n' +
            "  }\n" +
            "}\n" +
            "Use only the supplied single-period data. Do not claim comparisons or trends over time. Explain that healthStatus is a cash-flow indicator, not a complete assessment of the business.\n" +
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
    return parseExternalAIInsight(JSON.parse(content));
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return parseExternalAIInsight(JSON.parse(jsonMatch[1]));
    }
    throw new Error("Failed to parse AI response as JSON");
  }
}

function parseExternalAIInsight(value: unknown): AIInsightContent {
  if (!value || typeof value !== "object") {
    throw new Error("AI response is not an object");
  }

  const insight = value as Record<string, unknown>;
  const observations = insight.periodObservations;
  const isStringArray = (candidate: unknown) =>
    Array.isArray(candidate) && candidate.every((item) => typeof item === "string");

  if (
    typeof insight.summary !== "string" ||
    !["healthy", "caution", "critical"].includes(String(insight.healthStatus)) ||
    typeof insight.healthRationale !== "string" ||
    !isStringArray(insight.keyFindings) ||
    !isStringArray(insight.risks) ||
    !isStringArray(insight.recommendations) ||
    !observations ||
    typeof observations !== "object" ||
    typeof (observations as Record<string, unknown>).operating !== "string" ||
    typeof (observations as Record<string, unknown>).investing !== "string" ||
    typeof (observations as Record<string, unknown>).financing !== "string"
  ) {
    throw new Error("AI response is missing required analysis details");
  }

  return insight as unknown as AIInsightContent;
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
