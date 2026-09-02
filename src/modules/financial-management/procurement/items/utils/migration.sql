-- ============================================================================
-- Item modules overhaul - database cleanup migration
-- ============================================================================
-- This migration cleans up database artifacts left behind by the item modules
-- overhaul (consolidation of templates/variants/attributes into a unified
-- items module). It is provided as a reference artifact for the database
-- owner to apply manually - it is NOT executed by the application.
--
-- Statements:
--   1. DROP TABLE item_attribute_template_value
--      Write-only dead table: 37 orphaned records exist but no code ever reads
--      this table. The N+1 dead writes were removed from the variants POST
--      route (task 14), so the table is no longer referenced anywhere.
--
--   2. DROP TABLE item_attribute_template_line
--      Write-only dead table: 21 orphaned records exist but no code ever reads
--      this table. Same rationale as item_attribute_template_value - the
--      find-or-create writes were removed in task 14.
--
--   3. ALTER TABLE item_attribute DROP COLUMN display_type
--      display_type was never used by the UI (always rendered as a plain
--      select). The column is no longer written by the attributes POST route
--      (task 15) and is optional in the code types. Dropping it removes the
--      unused column.
--
--   4. DELETE orphaned attributes
--      Reference-aware cleanup: deletes only attributes that have NO values
--      (id NOT IN the distinct attribute_id set of item_attribute_value),
--      plus the 3 known test records (ids 7, 8, 9). Attributes that are
--      actually referenced by attribute values are preserved.
-- ============================================================================

DROP TABLE IF EXISTS item_attribute_template_value;

DROP TABLE IF EXISTS item_attribute_template_line;

ALTER TABLE item_attribute DROP COLUMN IF EXISTS display_type;

DELETE FROM item_attribute WHERE id IN (SELECT id FROM item_attribute WHERE id NOT IN (SELECT DISTINCT attribute_id FROM item_attribute_value)) OR id IN (7, 8, 9);

-- 5. ALTER TABLE item_variant ADD COLUMN uom
--    UOM moved from item_template (template level) to item_variant (variant level).
--    item_template.uom is kept in the DB for backward compatibility but is no
--    longer written by the application UI.
ALTER TABLE item_variant ADD COLUMN uom varchar(50) DEFAULT NULL;