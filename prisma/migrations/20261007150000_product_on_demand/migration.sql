-- Productos bajo pedido (de proveedor, sin stock propio)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "onDemand" BOOLEAN NOT NULL DEFAULT false;
