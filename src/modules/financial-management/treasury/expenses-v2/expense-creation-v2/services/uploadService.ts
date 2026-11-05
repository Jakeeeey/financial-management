const BASE_URL = "/api/fm/treasury/expenses-v2/expense-creation-v2";

export async function uploadReceiptFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/files`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "File upload failed" }));
    throw new Error(error.message || "Failed to upload file");
  }

  const json = await res.json();
  const fileId = json.data?.id;

  if (fileId) {
    return String(fileId);
  }

  throw new Error("File uploaded but no ID returned");
}
