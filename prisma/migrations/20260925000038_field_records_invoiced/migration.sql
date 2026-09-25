-- Records created by approving a field submission (waste ticket, delivery
-- note, fuel receipt) were left at the default data origin 'estimated'. Their
-- quantities come from the document, so they are invoiced primary data.
-- Emissions are unchanged; only the provenance label and pedigree tier move.
UPDATE "activity_records"
SET "data_origin" = 'invoiced'
WHERE "field_submission_id" IS NOT NULL
  AND "data_origin" = 'estimated';
