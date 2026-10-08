-- Los correos se guardan en minusculas y sin espacios (el inicio de sesion ya no distingue mayusculas).
-- Si dos cuentas quedaran con el mismo correo, se deja la existente sin cambiar.
UPDATE "users" u
SET "email" = lower(trim(u."email"))
WHERE u."email" <> lower(trim(u."email"))
  AND NOT EXISTS (
    SELECT 1 FROM "users" o WHERE o."email" = lower(trim(u."email")) AND o."id" <> u."id"
  );
