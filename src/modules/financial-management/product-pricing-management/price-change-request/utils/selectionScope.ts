type RowWithRequestId = {
    request_id?: number | string | null;
};

export function visibleRequestIdsOnPage(rows: RowWithRequestId[]): Set<number> {
    const ids = new Set<number>();
    for (const row of rows) {
        const id = Number(row.request_id);
        if (Number.isFinite(id)) {
            ids.add(id);
        }
    }
    return ids;
}

export function countOffPageSelected(selectedIds: number[], visiblePageIds: Set<number>): number {
    return selectedIds.filter((id) => !visiblePageIds.has(id)).length;
}
