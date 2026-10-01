-- Genero del producto: hombre, mujer o unisex (null = no aplica)
CREATE TYPE "Gender" AS ENUM ('MEN', 'WOMEN', 'UNISEX');

ALTER TABLE "products" ADD COLUMN "gender" "Gender";

-- Las tallas de ropa por genero pasan a ser "Ropa" + el genero del producto
UPDATE "products" SET "gender" = 'MEN', "sizeType" = 'CLOTHING' WHERE "sizeType" = 'CLOTHING_MEN';
UPDATE "products" SET "gender" = 'WOMEN', "sizeType" = 'CLOTHING' WHERE "sizeType" = 'CLOTHING_WOMEN';
