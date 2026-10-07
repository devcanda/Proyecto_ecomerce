-- Extensiones opcionales de busqueda (pg_trgm y unaccent).
-- La busqueda de la tienda ya no las necesita (se resuelve en la aplicacion), asi que si el
-- servidor no las tiene instaladas (comun en hostings compartidos) se omiten sin error.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm no disponible: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS unaccent;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'unaccent no disponible: %', SQLERRM;
END $$;
