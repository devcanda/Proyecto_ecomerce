import { prisma } from "./prisma"

// Similitud minima (0-1) para aceptar una palabra mal escrita: "mnitor" ~ "monitor" = 0.57
const SIMILARITY_THRESHOLD = 0.45
// Palabras mas cortas solo se buscan de forma exacta (evita coincidencias al azar)
const MIN_FUZZY_LENGTH = 3
const MAX_TOKENS = 8

export interface SearchResult {
  // id del producto -> puntaje de relevancia (mayor = mas relevante)
  scores: Map<string, number>
  // true si ningun producto contiene el termino tal cual (solo hay coincidencias aproximadas)
  approximate: boolean
}

/**
 * Busca productos activos por nombre, marca, categoria y descripcion,
 * tolerando errores de escritura y tildes (requiere pg_trgm y unaccent).
 */
export async function searchProducts(term: string): Promise<SearchResult> {
  const query = term.trim().toLowerCase()
  const tokens = query.split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS)
  if (tokens.length === 0) return { scores: new Map(), approximate: false }

  const rows = await prisma.$queryRaw<{ id: string; score: number; exact: boolean }[]>`
    WITH docs AS (
      SELECT
        p.id,
        unaccent(lower(p.name)) AS name,
        unaccent(lower(p.name || ' ' || b.name || ' ' || c.name || ' ' || coalesce(p.description, ''))) AS doc
      FROM products p
      JOIN brands b ON b.id = p."brandId"
      JOIN categories c ON c.id = p."categoryId"
      WHERE p."isActive" = true
    )
    SELECT
      id,
      strpos(doc, unaccent(${query})) > 0 AS exact,
      (
        CASE WHEN strpos(doc, unaccent(${query})) > 0 THEN 1 ELSE 0 END
        + word_similarity(unaccent(${query}), doc)
        + word_similarity(unaccent(${query}), name) * 0.5
      )::float8 AS score
    FROM docs
    WHERE NOT EXISTS (
      -- Cada palabra debe aparecer exacta o parecerse lo suficiente
      SELECT 1
      FROM unnest(${tokens}::text[]) AS t(token)
      WHERE strpos(doc, unaccent(t.token)) = 0
        AND (
          length(t.token) < ${MIN_FUZZY_LENGTH}
          OR word_similarity(unaccent(t.token), doc) < ${SIMILARITY_THRESHOLD}::real
        )
    )
  `

  return {
    scores: new Map(rows.map((row) => [row.id, row.score])),
    approximate: rows.length > 0 && !rows.some((row) => row.exact),
  }
}
