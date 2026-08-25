import { CashFlowEntry } from "../types/cash-flow.schema";

export interface AIInsight {
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

export interface AIAnalysisRequest {
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

/**
 * Sends cash flow data to the AI analysis API endpoint
 * and returns structured insights.
 */
export async function analyzeCashFlowWithAI(
  data: AIAnalysisRequest
): Promise<AIInsight> {
  const API_URL = "/api/fm/financial-statements/statement-of-cash-flow/ai-insights";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`AI analysis failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.data as AIInsight;
  } catch (error) {
    console.error("AI Cash Flow Analysis Error:", error);
    throw error;
  }
}