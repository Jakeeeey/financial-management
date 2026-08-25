
export const fetchProvider = {
    /**
     * GET Request
     */
    async get<T>(url: string): Promise<T | null> {
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const responseText = await response.text();
                let errorMsg = responseText;
                try {
                    const payload = JSON.parse(responseText) as { message?: unknown; error?: unknown };
                    errorMsg = String(payload.message || payload.error || responseText);
                } catch {
                    // Keep the upstream text when it is not JSON.
                }
                throw new Error(errorMsg || `GET Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            throw error;
        }
    },

    /**
     * POST Request
     * Supports both JSON responses and raw text (for system-generated IDs/DocNos)
     */
    async post<T>(url: string, body: unknown): Promise<T | null> {
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorMsg = await response.text();
                throw new Error(errorMsg || `POST Error: ${response.status}`);
            }

            // 🚀 PRO TIP: Check Content-Type.
            // If backend returns a raw string (like CP-0001), .json() will fail.
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            } else {
                // Fallback for raw text responses
                const textData = await response.text();
                return textData as unknown as T;
            }
        } catch (error) {
            console.error(`[fetchProvider] POST ${url} failed:`, error);
            throw error; // Re-throw so the Hook can catch it for alerts
        }
    },

    /**
     * Multipart POST Request
     * The browser sets the multipart boundary when a FormData body is used.
     */
    async postForm<T>(url: string, body: FormData): Promise<T | null> {
        try {
            const response = await fetch(url, {
                method: "POST",
                body,
            });

            if (!response.ok) {
                const responseText = await response.text();
                let errorMsg = responseText;
                try {
                    const payload = JSON.parse(responseText) as {
                        message?: unknown;
                        error?: unknown;
                        detail?: unknown;
                    };
                    errorMsg = String(payload.message || payload.detail || payload.error || responseText);
                } catch {
                    // Keep the upstream text when it is not JSON.
                }
                throw new Error(errorMsg || `POST Error: ${response.status}`);
            }

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            }

            const textData = await response.text();
            return textData as unknown as T;
        } catch (error) {
            console.error(`[fetchProvider] Multipart POST ${url} failed:`, error);
            throw error;
        }
    },

    /**
     * PUT Request
     */
    async put<T>(url: string, body: unknown): Promise<T | null> {
        try {
            const response = await fetch(url, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorMsg = await response.text();
                throw new Error(errorMsg || `PUT Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[fetchProvider] PUT ${url} failed:`, error);
            throw error;
        }
    },

    /**
     * DELETE Request
     */
    async delete<T>(url: string): Promise<T | null> {
        try {
            const response = await fetch(url, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorMsg = await response.text();
                throw new Error(errorMsg || `DELETE Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[fetchProvider] DELETE ${url} failed:`, error);
            return null;
        }
    },
};
