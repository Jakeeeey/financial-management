export const fetchProvider = {
    async get<T>(url: string): Promise<T | null> {
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include", // ← ADD THIS
                cache: "no-store"
            });

            if (!response.ok) {
                const text = await response.text();
                let errorMsg = text;
                try {
                    const data = JSON.parse(text);
                    if (data?.error) errorMsg = data.error;
                    if (data?.message) errorMsg = data.message;
                } catch {}
                throw new Error(JSON.stringify({ ok: false, status: response.status, message: errorMsg }));
            }

            return await response.json();
        } catch (error) {
            console.error(`[fetchProvider] GET ${url} failed:`, error);
            throw error;
        }
    },

    async post<T>(url: string, body: unknown): Promise<T | null> {
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include", // ← ADD THIS
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const text = await response.text();
                let errorMsg = text;
                try {
                    const data = JSON.parse(text);
                    if (data?.error) errorMsg = data.error;
                    if (data?.message) errorMsg = data.message;
                } catch {}
                throw new Error(JSON.stringify({ ok: false, status: response.status, message: errorMsg }));
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

    async put<T>(url: string, body: unknown): Promise<T | null> {
        try {
            const response = await fetch(url, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include", // ← ADD THIS
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const text = await response.text();
                let errorMsg = text;
                try {
                    const data = JSON.parse(text);
                    if (data?.error) errorMsg = data.error;
                    if (data?.message) errorMsg = data.message;
                } catch {}
                throw new Error(JSON.stringify({ ok: false, status: response.status, message: errorMsg }));
            }

            return await response.json();
        } catch (error) {
            console.error(`[fetchProvider] PUT ${url} failed:`, error);
            throw error;
        }
    },

    async delete<T>(url: string): Promise<T | null> {
        try {
            const response = await fetch(url, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include", // ← ADD THIS
            });

            if (!response.ok) {
                const text = await response.text();
                let errorMsg = text;
                try {
                    const data = JSON.parse(text);
                    if (data?.error) errorMsg = data.error;
                    if (data?.message) errorMsg = data.message;
                } catch {}
                throw new Error(JSON.stringify({ ok: false, status: response.status, message: errorMsg }));
            }

            return await response.json();
        } catch (error) {
            console.error(`[fetchProvider] DELETE ${url} failed:`, error);
            throw error;
        }
    },
};