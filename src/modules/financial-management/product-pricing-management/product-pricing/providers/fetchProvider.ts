export async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await fetch(input, {
        ...init,
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });

    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        // Attempt to re-throw the full JSON body so callers can extract Directus error details
        try {
            const json = JSON.parse(txt) as Record<string, unknown>;
            throw new Error(JSON.stringify(json));
        } catch (e) {
            if (e instanceof SyntaxError) {
                throw new Error(txt || `Request failed (${res.status})`);
            }
            throw e;
        }
    }
    return (await res.json()) as T;
}
