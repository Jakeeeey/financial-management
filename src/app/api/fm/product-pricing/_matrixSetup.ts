import {
    type LegacyPriceTypeRow,
    type LegacyProductsPatch,
    resolveLegacyProductsPatch,
} from "./_legacyProductPriceSync";
import { assertValidPriceValue } from "./_pricePrecision";
import { invalidateGroupIndexCacheOnCatalogChange } from "./_productGroupIndexCache";
import {
    PRICES,
    PRICE_TYPES,
    PRODUCTS,
    directusHeaders,
    fetchDirectus,
    mustBase,
    nowManila,
    pickId,
} from "./price-change-batches/_batch";

type DirectusList<T> = { data?: T[] };
type DirectusSingle<T> = { data?: T };

type MatrixRow = {
    id?: number | string | null;
    product_id?: number | string | null;
    price_type_id?: number | string | null;
    price?: number | string | null;
    status?: string | null;
};

type ProductSnapshot = Record<string, unknown> & { product_id?: number | string | null };

export type MatrixSetupReceipt = {
    id: number;
    row: MatrixRow;
    productId: number;
    productRestorePatch: Record<string, unknown> | null;
};

export class MatrixSetupError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly status: number,
        public readonly data?: Record<string, unknown>,
    ) {
        super(message);
        this.name = "MatrixSetupError";
    }
}

