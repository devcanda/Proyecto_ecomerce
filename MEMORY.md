# MEMORY.md — Compra En Linea (actualizado 2026-10-20)

## Estado Actual
- Tienda real "Compra En Linea" (Colombia, COP) en https://compraenlinea.store (cPanel/CloudLinux, Node 22, PostgreSQL 13). Ya NO es mock: Prisma 7 + PostgreSQL (local: Docker `basictech-db`, puerto 5490).
- Tienda: catálogo `/productos` (buscador, filtros, género), detalle con galería/zoom, variantes color+talla, carrito Zustand, "Comprar ahora", checkout.
- Auth NextAuth v5 (JWT, re-chequeo en BD cada 30 s). Roles: CUSTOMER, EDITOR (solo `/admin/products*`), ADMIN.
- Admin: productos (simple/variable, SKU, modelo, género, guía de tallas), usuarios (crear/editar/eliminar), carga masiva Excel/CSV, Fotos masivas (por nombre de archivo, arrastrar a productos sin foto, búsqueda con IA), Configuración > pestaña Inteligencia artificial.

## Decisiones Técnicas y Aprendizajes
- Variantes: `ProductVariant` (color/talla/precio/stock/images[]); fotos por color compartidas entre tallas; tallas ordenadas con `compareSizes`.
- Disponibilidad (`Product.availability`): STOCK (cuenta stock) | SUPPLIER (proveedor/dropshipping → "Disponible") | PREORDER (en camino → "Disponible bajo pedido"). Las 2 últimas venden sin stock (máx. 10 por línea). `supplierName` solo en panel, nunca en API pública.
- Excel (`src/lib/product-import.ts`): Talla `36-43` (rango) o `37,39,41` (lista); Stock vacío=SUPPLIER, "Bajo pedido"=PREORDER, número=por talla, lista=por talla en orden; columnas Proveedor y Fotos (enlaces, se descargan). Se quitan las notas de celda antes de leer (ExcelJS falla con xlsx hechos por Python/IA).
- IA (`src/lib/ai/`): agnóstica de proveedor, siempre vía `createAiClient(getAiConfig())`. Anthropic con SDK oficial; OpenAI/Gemini/compatibles por fetch. Claves cifradas (AES-GCM con AUTH_SECRET) en tabla `app_settings`. Buscador de imágenes: solo Serper.dev (Google CSE cerrado a cuentas nuevas).
- Pruebas actuales del dueño: Gemini `gemini-3.5-flash` (2.5-flash retirado para cuentas nuevas) + Serper.
- Fotos: `storeImage` (WebP ≤2000px, local `storage/uploads` o Cloudinary); descargas por URL bloquean IPs internas. Nombres: `REF.jpg`, `REF-2.jpg`, `REF_Color.jpg`.
- Emails en minúscula (`normalizeEmail`); contraseñas bcrypt. Panel solo con route handlers + `requireAdmin`/`requireProductManager`.
- Deploy: `npm run empaquetar` → subir tar.gz → `bash ~/tienda-nueva/instalacion/actualizar.sh` → RESTART. Migraciones con `migrar.mjs` (prisma migrate se cuelga en el hosting). No poner `node_modules` real en `~/tienda`.
- Tras cambiar `schema.prisma`, reiniciar `npm run dev` (el cliente Prisma queda en memoria).
- Barras de scroll: utilidad `scrollbar-brand` (globals.css; delgada, azul, sin flechas). Para mostrarla solo al pasar el ratón, alternar con `scrollbar-brand-hidden` vía estado React (onMouseEnter/Leave): Chrome no repinta `::-webkit-scrollbar` con `:hover`. Ej.: panel de filtros de `/productos`.

## Pendientes / Bugs Detectados
- Producción tiene la versión del 2026-10-07 (usuarios/seguridad, verificado 2026-10-20). Falta publicar: tallas por rango, disponibilidad, fotos masivas, IA, columna Fotos/Proveedor (3 migraciones: product_on_demand, app_settings, product_availability).
- Perfil: botón "Editar" de `/profile` sin acción (TestSprite TC011, sigue vigente).
- TestSprite (2026-01-03, desactualizado) por re-verificar: agregar varios productos al carrito (TC008/TC009) y prop `sizes` en `<Image fill>`.
- Filtros de la tienda: marca/categoría usan datos mock y Precio tiene máximo fijo 10.000 COP (panel de filtros PC ya tiene scroll propio, 2026-10-20); `/about` y `/contact` dan 404; footer dice "envío a todo Perú".
- Pasarela de pago colombiana pendiente (Stripe no sirve en Colombia). Pestañas General/Tienda/Notificaciones/Pagos de Configuración son maqueta.
- Lint previo: `Header` setMounted, comillas en `admin/settings/page.tsx`, imports sin uso en `AdminHeader`.
- Antes del lanzamiento: cambiar contraseñas admin; limpiar `~/restos_wordpress`, BD wp874 y dominios demo en cPanel.

## Próximos Pasos
1. Probar "Buscar con IA" con 3-5 productos reales y luego publicar la versión acumulada en producción.
2. Módulo de proveedores (reemplazará el texto libre `supplierName`).
3. Arreglar edición de perfil y re-verificar carrito con varios productos.
