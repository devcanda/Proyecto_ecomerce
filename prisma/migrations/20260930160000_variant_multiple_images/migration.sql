-- Varias fotos por color: la foto actual pasa a ser la portada (primera de la lista)
ALTER TABLE "product_variants" ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "product_variants" SET "images" = ARRAY["image"] WHERE "image" IS NOT NULL;

ALTER TABLE "product_variants" DROP COLUMN "image";
