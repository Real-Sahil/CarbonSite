-- A project site's own position, chosen from address search. Additive.

ALTER TABLE "sites" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;
