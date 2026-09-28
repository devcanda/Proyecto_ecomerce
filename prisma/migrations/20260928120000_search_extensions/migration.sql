-- Busqueda tolerante a errores de escritura (ej. "mnitor" -> "monitor")
-- pg_trgm: similitud por trigramas | unaccent: ignora tildes
-- Ambas son extensiones "trusted": no requieren superusuario en PostgreSQL 13+
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
