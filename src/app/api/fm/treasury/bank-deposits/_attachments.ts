export const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");
export const DIRECTUS_STATIC_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || "").trim();

export async function uploadDirectusFile(file: File): Promise<string> {
    if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
    if (!DIRECTUS_STATIC_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");

    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = await fetch(`${DIRECTUS_URL}/files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}` },
        body: formData,
        cache: "no-store",
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Directus file upload failed (${response.status}): ${text.slice(0, 200)}`);
    }

    const payload = await response.json() as { data?: { id?: string } };
    if (!payload.data?.id) throw new Error("Directus file upload returned no file ID");
    return payload.data.id;
}

export async function deleteDirectusFile(fileId: string): Promise<void> {
    if (!DIRECTUS_URL || !DIRECTUS_STATIC_TOKEN) return;

    const response = await fetch(`${DIRECTUS_URL}/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}` },
        cache: "no-store",
    });

    if (!response.ok && response.status !== 404) {
        const text = await response.text();
        throw new Error(`Directus file deletion failed (${response.status}): ${text.slice(0, 200)}`);
    }
}
