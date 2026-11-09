import { getReference, referenceResponse } from "../../../_references";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ resource: string; id: string }> }) {
  return referenceResponse(async () => {
    const { resource, id } = await params;
    return getReference(resource, id);
  });
}
