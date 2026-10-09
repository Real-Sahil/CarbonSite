-- AlterTable
ALTER TABLE "waste_documents" ADD COLUMN     "waste_record_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "waste_documents_waste_record_id_key" ON "waste_documents"("waste_record_id");

