-- AlterTable
ALTER TABLE "products" ADD COLUMN     "modelId" TEXT;

-- CreateTable
CREATE TABLE "product_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandId" TEXT NOT NULL,

    CONSTRAINT "product_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_models_brandId_idx" ON "product_models"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "product_models_brandId_slug_key" ON "product_models"("brandId", "slug");

-- CreateIndex
CREATE INDEX "products_modelId_idx" ON "products"("modelId");

-- AddForeignKey
ALTER TABLE "product_models" ADD CONSTRAINT "product_models_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "product_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
