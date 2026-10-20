-- Apply to each Directus database used by Financial Management and ERP_SERVER.
-- Existing price types become active; new rows default to active until explicitly deactivated.
-- The column is additive and the statement is safe to re-run.

SET @price_types_is_active_sql = IF(
    EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'price_types'
          AND COLUMN_NAME = 'is_active'
    ),
    'SELECT 1',
    'ALTER TABLE `price_types` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1'
);

PREPARE price_types_is_active_stmt FROM @price_types_is_active_sql;
EXECUTE price_types_is_active_stmt;
DEALLOCATE PREPARE price_types_is_active_stmt;
