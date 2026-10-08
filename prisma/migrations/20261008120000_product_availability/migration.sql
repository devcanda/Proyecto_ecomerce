-- Disponibilidad del producto: inventario propio, proveedor/dropshipping o bajo pedido
DO $$ BEGIN
  CREATE TYPE "Availability" AS ENUM ('STOCK', 'SUPPLIER', 'PREORDER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "availability" "Availability" NOT NULL DEFAULT 'STOCK';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "supplierName" TEXT;

-- Los productos "bajo pedido" anteriores venian de listas de proveedor
DO $$ BEGIN
  UPDATE "products" SET "availability" = 'SUPPLIER' WHERE "onDemand" = true;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

ALTER TABLE "products" DROP COLUMN IF EXISTS "onDemand";
