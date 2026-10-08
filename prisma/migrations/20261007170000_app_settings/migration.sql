-- Configuracion editable desde el panel (proveedor de IA, busqueda de imagenes)
CREATE TABLE IF NOT EXISTS "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);
