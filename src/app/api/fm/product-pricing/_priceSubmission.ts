import {
    MatrixSetupError,
    type MatrixSetupReceipt,
    initializeMissingMatrixRow,
    rollbackMatrixInitialization,
} from "./_matrixSetup";
import {
    type NormalizedBatchCreateLine,
    fetchLivePriceTargets,
} from "./price-change-batches/_batch";

function keyOf(line: { product_id: number; price_type_id: number }) {
    return `${line.product_id}:${line.price_type_id}`;
}

export type PreparedPriceSubmission = {
    liveLines: NormalizedBatchCreateLine[];
    initialized: MatrixSetupReceipt[];
};

export async function rollbackPreparedInitializations(receipts: MatrixSetupReceipt[]) {
    const failures: Array<{ id: number; product_id: number; error: string }> = [];
    for (const receipt of [...receipts].reverse()) {
        try {
            await rollbackMatrixInitialization(receipt);
        } catch (error: unknown) {
            failures.push({
                id: receipt.id,
                product_id: receipt.productId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    return failures;
}

export async function preparePriceSubmission(args: {
    userId: number;
    lines: NormalizedBatchCreateLine[];
}): Promise<PreparedPriceSubmission> {
    const initialTargets = await fetchLivePriceTargets(args.lines);

    const liveLines: NormalizedBatchCreateLine[] = [];
    const initialized: MatrixSetupReceipt[] = [];

    try {
        for (const line of args.lines) {
            const target = initialTargets.get(keyOf(line));
            if (target) {
                liveLines.push({ ...line, current_price: target.price });
                continue;
            }

            try {
                initialized.push(await initializeMissingMatrixRow({
                    userId: args.userId,
                    productId: line.product_id,
                    priceTypeId: line.price_type_id,
                    initialPrice: line.proposed_price,
                }));
            } catch (error: unknown) {
                if (error instanceof MatrixSetupError && error.code === "price_matrix_target_exists") {
                    const concurrentTargets = await fetchLivePriceTargets([line]);
                    const concurrent = concurrentTargets.get(keyOf(line));
                    if (concurrent) {
                        liveLines.push({ ...line, current_price: concurrent.price });
                        continue;
                    }
                }
                throw error;
            }
        }
    } catch (error: unknown) {
        const rollbackFailures = await rollbackPreparedInitializations(initialized);
        if (rollbackFailures.length > 0) {
            throw new MatrixSetupError(
                "Price submission initialization rollback was incomplete.",
                "price_submission_partial_failure",
                500,
                { failures: rollbackFailures },
            );
        }
        throw error;
    }

    return { liveLines, initialized };
}
