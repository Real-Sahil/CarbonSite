-- Records when a person accepted the Terms of Service at sign-up. Additive; existing users stay NULL.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "terms_accepted_at" TIMESTAMP(3),
ADD COLUMN     "terms_version" TEXT;

