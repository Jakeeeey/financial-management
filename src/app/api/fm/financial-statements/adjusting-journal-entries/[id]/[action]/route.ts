import { NextRequest, NextResponse } from "next/server";
import { buildSpringItemPath, proxySpring } from "../../_spring";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; action: string }> };
const ACTIONS = new Set(["submit", "reject", "reject-final", "withdraw", "revise", "cancel", "retry"]);
const AUTO_PRINT_SCRIPT = '<script>window.addEventListener("load",function(){window.setTimeout(function(){window.print();},250);},{once:true});</script>';
export async function GET(request: NextRequest, { params }: Context) {
  const { id, action } = await params;
  if (action !== "reversal-preview" && action !== "print") return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (action === "print" && request.nextUrl.searchParams.get("format") === "pdf") {
    return (await import("../../_print")).ajePdfResponse({ id });
  }
  const init = action === "print" ? { headers: { Accept: "text/html" } } : undefined;
  const springResponse = await proxySpring(buildSpringItemPath(id, action), init);
  if (action !== "print" || !springResponse.ok || !springResponse.headers.get("content-type")?.includes("text/html")) {
    return springResponse;
  }

  const html = await springResponse.text();
  const hasAutoPrint = /<script\b[^>]*>[\s\S]*?\bwindow\.print\s*\(/i.test(html);
  const printableHtml = hasAutoPrint
    ? html
    : html.replace(/<\/body\s*>/i, `${AUTO_PRINT_SCRIPT}</body>`);
  const response = new NextResponse(printableHtml, {
    status: springResponse.status,
    headers: {
      "Content-Type": springResponse.headers.get("content-type") || "text/html; charset=utf-8",
      "Content-Disposition": springResponse.headers.get("content-disposition") || "inline",
      "Cache-Control": "no-store",
    },
  });
  for (const cookie of springResponse.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
  return response;
}
export async function POST(request: NextRequest, { params }: Context) {
  const { id, action } = await params;
  if (!ACTIONS.has(action)) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return proxySpring(buildSpringItemPath(id, action), { method: "POST", body: await request.text() });
}

