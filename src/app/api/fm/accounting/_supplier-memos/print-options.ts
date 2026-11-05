import type { PdfTemplate } from "@/components/pdf-layout-design/services/pdf-template";
import { MemoError, positiveId, readRows } from "./directus";

export async function memoPrintTemplates() {
  return readRows<PdfTemplate>("pdf_templates", {}, "id,name,config", "name,id");
}

export async function memoPrintTemplate(id: string | null): Promise<PdfTemplate | undefined> {
  if (id == null) return undefined;
  const [template] = await readRows<PdfTemplate>("pdf_templates", { id: { _eq: positiveId(id) } }, "id,name,config");
  if (!template) throw new MemoError("The selected print template is no longer available. Choose another template or Standard Header.", 404);
  return template;
}
