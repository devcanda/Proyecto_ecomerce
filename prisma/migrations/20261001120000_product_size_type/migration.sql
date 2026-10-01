-- Tallas de ropa separadas para hombre y mujer
ALTER TYPE "VariantType" ADD VALUE 'CLOTHING_MEN';
ALTER TYPE "VariantType" ADD VALUE 'CLOTHING_WOMEN';

-- Cada producto guarda su propio tipo de talla
ALTER TABLE "products" ADD COLUMN "sizeType" "VariantType" NOT NULL DEFAULT 'NONE';

-- Los productos que ya tienen tallas toman el tipo de su categoria
UPDATE "products" p
SET "sizeType" = c."variantType"
FROM "categories" c
WHERE c."id" = p."categoryId"
  AND EXISTS (SELECT 1 FROM "product_variants" v WHERE v."productId" = p."id" AND v."size" IS NOT NULL);
