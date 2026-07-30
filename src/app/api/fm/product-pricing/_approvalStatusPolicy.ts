export function appendDisplayStatusFilter(params: URLSearchParams, andIdx: number, status: string): number {
    const normalized = status.trim().toUpperCase();
    if (!normalized) return andIdx;
    const now = new Date().toISOString();

    const addAnd = (suffix: string, value: string) => {
        params.set(`filter[_and][${andIdx}]${suffix}`, value);
        andIdx += 1;
    };

    if (normalized === "SCHEDULED") {
        addAnd("[status][_eq]", "APPROVED");
        addAnd("[application_status][_eq]", "SCHEDULED");
        addAnd("[effective_at][_gt]", now);
        return andIdx;
    }

    if (["APPLYING", "FAILED"].includes(normalized)) {
        addAnd("[status][_eq]", "APPROVED");
        addAnd("[application_status][_eq]", normalized);
        return andIdx;
    }

    if (normalized === "APPROVED") {
        addAnd("[status][_eq]", "APPROVED");
        params.set(`filter[_and][${andIdx}][_or][0][application_status][_nin]`, "SCHEDULED,APPLYING,FAILED");
        params.set(`filter[_and][${andIdx}][_or][1][application_status][_null]`, "true");
        params.set(`filter[_and][${andIdx}][_or][2][_and][0][application_status][_eq]`, "SCHEDULED");
        params.set(`filter[_and][${andIdx}][_or][2][_and][1][effective_at][_lte]`, now);
        return andIdx + 1;
    }

    addAnd("[status][_eq]", normalized);
    return andIdx;
}
