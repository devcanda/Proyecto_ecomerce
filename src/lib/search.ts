import { prisma } from "./prisma"

// Similitud minima (0-1) para aceptar una palabra mal escrita: "mnitor" ~ "monitor" = 0.5
const SIMILARITY_THRESHOLD = 0.4
// Palabras mas cortas solo se buscan de forma exacta (evita coincidencias al azar)
const MIN_FUZZY_LENGTH = 3
const MAX_TOKENS = 8

export interface SearchResult {
  // id del producto -> puntaje de relevancia (mayor = mas relevante)
  scores: Map<string, number>
  // true si ningun producto contiene el termino tal cual (solo hay coincidencias aproximadas)
  approximate: boolean
}

// Minusculas y sin tildes: "Audífonos" -> "audifonos"
const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

const toWords = (text: string) => text.split(/[^a-z0-9]+/).filter(Boolean)

// Trigramas de una palabra, como en PostgreSQL pg_trgm: "  m", " mo", "mon", ...
function trigrams(word: string): Set<string> {
  const padded = `  ${word} `
  const result = new Set<string>()
  for (let i = 0; i < padded.length - 2; i++) result.add(padded.slice(i, i + 3))
  return result
}

const trigramCache = new Map<string, Set<string>>()
function cachedTrigrams(word: string) {
  let value = trigramCache.get(word)
  if (!value) {
    value = trigrams(word)
    if (trigramCache.size > 20000) trigramCache.clear()
    trigramCache.set(word, value)
  }
  return value
}

// Parecido entre dos palabras (0 = nada, 1 = iguales)
function similarity(a: string, b: string) {
  const ta = cachedTrigrams(a)
  const tb = cachedTrigrams(b)
  let shared = 0
  for (const gram of ta) if (tb.has(gram)) shared++
  return shared / (ta.size + tb.size - shared)
}

const bestSimilarity = (token: string, words: string[]) =>
  words.reduce((best, word) => Math.max(best, similarity(token, word)), 0)

/**
 * Busca productos activos por nombre, marca, categoria y descripcion,
 * tolerando errores de escritura y tildes. Se resuelve en la aplicacion,
 * asi que no necesita extensiones especiales de PostgreSQL.
 */
export async function searchProducts(term: string): Promise<SearchResult> {
  const query = normalize(term.trim())
  const tokens = toWords(query).slice(0, MAX_TOKENS)
  if (tokens.length === 0) return { scores: new Map(), approximate: false }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
    },
  })

  const scores = new Map<string, number>()
  let anyExact = false

  for (const product of products) {
    const name = normalize(product.name)
    const doc = normalize(`${product.name} ${product.brand.name} ${product.category.name} ${product.description ?? ""}`)
    const docWords = toWords(doc)
    const nameWords = toWords(name)

    // Cada palabra debe aparecer tal cual o parecerse lo suficiente
    let total = 0
    let matches = true
    for (const token of tokens) {
      if (doc.includes(token)) {
        total += 1
        continue
      }
      const score = token.length < MIN_FUZZY_LENGTH ? 0 : bestSimilarity(token, docWords)
      if (score < SIMILARITY_THRESHOLD) {
        matches = false
        break
      }
      total += score
    }
    if (!matches) continue

    const exact = doc.includes(query)
    if (exact) anyExact = true
    // Mas relevante si la frase completa aparece y si coincide con el nombre
    const nameScore = tokens.reduce(
      (sum, token) => sum + (name.includes(token) ? 1 : bestSimilarity(token, nameWords)),
      0
    )
    scores.set(product.id, (exact ? 1 : 0) + total / tokens.length + (nameScore / tokens.length) * 0.5)
  }

  return { scores, approximate: scores.size > 0 && !anyExact }
}
