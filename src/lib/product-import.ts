import ExcelJS from "exceljs"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/slug"
import { compareSizes, guessVariantType } from "@/lib/category-type"
import { syncVariants, type VariantInput } from "@/lib/variants"
import type { Gender, VariantType } from "@/types"

// ---------------------------------------------------------------------------
// Columnas de la plantilla
// ---------------------------------------------------------------------------

export type ColumnKey =
  | "sku"
  | "name"
  | "description"
  | "category"
  | "brand"
  | "model"
  | "gender"
  | "sizeType"
  | "price"
  | "comparePrice"
  | "color"
  | "size"
  | "stock"
  | "variantPrice"
  | "featured"
  | "isNew"

interface ColumnDef {
  key: ColumnKey
  header: string
  required: string
  help: string
  example: string
  width: number
}

export const COLUMNS: ColumnDef[] = [
  { key: "sku", header: "Referencia", required: "Sí", width: 16, example: "NIK-SHOX-R4", help: "Código único del producto. Las filas con la misma referencia son el mismo producto (una fila por cada color/talla). Si ya existe, el producto se actualiza." },
  { key: "name", header: "Nombre", required: "Sí (productos nuevos)", width: 32, example: "Nike Shox R4", help: "Nombre del producto. En un producto variable basta con escribirlo en la primera fila." },
  { key: "description", header: "Descripción", required: "No", width: 40, example: "Tenis con amortiguación de resortes", help: "Texto que ve el cliente." },
  { key: "category", header: "Categoría", required: "Sí (productos nuevos)", width: 18, example: "Calzado", help: "Si no existe, se crea." },
  { key: "brand", header: "Marca", required: "Sí (productos nuevos)", width: 16, example: "Nike", help: "Si no existe, se crea." },
  { key: "model", header: "Modelo", required: "No", width: 16, example: "Shox R4", help: "Modelo dentro de la marca. Si no existe, se crea." },
  { key: "gender", header: "Género", required: "No", width: 12, example: "Hombre", help: "Hombre, Mujer, Unisex o vacío (no aplica)." },
  { key: "sizeType", header: "Tipo de talla", required: "Solo si tiene tallas", width: 14, example: "Calzado", help: "Sin talla, Calzado o Ropa. Si lo dejas vacío y hay tallas, se deduce." },
  { key: "price", header: "Precio", required: "Sí (productos nuevos)", width: 13, example: "450000", help: "Precio en COP, sin símbolos. Ej. 450000 o 450.000" },
  { key: "comparePrice", header: "Precio anterior", required: "No", width: 15, example: "520000", help: "Precio tachado (oferta). Vacío si no aplica." },
  { key: "color", header: "Color", required: "Solo productos variables", width: 13, example: "Negro", help: "Color de esta fila. Vacío si el producto no maneja colores." },
  { key: "size", header: "Talla", required: "Solo productos variables", width: 10, example: "40", help: "Talla de esta fila. Vacío si el producto no maneja tallas." },
  { key: "stock", header: "Stock", required: "No (0 si está vacío)", width: 9, example: "3", help: "Unidades disponibles de este producto, o de esta combinación de color y talla." },
  { key: "variantPrice", header: "Precio variante", required: "No", width: 15, example: "470000", help: "Precio solo para este color/talla. Vacío = usa el Precio del producto." },
  { key: "featured", header: "Destacado", required: "No", width: 11, example: "No", help: "Sí o No. Muestra el producto en destacados." },
  { key: "isNew", header: "Nuevo", required: "No", width: 9, example: "Sí", help: "Sí o No. Muestra la etiqueta \"Nuevo\"." },
]

const SIZE_TYPE_OPTIONS = ["Sin talla", "Calzado", "Ropa"]
const GENDER_OPTIONS = ["Hombre", "Mujer", "Unisex"]
const YES_NO = ["Sí", "No"]

export const MAX_IMPORT_ROWS = 3000

// ---------------------------------------------------------------------------
// Plantilla de Excel
// ---------------------------------------------------------------------------