function messageOf(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

async function fetchPriceTypeCatalog() {
    const params = new URLSearchParams({
        fields: "price_type_id,price_type_name,sort",
        limit: "-1",
        sort: "sort,price_type_id",
    });
    const response = await fetchDirectus<DirectusList<LegacyPriceTypeRow>>(
        `${mustBase()}/items/${PRICE_TYPES}?${params.toString()}`,
        { headers: directusHeaders() },
    );
    return response.data ?? [];
}

async function findMatrixRow(productId: number, priceTypeId: number) {
    const params = new URLSearchParams({
        fields: "id,product_id,price_type_id,price,status",
        limit: "1",
        "filter[product_id][_eq]": String(productId),
        "filter[price_type_id][_eq]": String(priceTypeId),
    });
    const response = await fetchDirectus<DirectusList<MatrixRow>>(
        `${mustBase()}/items/${PRICES}?${params.toString()}`,
        { headers: directusHeaders() },
    );
    return response.data?.[0] ?? null;
}

async function fetchProductSnapshot(productId: number) {
    const params = new URLSearchParams({
        fields: "product_id,price_per_unit,priceA,priceB,priceC,priceD,priceE,last_updated,updated_by",
        limit: "1",
        "filter[product_id][_eq]": String(productId),
    });
    const response = await fetchDirectus<DirectusList<ProductSnapshot>>(
        `${mustBase()}/items/${PRODUCTS}?${params.toString()}`,
        { headers: directusHeaders() },
    );
    return response.data?.[0] ?? null;
}

function restorePatch(snapshot: ProductSnapshot, patch: LegacyProductsPatch) {
    const restore: Record<string, unknown> = {
        last_updated: snapshot.last_updated ?? null,
        updated_by: snapshot.updated_by ?? null,
    };
    for (const field of Object.keys(patch)) restore[field] = snapshot[field] ?? null;
    return restore;
}

export async function rollbackMatrixInitialization(receipt: MatrixSetupReceipt) {
    const failures: string[] = [];
    let matrixDeleted = false;
    try {
        await fetchDirectus(`${mustBase()}/items/${PRICES}/${receipt.id}`, {
            method: "DELETE",
            headers: directusHeaders(),
        });
        matrixDeleted = true;
    } catch (error: unknown) {
        failures.push(`matrix delete: ${messageOf(error)}`);
    }

    if (matrixDeleted && receipt.productRestorePatch) {
        try {
            await fetchDirectus(`${mustBase()}/items/${PRODUCTS}/${receipt.productId}`, {
                method: "PATCH",
                headers: directusHeaders(),
                body: JSON.stringify(receipt.productRestorePatch),
            });
        } catch (error: unknown) {
            failures.push(`product restore: ${messageOf(error)}`);
        }
    }

    invalidateGroupIndexCacheOnCatalogChange();

    if (failures.length > 0) {
        throw new MatrixSetupError(
            "Matrix initialization rollback was incomplete.",
            "price_matrix_setup_partial_failure",
            500,
            { id: receipt.id, product_id: receipt.productId, failures },
        );
    }
}

export async function initializeMissingMatrixRow(args: {
    userId: number;
    productId: number;
    priceTypeId: number;
    initialPrice: unknown;
}): Promise<MatrixSetupReceipt> {
    const { userId, productId, priceTypeId } = args;
    const initialPrice = args.initialPrice === null
        ? null
        : assertValidPriceValue(args.initialPrice, "initial_price");
    const [product, catalog, existing] = await Promise.all([
        fetchProductSnapshot(productId),
        fetchPriceTypeCatalog(),
        findMatrixRow(productId, priceTypeId),
    ]);

    if (!product) throw new MatrixSetupError(`Product ${productId} does not exist.`, "invalid_product", 400);
    const priceType = catalog.find((row) => Number(row.price_type_id) === priceTypeId);
    if (!priceType) throw new MatrixSetupError(`Price type ${priceTypeId} does not exist.`, "invalid_price_type", 400);
    if (existing) {
        throw new MatrixSetupError(
            "The product and price-type combination already exists.",
            "price_matrix_target_exists",
            409,
            { row: existing },
        );
    }

    const now = nowManila();
    let created: DirectusSingle<MatrixRow>;
    try {
        created = await fetchDirectus<DirectusSingle<MatrixRow>>(`${mustBase()}/items/${PRICES}`, {
            method: "POST",
            headers: directusHeaders(),
            body: JSON.stringify({
                product_id: productId,
                price_type_id: priceTypeId,
                price: initialPrice,
                status: "approved",
                created_by: userId,
                updated_by: userId,
                created_at: now,
                updated_at: now,
            }),
        });
    } catch (error: unknown) {
        const concurrent = await findMatrixRow(productId, priceTypeId).catch(() => null);
        if (concurrent) {
            throw new MatrixSetupError(
                "The product and price-type combination already exists.",
                "price_matrix_target_exists",
                409,
                { row: concurrent },
            );
        }
        throw error;
    }

    const id = pickId(created.data?.id);
    if (!id) {
        throw new MatrixSetupError(
            "Created matrix row did not return an id.",
            "price_matrix_setup_partial_failure",
            500,
            { product_id: productId, price_type_id: priceTypeId },
        );
    }

    const productPatch = resolveLegacyProductsPatch({
        priceTypeId,
        priceTypeName: priceType.price_type_name,
        price: initialPrice,
        catalog,
    });
    const receipt: MatrixSetupReceipt = {
        id,
        row: created.data ?? { id },
        productId,
        productRestorePatch: productPatch ? restorePatch(product, productPatch) : null,
    };

    try {
        if (productPatch) {
            await fetchDirectus(`${mustBase()}/items/${PRODUCTS}/${productId}`, {
                method: "PATCH",
                headers: directusHeaders(),
                body: JSON.stringify({ ...productPatch, last_updated: nowManila(), updated_by: userId }),
            });
        }
    } catch (syncError: unknown) {
        try {
            await rollbackMatrixInitialization(receipt);
        } catch (rollbackError: unknown) {
            console.error("[matrix-setup] Synchronization and rollback failed.", {
                syncError: messageOf(syncError),
                rollbackError: messageOf(rollbackError),
                id,
            });
            throw rollbackError;
        }
        throw new MatrixSetupError(
            "Price matrix setup failed; the created row was rolled back.",
            "price_matrix_setup_sync_failed",
            500,
            { details: messageOf(syncError) },
        );
    }

    invalidateGroupIndexCacheOnCatalogChange();
    return receipt;
}
