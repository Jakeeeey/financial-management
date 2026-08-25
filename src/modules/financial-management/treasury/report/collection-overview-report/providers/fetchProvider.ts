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
                cache: "no-store"
            });

            if (!response.ok) {
                const text = await response.text();
                let errorMsg = text;
                try {
                    const data = JSON.parse(text);
                    if (data?.error) errorMsg = data.error;
                } catch {}
                throw new Error(errorMsg || `GET Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[fetchProvider] GET ${url} failed:`, error);
            throw error;
        }
    },

    /**
     * POST Request
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
                const text = await response.text();
                let errorMsg = text;
                try {
                    const data = JSON.parse(text);
                    if (data?.error) errorMsg = data.error;
                } catch {}
                throw new Error(errorMsg || `POST Error: ${response.status}`);
            }

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            } else {
                const textData = await response.text();
                return textData as unknown as T;
            }
        } catch (error) {
            console.error(`[fetchProvider] POST ${url} failed:`, error);
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
                const text = await response.text();
                let errorMsg = text;
                try {
                    const data = JSON.parse(text);
                    if (data?.error) errorMsg = data.error;
                } catch {}
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
                const text = await response.text();
                let errorMsg = text;
                try {
                    const data = JSON.parse(text);
                    if (data?.error) errorMsg = data.error;
                } catch {}
                throw new Error(errorMsg || `DELETE Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[fetchProvider] DELETE ${url} failed:`, error);
            throw error;
        }
    },
};