export async function buildTemplate(): Promise<Buffer> {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ])

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Compra En Linea"

  const headerStyle = (row: ExcelJS.Row) => {
    row.font = { bold: true, color: { argb: "FFFFFFFF" } }
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF04ADBF" } }
    row.alignment = { vertical: "middle" }
    row.height = 22
  }

  // Hoja donde se llenan los productos
  const sheet = workbook.addWorksheet("Productos", { views: [{ state: "frozen", ySplit: 1 }] })
  sheet.columns = COLUMNS.map((column) => ({ header: column.header, key: column.key, width: column.width }))
  headerStyle(sheet.getRow(1))
  COLUMNS.forEach((column, index) => {
    sheet.getCell(1, index + 1).note = `${column.help}\nObligatorio: ${column.required}`
  })

  // Hoja de listas (opciones de las celdas desplegables)
  const lists = workbook.addWorksheet("Listas")
  lists.columns = [
    { header: "Categorías existentes", key: "category", width: 26 },
    { header: "Marcas existentes", key: "brand", width: 22 },
    { header: "Género", key: "gender", width: 12 },
    { header: "Tipo de talla", key: "sizeType", width: 14 },
    { header: "Sí / No", key: "yesNo", width: 9 },
  ]
  headerStyle(lists.getRow(1))
  const longest = Math.max(categories.length, brands.length, 3)
  for (let i = 0; i < longest; i++) {
    lists.addRow({
      category: categories[i]?.name,
      brand: brands[i]?.name,
      gender: GENDER_OPTIONS[i],
      sizeType: SIZE_TYPE_OPTIONS[i],
      yesNo: YES_NO[i],
    })
  }

  const columnLetter = (key: ColumnKey) => sheet.getColumn(key).letter
  const lastRow = MAX_IMPORT_ROWS + 1
  const listValidation = (key: ColumnKey, formula: string, strict: boolean) => {
    const letter = columnLetter(key)
    for (let row = 2; row <= lastRow; row++) {
      sheet.getCell(`${letter}${row}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
        // Categoria y marca permiten escribir una nueva; el resto solo acepta la lista
        showErrorMessage: strict,
        errorStyle: "stop",
        errorTitle: "Valor no válido",
        error: "Elige una opción de la lista.",
      }
    }
  }
  if (categories.length) listValidation("category", `Listas!$A$2:$A$${categories.length + 1}`, false)
  if (brands.length) listValidation("brand", `Listas!$B$2:$B$${brands.length + 1}`, false)
  listValidation("gender", `Listas!$C$2:$C$4`, true)
  listValidation("sizeType", `Listas!$D$2:$D$4`, true)
  listValidation("featured", `Listas!$E$2:$E$3`, true)
  listValidation("isNew", `Listas!$E$2:$E$3`, true)

  // Hoja de ejemplo (no se importa)
  const example = workbook.addWorksheet("Ejemplo")
  example.columns = COLUMNS.map((column) => ({ header: column.header, key: column.key, width: column.width }))
  headerStyle(example.getRow(1))
  const exampleRows: Partial<Record<ColumnKey, string | number>>[] = [
    { sku: "COR-K100", name: "Teclado Corsair K100", description: "Teclado mecánico RGB", category: "Teclados", brand: "Corsair", price: 459900, stock: 12, featured: "Sí", isNew: "No" },
    { sku: "NIK-SHOX-R4", name: "Nike Shox R4", description: "Tenis con amortiguación", category: "Calzado", brand: "Nike", model: "Shox R4", gender: "Hombre", sizeType: "Calzado", price: 450000, color: "Negro", size: "40", stock: 3 },
    { sku: "NIK-SHOX-R4", color: "Negro", size: "41", stock: 2 },
    { sku: "NIK-SHOX-R4", color: "Blanco", size: "40", stock: 4, variantPrice: 470000 },
    { sku: "TER-ACERO", name: "Termo de acero 1L", category: "Hogar", brand: "Genérica", sizeType: "Sin talla", price: 45000, color: "Rojo", stock: 5 },
    { sku: "TER-ACERO", color: "Azul", stock: 3 },
  ]
  exampleRows.forEach((row) => example.addRow(row))

  // Instrucciones
  const help = workbook.addWorksheet("Instrucciones")
  help.columns = [
    { header: "Columna", key: "header", width: 18 },
    { header: "Obligatorio", key: "required", width: 22 },
    { header: "Qué escribir", key: "help", width: 80 },
    { header: "Ejemplo", key: "example", width: 18 },
  ]
  headerStyle(help.getRow(1))
  COLUMNS.forEach((column) => help.addRow(column))
  help.addRow({})
  ;[
    "Cómo llenar la hoja \"Productos\":",
    "• Producto simple (un precio y un stock): una sola fila.",
    "• Producto variable: una fila por cada color y/o talla, todas con la misma Referencia.",
    "• En las filas siguientes del mismo producto basta con Referencia, Color, Talla y Stock.",
    "• Las fotos se agregan después desde el panel. Mientras tanto la tienda muestra \"Foto próximamente\".",
    "• Si subes de nuevo una Referencia que ya existe, se actualiza ese producto. Las celdas vacías no borran datos.",
    "• Mira la hoja \"Ejemplo\" para ver un archivo lleno. Esa hoja no se importa.",
  ].forEach((text) => {
    const row = help.addRow({ header: text })
    help.mergeCells(`A${row.number}:D${row.number}`)
  })
  help.getColumn("help").alignment = { wrapText: true, vertical: "top" }

  // La hoja Productos queda como la primera que se abre
  workbook.views = [{ activeTab: 0, x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, visibility: "visible" }]

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

// ---------------------------------------------------------------------------
// Lectura del archivo
// ---------------------------------------------------------------------------

interface RawRow {
  row: number
  values: Partial<Record<ColumnKey, string>>
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

// Encabezados aceptados (tambien sin tildes o en minusculas)
const HEADER_ALIASES: Record<string, ColumnKey> = Object.fromEntries(
  COLUMNS.flatMap((column) => [
    [normalize(column.header), column.key],
    ...(column.key === "sku" ? [["sku", column.key], ["codigo", column.key], ["ref", column.key]] : []),
  ])
)

const cellText = (cell: ExcelJS.Cell): string => {
  const value = cell.value
  if (value === null || value === undefined) return ""
  if (typeof value === "number") return String(value)
  if (value instanceof Date) return value.toISOString()
  return (cell.text ?? "").trim()
}

async function readXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  const sheet = workbook.getWorksheet("Productos") ?? workbook.worksheets[0]
  if (!sheet) return []
  const rows: string[][] = []
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = []
    for (let col = 1; col <= Math.max(sheet.columnCount, COLUMNS.length); col++) {
      cells.push(cellText(row.getCell(col)))
    }
    rows[rowNumber - 1] = cells
  })
  return Array.from(rows, (row) => row ?? [])
}

// CSV con coma o punto y coma (Excel en español suele usar ";")
function readCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "")
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ""
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ","
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === delimiter) {
      row.push(field.trim())
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i++
      row.push(field.trim())
      rows.push(row)
      row = []
      field = ""
    } else field += char
  }
  if (field || row.length) {
    row.push(field.trim())
    rows.push(row)
  }
  return rows
}

export async function readImportFile(buffer: Buffer, fileName: string): Promise<{ rows: RawRow[]; missingHeaders: string[] }> {
  const grid = fileName.toLowerCase().endsWith(".csv") ? readCsv(buffer.toString("utf8")) : await readXlsx(buffer)
  const headerIndex = grid.findIndex((cells) => cells.some((cell) => HEADER_ALIASES[normalize(cell)] === "sku"))
  if (headerIndex === -1) return { rows: [], missingHeaders: ["Referencia"] }

  const headerMap = new Map<number, ColumnKey>()
  grid[headerIndex].forEach((cell, index) => {
    const key = HEADER_ALIASES[normalize(cell)]
    if (key && ![...headerMap.values()].includes(key)) headerMap.set(index, key)
  })
  const present = new Set(headerMap.values())
  const missingHeaders = COLUMNS.filter((column) => ["sku", "name", "category", "brand", "price"].includes(column.key))
    .filter((column) => !present.has(column.key))
    .map((column) => column.header)

  const rows: RawRow[] = []
  grid.slice(headerIndex + 1).forEach((cells, offset) => {
    const values: Partial<Record<ColumnKey, string>> = {}
    headerMap.forEach((key, index) => {
      const value = (cells[index] ?? "").trim()
      if (value) values[key] = value
    })
    if (Object.keys(values).length) rows.push({ row: headerIndex + offset + 2, values })
  })
  return { rows, missingHeaders }
}

// ---------------------------------------------------------------------------
// Conversion de valores
// ---------------------------------------------------------------------------

// Acepta 450000, 450.000, 450,000.50, 450.000,50 y $ 450.000
export function parseMoney(raw?: string): number | undefined | null {
  if (!raw) return undefined
  let text = raw.replace(/cop/i, "").replace(/[$\s]/g, "")
  if (!text) return undefined
  const hasDot = text.includes(".")
  const hasComma = text.includes(",")
  if (hasDot && hasComma) {
    text = text.lastIndexOf(",") > text.lastIndexOf(".")
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "")
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "")
  } else if (hasComma) {
    text = /^\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, "") : text.replace(",", ".")
  }
  const value = Number(text)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

function parseStock(raw?: string): number | undefined | null {
  if (!raw) return undefined
  const value = Number(raw.replace(/[.\s]/g, "").replace(",", "."))
  return Number.isInteger(value) && value >= 0 ? value : null
}

function parseYesNo(raw?: string): boolean | undefined {
  if (!raw) return undefined
  return /^(si|s|x|1|true|verdadero)$/.test(normalize(raw))
}

function parseGenderText(raw?: string): Gender | null | undefined | "invalid" {
  if (!raw) return undefined
  const text = normalize(raw)
  if (/^(no aplica|ninguno|n a)$/.test(text)) return null
  if (/^(hombre|masculino|caballero|h)$/.test(text)) return "MEN"
  if (/^(mujer|femenino|dama|m)$/.test(text)) return "WOMEN"
  if (text === "unisex") return "UNISEX"
  return "invalid"
}

function parseSizeTypeText(raw?: string): VariantType | undefined | "invalid" {
  if (!raw) return undefined
  const text = normalize(raw)
  if (/^(sin talla|ninguna|no aplica|solo color|solo colores)$/.test(text)) return "NONE"
  if (/^(calzado|zapatos|tenis)$/.test(text)) return "FOOTWEAR"
  if (/^(ropa|prenda|prendas)$/.test(text)) return "CLOTHING"
  return "invalid"
}

const moneyText = (value: number) => new Intl.NumberFormat("es-CO").format(value)

// ---------------------------------------------------------------------------
// Analisis (vista previa): no escribe nada en la base de datos
// ---------------------------------------------------------------------------

export interface ImportMessage {
  type: "error" | "warning" | "info"
  text: string
  row?: number
}

interface PlannedVariant {
  row: number
  color?: string
  size?: string
  stock?: number
  price?: number | null
}

export interface ImportItem {
  sku: string
  name: string
  action: "create" | "update"
  rows: number[]
  status: "ok" | "warning" | "error"
  messages: ImportMessage[]
  variantCount: number
  stock: number
  price?: number
  category?: string
  brand?: string
  isVariable: boolean
}

interface PlannedProduct extends ImportItem {
  existingId?: string
  description?: string
  model?: string
  gender?: Gender | null
  sizeType?: VariantType
  comparePrice?: number | null
  featured?: boolean
  isNew?: boolean
  variants: PlannedVariant[]
}

export interface ImportPreview {
  summary: {
    rows: number
    products: number
    create: number
    update: number
    withErrors: number
    newCategories: string[]
    newBrands: string[]
    newModels: string[]
  }
  items: ImportItem[]
  fileErrors: string[]
}

interface Lookups {
  categories: Map<string, { id: string; name: string }>
  brands: Map<string, { id: string; name: string }>
  models: Map<string, { id: string; name: string }>
  products: Map<
    string,
    { id: string; name: string; sizeType: VariantType; variants: { id: string; size: string | null; color: string | null; price: unknown; stock: number; images: string[] }[] }
  >
  slugs: Set<string>
}

const variantKey = (color?: string | null, size?: string | null) =>
  `${normalize(color ?? "")}|${normalize(size ?? "")}`

async function loadLookups(skus: string[]): Promise<Lookups> {
  const [categories, brands, models, products, slugs] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.brand.findMany({ select: { id: true, name: true } }),
    prisma.productModel.findMany({ select: { id: true, name: true, brandId: true } }),
    prisma.product.findMany({
      where: { sku: { in: skus } },
      select: {
        id: true,
        sku: true,
        name: true,
        sizeType: true,
        variants: { orderBy: { position: "asc" }, select: { id: true, size: true, color: true, price: true, stock: true, images: true } },
      },
    }),
    prisma.product.findMany({ select: { slug: true } }),
  ])
  return {
    categories: new Map(categories.map((item) => [normalize(item.name), item])),
    brands: new Map(brands.map((item) => [normalize(item.name), item])),
    models: new Map(models.map((item) => [`${item.brandId}|${normalize(item.name)}`, item])),
    products: new Map(products.map((item) => [normalize(item.sku ?? ""), item])),
    slugs: new Set(slugs.map((item) => item.slug)),
  }
}

// Deduce el tipo de talla si no se escribio: numeros de 30 a 50 = calzado; letras = ropa
function inferSizeType(sizes: string[]): VariantType | undefined {
  if (!sizes.length) return undefined
  const numeric = sizes.every((size) => {
    const value = Number(size.replace(",", "."))
    return Number.isFinite(value) && value >= 30 && value <= 50
  })
  if (numeric) return "FOOTWEAR"
  const letters = sizes.every((size) => /^(xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl)$/i.test(size))
  return letters ? "CLOTHING" : undefined
}

async function planImport(rows: RawRow[]): Promise<{ products: PlannedProduct[]; lookups: Lookups }> {
  // Agrupar filas por referencia
  const groups = new Map<string, RawRow[]>()
  const noSku: RawRow[] = []
  for (const row of rows) {
    const sku = row.values.sku?.trim()
    if (!sku) {
      noSku.push(row)
      continue
    }
    const key = normalize(sku)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  const lookups = await loadLookups([...groups.values()].map((group) => group[0].values.sku!.trim()))
  const plannedSlugs = new Set<string>()
  const products: PlannedProduct[] = []

  for (const [key, group] of groups) {
    const messages: ImportMessage[] = []
    const error = (text: string, row?: number) => messages.push({ type: "error", text, row })
    const warning = (text: string, row?: number) => messages.push({ type: "warning", text, row })
    const info = (text: string, row?: number) => messages.push({ type: "info", text, row })

    // Datos del producto: el primer valor escrito en cualquiera de sus filas
    const first = (column: ColumnKey) => group.find((row) => row.values[column])?.values[column]
    const conflict = (column: ColumnKey, label: string) => {
      const values = group.filter((row) => row.values[column])
      const distinct = new Set(values.map((row) => normalize(row.values[column]!)))
      if (distinct.size > 1) error(`${label} distinto entre las filas ${values.map((row) => row.row).join(", ")} de la misma referencia.`)
    }
    ;(["name", "category", "brand", "price"] as const).forEach((column) =>
      conflict(column, { name: "Nombre", category: "Categoría", brand: "Marca", price: "Precio" }[column])
    )

    const sku = group[0].values.sku!.trim()
    const existing = lookups.products.get(key)
    const action = existing ? "update" : "create"
    const name = first("name") ?? existing?.name ?? ""
    const category = first("category")
    const brand = first("brand")
    const model = first("model")

    if (action === "create") {
      if (!name) error("Falta el Nombre.", group[0].row)
      if (!category) error("Falta la Categoría.", group[0].row)
      if (!brand) error("Falta la Marca.", group[0].row)
    }
    if (model && !brand && action === "create") error("El Modelo necesita una Marca.", group[0].row)

    const price = parseMoney(first("price"))
    if (price === null || (price !== undefined && price <= 0)) error("El Precio no es un número válido mayor a 0.", group.find((row) => row.values.price)?.row)
    if (price === undefined && action === "create") error("Falta el Precio.", group[0].row)

    const comparePrice = parseMoney(first("comparePrice"))
    if (comparePrice === null) error("El Precio anterior no es un número válido.")

    const genderValue = parseGenderText(first("gender"))
    if (genderValue === "invalid") error(`Género "${first("gender")}" no válido. Usa Hombre, Mujer o Unisex.`)

    let sizeType = parseSizeTypeText(first("sizeType"))
    if (sizeType === "invalid") {
      error(`Tipo de talla "${first("sizeType")}" no válido. Usa Sin talla, Calzado o Ropa.`)
      sizeType = undefined
    }

    // Variantes: filas con color y/o talla
    const isVariable = group.some((row) => row.values.color || row.values.size)
    const variants: PlannedVariant[] = []
    if (isVariable) {
      const seen = new Map<string, number>()
      for (const row of group) {
        const color = row.values.color?.trim()
        const size = row.values.size?.trim().replace(",", ".")
        if (!color && !size) {
          error("En un producto variable cada fila necesita Color o Talla.", row.row)
          continue
        }
        const vKey = variantKey(color, size)
        if (seen.has(vKey)) {
          error(`Color/talla repetido (también en la fila ${seen.get(vKey)}).`, row.row)
          continue
        }
        seen.set(vKey, row.row)
        const stock = parseStock(row.values.stock)
        if (stock === null) error(`Stock "${row.values.stock}" no válido (debe ser un número entero).`, row.row)
        const variantPrice = parseMoney(row.values.variantPrice)
        if (variantPrice === null || (typeof variantPrice === "number" && variantPrice <= 0)) error("Precio variante no válido.", row.row)
        variants.push({ row: row.row, color, size, stock: stock ?? undefined, price: variantPrice ?? undefined })
      }

      const sizes = variants.flatMap((variant) => (variant.size ? [variant.size] : []))
      if (sizeType === "NONE" && sizes.length) error("El Tipo de talla es \"Sin talla\" pero hay tallas escritas.")
      if ((sizeType === "FOOTWEAR" || sizeType === "CLOTHING") && sizes.length === 0) error("El Tipo de talla pide tallas, pero no hay ninguna.")
      if (sizes.length && sizes.length !== variants.length) error("Si el producto usa tallas, todas sus filas deben tener Talla.")
      if (!sizeType) {
        if (sizes.length === 0) sizeType = "NONE"
        else if (existing && existing.sizeType !== "NONE") sizeType = existing.sizeType
        else {
          sizeType = inferSizeType(sizes)
          if (sizeType) info(`Tipo de talla deducido: ${sizeType === "FOOTWEAR" ? "Calzado" : "Ropa"}.`)
          else error("No se pudo deducir el Tipo de talla. Escribe Calzado o Ropa.")
        }
      }
    } else {
      if (group.length > 1) error(`La referencia está en varias filas (${group.map((row) => row.row).join(", ")}) sin Color ni Talla. Si es variable, agrega Color/Talla.`)
      if (group[0].values.variantPrice) warning("Precio variante se ignora en productos simples.", group[0].row)
      if (sizeType && sizeType !== "NONE") error("El Tipo de talla indica tallas, pero no hay ninguna Talla escrita.")
    }

    const simpleStock = isVariable ? undefined : parseStock(group[0].values.stock)
    if (simpleStock === null) error(`Stock "${group[0].values.stock}" no válido (debe ser un número entero).`, group[0].row)

    // Productos existentes que pasan de simple a variable o al reves
    if (existing && isVariable && existing.variants.length === 0) info("Se convertirá en producto variable.")
    if (existing && !isVariable && existing.variants.length > 0) {
      error("Este producto es variable en la tienda: incluye su Color/Talla en cada fila para actualizarlo.")
    }

    // Avisos de lo que se va a crear
    if (category && !lookups.categories.has(normalize(category))) info(`Categoría nueva: "${category}".`)
    if (brand && !lookups.brands.has(normalize(brand))) info(`Marca nueva: "${brand}".`)

    // Slug unico para productos nuevos
    let slug = ""
    if (action === "create" && name) {
      const base = slugify(name) || slugify(sku) || "producto"
      slug = base
      for (let n = 2; lookups.slugs.has(slug) || plannedSlugs.has(slug); n++) slug = `${base}-${n}`
      plannedSlugs.add(slug)
    }

    const stock = isVariable
      ? variants.reduce((total, variant) => total + (variant.stock ?? 0), 0)
      : simpleStock ?? 0
    const hasError = messages.some((message) => message.type === "error")
    products.push({
      sku,
      name: name || sku,
      action,
      rows: group.map((row) => row.row),
      status: hasError ? "error" : messages.some((message) => message.type === "warning") ? "warning" : "ok",
      messages,
      variantCount: variants.length,
      stock,
      price: price ?? undefined,
      category,
      brand,
      isVariable,
      existingId: existing?.id,
      description: first("description"),
      model,
      gender: genderValue === "invalid" ? undefined : genderValue,
      sizeType,
      comparePrice: comparePrice === null ? undefined : comparePrice,
      featured: parseYesNo(first("featured")),
      isNew: parseYesNo(first("isNew")),
      variants,
      ...(slug ? { slug } : {}),
    } as PlannedProduct & { slug?: string })
  }

  // Filas sin referencia
  for (const row of noSku) {
    products.push({
      sku: "",
      name: row.values.name ?? "(sin nombre)",
      action: "create",
      rows: [row.row],
      status: "error",
      messages: [{ type: "error", text: "Falta la Referencia.", row: row.row }],
      variantCount: 0,
      stock: 0,
      isVariable: false,
      variants: [],
    })
  }

  return { products, lookups }
}

export async function previewImport(rows: RawRow[], fileErrors: string[] = []): Promise<ImportPreview> {
  const { products, lookups } = await planImport(rows)
  const valid = products.filter((item) => item.status !== "error")
  const unique = (values: (string | undefined)[], existing: Map<string, unknown>) => {
    const seen = new Map<string, string>()
    values.forEach((value) => {
      if (value && !existing.has(normalize(value)) && !seen.has(normalize(value))) seen.set(normalize(value), value)
    })
    return [...seen.values()]
  }
  return {
    summary: {
      rows: rows.length,
      products: products.length,
      create: valid.filter((item) => item.action === "create").length,
      update: valid.filter((item) => item.action === "update").length,
      withErrors: products.filter((item) => item.status === "error").length,
      newCategories: unique(valid.map((item) => item.category), lookups.categories),
      newBrands: unique(valid.map((item) => item.brand), lookups.brands),
      newModels: [],
    },
    // Solo los datos que necesita la pantalla
    items: products.map((item) => ({
      sku: item.sku,
      name: item.name,
      action: item.action,
      rows: item.rows,
      status: item.status,
      messages: item.messages,
      variantCount: item.variantCount,
      stock: item.stock,
      price: item.price,
      category: item.category,
      brand: item.brand,
      isVariable: item.isVariable,
    })),
    fileErrors,
  }
}

// ---------------------------------------------------------------------------
// Importacion
// ---------------------------------------------------------------------------

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  failed: { sku: string; name: string; error: string }[]
  newCategories: number
  newBrands: number
}

export async function runImport(rows: RawRow[]): Promise<ImportResult> {
  const { products, lookups } = await planImport(rows)
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: [], newCategories: 0, newBrands: 0 }

  const ensureCategory = async (name: string) => {
    const found = lookups.categories.get(normalize(name))
    if (found) return found.id
    const slugBase = slugify(name) || "categoria"
    let slug = slugBase
    for (let n = 2; await prisma.category.findUnique({ where: { slug } }); n++) slug = `${slugBase}-${n}`
    const created = await prisma.category.create({ data: { name, slug, variantType: guessVariantType(name) } })
    lookups.categories.set(normalize(name), created)
    result.newCategories++
    return created.id
  }
  const ensureBrand = async (name: string) => {
    const found = lookups.brands.get(normalize(name))
    if (found) return found.id
    const slugBase = slugify(name) || "marca"
    let slug = slugBase
    for (let n = 2; await prisma.brand.findUnique({ where: { slug } }); n++) slug = `${slugBase}-${n}`
    const created = await prisma.brand.create({ data: { name, slug } })
    lookups.brands.set(normalize(name), created)
    result.newBrands++
    return created.id
  }
  const ensureModel = async (name: string, brandId: string) => {
    const key = `${brandId}|${normalize(name)}`
    const found = lookups.models.get(key)
    if (found) return found.id
    const created = await prisma.productModel.upsert({
      where: { brandId_slug: { brandId, slug: slugify(name) } },
      update: {},
      create: { name, slug: slugify(name), brandId },
    })
    lookups.models.set(key, created)
    return created.id
  }

  for (const item of products as (PlannedProduct & { slug?: string })[]) {
    if (item.status === "error") {
      result.skipped++
      continue
    }
    try {
      const categoryId = item.category ? await ensureCategory(item.category) : undefined
      const brandId = item.brand ? await ensureBrand(item.brand) : undefined
      const existing = item.existingId ? lookups.products.get(normalize(item.sku)) : undefined
      const modelBrandId = brandId ?? (existing ? (await prisma.product.findUnique({ where: { id: existing.id }, select: { brandId: true } }))?.brandId : undefined)
      const modelId = item.model && modelBrandId ? await ensureModel(item.model, modelBrandId) : undefined

      // Variantes: se actualizan las que coinciden (conservando sus fotos) y se agregan las nuevas
      const fileVariants = new Map(item.variants.map((variant) => [variantKey(variant.color, variant.size), variant]))
      const merged: VariantInput[] = []
      for (const current of existing?.variants ?? []) {
        const incoming = fileVariants.get(variantKey(current.color, current.size))
        if (incoming) fileVariants.delete(variantKey(current.color, current.size))
        merged.push({
          id: current.id,
          size: current.size ?? undefined,
          color: current.color ?? undefined,
          price: incoming?.price !== undefined ? incoming.price : current.price === null ? null : Number(current.price),
          stock: incoming?.stock !== undefined ? incoming.stock : current.stock,
          images: current.images,
        })
      }
      for (const variant of item.variants) {
        if (!fileVariants.has(variantKey(variant.color, variant.size))) continue
        const colorImages =
          merged.find((current) => normalize(current.color ?? "") === normalize(variant.color ?? "") && current.images.length)
            ?.images ?? []
        merged.push({ size: variant.size, color: variant.color, price: variant.price ?? null, stock: variant.stock ?? 0, images: colorImages })
      }
      // Tallas en orden y colores en el orden del archivo
      const colorOrder = [...new Set(merged.map((variant) => normalize(variant.color ?? "")))]
      merged.sort(
        (a, b) =>
          colorOrder.indexOf(normalize(a.color ?? "")) - colorOrder.indexOf(normalize(b.color ?? "")) ||
          compareSizes(a.size ?? "", b.size ?? "")
      )
      const variantStock = merged.reduce((total, variant) => total + variant.stock, 0)

      await prisma.$transaction(async (tx) => {
        if (!existing) {
          const created = await tx.product.create({
            data: {
              name: item.name,
              slug: item.slug!,
              sku: item.sku,
              description: item.description ?? "",
              price: item.price!,
              comparePrice: item.comparePrice ?? null,
              stock: item.isVariable ? variantStock : item.stock,
              images: [],
              isNew: item.isNew ?? false,
              isFeatured: item.featured ?? false,
              categoryId: categoryId!,
              brandId: brandId!,
              modelId: modelId ?? null,
              gender: item.gender ?? null,
              sizeType: item.isVariable ? item.sizeType ?? "NONE" : "NONE",
            },
          })
          if (item.isVariable) await syncVariants(tx, created.id, merged)
        } else {
          if (item.isVariable) await syncVariants(tx, existing.id, merged)
          await tx.product.update({
            where: { id: existing.id },
            data: {
              // Las celdas vacias no cambian el dato actual
              name: item.name || undefined,
              description: item.description,
              price: item.price,
              comparePrice: item.comparePrice,
              stock: item.isVariable ? variantStock : item.variants.length === 0 && rowsHaveStock(rows, item) ? item.stock : undefined,
              isNew: item.isNew,
              isFeatured: item.featured,
              categoryId,
              brandId,
              modelId,
              gender: item.gender,
              sizeType: item.isVariable ? item.sizeType : undefined,
            },
          })
        }
      })
      if (existing) result.updated++
      else result.created++
    } catch (error) {
      console.error("Error importing product", item.sku, error)
      result.failed.push({ sku: item.sku, name: item.name, error: "No se pudo guardar este producto." })
    }
  }

  return result
}

// En un producto simple solo se cambia el stock si la celda Stock tiene un valor
function rowsHaveStock(rows: RawRow[], item: ImportItem) {
  return rows.some((row) => item.rows.includes(row.row) && row.values.stock)
}

export { moneyText }
